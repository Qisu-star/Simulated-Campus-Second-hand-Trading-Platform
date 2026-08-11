import { Config, Destroy, Init, Provide } from "@midwayjs/core";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { User } from "../interface";
import {
  generateToken,
  hashPassword,
  invalidateToken,
  verifyPassword,
  verifyToken,
} from "../utils/auth";

type UserRow = {
  id: number;
  username: string;
  password: string;
  role: string;
  created_at: string;
};

@Provide()
export class AuthService {
  @Config("authDatabase.path")
  databasePath: string;

  private database: DatabaseSync;

  @Init()
  async initialize() {
    const absolutePath = resolve(process.cwd(), this.databasePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    this.database = new DatabaseSync(absolutePath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Seed admin user if not exists
    const adminRow = this.database
      .prepare("SELECT id FROM users WHERE username = ?")
      .get("admin") as UserRow | undefined;

    if (!adminRow) {
      const hashedPassword = hashPassword("admin123");
      this.database
        .prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)")
        .run("admin", hashedPassword, "admin");
    }
  }

  register(username: string, password: string): { user: User; token: string } {
    // Check if username already exists
    const existing = this.database
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(username) as UserRow | undefined;

    if (existing) {
      throw new Error("用户名已存在");
    }

    const hashedPassword = hashPassword(password);
    const result = this.database
      .prepare("INSERT INTO users (username, password) VALUES (?, ?)")
      .run(username, hashedPassword);

    const row = this.database
      .prepare("SELECT id, username, password, role, created_at FROM users WHERE id = ?")
      .get(result.lastInsertRowid) as UserRow;

    const token = generateToken({ userId: row.id });
    return { user: mapUser(row), token };
  }

  login(username: string, password: string): { user: User; token: string } {
    const row = this.database
      .prepare("SELECT id, username, password, role, created_at FROM users WHERE username = ?")
      .get(username) as UserRow | undefined;

    if (!row || !verifyPassword(password, row.password)) {
      throw new Error("用户名或密码错误");
    }

    const token = generateToken({ userId: row.id });
    return { user: mapUser(row), token };
  }

  logout(token: string): void {
    invalidateToken(token);
  }

  getCurrentUser(token: string): User | null {
    const payload = verifyToken(token);
    if (!payload) {
      return null;
    }

    const row = this.database
      .prepare("SELECT id, username, password, role, created_at FROM users WHERE id = ?")
      .get(payload.userId) as UserRow | undefined;

    if (!row) {
      return null;
    }

    return mapUser(row);
  }

  getUserById(id: number): User | null {
    const row = this.database
      .prepare("SELECT id, username, role, created_at FROM users WHERE id = ?")
      .get(id) as UserRow | undefined;
    return row ? mapUser(row) : null;
  }

  updatePassword(token: string, currentPassword: string, newPassword: string): void {
    const payload = verifyToken(token);
    if (!payload) {
      throw new Error("未登录或登录已过期");
    }

    const row = this.database
      .prepare("SELECT id, username, password, role, created_at FROM users WHERE id = ?")
      .get(payload.userId) as UserRow | undefined;

    if (!row) {
      throw new Error("用户不存在");
    }

    if (!verifyPassword(currentPassword, row.password)) {
      throw new Error("当前密码错误");
    }

    const hashedPassword = hashPassword(newPassword);
    this.database
      .prepare("UPDATE users SET password = ? WHERE id = ?")
      .run(hashedPassword, row.id);
  }

  @Destroy()
  async close() {
    if (this.database) {
      this.database.close();
    }
  }
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: new Date(`${row.created_at.replace(" ", "T")}Z`).toISOString(),
  };
}