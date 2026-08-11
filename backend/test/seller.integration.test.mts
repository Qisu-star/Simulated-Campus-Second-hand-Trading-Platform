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

type TestApplication = Awaited<ReturnType<typeof createApp>>;

const JSON_REQUEST = { Accept: "application/json" };

describe("seller item management API", { concurrency: false }, () => {
  test("AC-01: POST /api/items creates item with status=pending (201)", async () => {
    await withApi(async (request) => {
      const token = await registerAndLogin(request, "创建用户", "password123");

      const response = await request
        .post("/api/items")
        .set("Authorization", `Bearer ${token}`)
        .set(JSON_REQUEST)
        .send({
          title: "测试商品",
          price: 25.5,
          quantity: 3,
          category: "书籍",
          description: "这是一个测试商品",
          images: ["https://example.com/image1.jpg"],
        })
        .expect(201);

      assert.ok(response.body.data);
      const item = response.body.data;
      assert.equal(item.title, "测试商品");
      assert.equal(item.price, 25.5);
      assert.equal(item.quantity, 3);
      assert.equal(item.category, "书籍");
      assert.equal(item.description, "这是一个测试商品");
      assert.equal(item.status, "pending");
      assert.deepEqual(item.images, ["https://example.com/image1.jpg"]);
      assert.ok(typeof item.id === "number");
      assert.ok(typeof item.createdAt === "string");
    });
  });

  test("AC-02: POST /api/items without auth returns 401", async () => {
    await withApi(async (request) => {
      const response = await request
        .post("/api/items")
        .set(JSON_REQUEST)
        .send({
          title: "测试商品",
          price: 25.5,
          quantity: 3,
          category: "书籍",
        })
        .expect(401);

      assert.ok(response.body.message);
    });
  });

  test("AC-03: POST /api/items with price <= 0 returns 400", async () => {
    await withApi(async (request) => {
      const token = await registerAndLogin(request, "价格测试", "password123");

      const zeroPriceResponse = await request
        .post("/api/items")
        .set("Authorization", `Bearer ${token}`)
        .set(JSON_REQUEST)
        .send({
          title: "零元商品",
          price: 0,
          quantity: 1,
          category: "书籍",
        })
        .expect(400);

      assert.ok(zeroPriceResponse.body.message.includes("价格"));

      const negativePriceResponse = await request
        .post("/api/items")
        .set("Authorization", `Bearer ${token}`)
        .set(JSON_REQUEST)
        .send({
          title: "负价商品",
          price: -10,
          quantity: 1,
          category: "书籍",
        })
        .expect(400);

      assert.ok(negativePriceResponse.body.message.includes("价格"));
    });
  });

  test("AC-09: POST /api/items with invalid category returns 400", async () => {
    await withApi(async (request) => {
      const token = await registerAndLogin(request, "分类测试", "password123");

      const response = await request
        .post("/api/items")
        .set("Authorization", `Bearer ${token}`)
        .set(JSON_REQUEST)
        .send({
          title: "测试商品",
          price: 10,
          quantity: 1,
          category: "无效分类",
        })
        .expect(400);

      assert.ok(response.body.message.includes("分类"), response.body.message);
    });
  });

  test("AC-04: PUT /api/items/:id updates own item (200)", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "编辑测试",
          "password123",
        );

        // Create an item first
        const createResponse = await request
          .post("/api/items")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({
            title: "原始商品",
            price: 10,
            quantity: 1,
            category: "书籍",
          })
          .expect(201);

        const itemId = createResponse.body.data.id;

        // Update the item
        const updateResponse = await request
          .put(`/api/items/${itemId}`)
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({
            title: "已更新商品",
            price: 20,
            quantity: 5,
            category: "电子设备",
            description: "更新后的描述",
          })
          .expect(200);

        assert.equal(updateResponse.body.data.title, "已更新商品");
        assert.equal(updateResponse.body.data.price, 20);
        assert.equal(updateResponse.body.data.quantity, 5);
        assert.equal(updateResponse.body.data.category, "电子设备");
        assert.equal(updateResponse.body.data.description, "更新后的描述");
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
      },
    );
  });

  test("AC-05: PUT /api/items/:id on others' item returns 403", async () => {
    await withApi(
      async (request) => {
        // Create user A and create an item
        const tokenA = await registerAndLogin(request, "用户A", "password123");

        const createResponse = await request
          .post("/api/items")
          .set("Authorization", `Bearer ${tokenA}`)
          .set(JSON_REQUEST)
          .send({
            title: "用户A的商品",
            price: 10,
            quantity: 1,
            category: "书籍",
          })
          .expect(201);

        const itemId = createResponse.body.data.id;

        // Create user B and try to edit user A's item
        const tokenB = await registerAndLogin(request, "用户B", "password456");

        const updateResponse = await request
          .put(`/api/items/${itemId}`)
          .set("Authorization", `Bearer ${tokenB}`)
          .set(JSON_REQUEST)
          .send({
            title: "用户B尝试修改",
          })
          .expect(403);

        assert.ok(updateResponse.body.message);
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
      },
    );
  });

  test("AC-06: PATCH /api/items/:id/status delists item; delisted item not in public list but visible in my-items", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "下架测试",
          "password123",
        );

        // Create an item
        const createResponse = await request
          .post("/api/items")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({
            title: "待下架商品",
            price: 10,
            quantity: 1,
            category: "书籍",
          })
          .expect(201);

        const itemId = createResponse.body.data.id;

        // Delist the item
        const delistResponse = await request
          .patch(`/api/items/${itemId}/status`)
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ status: "delisted" })
          .expect(200);

        assert.equal(delistResponse.body.message, "商品已下架");

        // Delisted item should NOT appear in public list
        const publicList = await request.get("/api/items").expect(200);
        const foundInPublic = publicList.body.data.find(
          (item: { id: number }) => item.id === itemId,
        );
        assert.equal(foundInPublic, undefined, "下架商品不应出现在公开列表");

        // Delisted item should appear in my-items
        const myItems = await request
          .get("/api/items/mine")
          .set("Authorization", `Bearer ${token}`)
          .expect(200);

        const foundInMyItems = myItems.body.data.find(
          (item: { id: number }) => item.id === itemId,
        );
        assert.ok(foundInMyItems, "下架商品应出现在我的商品列表");
        assert.equal(foundInMyItems.status, "delisted");
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
      },
    );
  });

  test("AC-07: GET /api/items/mine returns all user's items sorted by created_at DESC", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "列表测试",
          "password123",
        );

        // Create multiple items
        await request
          .post("/api/items")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({
            title: "商品1",
            price: 10,
            quantity: 1,
            category: "书籍",
          })
          .expect(201);

        await request
          .post("/api/items")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({
            title: "商品2",
            price: 20,
            quantity: 2,
            category: "衣物",
          })
          .expect(201);

        // Fetch my items
        const myItems = await request
          .get("/api/items/mine")
          .set("Authorization", `Bearer ${token}`)
          .expect(200);

        assert.equal(myItems.body.data.length, 2);
        assert.equal(myItems.body.total, 2);

        // Items should be sorted by created_at DESC
        const dates = myItems.body.data.map((item: { createdAt: string }) =>
          new Date(item.createdAt).getTime(),
        );
        for (let i = 1; i < dates.length; i++) {
          assert.ok(
            dates[i - 1] >= dates[i],
            "items should be sorted by createdAt DESC",
          );
        }
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
      },
    );
  });

  test("Delist own item (PATCH) by owner succeeds", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "下架拥有者",
          "password123",
        );

        // Create an item
        const createResponse = await request
          .post("/api/items")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({
            title: "下架商品",
            price: 15,
            quantity: 1,
            category: "运动",
          })
          .expect(201);

        const itemId = createResponse.body.data.id;

        // Delist
        const delistResponse = await request
          .patch(`/api/items/${itemId}/status`)
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ status: "delisted" })
          .expect(200);

        assert.equal(delistResponse.body.message, "商品已下架");

        // Relist
        const relistResponse = await request
          .patch(`/api/items/${itemId}/status`)
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ status: "active" })
          .expect(200);

        assert.equal(relistResponse.body.message, "商品已上架");
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
      },
    );
  });

  test("Delist others' item returns 403", async () => {
    await withApi(
      async (request) => {
        const tokenA = await registerAndLogin(request, "用户A2", "password123");

        const createResponse = await request
          .post("/api/items")
          .set("Authorization", `Bearer ${tokenA}`)
          .set(JSON_REQUEST)
          .send({
            title: "A的商品",
            price: 10,
            quantity: 1,
            category: "书籍",
          })
          .expect(201);

        const itemId = createResponse.body.data.id;

        const tokenB = await registerAndLogin(request, "用户B2", "password456");

        const response = await request
          .patch(`/api/items/${itemId}/status`)
          .set("Authorization", `Bearer ${tokenB}`)
          .set(JSON_REQUEST)
          .send({ status: "delisted" })
          .expect(403);

        assert.ok(response.body.message);
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
      },
    );
  });

  test("Auto-delist: quantity=0 for 7+ days auto-delists item", async () => {
    await withApi(
      async (request) => {
        // Login as admin (id=1) since seed items have seller_id=1
        const loginResponse = await request
          .post("/api/auth/login")
          .set(JSON_REQUEST)
          .send({ username: "admin", password: "admin123" })
          .expect(200);

        const adminToken = loginResponse.body.token;

        const response = await request.get("/api/items").expect(200);

        // The item with quantity=0 for 8 days (id=999) should be auto-delisted, so not in public list
        const expiredItem = response.body.data.find(
          (item: { id: number }) => item.id === 999,
        );
        assert.equal(
          expiredItem,
          undefined,
          "item with quantity=0 for 7+ days should be auto-delisted and not appear in public list",
        );

        // The item with quantity=0 for 3 days (id=998) should still be in the public list
        const recentItem = response.body.data.find(
          (item: { id: number }) => item.id === 998,
        );
        assert.ok(
          recentItem,
          "item with quantity=0 for <7 days should still be in public list",
        );
        assert.equal(
          recentItem.status,
          "active",
          "recently sold-out item should still be active",
        );

        // Verify the expired item is still visible in my-items (as delisted)
        const myItems = await request
          .get("/api/items/mine")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        const myExpiredItem = myItems.body.data.find(
          (item: { id: number }) => item.id === 999,
        );
        assert.ok(
          myExpiredItem,
          "auto-delisted item should still be visible in my-items",
        );
        assert.equal(
          myExpiredItem.status,
          "delisted",
          "auto-delisted item should have delisted status",
        );
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
        seedAutoDelistItems(databasePath);
      },
    );
  });

  test("GET /api/items/mine returns paginated results", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "分页测试",
          "password123",
        );

        // Create 3 items
        for (let i = 1; i <= 3; i++) {
          await request
            .post("/api/items")
            .set("Authorization", `Bearer ${token}`)
            .set(JSON_REQUEST)
            .send({
              title: `分页商品${i}`,
              price: i * 10,
              quantity: i,
              category: "书籍",
            })
            .expect(201);
        }

        // Page 1 with pageSize=2
        const page1 = await request
          .get("/api/items/mine?page=1&pageSize=2")
          .set("Authorization", `Bearer ${token}`)
          .expect(200);

        assert.equal(page1.body.data.length, 2);
        assert.equal(page1.body.total, 3);
        assert.equal(page1.body.totalPages, 2);

        // Page 2 with pageSize=2
        const page2 = await request
          .get("/api/items/mine?page=2&pageSize=2")
          .set("Authorization", `Bearer ${token}`)
          .expect(200);

        assert.equal(page2.body.data.length, 1);
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
      },
    );
  });

  test("GET /api/items/mine without auth returns 401", async () => {
    await withApi(async (request) => {
      const response = await request.get("/api/items/mine").expect(401);

      assert.ok(response.body, "response should have a body");
    });
  });
});

