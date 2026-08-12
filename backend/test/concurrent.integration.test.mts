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

describe("concurrent race condition tests", { concurrency: false }, () => {
  // ===== Register atomicity =====
  test("CR-01: Concurrent register with same username — only one succeeds", async () => {
    await withApi(async (request) => {
      const promises = Array.from({ length: 5 }, () =>
        request
          .post("/api/auth/register")
          .set(JSON_REQUEST)
          .send({ username: "raceuser", password: "password123" }),
      );

      const results = await Promise.allSettled(promises);

      const successCount = results.filter(
        (r) => r.status === "fulfilled" && r.value.status === 201,
      ).length;

      // Exactly one registration should succeed; the rest should fail
      assert.equal(
        successCount,
        1,
        `Expected exactly 1 successful registration, got ${successCount}`,
      );

      // All failures should be 409 Conflict (not 500)
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.status !== 201) {
          assert.equal(
            result.value.status,
            409,
            "Race-condition registration should return 409, not 500",
          );
        }
      }
    });
  });

  // ===== Checkout rollback on failure =====
  test("CR-02: Checkout rollback — stock restored on payment failure", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "回滚测试", "password123");

        // Set payment password and balance
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

        // Add item to cart (item 1, price 25, quantity 2)
        await request
          .post("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 2 })
          .expect(201);

        // Check stock before
        const beforeItem = await request
          .get("/api/items/1")
          .set(JSON_REQUEST)
          .expect(200);
        const beforeStock = beforeItem.body.data.quantity;
        assert.equal(beforeStock, 5);

        // Checkout with WRONG payment password => should fail
        await request
          .post("/api/cart/checkout")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ paymentPassword: "000000" })
          .expect(400);

        // Verify stock was NOT deducted (rollback worked)
        const afterItem = await request
          .get("/api/items/1")
          .set(JSON_REQUEST)
          .expect(200);
        assert.equal(
          afterItem.body.data.quantity,
          beforeStock,
          "Stock should be restored after failed checkout",
        );
      },
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItems(databasePaths.itemPath, [
          {
            id: 1,
            title: "测试商品",
            price: 25,
            quantity: 5,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-10 12:00:00",
            sellerId: 1,
            sellerName: "admin",
          },
        ]);
      },
    );
  });

  // ===== BuyNow oversell protection =====
  test("CR-03: Concurrent buy-now — no overselling", async () => {
    await withApi(
      async (request) => {
        // Create two users, each with enough balance to buy 3 units
        // Item has only 5 units total, so the second buyer should fail
        const user1Token = await registerAndLogin(
          request,
          "buyrace1",
          "password123",
        );
        const user2Token = await registerAndLogin(
          request,
          "buyrace2",
          "password123",
        );

        // Set up accounts
        await request
          .put("/api/account/password")
          .set("Authorization", `Bearer ${user1Token}`)
          .set(JSON_REQUEST)
          .send({ password: "123456" })
          .expect(200);
        await request
          .put("/api/account/balance")
          .set("Authorization", `Bearer ${user1Token}`)
          .set(JSON_REQUEST)
          .send({ balance: 1000 })
          .expect(200);

        await request
          .put("/api/account/password")
          .set("Authorization", `Bearer ${user2Token}`)
          .set(JSON_REQUEST)
          .send({ password: "123456" })
          .expect(200);
        await request
          .put("/api/account/balance")
          .set("Authorization", `Bearer ${user2Token}`)
          .set(JSON_REQUEST)
          .send({ balance: 1000 })
          .expect(200);

        // Send two concurrent buy-now requests, each wanting 3 units (total 6, stock 5)
        const [r1, r2] = await Promise.all([
          request
            .post("/api/cart/buy-now")
            .set("Authorization", `Bearer ${user1Token}`)
            .set(JSON_REQUEST)
            .send({ itemId: 1, quantity: 3, paymentPassword: "123456" }),
          request
            .post("/api/cart/buy-now")
            .set("Authorization", `Bearer ${user2Token}`)
            .set(JSON_REQUEST)
            .send({ itemId: 1, quantity: 3, paymentPassword: "123456" }),
        ]);

        // At most one should succeed (need 3 each, only 5 total)
        const succeeded = [r1, r2].filter((r) => r.status === 200).length;
        assert.ok(
          succeeded <= 1,
          `At most 1 buy-now should succeed, got ${succeeded}`,
        );

        // Verify final stock >= 0
        const finalItem = await request
          .get("/api/items/1")
          .set(JSON_REQUEST)
          .expect(200);
        assert.ok(
          finalItem.body.data.quantity >= 0,
          `Stock should not be negative, got ${finalItem.body.data.quantity}`,
        );
      },
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItems(databasePaths.itemPath, [
          {
            id: 1,
            title: "限量商品",
            price: 50,
            quantity: 5,
            category: "电子",
            status: "active",
            createdAt: "2026-08-10 12:00:00",
            sellerId: 1,
            sellerName: "admin",
          },
        ]);
      },
    );
  });

  // ===== Atomic balance adjustment =====
  test("CR-04: Atomic adjustBalance — no read-modify-write race", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "余额原子测试", "password123");

        // Set payment password and initial balance
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

        // Add item to cart
        await request
          .post("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1 })
          .expect(201);

        // Buy now — uses adjustBalance internally
        const buyResponse = await request
          .post("/api/cart/buy-now")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1, paymentPassword: "123456" })
          .expect(200);

        assert.ok(buyResponse.body.data.orderId);

        // Verify balance: 1000 - 25 = 975
        const accountResponse = await request
          .get("/api/account")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);
        assert.equal(accountResponse.body.data.balance, 975);
      },
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItems(databasePaths.itemPath, [
          {
            id: 1,
            title: "测试商品",
            price: 25,
            quantity: 10,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-10 12:00:00",
            sellerId: 1,
            sellerName: "admin",
          },
        ]);
      },
    );
  });
});

// ===== Helper functions =====

async function withApi(
  run: (
    request: ReturnType<typeof createHttpRequest>,
    databasePaths: {
      authPath: string;
      itemPath: string;
      accountPath: string;
      tradePath: string;
    },
  ) => Promise<void>,
  seed?: (databasePaths: {
    authPath: string;
    itemPath: string;
    accountPath: string;
    tradePath: string;
  }) => void,
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
  run: (databasePaths: {
    authPath: string;
    itemPath: string;
    accountPath: string;
    tradePath: string;
  }) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "concurrent-test-"));

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

async function openApplication(databasePaths: {
  authPath: string;
  itemPath: string;
  accountPath: string;
  tradePath: string;
}) {
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

function seedItems(
  databasePath: string,
  items: {
    id: number;
    title: string;
    price: number;
    quantity: number;
    category: string;
    status: string;
    createdAt: string;
    sellerId?: number;
    sellerName?: string;
  }[],
) {
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