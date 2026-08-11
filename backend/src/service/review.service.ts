import { Config, Destroy, Init, Provide } from "@midwayjs/core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  CreateReviewInput,
  Review,
  ReviewListResponse,
} from "../interface";

type ReviewRow = {
  id: number;
  user_id: number;
  order_id: number;
  item_id: number;
  seller_id: number;
  rating: number;
  comment: string;
  username: string;
  created_at: string;
};

@Provide()
export class ReviewService {
  @Config("reviewDatabase.path")
  databasePath: string;

  private database: DatabaseSync | null = null;

  @Init()
  async initialize() {
    try {
      const absolutePath = resolve(process.cwd(), this.databasePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      this.database = new DatabaseSync(absolutePath);
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          order_id INTEGER NOT NULL,
          item_id INTEGER NOT NULL,
          seller_id INTEGER NOT NULL,
          rating INTEGER NOT NULL,
          comment TEXT NOT NULL DEFAULT '',
          username TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(order_id, item_id)
        )
      `);
    } catch {
      this.database = null;
    }
  }

  createReview(
    userId: number,
    username: string,
    input: CreateReviewInput,
  ): Review {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    // Validate rating
    if (
      !Number.isInteger(input.rating) ||
      input.rating < 1 ||
      input.rating > 10
    ) {
      throw new Error("评分必须在 1-10 之间");
    }

    // Check for duplicate review
    const existing = this.database
      .prepare("SELECT id FROM reviews WHERE order_id = ? AND item_id = ?")
      .get(input.orderId, input.itemId) as { id: number } | undefined;

    if (existing) {
      throw new Error("已评价");
    }

    const result = this.database
      .prepare(
        "INSERT INTO reviews (user_id, order_id, item_id, seller_id, rating, comment, username) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        userId,
        input.orderId,
        input.itemId,
        0,
        input.rating,
        input.comment || "",
        username,
      );

    const row = this.database
      .prepare(
        "SELECT id, user_id, order_id, item_id, seller_id, rating, comment, username, created_at FROM reviews WHERE id = ?",
      )
      .get(result.lastInsertRowid) as ReviewRow;

    return mapReview(row);
  }

  setSellerId(reviewId: number, sellerId: number): void {
    if (!this.database) {
      return;
    }

    this.database
      .prepare("UPDATE reviews SET seller_id = ? WHERE id = ?")
      .run(sellerId, reviewId);
  }

  listReviewsByItem(
    itemId: number,
    page: number = 1,
    pageSize: number = 20,
  ): ReviewListResponse {
    if (!this.database) {
      return { data: [], total: 0, totalPages: 1 };
    }

    const countRow = this.database
      .prepare("SELECT COUNT(*) AS total FROM reviews WHERE item_id = ?")
      .get(itemId) as { total: number };

    const total = countRow.total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    const rows = this.database
      .prepare(
        "SELECT id, user_id, order_id, item_id, seller_id, rating, comment, username, created_at FROM reviews WHERE item_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      )
      .all(itemId, pageSize, offset) as ReviewRow[];

    return {
      data: rows.map(mapReview),
      total,
      totalPages,
    };
  }

  listReviewsBySeller(
    sellerId: number,
    days: number = 30,
    page: number = 1,
    pageSize: number = 20,
  ): ReviewListResponse {
    if (!this.database) {
      return { data: [], total: 0, totalPages: 1 };
    }

    const countRow = this.database
      .prepare(
        "SELECT COUNT(*) AS total FROM reviews WHERE seller_id = ? AND created_at >= datetime('now', ?)",
      )
      .get(sellerId, `-${days} days`) as { total: number };

    const total = countRow.total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    const rows = this.database
      .prepare(
        "SELECT id, user_id, order_id, item_id, seller_id, rating, comment, username, created_at FROM reviews WHERE seller_id = ? AND created_at >= datetime('now', ?) ORDER BY created_at DESC LIMIT ? OFFSET ?",
      )
      .all(sellerId, `-${days} days`, pageSize, offset) as ReviewRow[];

    return {
      data: rows.map(mapReview),
      total,
      totalPages,
    };
  }

  hasReviewed(userId: number, orderId: number, itemId: number): boolean {
    if (!this.database) {
      return false;
    }

    const row = this.database
      .prepare(
        "SELECT id FROM reviews WHERE user_id = ? AND order_id = ? AND item_id = ?",
      )
      .get(userId, orderId, itemId) as { id: number } | undefined;

    return row !== undefined;
  }

  @Destroy()
  async close() {
    if (this.database) {
      this.database.close();
    }
  }
}

function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    userId: row.user_id,
    orderId: row.order_id,
    itemId: row.item_id,
    sellerId: row.seller_id,
    rating: row.rating,
    comment: row.comment,
    username: row.username,
    createdAt: new Date(`${row.created_at.replace(" ", "T")}Z`).toISOString(),
  };
}