describe("seller page API", { concurrency: false }, () => {
  test("AC-01: GET /api/sellers/:id returns seller info", async () => {
    await withApi(
      async (request) => {
        const response = await request.get("/api/sellers/1").expect(200);

        assert.ok(response.body.data);
        assert.equal(response.body.data.id, 1);
        assert.equal(response.body.data.username, "admin");
        assert.ok(typeof response.body.data.createdAt === "string");
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
      },
    );
  });

  test("Non-existent seller returns 404", async () => {
    await withApi(async (request) => {
      const response = await request.get("/api/sellers/999").expect(404);

      assert.ok(response.body, "should have a response body");
    });
  });

  test("GET /api/sellers/:id/items returns only active items for seller", async () => {
    await withApi(
      async (request) => {
        const response = await request.get("/api/sellers/1/items").expect(200);

        assert.ok(Array.isArray(response.body.data));
        // All returned items should be active
        for (const item of response.body.data) {
          assert.equal(item.status, "active");
          assert.equal(item.sellerId, 1);
        }
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
        seedSellerItems(databasePath);
      },
    );
  });

  test("GET /api/sellers/:id/items with category filter works", async () => {
    await withApi(
      async (request) => {
        const response = await request
          .get("/api/sellers/1/items?category=%E4%B9%A6%E7%B1%8D")
          .expect(200);

        assert.ok(Array.isArray(response.body.data));
        assert.equal(response.body.total, 1);
        assert.equal(response.body.data[0].category, "书籍");
        assert.equal(response.body.data[0].title, "卖家书籍商品");
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
        seedSellerItems(databasePath);
      },
    );
  });

  test("GET /api/sellers/:id/items excludes non-active items", async () => {
    await withApi(
      async (request) => {
        const response = await request.get("/api/sellers/1/items").expect(200);

        // Should not include the delisted item
        const found = response.body.data.find(
          (item: { title: string }) => item.title === "卖家已下架商品",
        );
        assert.equal(found, undefined, "should not include delisted items");
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
        seedSellerItems(databasePath);
      },
    );
  });

  test("GET /api/sellers/:id/reviews returns empty array", async () => {
    await withApi(
      async (request) => {
        const response = await request
          .get("/api/sellers/1/reviews")
          .expect(200);

        assert.deepEqual(response.body.data, []);
        assert.equal(response.body.total, 0);
        assert.equal(response.body.totalPages, 1);
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
      },
    );
  });

  test("Non-existent seller for items returns 404", async () => {
    await withApi(
      async (request) => {
        const response = await request
          .get("/api/sellers/999/items")
          .expect(404);

        assert.ok(response.body, "should have a response body");
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
      },
    );
  });

  test("Non-existent seller for reviews returns 404", async () => {
    await withApi(
      async (request) => {
        const response = await request
          .get("/api/sellers/999/reviews")
          .expect(404);

        assert.ok(response.body, "should have a response body");
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
      },
    );
  });

  test("GET /api/sellers/:id returns 400 for invalid id", async () => {
    await withApi(async (request) => {
      const response = await request.get("/api/sellers/abc").expect(400);

      assert.ok(response.body, "should have a response body");
    });
  });

  test("GET /api/sellers/:id/items supports pagination", async () => {
    await withApi(
      async (request) => {
        const page1 = await request
          .get("/api/sellers/1/items?page=1&pageSize=2")
          .expect(200);

        assert.equal(page1.body.data.length, 2);
        assert.equal(page1.body.total, 3);
        assert.equal(page1.body.totalPages, 2);

        const page2 = await request
          .get("/api/sellers/1/items?page=2&pageSize=2")
          .expect(200);

        assert.equal(page2.body.data.length, 1);
        assert.equal(page2.body.total, 3);
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
        seedSellerItems(databasePath);
      },
    );
  });
});

