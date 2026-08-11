import { Config, Destroy, Init, Provide } from "@midwayjs/core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  FavoriteItemListResponse,
  FavoriteItemWithInfo,
  FavoriteSellerListResponse,
  FavoriteSellerWithInfo,
  ToggleFavoriteResponse,
} from "../interface";

type FavoriteRow = {
  id: number;
  user_id: number;
  item_id: number | null;
  seller_id: number | null;
  created_at: string;
};

@Provide()
export class FavoriteService {
  @Config("favoriteDatabase.path")
  databasePath: string;

  private database: DatabaseSync | null = null;

  @Init()
  async initialize() {
    try {
      const absolutePath = resolve(process.cwd(), this.databasePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      this.database = new DatabaseSync(absolutePath);
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          item_id INTEGER,
          seller_id INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    } catch {
      this.database = null;
    }
  }

  toggleFavoriteItem(userId: number, itemId: number): ToggleFavoriteResponse {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    const existing = this.database
      .prepare("SELECT id FROM favorites WHERE user_id = ? AND item_id = ?")
      .get(userId, itemId) as { id: number } | undefined;

    if (existing) {
      this.database
        .prepare("DELETE FROM favorites WHERE id = ?")
        .run(existing.id);
      return { action: "unfavorited" };
    }

    this.database
      .prepare("INSERT INTO favorites (user_id, item_id) VALUES (?, ?)")
      .run(userId, itemId);
    return { action: "favorited" };
  }

  unfavoriteItem(userId: number, itemId: number): void {
    if (!this.database) {
      return;
    }

    this.database
      .prepare("DELETE FROM favorites WHERE user_id = ? AND item_id = ?")
      .run(userId, itemId);
  }

  isItemFavorited(userId: number, itemId: number): boolean {
    if (!this.database) {
      return false;
    }

    const row = this.database
      .prepare("SELECT id FROM favorites WHERE user_id = ? AND item_id = ?")
      .get(userId, itemId) as { id: number } | undefined;

    return !!row;
  }

  isSellerFavorited(userId: number, sellerId: number): boolean {
    if (!this.database) {
      return false;
    }

    const row = this.database
      .prepare(
        "SELECT id FROM favorites WHERE user_id = ? AND seller_id = ?",
      )
      .get(userId, sellerId) as { id: number } | undefined;

    return !!row;
  }

  listFavoriteItemIds(
    userId: number,
    page: number,
    pageSize: number,
  ): { rows: Array<{ id: number; itemId: number; createdAt: string }>; total: number; totalPages: number } {
    if (!this.database) {
      return { rows: [], total: 0, totalPages: 1 };
    }

    const countRow = this.database
      .prepare(
        "SELECT COUNT(*) AS total FROM favorites WHERE user_id = ? AND item_id IS NOT NULL",
      )
      .get(userId) as { total: number };

    const total = countRow.total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    const rows = this.database
      .prepare(
        `SELECT id, user_id, item_id, created_at
         FROM favorites
         WHERE user_id = ? AND item_id IS NOT NULL
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(userId, pageSize, offset) as FavoriteRow[];

    return {
      rows: rows.map((r) => ({
        id: r.id,
        itemId: r.item_id ?? 0,
        createdAt: new Date(
          `${r.created_at.replace(" ", "T")}Z`,
        ).toISOString(),
      })),
      total,
      totalPages,
    };
  }

  toggleFavoriteSeller(
    userId: number,
    sellerId: number,
  ): ToggleFavoriteResponse {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    const existing = this.database
      .prepare(
        "SELECT id FROM favorites WHERE user_id = ? AND seller_id = ?",
      )
      .get(userId, sellerId) as { id: number } | undefined;

    if (existing) {
      this.database
        .prepare("DELETE FROM favorites WHERE id = ?")
        .run(existing.id);
      return { action: "unfavorited" };
    }

    this.database
      .prepare("INSERT INTO favorites (user_id, seller_id) VALUES (?, ?)")
      .run(userId, sellerId);
    return { action: "favorited" };
  }

  unfavoriteSeller(userId: number, sellerId: number): void {
    if (!this.database) {
      return;
    }

    this.database
      .prepare(
        "DELETE FROM favorites WHERE user_id = ? AND seller_id = ?",
      )
      .run(userId, sellerId);
  }

  listFavoriteSellerIds(
    userId: number,
    page: number,
    pageSize: number,
  ): { rows: Array<{ id: number; sellerId: number; createdAt: string }>; total: number; totalPages: number } {
    if (!this.database) {
      return { rows: [], total: 0, totalPages: 1 };
    }

    const countRow = this.database
      .prepare(
        "SELECT COUNT(*) AS total FROM favorites WHERE user_id = ? AND seller_id IS NOT NULL",
      )
      .get(userId) as { total: number };

    const total = countRow.total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    const rows = this.database
      .prepare(
        `SELECT id, user_id, seller_id, created_at
         FROM favorites
         WHERE user_id = ? AND seller_id IS NOT NULL
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(userId, pageSize, offset) as FavoriteRow[];

    return {
      rows: rows.map((r) => ({
        id: r.id,
        sellerId: r.seller_id ?? 0,
        createdAt: new Date(
          `${r.created_at.replace(" ", "T")}Z`,
        ).toISOString(),
      })),
      total,
      totalPages,
    };
  }

  @Destroy()
  async close() {
    if (this.database) {
      this.database.close();
    }
  }
}