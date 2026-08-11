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

describe("cart API", { concurrency: false }, () => {
  test("AC-01: POST /api/cart adds item to cart (201)", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "购物车测试1",
          "password123",
        );

        const response = await request
          .post("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1 })
          .expect(201);

        assert.ok(response.body.message);
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
          },
        ]);
      },
    );
  });

  test("AC-02: Same item again merges quantity", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "购物车测试2",
          "password123",
        );

        // Add first time
        await request
          .post("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 2 })
          .expect(201);

        // Add second time
        await request
          .post("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 3 })
          .expect(201);

        // List cart - should have 1 item with quantity 5
        const listResponse = await request
          .get("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(listResponse.body.data.length, 1);
        assert.equal(listResponse.body.data[0].quantity, 5);
        assert.equal(listResponse.body.data[0].itemId, 1);
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
          },
        ]);
      },
    );
  });

  test("AC-03: Unauthenticated returns 401", async () => {
    await withApi(async (request) => {
      await request
        .post("/api/cart")
        .set(JSON_REQUEST)
        .send({ itemId: 1, quantity: 1 })
        .expect(401);

      await request.get("/api/cart").set(JSON_REQUEST).expect(401);
    });
  });

  test("AC-04: GET /api/cart returns cart items with details", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "购物车测试3",
          "password123",
        );

        // Add two different items
        await request
          .post("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 2 })
          .expect(201);

        await request
          .post("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 2, quantity: 1 })
          .expect(201);

        const response = await request
          .get("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(response.body.data.length, 2);
        const item1 = response.body.data.find(
          (ci: { itemId: number }) => ci.itemId === 1,
        );
        const item2 = response.body.data.find(
          (ci: { itemId: number }) => ci.itemId === 2,
        );
        assert.ok(item1);
        assert.ok(item2);
        assert.equal(item1.quantity, 2);
        assert.equal(item2.quantity, 1);
        assert.equal(item1.title, "商品A");
        assert.equal(item2.title, "商品B");
        assert.equal(item1.selected, true);
        assert.equal(item2.selected, true);
      },
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItems(databasePaths.itemPath, [
          {
            id: 1,
            title: "商品A",
            price: 25,
            quantity: 5,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-10 12:00:00",
          },
          {
            id: 2,
            title: "商品B",
            price: 30,
            quantity: 3,
            category: "衣物",
            status: "active",
            createdAt: "2026-08-10 12:00:00",
          },
        ]);
      },
    );
  });

  test("Remove from cart returns 200", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "购物车测试4",
          "password123",
        );

        // Add item
        await request
          .post("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1 })
          .expect(201);

        // List to get cart item id
        const listResponse = await request
          .get("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        const cartItemId = listResponse.body.data[0].id;

        // Delete
        await request
          .delete(`/api/cart/${cartItemId}`)
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        // Verify empty
        const afterResponse = await request
          .get("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(afterResponse.body.data.length, 0);
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
          },
        ]);
      },
    );
  });

  test("Toggle select", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "购物车测试5",
          "password123",
        );

        // Add item
        await request
          .post("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1 })
          .expect(201);

        // Get cart item id
        const listResponse = await request
          .get("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        const cartItemId = listResponse.body.data[0].id;
        assert.equal(listResponse.body.data[0].selected, true);

        // Toggle to false
        await request
          .patch(`/api/cart/${cartItemId}/select`)
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ selected: false })
          .expect(200);

        // Verify
        const afterResponse = await request
          .get("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(afterResponse.body.data[0].selected, false);
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
          },
        ]);
      },
    );
  });

  test("Checkout success (AC-08)", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "结算测试",
          "password123",
        );
        const userId = 1; // admin user from seed

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

        // Checkout
        const checkoutResponse = await request
          .post("/api/cart/checkout")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ paymentPassword: "123456" })
          .expect(200);

        assert.ok(checkoutResponse.body.data.orderId);
        assert.equal(checkoutResponse.body.message, "结算成功");

        // Verify stock deducted (item 1 had 5, quantity 2 purchased -> 3 remaining)
        const itemResponse = await request
          .get("/api/items/1")
          .set(JSON_REQUEST)
          .expect(200);
        assert.equal(itemResponse.body.data.quantity, 3);

        // Verify balance deducted (1000 - 50 = 950)
        const accountResponse = await request
          .get("/api/account")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);
        assert.equal(accountResponse.body.data.balance, 950);
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

  test("Insufficient balance returns 402 (AC-09)", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "余额不足测试",
          "password123",
        );

        // Set payment password but no balance
        await request
          .put("/api/account/password")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ password: "123456" })
          .expect(200);

        // Add item
        await request
          .post("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1 })
          .expect(201);

        // Checkout should fail with 402
        await request
          .post("/api/cart/checkout")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ paymentPassword: "123456" })
          .expect(402);
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
          },
        ]);
      },
    );
  });

  test("Insufficient stock returns 400 (AC-10)", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "库存不足测试",
          "password123",
        );

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

        // Add item with quantity > stock
        await request
          .post("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 10 })
          .expect(201);

        // Checkout should fail (stock is 5, need 10)
        await request
          .post("/api/cart/checkout")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ paymentPassword: "123456" })
          .expect(400);
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
          },
        ]);
      },
    );
  });

  test("Wrong password returns 400 (AC-10)", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "密码错误测试",
          "password123",
        );

        // Set payment password
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

        // Add item
        await request
          .post("/api/cart")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 1 })
          .expect(201);

        // Checkout with wrong password
        await request
          .post("/api/cart/checkout")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ paymentPassword: "654321" })
          .expect(400);
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
          },
        ]);
      },
    );
  });

  test("Buy-now success (AC-15)", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "立即购买测试",
          "password123",
        );

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

        // Buy now
        const buyResponse = await request
          .post("/api/cart/buy-now")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 2, paymentPassword: "123456" })
          .expect(200);

        assert.ok(buyResponse.body.data.orderId);

        // Verify stock deducted
        const itemResponse = await request
          .get("/api/items/1")
          .set(JSON_REQUEST)
          .expect(200);
        assert.equal(itemResponse.body.data.quantity, 3); // 5 - 2 = 3
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

  test("Buy-now insufficient stock returns 400", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "立即购买库存不足",
          "password123",
        );

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

        // Buy now with quantity > stock
        await request
          .post("/api/cart/buy-now")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ itemId: 1, quantity: 10, paymentPassword: "123456" })
          .expect(400);
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
          },
        ]);
      },
    );
  });

  test("Unauthenticated checkout returns 401", async () => {
    await withApi(async (request) => {
      await request
        .post("/api/cart/checkout")
        .set(JSON_REQUEST)
        .send({ paymentPassword: "123456" })
        .expect(401);

      await request
        .post("/api/cart/buy-now")
        .set(JSON_REQUEST)
        .send({ itemId: 1, quantity: 1, paymentPassword: "123456" })
        .expect(401);
    });
  });
});

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
  const directory = await mkdtemp(join(tmpdir(), "cart-backend-test-"));

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