async function withApi(
  run: (
    request: ReturnType<typeof createHttpRequest>,
    databasePath: string,
  ) => Promise<void>,
  prepare?: (databasePath: string) => void,
  seed?: (databasePath: string) => void,
) {
  await withTemporaryDatabase(async (databasePath) => {
    if (seed) {
      seed(databasePath);
    }

    prepare?.(databasePath);
    const application = await openApplication(databasePath);

    try {
      await run(createHttpRequest(application), databasePath);
    } finally {
      await close(application, { cleanLogsDir: true });
    }
  });
}

async function withTemporaryDatabase(
  run: (databasePath: string) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "seller-backend-test-"));

  try {
    await run(join(directory, "items.sqlite"));
  } finally {
    try {
      await rm(directory, { recursive: true, force: true });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await rm(directory, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function openApplication(databasePath: string) {
  return createApp(backendDirectory, {
    baseDir: compiledSourceDirectory,
    globalConfig: {
      itemDatabase: { path: databasePath },
      authDatabase: {
        path: databasePath.replace("items.sqlite", "auth.sqlite"),
      },
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
  const authDbPath = databasePath.replace("items.sqlite", "auth.sqlite");
  const database = new DatabaseSync(authDbPath);

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

function seedAutoDelistItems(databasePath: string) {
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

    // Insert an item with quantity=0 and quantity_updated_at 8 days ago
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);

    database
      .prepare(
        `INSERT INTO items (id, title, price, quantity, description, category, seller_id, seller_name, status, quantity_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        999,
        "已过期商品",
        10,
        0,
        "库存为0已超过7天",
        "书籍",
        1,
        "admin",
        "active",
        eightDaysAgo,
      );

    // Insert an item with quantity=0 and quantity_updated_at 3 days ago (should NOT be auto-delisted)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);

    database
      .prepare(
        `INSERT INTO items (id, title, price, quantity, description, category, seller_id, seller_name, status, quantity_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        998,
        "近期售罄商品",
        20,
        0,
        "库存为0但未超过7天",
        "电子设备",
        1,
        "admin",
        "active",
        threeDaysAgo,
      );
  } finally {
    database.close();
  }
}

function seedSellerItems(databasePath: string) {
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
      INSERT INTO items (id, title, price, quantity, description, category, seller_id, seller_name, status, created_at, cover_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const coverImage = "https://picsum.photos/seed/test/400/300";

    // Active items for seller 1
    insert.run(
      1,
      "卖家书籍商品",
      25,
      1,
      "书籍描述",
      "书籍",
      1,
      "seller1",
      "active",
      "2026-08-10 12:00:00",
      coverImage,
    );
    insert.run(
      2,
      "卖家衣物商品",
      30,
      5,
      "衣物描述",
      "衣物",
      1,
      "seller1",
      "active",
      "2026-08-08 12:00:00",
      coverImage,
    );
    insert.run(
      3,
      "卖家电子设备",
      100,
      2,
      "电子设备描述",
      "电子设备",
      1,
      "seller1",
      "active",
      "2026-08-05 12:00:00",
      coverImage,
    );

    // Delisted item for seller 1 (should NOT appear in seller items)
    insert.run(
      4,
      "卖家已下架商品",
      50,
      0,
      "已下架",
      "书籍",
      1,
      "seller1",
      "delisted",
      "2026-08-01 12:00:00",
      coverImage,
    );

    // Active item for seller 2 (should NOT appear when querying seller 1)
    insert.run(
      5,
      "其他商家商品",
      40,
      3,
      "其他商家",
      "运动",
      2,
      "seller2",
      "active",
      "2026-08-03 12:00:00",
      coverImage,
    );
  } finally {
    database.close();
  }
}
