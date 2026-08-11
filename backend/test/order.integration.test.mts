import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { close, createApp, createHttpRequest } from "@midwayjs/mock";

process.env.MIDWAY_TS_MODE = "false";
process.env.NODE_ENV = "unittest";

const backendDirectory = fileURLToPath(new URL("..", import.meta.url));
const compiledSourceDirectory = join(backendDirectory, "dist");

const JSON_REQUEST = { Accept: "application/json" };

describe("order API", { concurrency: false }, () => {
  test("List purchase orders (AC-11)", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "订单测试1", "password123");

        // Set up account and buy an item first
        await request
          .put("/api/account/password")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ password: "123456" })
          .expect(200);

        await request
          .put("/api/account/balance")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ balance: 1000 })
          .expect(200);

        // Buy now
        await request
          .post("/api/cart/buy-now")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1, paymentPassword: "123456" })
          .expect(200);

        // List orders
        const response = await request
          .get("/api/orders")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(response.body.data.length, 1);
        const order = response.body.data[0];
        assert.equal(order.status, "pending_receipt");
        assert.equal(order.totalPrice, 25);
        assert.equal(order.items.length, 1);
        assert.equal(order.items[0].title, "测试商品");
        assert.equal(order.items[0].price, 25);
        assert.equal(order.items[0].quantity, 1);
      },
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItems(databasePaths.itemPath, [
          {
            id: 1, title: "测试商品", price: 25, quantity: 5,
            category: "书籍", status: "active", createdAt: "2026-08-10 12:00:00",
            sellerId: 1, sellerName: "admin",
          },
        ]);
      },
    );
  });

  test("Confirm receive updates status (AC-13)", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "签收测试", "password123");

        // Set up account and buy
        await request
          .put("/api/account/password")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ password: "123456" })
          .expect(200);

        await request
          .put("/api/account/balance")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ balance: 1000 })
          .expect(200);

        const buyResponse = await request
          .post("/api/cart/buy-now")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1, paymentPassword: "123456" })
          .expect(200);

        const orderId = buyResponse.body.data.orderId;

        // Confirm receive
        const receiveResponse = await request
          .post(`/api/orders/${orderId}/receive`)
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(receiveResponse.body.message, "已确认签收");

        // Verify status
        const ordersResponse = await request
          .get("/api/orders")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(ordersResponse.body.data[0].status, "received");
      },
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItems(databasePaths.itemPath, [
          {
            id: 1, title: "测试商品", price: 25, quantity: 5,
            category: "书籍", status: "active", createdAt: "2026-08-10 12:00:00",
            sellerId: 1, sellerName: "admin",
          },
        ]);
      },
    );
  });

  test("Non-buyer confirm returns 403 (AC-13)", async () => {
    await withApi(
      async (request) => {
        // Register buyer
        const buyerToken = await registerAndLogin(request, "买家", "password123");

        await request
          .put("/api/account/password")
          .set("Authorization", `Bearer ${buyerToken}`)
          .set(JSON_REQUEST)
          .send({ password: "123456" })
          .expect(200);

        await request
          .put("/api/account/balance")
          .set("Authorization", `Bearer ${buyerToken}`)
          .set(JSON_REQUEST)
          .send({ balance: 1000 })
          .expect(200);

        const buyResponse = await request
          .post("/api/cart/buy-now")
          .set("Authorization", `Bearer ${buyerToken}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1, paymentPassword: "123456" })
          .expect(200);

        const orderId = buyResponse.body.data.orderId;

        // Register another user and try to confirm
        const otherToken = await registerAndLogin(request, "其他人", "password123");

        await request
          .post(`/api/orders/${orderId}/receive`)
          .set("Authorization", `Bearer ${otherToken}`)
          .set(JSON_REQUEST)
          .expect(403);
      },
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItems(databasePaths.itemPath, [
          {
            id: 1, title: "测试商品", price: 25, quantity: 5,
            category: "书籍", status: "active", createdAt: "2026-08-10 12:00:00",
            sellerId: 1, sellerName: "admin",
          },
        ]);
      },
    );
  });

  test("List sales orders (AC-12)", async () => {
    await withApi(
      async (request) => {
        // Login as admin (seeded with password "admin123")
        const loginResponse = await request
          .post("/api/auth/login")
          .set(JSON_REQUEST)
          .send({ username: "admin", password: "admin123" })
          .expect(200);

        const sellerToken = loginResponse.body.token;

        // Set up seller account
        await request
          .put("/api/account/password")
          .set("Authorization", `Bearer ${sellerToken}`)
          .set(JSON_REQUEST)
          .send({ password: "123456" })
          .expect(200);

        // Register buyer
        const buyerToken = await registerAndLogin(request, "买家2", "password123");

        await request
          .put("/api/account/password")
          .set("Authorization", `Bearer ${buyerToken}`)
          .set(JSON_REQUEST)
          .send({ password: "123456" })
          .expect(200);

        await request
          .put("/api/account/balance")
          .set("Authorization", `Bearer ${buyerToken}`)
          .set(JSON_REQUEST)
          .send({ balance: 1000 })
          .expect(200);

        // Buy from seller 1 (admin)
        await request
          .post("/api/cart/buy-now")
          .set("Authorization", `Bearer ${buyerToken}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1, paymentPassword: "123456" })
          .expect(200);

        // Check sales as seller (admin)
        const salesResponse = await request
          .get("/api/orders/sales")
          .set("Authorization", `Bearer ${sellerToken}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(salesResponse.body.data.length, 1);
        const order = salesResponse.body.data[0];
        assert.equal(order.status, "pending_receipt");
        assert.equal(order.totalPrice, 25);
        assert.equal(order.items.length, 1);
        assert.equal(order.items[0].title, "测试商品");
      },
      (databasePaths) => {
        // Seed auth database
        seedAuthDatabase(databasePaths.authPath);
        seedItems(databasePaths.itemPath, [
          {
            id: 1, title: "测试商品", price: 25, quantity: 5,
            category: "书籍", status: "active", createdAt: "2026-08-10 12:00:00",
            sellerId: 1, sellerName: "admin",
          },
        ]);
      },
    );
  });
});

async function withApi(
  run: (
    request: ReturnType<typeof createHttpRequest>,
    databasePaths: { authPath: string; itemPath: string; accountPath: string; tradePath: string },
  ) => Promise<void>,
  seed?: (databasePaths: { authPath: string; itemPath: string; accountPath: string; tradePath: string }) => void,
) {
  await withTemporaryDatabases(async (databasePaths) => {
    if (seed) {
      seed(databasePaths);
    }

    const application = await openApplication(databasePaths);

    try {
      await run(createHttpRequest(application), databasePaths);
    } finally {
      await close(application, { cleanLogsDir: true });
    }
  });
}

async function withTemporaryDatabases(
  run: (databasePaths: { authPath: string; itemPath: string; accountPath: string; tradePath: string }) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "order-backend-test-"));

  try {
    await run({
      authPath: join(directory, "auth.sqlite"),
      itemPath: join(directory, "items.sqlite"),
      accountPath: join(directory, "account.sqlite"),
      tradePath: join(directory, "trade.sqlite"),
    });
  } finally {
    try {
      await rm(directory, { recursive: true, force: true });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await rm(directory, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function openApplication(databasePaths: { authPath: string; itemPath: string; accountPath: string; tradePath: string }) {
  return createApp(backendDirectory, {
    baseDir: compiledSourceDirectory,
    globalConfig: {
      authDatabase: { path: databasePaths.authPath },
      itemDatabase: { path: databasePaths.itemPath },
      accountDatabase: { path: databasePaths.accountPath },
      tradeDatabase: { path: databasePaths.tradePath },
      koa: { port: null },
    },
  });
}

async function registerAndLogin(
  request: ReturnType<typeof createHttpRequest>,
  username: string,
  password: string,
): Promise<string> {
  const registerResponse = await request
    .post("/api/auth/register")
    .set(JSON_REQUEST)
    .send({ username, password })
    .expect(201);

  return registerResponse.body.token;
}

function seedAuthDatabase(databasePath: string) {
  const database = new DatabaseSync(databasePath);

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } finally {
    database.close();
  }
}

function seedItems(databasePath: string, items: {
  id: number;
  title: string;
  price: number;
  quantity: number;
  category: string;
  status: string;
  createdAt: string;
  sellerId?: number;
  sellerName?: string;
}[]) {
  const database = new DatabaseSync(databasePath);

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        images TEXT NOT NULL DEFAULT '[]',
        cover_image TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        seller_id INTEGER NOT NULL DEFAULT 1,
        seller_name TEXT NOT NULL DEFAULT 'admin',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        quantity_updated_at TEXT
      )
    `);
    const insert = database.prepare(`
      INSERT INTO items (id, title, price, quantity, category, status, created_at, seller_id, seller_name, cover_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insert.run(
        item.id,
        item.title,
        item.price,
        item.quantity,
        item.category,
        item.status,
        item.createdAt,
        item.sellerId ?? 1,
        item.sellerName ?? "admin",
        `https://picsum.photos/seed/${encodeURIComponent(item.title)}/400/300`,
      );
    }
  } finally {
    database.close();
  }
}