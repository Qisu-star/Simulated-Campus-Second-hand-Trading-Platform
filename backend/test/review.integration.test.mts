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

describe("review API", { concurrency: false }, () => {
  test("AC-01: Create review as received buyer (201)", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "评价测试1", "password123");

        // Set up account and buy an item
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
        const buyResponse = await request
          .post("/api/cart/buy-now")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1, paymentPassword: "123456" })
          .expect(200);

        const orderId = buyResponse.body.data.orderId;

        // Confirm receive
        await request
          .post(`/api/orders/${orderId}/receive`)
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        // Create review
        const reviewResponse = await request
          .post("/api/reviews")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ orderId, itemId: 1, rating: 8, comment: "很好用" })
          .expect(201);

        assert.equal(reviewResponse.body.data.rating, 8);
        assert.equal(reviewResponse.body.data.comment, "很好用");
        assert.equal(reviewResponse.body.data.itemId, 1);
        assert.equal(reviewResponse.body.data.orderId, orderId);
        assert.ok(reviewResponse.body.data.id);
        assert.ok(reviewResponse.body.data.createdAt);
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

  test("AC-02: Non-received buyer returns 403", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "评价测试2", "password123");

        // Set up account and buy an item
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

        // Buy now but don't confirm receive
        const buyResponse = await request
          .post("/api/cart/buy-now")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1, paymentPassword: "123456" })
          .expect(200);

        const orderId = buyResponse.body.data.orderId;

        // Try to create review - should fail because order is pending_receipt
        await request
          .post("/api/reviews")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ orderId, itemId: 1, rating: 8 })
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

  test("AC-03: Rating < 1 or > 10 returns 400", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "评价测试3", "password123");

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
        await request
          .post(`/api/orders/${orderId}/receive`)
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        // Rating 0 - should fail
        await request
          .post("/api/reviews")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ orderId, itemId: 1, rating: 0 })
          .expect(400);

        // Rating 11 - should fail
        await request
          .post("/api/reviews")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ orderId, itemId: 1, rating: 11 })
          .expect(400);
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

  test("AC-04: Duplicate review returns 409", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "评价测试4", "password123");

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
        await request
          .post(`/api/orders/${orderId}/receive`)
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        // Create review
        await request
          .post("/api/reviews")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ orderId, itemId: 1, rating: 8 })
          .expect(201);

        // Duplicate review should return 409
        await request
          .post("/api/reviews")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ orderId, itemId: 1, rating: 9 })
          .expect(409);
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

  test("AC-05: Unauthenticated returns 401", async () => {
    await withApi(async (request) => {
      await request
        .post("/api/reviews")
        .set(JSON_REQUEST)
        .send({ orderId: 1, itemId: 1, rating: 8 })
        .expect(401);
    });
  });

  test("AC-06: View item reviews list", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "评价测试6", "password123");

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
        await request
          .post(`/api/orders/${orderId}/receive`)
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        // Create review
        await request
          .post("/api/reviews")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ orderId, itemId: 1, rating: 7, comment: "还不错" })
          .expect(201);

        // View item reviews
        const itemReviewsResponse = await request
          .get("/api/items/1/reviews")
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(itemReviewsResponse.body.data.length, 1);
        assert.equal(itemReviewsResponse.body.data[0].rating, 7);
        assert.equal(itemReviewsResponse.body.data[0].comment, "还不错");
        assert.equal(itemReviewsResponse.body.total, 1);
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

  test("AC-07: View seller recent reviews", async () => {
    await withApi(
      async (request) => {
        // Register buyer
        const buyerToken = await registerAndLogin(request, "评价买家", "password123");

        // Set up buyer account
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
        const buyResponse = await request
          .post("/api/cart/buy-now")
          .set("Authorization", `Bearer ${buyerToken}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1, paymentPassword: "123456" })
          .expect(200);

        const orderId = buyResponse.body.data.orderId;

        // Confirm receive
        await request
          .post(`/api/orders/${orderId}/receive`)
          .set("Authorization", `Bearer ${buyerToken}`)
          .set(JSON_REQUEST)
          .expect(200);

        // Create review
        await request
          .post("/api/reviews")
          .set("Authorization", `Bearer ${buyerToken}`)
          .set(JSON_REQUEST)
          .send({ orderId, itemId: 1, rating: 9, comment: "非常满意" })
          .expect(201);

        // View seller reviews
        const sellerReviewsResponse = await request
          .get("/api/sellers/1/reviews?days=30")
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(sellerReviewsResponse.body.data.length, 1);
        assert.equal(sellerReviewsResponse.body.data[0].rating, 9);
        assert.equal(sellerReviewsResponse.body.data[0].comment, "非常满意");
        assert.equal(sellerReviewsResponse.body.data[0].username, "评价买家");
        assert.equal(sellerReviewsResponse.body.total, 1);
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
});

async function withApi(
  run: (
    request: ReturnType<typeof createHttpRequest>,
    databasePaths: { authPath: string; itemPath: string; accountPath: string; tradePath: string; reviewPath: string },
  ) => Promise<void>,
  seed?: (databasePaths: { authPath: string; itemPath: string; accountPath: string; tradePath: string; reviewPath: string }) => void,
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
  run: (databasePaths: { authPath: string; itemPath: string; accountPath: string; tradePath: string; reviewPath: string }) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "review-backend-test-"));

  try {
    await run({
      authPath: join(directory, "auth.sqlite"),
      itemPath: join(directory, "items.sqlite"),
      accountPath: join(directory, "account.sqlite"),
      tradePath: join(directory, "trade.sqlite"),
      reviewPath: join(directory, "review.sqlite"),
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

async function openApplication(databasePaths: { authPath: string; itemPath: string; accountPath: string; tradePath: string; reviewPath: string }) {
  return createApp(backendDirectory, {
    baseDir: compiledSourceDirectory,
    globalConfig: {
      authDatabase: { path: databasePaths.authPath },
      itemDatabase: { path: databasePaths.itemPath },
      accountDatabase: { path: databasePaths.accountPath },
      tradeDatabase: { path: databasePaths.tradePath },
      reviewDatabase: { path: databasePaths.reviewPath },
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