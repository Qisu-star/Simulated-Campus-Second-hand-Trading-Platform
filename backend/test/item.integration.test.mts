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

type SeedItem = {
  id: number;
  title: string;
  price: number;
  quantity: number;
  category: string;
  status: string;
  createdAt: string;
  sellerId?: number;
  sellerName?: string;
  description?: string;
};

describe("item API integration", { concurrency: false }, () => {
  test("AC-01: GET /api/items returns paginated items sorted by created_at DESC", async () => {
    await withApi(
      async (request) => {
        const response = await request.get("/api/items").expect(200);

        assert.ok(Array.isArray(response.body.data));
        assert.equal(typeof response.body.total, "number");
        assert.equal(typeof response.body.totalPages, "number");

        // Items should be sorted by created_at DESC
        const dates = response.body.data.map(
          (item: { createdAt: string }) => new Date(item.createdAt).getTime(),
        );
        for (let i = 1; i < dates.length; i++) {
          assert.ok(
            dates[i - 1] >= dates[i],
            `items should be sorted by createdAt DESC (index ${i - 1}: ${new Date(dates[i - 1]).toISOString()} vs ${new Date(dates[i]).toISOString()})`,
          );
        }

        // Verify item shape
        for (const item of response.body.data) {
          assert.ok(typeof item.id === "number");
          assert.ok(typeof item.title === "string");
          assert.ok(typeof item.price === "number");
          assert.ok(typeof item.quantity === "number");
          assert.ok(typeof item.category === "string");
          assert.ok(typeof item.sellerName === "string");
          assert.ok(typeof item.createdAt === "string");
          assert.ok(["pending", "active", "delisted"].includes(item.status));
        }
      },
      undefined,
      (databasePath) => {
        seedItems(databasePath, [
          {
            id: 1,
            title: "晚发布的商品",
            price: 10,
            quantity: 1,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-10 12:00:00",
          },
          {
            id: 2,
            title: "早发布的商品",
            price: 20,
            quantity: 1,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-01 12:00:00",
          },
          {
            id: 3,
            title: "最早发布的商品",
            price: 30,
            quantity: 1,
            category: "衣物",
            status: "active",
            createdAt: "2026-07-01 12:00:00",
          },
        ]);
      },
    );
  });

  test("AC-02: GET /api/items with page=1&pageSize=2 returns page 1 with total and totalPages", async () => {
    await withApi(
      async (request) => {
        const response = await request
          .get("/api/items?page=1&pageSize=2")
          .expect(200);

        assert.equal(response.body.data.length, 2);
        assert.equal(response.body.total, 3);
        assert.equal(response.body.totalPages, 2);

        // First page should have the two most recent items
        assert.equal(response.body.data[0].title, "晚发布的商品");
        assert.equal(response.body.data[1].title, "早发布的商品");
      },
      undefined,
      (databasePath) => {
        seedItems(databasePath, [
          {
            id: 1,
            title: "晚发布的商品",
            price: 10,
            quantity: 1,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-10 12:00:00",
          },
          {
            id: 2,
            title: "早发布的商品",
            price: 20,
            quantity: 1,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-01 12:00:00",
          },
          {
            id: 3,
            title: "最早发布的商品",
            price: 30,
            quantity: 1,
            category: "衣物",
            status: "active",
            createdAt: "2026-07-01 12:00:00",
          },
        ]);
      },
    );
  });

  test("AC-03: GET /api/items with no active items returns empty array", async () => {
    await withApi(
      async (request) => {
        const response = await request.get("/api/items").expect(200);

        assert.deepEqual(response.body.data, []);
        assert.equal(response.body.total, 0);
        assert.equal(response.body.totalPages, 1);
      },
      undefined,
      (databasePath) => {
        seedItems(databasePath, [
          {
            id: 1,
            title: "已下架商品",
            price: 10,
            quantity: 1,
            category: "书籍",
            status: "delisted",
            createdAt: "2026-08-10 12:00:00",
          },
          {
            id: 2,
            title: "待审核商品",
            price: 20,
            quantity: 1,
            category: "书籍",
            status: "pending",
            createdAt: "2026-08-01 12:00:00",
          },
        ]);
      },
    );
  });

  test("AC-04: GET /api/items?category=书籍 returns only books", async () => {
    await withApi(
      async (request) => {
        const response = await request
          .get("/api/items?category=%E4%B9%A6%E7%B1%8D")
          .expect(200);

        assert.equal(response.body.data.length, 2);
        assert.equal(response.body.total, 2);
        for (const item of response.body.data) {
          assert.equal(item.category, "书籍");
        }
      },
      undefined,
      (databasePath) => {
        seedItems(databasePath, [
          {
            id: 1,
            title: "书籍1",
            price: 10,
            quantity: 1,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-10 12:00:00",
          },
          {
            id: 2,
            title: "书籍2",
            price: 20,
            quantity: 1,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-01 12:00:00",
          },
          {
            id: 3,
            title: "衣物1",
            price: 30,
            quantity: 1,
            category: "衣物",
            status: "active",
            createdAt: "2026-07-01 12:00:00",
          },
        ]);
      },
    );
  });

  test("AC-05: GET /api/items?category=全部 returns all items (same as no filter)", async () => {
    await withApi(
      async (request) => {
        const allResponse = await request.get("/api/items").expect(200);
        const categoryAllResponse = await request
          .get("/api/items?category=%E5%85%A8%E9%83%A8")
          .expect(200);

        assert.equal(
          categoryAllResponse.body.data.length,
          allResponse.body.data.length,
        );
        assert.equal(
          categoryAllResponse.body.total,
          allResponse.body.total,
        );
      },
      undefined,
      (databasePath) => {
        seedItems(databasePath, [
          {
            id: 1,
            title: "书籍1",
            price: 10,
            quantity: 1,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-10 12:00:00",
          },
          {
            id: 2,
            title: "衣物1",
            price: 20,
            quantity: 1,
            category: "衣物",
            status: "active",
            createdAt: "2026-08-01 12:00:00",
          },
        ]);
      },
    );
  });

  test("AC-06: Category filtering with pagination works together", async () => {
    await withApi(
      async (request) => {
        // Page 1 of books
        const page1 = await request
          .get("/api/items?category=%E4%B9%A6%E7%B1%8D&page=1&pageSize=2")
          .expect(200);

        assert.equal(page1.body.data.length, 2);
        assert.equal(page1.body.total, 3);
        assert.equal(page1.body.totalPages, 2);

        // Page 2 of books
        const page2 = await request
          .get("/api/items?category=%E4%B9%A6%E7%B1%8D&page=2&pageSize=2")
          .expect(200);

        assert.equal(page2.body.data.length, 1);
        assert.equal(page2.body.total, 3);
        assert.equal(page2.body.totalPages, 2);
      },
      undefined,
      (databasePath) => {
        seedItems(databasePath, [
          {
            id: 1,
            title: "书籍1",
            price: 10,
            quantity: 1,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-10 12:00:00",
          },
          {
            id: 2,
            title: "书籍2",
            price: 20,
            quantity: 1,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-05 12:00:00",
          },
          {
            id: 3,
            title: "书籍3",
            price: 30,
            quantity: 1,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-01 12:00:00",
          },
          {
            id: 4,
            title: "衣物1",
            price: 40,
            quantity: 1,
            category: "衣物",
            status: "active",
            createdAt: "2026-07-01 12:00:00",
          },
        ]);
      },
    );
  });

  test("AC-01: GET /api/categories returns fixed category list", async () => {
    await withApi(async (request) => {
      const response = await request.get("/api/categories").expect(200);

      assert.deepEqual(response.body.data, [
        "衣物",
        "书籍",
        "电子设备",
        "运动",
        "食物",
        "其它",
      ]);
    });
  });

  test("Items with quantity=0 are still shown (active status)", async () => {
    await withApi(
      async (request) => {
        const response = await request.get("/api/items").expect(200);

        const soldOutItem = response.body.data.find(
          (item: { title: string }) => item.title === "已售罄商品",
        );
        assert.ok(soldOutItem);
        assert.equal(soldOutItem.quantity, 0);
        assert.equal(soldOutItem.status, "active");
      },
      undefined,
      (databasePath) => {
        seedItems(databasePath, [
          {
            id: 1,
            title: "已售罄商品",
            price: 10,
            quantity: 0,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-10 12:00:00",
          },
        ]);
      },
    );
  });

  test("Non-existent category returns empty array", async () => {
    await withApi(
      async (request) => {
        const response = await request
          .get("/api/items?category=%E4%B8%8D%E5%AD%98%E5%9C%A8")
          .expect(200);

        assert.deepEqual(response.body.data, []);
        assert.equal(response.body.total, 0);
      },
      undefined,
      (databasePath) => {
        seedItems(databasePath, [
          {
            id: 1,
            title: "书籍1",
            price: 10,
            quantity: 1,
            category: "书籍",
            status: "active",
            createdAt: "2026-08-10 12:00:00",
          },
        ]);
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
  const directory = await mkdtemp(join(tmpdir(), "item-backend-test-"));

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
      koa: { port: null },
    },
  });
}

function seedItems(databasePath: string, items: SeedItem[]) {
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
      INSERT INTO items (id, title, price, quantity, category, status, created_at, seller_id, seller_name, description, cover_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        item.description ?? "",
        `https://picsum.photos/seed/${encodeURIComponent(item.title)}/400/300`,
      );
    }
  } finally {
    database.close();
  }
}