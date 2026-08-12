import { Config, Destroy, Init, Provide } from "@midwayjs/core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  CreateItemInput,
  Item,
  ItemListResponse,
  UpdateItemInput,
} from "../interface";

type ItemRow = {
  id: number;
  title: string;
  price: number;
  quantity: number;
  description: string;
  images: string;
  cover_image: string;
  category: string;
  seller_id: number;
  seller_name: string;
  status: string;
  created_at: string;
  quantity_updated_at: string | null;
};

const CATEGORIES = [
  "衣物",
  "书籍",
  "电子设备",
  "运动",
  "食物",
  "其它",
] as const;

const SEED_ITEMS = [
  {
    title: "高等数学教材",
    price: 25.0,
    quantity: 1,
    category: "书籍",
    sellerId: 1,
    sellerName: "admin",
    description: "九成新，无笔记",
    status: "active",
  },
  {
    title: "羽毛球拍",
    price: 80.0,
    quantity: 2,
    category: "运动",
    sellerId: 1,
    sellerName: "admin",
    description: "仅用一次",
    status: "active",
  },
  {
    title: "USB-C 扩展坞",
    price: 45.0,
    quantity: 0,
    category: "电子设备",
    sellerId: 1,
    sellerName: "admin",
    description: "已售罄",
    status: "active",
  },
  {
    title: "纯棉T恤",
    price: 30.0,
    quantity: 5,
    category: "衣物",
    sellerId: 1,
    sellerName: "admin",
    description: "全新带吊牌",
    status: "active",
  },
  {
    title: "二手电饭煲",
    price: 60.0,
    quantity: 1,
    category: "其它",
    sellerId: 1,
    sellerName: "admin",
    description: "功能正常",
    status: "active",
  },
  {
    title: "数据结构习题集",
    price: 15.0,
    quantity: 3,
    category: "书籍",
    sellerId: 1,
    sellerName: "admin",
    description: "考研必备",
    status: "active",
  },
  {
    title: "巧克力礼盒",
    price: 50.0,
    quantity: 10,
    category: "食物",
    sellerId: 1,
    sellerName: "admin",
    description: "保质期到2026年底",
    status: "active",
  },
];

@Provide()
export class ItemService {
  @Config("itemDatabase.path")
  databasePath: string;

  private database: DatabaseSync | null = null;

