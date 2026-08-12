import { Config, Destroy, Init, Inject, Provide } from "@midwayjs/core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AccountService } from "./account.service";
import { ItemService } from "./item.service";
import { OrderService } from "./order.service";
import type { CartItem } from "../interface";

type CartRow = {
  id: number;
  user_id: number;
  item_id: number;
  quantity: number;
  selected: number;
  created_at: string;
};

@Provide()
export class CartService {
  @Config("tradeDatabase.path")
  databasePath: string;

  private database: DatabaseSync | null = null;

  @Inject()
  accountService: AccountService;

  @Inject()
  itemService: ItemService;

  @Inject()
  orderService: OrderService;

  @Init()
  async initialize() {
    const absolutePath = resolve(process.cwd(), this.databasePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    this.database = new DatabaseSync(absolutePath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        selected INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, item_id)
      )
    `);
  }

  addToCart(userId: number, itemId: number, quantity: number): void {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    // Check if item exists and is active
    const item = this.itemService.getItemById(itemId);
    if (!item) {
      throw new Error("商品不存在或已下架");
    }

    if (item.quantity < 1) {
      throw new Error("商品已售罄，无法加入购物车");
    }

    // Try to update existing row first
    const result = this.database
      .prepare(
        "UPDATE cart_items SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?",
      )
      .run(quantity, userId, itemId);

    if (result.changes === 0) {
      // Insert new row
      this.database
        .prepare(
          "INSERT INTO cart_items (user_id, item_id, quantity) VALUES (?, ?, ?)",
        )
        .run(userId, itemId, quantity);
    }
  }

  listCart(userId: number): CartItem[] {
    if (!this.database) {
      return [];
    }

    const rows = this.database
      .prepare(
        "SELECT id, user_id, item_id, quantity, selected, created_at FROM cart_items WHERE user_id = ? ORDER BY created_at DESC",
      )
      .all(userId) as CartRow[];

    const cartItems: CartItem[] = [];

    for (const row of rows) {
      const item = this.itemService.getItemById(row.item_id);
      cartItems.push({
        id: row.id,
        userId: row.user_id,
        itemId: row.item_id,
        quantity: row.quantity,
        selected: row.selected === 1,
        createdAt: new Date(
          `${row.created_at.replace(" ", "T")}Z`,
        ).toISOString(),
        title: item?.title ?? "（商品已下架）",
        price: item?.price ?? 0,
        coverImage: item?.coverImage ?? "",
        stock: item?.quantity ?? 0,
        status: item?.status ?? "delisted",
      });
    }

    return cartItems;
  }

  removeFromCart(cartItemId: number): boolean {
    if (!this.database) {
      return false;
    }

    const result = this.database
      .prepare("DELETE FROM cart_items WHERE id = ?")
      .run(cartItemId);

    return result.changes > 0;
  }

  toggleSelect(cartItemId: number, selected: boolean): boolean {
    if (!this.database) {
      return false;
    }

    const result = this.database
      .prepare("UPDATE cart_items SET selected = ? WHERE id = ?")
      .run(selected ? 1 : 0, cartItemId);

    return result.changes > 0;
  }

  checkout(userId: number, paymentPassword: string): { orderId: number } {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    // 1. Get all selected cart items
    const rows = this.database
      .prepare(
        "SELECT id, user_id, item_id, quantity, selected, created_at FROM cart_items WHERE user_id = ? AND selected = 1",
      )
      .all(userId) as CartRow[];

    if (rows.length === 0) {
      throw new Error("请先勾选要结算的商品");
    }

    // 2. Verify each item is still in stock
    const checkoutItems: {
      itemId: number;
      quantity: number;
      sellerId: number;
      sellerName: string;
      title: string;
      price: number;
      coverImage: string;
      cartItemId: number;
    }[] = [];

    for (const row of rows) {
      const item = this.itemService.getItemById(row.item_id);
      if (!item) {
        throw new Error(`商品 ${row.item_id} 不存在或已下架`);
      }
      if (item.quantity < row.quantity) {
        throw new Error(
          `商品"${item.title}"库存不足，当前库存 ${item.quantity}，需要 ${row.quantity}`,
        );
      }
      checkoutItems.push({
        itemId: row.item_id,
        quantity: row.quantity,
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        title: item.title,
        price: item.price,
        coverImage: item.coverImage,
        cartItemId: row.id,
      });
    }

    // 3. Calculate total price
    const totalPrice = checkoutItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // 4. Verify payment password
    const isPasswordValid = this.accountService.verifyPaymentPassword(
      userId,
      paymentPassword,
    );
    if (!isPasswordValid) {
      throw new Error("支付密码错误");
    }

    // 5. Verify balance
    const account = this.accountService.getOrCreateAccount(userId);
    if (account.balance < totalPrice) {
      throw new Error("余额不足");
    }

    // 6. Execute destructive operations with rollback support
    // Track what was done for rollback
    const deductedItems: { itemId: number; quantity: number }[] = [];
    let buyerBalanceAdjusted = false;
    const sellerAdjustments: { sellerId: number; amount: number }[] = [];
    let orderCreated = false;
    let orderId = 0;

    try {
      // 6a. Deduct stock for each item
      for (const item of checkoutItems) {
        const success = this.itemService.deductStock(item.itemId, item.quantity);
        if (!success) {
          throw new Error(`商品"${item.title}"库存不足`);
        }
        deductedItems.push({ itemId: item.itemId, quantity: item.quantity });
      }

      // 6b. Deduct buyer balance (atomic)
      this.accountService.adjustBalance(userId, -totalPrice);
      buyerBalanceAdjusted = true;

      // 6c. Add seller balance (atomic, grouped by seller)
      const sellerTotals = new Map<
        number,
        { total: number; sellerName: string }
      >();
      for (const item of checkoutItems) {
        const existing = sellerTotals.get(item.sellerId) ?? {
          total: 0,
          sellerName: item.sellerName,
        };
        existing.total += item.price * item.quantity;
        sellerTotals.set(item.sellerId, existing);
      }

      for (const [sellerId, sellerInfo] of sellerTotals) {
        this.accountService.adjustBalance(sellerId, sellerInfo.total);
        sellerAdjustments.push({ sellerId, amount: sellerInfo.total });
      }

      // 6d. Create order + order_items
      const orderItems = checkoutItems.map((item) => ({
        itemId: item.itemId,
        sellerId: item.sellerId,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        coverImage: item.coverImage,
      }));

      orderId = this.orderService.createOrder(userId, totalPrice, orderItems);
      orderCreated = true;

      // 6e. Delete checked cart items
      const cartItemIds = checkoutItems.map((item) => item.cartItemId);
      for (const cartItemId of cartItemIds) {
        this.database
          .prepare("DELETE FROM cart_items WHERE id = ?")
          .run(cartItemId);
      }
    } catch (err) {
      // Rollback: undo all completed operations in reverse order
      if (orderCreated) {
        // Order created but we can't easily delete it — the user can see a failed order
        // This is a known limitation with distributed compensation
      }

      // Reverse seller balance adjustments
      for (const adj of sellerAdjustments) {
        this.accountService.adjustBalance(adj.sellerId, -adj.amount);
      }

      // Reverse buyer balance deduction
      if (buyerBalanceAdjusted) {
        this.accountService.adjustBalance(userId, totalPrice);
      }

      // Restore stock
      for (const item of deductedItems) {
        this.itemService.restoreStock(item.itemId, item.quantity);
      }

      throw err;
    }

    return { orderId };
  }

  buyNow(
    userId: number,
    itemId: number,
    quantity: number,
    paymentPassword: string,
  ): { orderId: number } {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    // 1. Validate item
    const item = this.itemService.getItemById(itemId);
    if (!item) {
      throw new Error("商品不存在或已下架");
    }

    if (item.quantity < quantity) {
      throw new Error("商品已售罄");
    }

    // 2. Calculate price
    const totalPrice = item.price * quantity;

    // 3. Verify payment password
    const isPasswordValid = this.accountService.verifyPaymentPassword(
      userId,
      paymentPassword,
    );
    if (!isPasswordValid) {
      throw new Error("支付密码错误");
    }

    // 4. Verify balance
    const account = this.accountService.getOrCreateAccount(userId);
    if (account.balance < totalPrice) {
      throw new Error("余额不足");
    }

    // 5. Execute destructive operations with rollback support
    let stockDeducted = false;
    let buyerBalanceAdjusted = false;
    let sellerBalanceAdjusted = false;
    let orderId = 0;

    try {
      // 5a. Deduct stock
      const success = this.itemService.deductStock(itemId, quantity);
      if (!success) {
        throw new Error("商品已售罄");
      }
      stockDeducted = true;

      // 5b. Deduct buyer balance (atomic)
      this.accountService.adjustBalance(userId, -totalPrice);
      buyerBalanceAdjusted = true;

      // 5c. Add seller balance (atomic)
      this.accountService.adjustBalance(item.sellerId, totalPrice);
      sellerBalanceAdjusted = true;

      // 5d. Create order
      orderId = this.orderService.createOrder(userId, totalPrice, [
        {
          itemId: item.id,
          sellerId: item.sellerId,
          title: item.title,
          price: item.price,
          quantity,
          coverImage: item.coverImage,
        },
      ]);
    } catch (err) {
      // Rollback: undo completed operations in reverse order
      if (sellerBalanceAdjusted) {
        this.accountService.adjustBalance(item.sellerId, -totalPrice);
      }
      if (buyerBalanceAdjusted) {
        this.accountService.adjustBalance(userId, totalPrice);
      }
      if (stockDeducted) {
        this.itemService.restoreStock(itemId, quantity);
      }
      throw err;
    }

    return { orderId };
  }

  @Destroy()
  async close() {
    if (this.database) {
      this.database.close();
    }
  }
}
