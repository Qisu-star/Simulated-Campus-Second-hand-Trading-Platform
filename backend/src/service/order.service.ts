import { Config, Destroy, Init, Provide } from "@midwayjs/core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Order, OrderItem, OrderListResponse } from "../interface";

type OrderRow = {
  id: number;
  user_id: number;
  total_price: number;
  status: string;
  created_at: string;
};

type OrderItemRow = {
  id: number;
  order_id: number;
  item_id: number;
  seller_id: number;
  title: string;
  price: number;
  quantity: number;
  cover_image: string;
};

export interface CreateOrderItemInput {
  itemId: number;
  sellerId: number;
  title: string;
  price: number;
  quantity: number;
  coverImage: string;
}

@Provide()
export class OrderService {
  @Config("tradeDatabase.path")
  databasePath: string;

  private database: DatabaseSync | null = null;

  @Init()
  async initialize() {
    const absolutePath = resolve(process.cwd(), this.databasePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    this.database = new DatabaseSync(absolutePath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        total_price REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_receipt',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        cover_image TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )
    `);
  }

  createOrder(userId: number, totalPrice: number, items: CreateOrderItemInput[]): number {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    const result = this.database
      .prepare("INSERT INTO orders (user_id, total_price, status) VALUES (?, ?, 'pending_receipt')")
      .run(userId, totalPrice);

    const orderId = Number(result.lastInsertRowid);

    const insertItem = this.database.prepare(
      "INSERT INTO order_items (order_id, item_id, seller_id, title, price, quantity, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );

    for (const item of items) {
      insertItem.run(orderId, item.itemId, item.sellerId, item.title, item.price, item.quantity, item.coverImage);
    }

    return orderId;
  }

  listOrders(userId: number, page: number = 1, pageSize: number = 20): OrderListResponse {
    if (!this.database) {
      return { data: [], total: 0, totalPages: 1 };
    }

    const countRow = this.database
      .prepare("SELECT COUNT(*) AS total FROM orders WHERE user_id = ?")
      .get(userId) as { total: number };

    const total = countRow.total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    const rows = this.database
      .prepare("SELECT id, user_id, total_price, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
      .all(userId, pageSize, offset) as OrderRow[];

    return {
      data: rows.map((row) => this.mapOrder(row)),
      total,
      totalPages,
    };
  }

  listSales(userId: number, page: number = 1, pageSize: number = 20): OrderListResponse {
    if (!this.database) {
      return { data: [], total: 0, totalPages: 1 };
    }

    const countRow = this.database
      .prepare("SELECT COUNT(DISTINCT o.id) AS total FROM orders o JOIN order_items oi ON o.id = oi.order_id WHERE oi.seller_id = ?")
      .get(userId) as { total: number };

    const total = countRow.total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    // Get distinct order IDs with pagination
    const orderIdRows = this.database
      .prepare("SELECT DISTINCT o.id FROM orders o JOIN order_items oi ON o.id = oi.order_id WHERE oi.seller_id = ? ORDER BY o.created_at DESC LIMIT ? OFFSET ?")
      .all(userId, pageSize, offset) as { id: number }[];

    if (orderIdRows.length === 0) {
      return { data: [], total, totalPages };
    }

    const orderIds = orderIdRows.map((row) => row.id);

    // Fetch the orders by those IDs
    const placeholders = orderIds.map(() => "?").join(",");
    const orderRows = this.database
      .prepare(`SELECT id, user_id, total_price, status, created_at FROM orders WHERE id IN (${placeholders}) ORDER BY created_at DESC`)
      .all(...orderIds) as OrderRow[];

    return {
      data: orderRows.map((row) => this.mapOrder(row)),
      total,
      totalPages,
    };
  }

  confirmReceive(userId: number, orderId: number): void {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    // Verify the order belongs to this user
    const order = this.database
      .prepare("SELECT id, user_id, status FROM orders WHERE id = ?")
      .get(orderId) as { id: number; user_id: number; status: string } | undefined;

    if (!order) {
      throw new Error("订单不存在");
    }

    if (order.user_id !== userId) {
      throw new Error("无权操作此订单");
    }

    if (order.status !== "pending_receipt") {
      throw new Error("订单已签收");
    }

    this.database
      .prepare("UPDATE orders SET status = 'received' WHERE id = ?")
      .run(orderId);
  }

  private getOrderItems(orderId: number): OrderItem[] {
    if (!this.database) {
      return [];
    }

    const rows = this.database
      .prepare("SELECT id, order_id, item_id, seller_id, title, price, quantity, cover_image FROM order_items WHERE order_id = ?")
      .all(orderId) as OrderItemRow[];

    return rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      itemId: row.item_id,
      sellerId: row.seller_id,
      title: row.title,
      price: row.price,
      quantity: row.quantity,
      coverImage: row.cover_image,
    }));
  }

  private mapOrder(row: OrderRow): Order {
    return {
      id: row.id,
      userId: row.user_id,
      totalPrice: row.total_price,
      status: row.status as Order["status"],
      createdAt: new Date(`${row.created_at.replace(" ", "T")}Z`).toISOString(),
      items: this.getOrderItems(row.id),
    };
  }

  @Destroy()
  async close() {
    if (this.database) {
      this.database.close();
    }
  }
}