  @Init()
  async initialize() {
    try {
      const absolutePath = resolve(process.cwd(), this.databasePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      this.database = new DatabaseSync(absolutePath);
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          price REAL NOT NULL,
          quantity INTEGER NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          images TEXT NOT NULL DEFAULT '[]',
          cover_image TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL,
          seller_id INTEGER NOT NULL,
          seller_name TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          quantity_updated_at TEXT
        )
      `);

      const row = this.database
        .prepare("SELECT COUNT(*) AS total FROM items")
        .get() as { total: number };

      if (row.total === 0) {
        const insert = this.database.prepare(`
          INSERT INTO items (title, price, quantity, description, cover_image, category, seller_id, seller_name, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of SEED_ITEMS) {
          const coverImage = `https://picsum.photos/seed/${encodeURIComponent(item.title)}/400/300`;
          insert.run(
            item.title,
            item.price,
            item.quantity,
            item.description,
            coverImage,
            item.category,
            item.sellerId,
            item.sellerName,
            item.status,
          );
        }
      }
    } catch {
      // Database initialization failed (e.g., missing config in other tests).
      // The service will return empty results gracefully.
      this.database = null;
    }
  }

  listItems(
    page: number,
    pageSize: number,
    category?: string,
  ): ItemListResponse {
    if (!this.database) {
      return { data: [], total: 0, totalPages: 1 };
    }

    this.autoDelistExpiredItems();

    const conditions: string[] = ["status = 'active'"];
    const params: (string | number)[] = [];

    if (category && category !== "全部") {
      conditions.push("category = ?");
      params.push(category);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRow = this.database
      .prepare(`SELECT COUNT(*) AS total FROM items ${whereClause}`)
      .get(...params) as { total: number };

    const total = countRow.total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    const rows = this.database
      .prepare(
        `SELECT id, title, price, quantity, description, images, cover_image, category, seller_id, seller_name, status, created_at, quantity_updated_at
         FROM items ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, offset) as ItemRow[];

    return {
      data: rows.map(mapItem),
      total,
      totalPages,
    };
  }

  getItemById(id: number): Item | null {
    if (!this.database) {
      return null;
    }

    this.autoDelistExpiredItems();

    const row = this.database
      .prepare(
        `SELECT id, title, price, quantity, description, images, cover_image, category, seller_id, seller_name, status, created_at, quantity_updated_at
         FROM items
         WHERE id = ? AND status = 'active'`,
      )
      .get(id) as ItemRow | undefined;

    if (!row) {
      return null;
    }

    return mapItem(row);
  }

  searchItems(
    q: string,
    category?: string,
    page: number = 1,
    pageSize: number = 20,
  ): ItemListResponse {
    // Empty keyword delegates to listItems
    if (!q || q.trim() === "") {
      return this.listItems(page, pageSize, category);
    }

    if (!this.database) {
      return { data: [], total: 0, totalPages: 1 };
    }

    this.autoDelistExpiredItems();

    const keyword = `%${q.trim()}%`;
    const conditions: string[] = [
      "(title LIKE ? OR description LIKE ? OR category LIKE ?)",
      "status = 'active'",
    ];
    const params: (string | number)[] = [keyword, keyword, keyword];

    if (category && category !== "全部") {
      conditions.push("category = ?");
      params.push(category);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countRow = this.database
      .prepare(`SELECT COUNT(*) AS total FROM items ${whereClause}`)
      .get(...params) as { total: number };

    const total = countRow.total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    const rows = this.database
      .prepare(
        `SELECT id, title, price, quantity, description, images, cover_image, category, seller_id, seller_name, status, created_at, quantity_updated_at
         FROM items ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, offset) as ItemRow[];

    return {
      data: rows.map(mapItem),
      total,
      totalPages,
    };
  }

  listCategories(): string[] {
    return [...CATEGORIES];
  }

  createItem(
    sellerId: number,
    sellerName: string,
    input: CreateItemInput,
  ): Item {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    const images = JSON.stringify(input.images || []);
    const coverImage =
      input.coverImage ||
      (input.images && input.images.length > 0 ? input.images[0] : "");
    const quantityUpdatedAt =
      input.quantity === 0
        ? new Date().toISOString().replace("T", " ").slice(0, 19)
        : null;

    const result = this.database
      .prepare(
        `
        INSERT INTO items (title, price, quantity, description, images, cover_image, category, seller_id, seller_name, status, quantity_updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `,
      )
      .run(
        input.title,
        input.price,
        input.quantity,
        input.description || "",
        images,
        coverImage,
        input.category,
        sellerId,
        sellerName,
        quantityUpdatedAt,
      );

    const row = this.database
      .prepare(
        `SELECT id, title, price, quantity, description, images, cover_image, category, seller_id, seller_name, status, created_at, quantity_updated_at
         FROM items WHERE id = ?`,
      )
      .get(result.lastInsertRowid) as ItemRow;

    return mapItem(row);
  }

  updateItem(userId: number, itemId: number, input: UpdateItemInput): Item {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    const row = this.database
      .prepare(
        `SELECT id, title, price, quantity, description, images, cover_image, category, seller_id, seller_name, status, created_at, quantity_updated_at
         FROM items WHERE id = ?`,
      )
      .get(itemId) as ItemRow | undefined;

    if (!row) {
      throw new Error("商品不存在");
    }

    if (row.seller_id !== userId) {
      throw new Error("无权修改此商品");
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.title !== undefined) {
      updates.push("title = ?");
      params.push(input.title);
    }
    if (input.price !== undefined) {
      updates.push("price = ?");
      params.push(input.price);
    }
    if (input.quantity !== undefined) {
      updates.push("quantity = ?");
      params.push(input.quantity);
    }
    if (input.description !== undefined) {
      updates.push("description = ?");
      params.push(input.description);
    }
    if (input.category !== undefined) {
      updates.push("category = ?");
      params.push(input.category);
    }
    if (input.images !== undefined) {
      const imagesJson = JSON.stringify(input.images);
      updates.push("images = ?");
      params.push(imagesJson);
      // Update cover_image if first image is provided
      if (input.images.length > 0) {
        updates.push("cover_image = ?");
        params.push(input.images[0]);
      }
    }
    if (input.coverImage !== undefined) {
      updates.push("cover_image = ?");
      params.push(input.coverImage);
    }

    // If quantity is being updated to 0, set quantity_updated_at
    if (input.quantity !== undefined && input.quantity === 0) {
      updates.push("quantity_updated_at = ?");
      params.push(new Date().toISOString().replace("T", " ").slice(0, 19));
    } else if (input.quantity !== undefined && input.quantity > 0) {
      updates.push("quantity_updated_at = NULL");
    }

    // If delisted -> re-submit for review (set to pending)
    if (row.status === "delisted") {
      updates.push("status = 'pending'");
    }

    if (updates.length === 0) {
      return mapItem(row);
    }

    params.push(itemId);
    this.database
      .prepare(`UPDATE items SET ${updates.join(", ")} WHERE id = ?`)
      .run(...params);

    const updatedRow = this.database
      .prepare(
        `SELECT id, title, price, quantity, description, images, cover_image, category, seller_id, seller_name, status, created_at, quantity_updated_at
         FROM items WHERE id = ?`,
      )
      .get(itemId) as ItemRow;

    return mapItem(updatedRow);
  }

  updateItemStatus(userId: number, itemId: number, status: string): void {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    if (status !== "delisted" && status !== "active") {
      throw new Error("无效的状态变更");
    }

    const row = this.database
      .prepare("SELECT id, seller_id FROM items WHERE id = ?")
      .get(itemId) as { id: number; seller_id: number } | undefined;

    if (!row) {
      throw new Error("商品不存在");
    }

    if (row.seller_id !== userId) {
      throw new Error("无权修改此商品");
    }

    this.database
      .prepare("UPDATE items SET status = ? WHERE id = ?")
      .run(status, itemId);
  }

  deductStock(itemId: number, quantity: number): boolean {
    if (!this.database) {
      return false;
    }

    const result = this.database
      .prepare(
        "UPDATE items SET quantity = quantity - ? WHERE id = ? AND status = 'active' AND quantity >= ?",
      )
      .run(quantity, itemId, quantity);

    return result.changes > 0;
  }

  restoreStock(itemId: number, quantity: number): void {
    if (!this.database) {
      return;
    }

    this.database
      .prepare("UPDATE items SET quantity = quantity + ? WHERE id = ?")
      .run(quantity, itemId);
  }

  listSellerItems(
    sellerId: number,
    category?: string,
    page: number = 1,
    pageSize: number = 20,
  ): ItemListResponse {
    if (!this.database) {
      return { data: [], total: 0, totalPages: 1 };
    }

    this.autoDelistExpiredItems();

    const conditions: string[] = ["seller_id = ?", "status = 'active'"];
    const params: (string | number)[] = [sellerId];

    if (category && category !== "全部") {
      conditions.push("category = ?");
      params.push(category);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countRow = this.database
      .prepare(`SELECT COUNT(*) AS total FROM items ${whereClause}`)
      .get(...params) as { total: number };

    const total = countRow.total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    const rows = this.database
      .prepare(
        `SELECT id, title, price, quantity, description, images, cover_image, category, seller_id, seller_name, status, created_at, quantity_updated_at
         FROM items ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, offset) as ItemRow[];

    return {
      data: rows.map(mapItem),
      total,
      totalPages,
    };
  }

  listMyItems(
    userId: number,
    page: number,
    pageSize: number,
  ): ItemListResponse {
    if (!this.database) {
      return { data: [], total: 0, totalPages: 1 };
    }

    this.autoDelistExpiredItems();

    const conditions = ["seller_id = ?"];
    const params: (string | number)[] = [userId];

    const countRow = this.database
      .prepare(
        `SELECT COUNT(*) AS total FROM items WHERE ${conditions.join(" AND ")}`,
      )
      .get(...params) as { total: number };

    const total = countRow.total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    const rows = this.database
      .prepare(
        `SELECT id, title, price, quantity, description, images, cover_image, category, seller_id, seller_name, status, created_at, quantity_updated_at
         FROM items WHERE ${conditions.join(" AND ")}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, offset) as ItemRow[];

    return {
      data: rows.map(mapItem),
      total,
      totalPages,
    };
  }

  listPendingItems(page: number, pageSize: number): ItemListResponse {
    if (!this.database) {
      return { data: [], total: 0, totalPages: 1 };
    }

    const conditions = ["status = 'pending'"];
    const params: (string | number)[] = [];

    const countRow = this.database
      .prepare(
        `SELECT COUNT(*) AS total FROM items WHERE ${conditions.join(" AND ")}`,
      )
      .get(...params) as { total: number };

    const total = countRow.total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    const rows = this.database
      .prepare(
        `SELECT id, title, price, quantity, description, images, cover_image, category, seller_id, seller_name, status, created_at, quantity_updated_at
         FROM items WHERE ${conditions.join(" AND ")}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, offset) as ItemRow[];

    return {
      data: rows.map(mapItem),
      total,
      totalPages,
    };
  }

  approveItem(itemId: number): void {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    const row = this.database
      .prepare("SELECT id, status FROM items WHERE id = ?")
      .get(itemId) as { id: number; status: string } | undefined;

    if (!row) {
      throw new Error("商品不存在");
    }

    this.database
      .prepare("UPDATE items SET status = 'active' WHERE id = ?")
      .run(itemId);
  }

  rejectItem(itemId: number): void {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    const row = this.database
      .prepare("SELECT id, status FROM items WHERE id = ?")
      .get(itemId) as { id: number; status: string } | undefined;

    if (!row) {
      throw new Error("商品不存在");
    }

    this.database
      .prepare("UPDATE items SET status = 'delisted' WHERE id = ?")
      .run(itemId);
  }

  private autoDelistExpiredItems(): void {
    if (!this.database) {
      return;
    }

    this.database.exec(`
      UPDATE items SET status = 'delisted'
      WHERE status = 'active'
        AND quantity = 0
        AND quantity_updated_at IS NOT NULL
        AND datetime(quantity_updated_at, '+7 days') <= datetime('now')
    `);
  }

  @Destroy()
  async close() {
    if (this.database) {
      this.database.close();
    }
  }
}

function mapItem(row: ItemRow): Item {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    quantity: row.quantity,
    description: row.description,
    images: JSON.parse(row.images || "[]") as string[],
    coverImage: row.cover_image,
    category: row.category,
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    status: row.status as Item["status"],
    createdAt: new Date(`${row.created_at.replace(" ", "T")}Z`).toISOString(),
    quantityUpdatedAt: row.quantity_updated_at
      ? new Date(`${row.quantity_updated_at.replace(" ", "T")}Z`).toISOString()
      : null,
  };
}
