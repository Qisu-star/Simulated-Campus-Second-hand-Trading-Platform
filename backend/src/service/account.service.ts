import { Config, Destroy, Init, Provide } from "@midwayjs/core";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Account, AccountInfo } from "../interface";

type AccountRow = {
  id: number;
  user_id: number;
  balance: number;
  payment_password: string | null;
  created_at: string;
};

@Provide()
export class AccountService {
  @Config("accountDatabase.path")
  databasePath: string;

  private database: DatabaseSync | null = null;

  @Init()
  async initialize() {
    const absolutePath = resolve(process.cwd(), this.databasePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    this.database = new DatabaseSync(absolutePath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        balance REAL NOT NULL DEFAULT 0,
        payment_password TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  getOrCreateAccount(userId: number): AccountInfo {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    let row = this.database
      .prepare(
        "SELECT id, user_id, balance, payment_password, created_at FROM accounts WHERE user_id = ?",
      )
      .get(userId) as AccountRow | undefined;

    if (!row) {
      this.database
        .prepare("INSERT INTO accounts (user_id, balance) VALUES (?, 0)")
        .run(userId);

      row = this.database
        .prepare(
          "SELECT id, user_id, balance, payment_password, created_at FROM accounts WHERE user_id = ?",
        )
        .get(userId) as AccountRow;
    }

    return {
      balance: row.balance,
      hasPaymentPassword: row.payment_password !== null,
    };
  }

  setBalance(userId: number, balance: number): void {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    this.database
      .prepare("UPDATE accounts SET balance = ? WHERE user_id = ?")
      .run(balance, userId);
  }

  setPaymentPassword(userId: number, password: string): void {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    // Validate that password is 6 digits
    if (!/^\d{6}$/.test(password)) {
      throw new Error("支付密码必须为 6 位数字");
    }

    const hash = createHash("sha256").update(password).digest("hex");
    this.database
      .prepare("UPDATE accounts SET payment_password = ? WHERE user_id = ?")
      .run(hash, userId);
  }

  verifyPaymentPassword(userId: number, password: string): boolean {
    if (!this.database) {
      throw new Error("数据库未初始化");
    }

    const row = this.database
      .prepare("SELECT payment_password FROM accounts WHERE user_id = ?")
      .get(userId) as { payment_password: string | null } | undefined;

    if (!row || !row.payment_password) {
      return false;
    }

    const hash = createHash("sha256").update(password).digest("hex");
    return hash === row.payment_password;
  }

  getAccount(userId: number): Account | null {
    if (!this.database) {
      return null;
    }

    const row = this.database
      .prepare(
        "SELECT id, user_id, balance, payment_password, created_at FROM accounts WHERE user_id = ?",
      )
      .get(userId) as AccountRow | undefined;

    if (!row) {
      return null;
    }

    return mapAccount(row);
  }

  @Destroy()
  async close() {
    if (this.database) {
      this.database.close();
    }
  }
}

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    userId: row.user_id,
    balance: row.balance,
    paymentPassword: row.payment_password,
    createdAt: new Date(`${row.created_at.replace(" ", "T")}Z`).toISOString(),
  };
}
