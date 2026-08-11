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

describe("admin review API", { concurrency: false }, () => {
  test("AC-01: Admin lists pending items", async () => {
    await withApi(
      async (request) => {
        // Login as admin
        const loginResponse = await request
          .post("/api/auth/login")
          .set(JSON_REQUEST)
          .send({ username: "admin", password: "admin123" })
          .expect(200);

        const adminToken = loginResponse.body.token;

        // List pending reviews
        const response = await request
          .get("/api/admin/reviews")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        assert.ok(Array.isArray(response.body.data));
        assert.equal(response.body.total, 2);
        assert.equal(response.body.data.length, 2);

        // Items should be sorted by createdAt DESC
        const dates = response.body.data.map(
          (item: { createdAt: string }) => new Date(item.createdAt).getTime(),
        );
        for (let i = 1; i < dates.length; i++) {
          assert.ok(
            dates[i - 1] >= dates[i],
            "items should be sorted by createdAt DESC",
          );
        }

        // Verify item shape
        for (const item of response.body.data) {
          assert.equal(item.status, "pending");
          assert.ok(typeof item.id === "number");
          assert.ok(typeof item.title === "string");
          assert.ok(typeof item.price === "number");
          assert.ok(typeof item.quantity === "number");
          assert.ok(typeof item.category === "string");
          assert.ok(typeof item.sellerName === "string");
          assert.ok(typeof item.createdAt === "string");
        }
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
        seedPendingItems(databasePath);
      },
    );
  });

  test("AC-02: Non-admin returns 403", async () => {
    await withApi(
      async (request) => {
        // Register a regular user
        const registerResponse = await request
          .post("/api/auth/register")
          .set(JSON_REQUEST)
          .send({ username: "普通用户", password: "password123" })
          .expect(201);

        const userToken = registerResponse.body.token;

        // Try to list pending reviews
        const response = await request
          .get("/api/admin/reviews")
          .set("Authorization", `Bearer ${userToken}`)
          .expect(403);

        assert.ok(response.body.message);
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
      },
    );
  });

  test("AC-03: Admin approves item -> status becomes active", async () => {
    await withApi(
      async (request) => {
        // Login as admin
        const loginResponse = await request
          .post("/api/auth/login")
          .set(JSON_REQUEST)
          .send({ username: "admin", password: "admin123" })
          .expect(200);

        const adminToken = loginResponse.body.token;

        // Approve item 1
        const approveResponse = await request
          .post("/api/admin/reviews/1/approve")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        assert.equal(approveResponse.body.message, "审核通过");

        // Item should appear in public list
        const publicList = await request.get("/api/items").expect(200);
        const approvedItem = publicList.body.data.find(
          (item: { id: number }) => item.id === 1,
        );
        assert.ok(approvedItem, "approved item should appear in public list");
        assert.equal(approvedItem.status, "active");
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
        seedPendingItems(databasePath);
      },
    );
  });

  test("AC-04: Admin rejects item -> status becomes delisted", async () => {
    await withApi(
      async (request) => {
        // Login as admin
        const loginResponse = await request
          .post("/api/auth/login")
          .set(JSON_REQUEST)
          .send({ username: "admin", password: "admin123" })
          .expect(200);

        const adminToken = loginResponse.body.token;

        // Reject item 1
        const rejectResponse = await request
          .post("/api/admin/reviews/1/reject")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        assert.equal(rejectResponse.body.message, "已驳回");

        // Item should NOT appear in public list
        const publicList = await request.get("/api/items").expect(200);
        const rejectedItem = publicList.body.data.find(
          (item: { id: number }) => item.id === 1,
        );
        assert.equal(
          rejectedItem,
          undefined,
          "rejected item should not appear in public list",
        );
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
        seedPendingItems(databasePath);
      },
    );
  });

  test("AC-05: Rejected item, seller edits -> status back to pending, appears in review list", async () => {
    await withApi(
      async (request) => {
        // Login as admin (seller of item 1)
        const adminLogin = await request
          .post("/api/auth/login")
          .set(JSON_REQUEST)
          .send({ username: "admin", password: "admin123" })
          .expect(200);

        const adminToken = adminLogin.body.token;

        // Reject item 1
        await request
          .post("/api/admin/reviews/1/reject")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        // Seller edits the rejected item
        await request
          .put("/api/items/1")
          .set("Authorization", `Bearer ${adminToken}`)
          .set(JSON_REQUEST)
          .send({ title: "重新提交的商品", price: 30 })
          .expect(200);

        // Item should appear in review list again
        const reviewList = await request
          .get("/api/admin/reviews")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        const resubmitted = reviewList.body.data.find(
          (item: { id: number }) => item.id === 1,
        );
        assert.ok(resubmitted, "resubmitted item should appear in review list");
        assert.equal(resubmitted.status, "pending");
        assert.equal(resubmitted.title, "重新提交的商品");
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
        seedPendingItems(databasePath);
      },
    );
  });

  test("AC-06: Approved item, seller edits -> status stays active", async () => {
    await withApi(
      async (request) => {
        // Login as admin (seller of item 1)
        const adminLogin = await request
          .post("/api/auth/login")
          .set(JSON_REQUEST)
          .send({ username: "admin", password: "admin123" })
          .expect(200);

        const adminToken = adminLogin.body.token;

        // Approve item 1
        await request
          .post("/api/admin/reviews/1/approve")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        // Seller edits the approved item
        await request
          .put("/api/items/1")
          .set("Authorization", `Bearer ${adminToken}`)
          .set(JSON_REQUEST)
          .send({ title: "已更新活跃商品", price: 35 })
          .expect(200);

        // Item should still be active
        const publicList = await request.get("/api/items").expect(200);
        const updatedItem = publicList.body.data.find(
          (item: { id: number }) => item.id === 1,
        );
        assert.ok(updatedItem, "updated item should still be in public list");
        assert.equal(updatedItem.status, "active");
        assert.equal(updatedItem.title, "已更新活跃商品");

        // Item should NOT appear in review list
        const reviewList = await request
          .get("/api/admin/reviews")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        const inReview = reviewList.body.data.find(
          (item: { id: number }) => item.id === 1,
        );
        assert.equal(
          inReview,
          undefined,
          "edited active item should not appear in review list",
        );
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
        seedPendingItems(databasePath);
      },
    );
  });

  test("AC-07: Unauthenticated returns 401", async () => {
    await withApi(
      async (request) => {
        // GET /api/admin/reviews without auth
        const getResponse = await request
          .get("/api/admin/reviews")
          .expect(401);

        assert.ok(getResponse.body.message);

        // POST /api/admin/reviews/1/approve without auth
        const approveResponse = await request
          .post("/api/admin/reviews/1/approve")
          .expect(401);

        assert.ok(approveResponse.body.message);

        // POST /api/admin/reviews/1/reject without auth
        const rejectResponse = await request
          .post("/api/admin/reviews/1/reject")
          .expect(401);

        assert.ok(rejectResponse.body.message);
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
      },
    );
  });

  test("Admin approves non-existent item -> 404", async () => {
    await withApi(
      async (request) => {
        // Login as admin
        const loginResponse = await request
          .post("/api/auth/login")
          .set(JSON_REQUEST)
          .send({ username: "admin", password: "admin123" })
          .expect(200);

        const adminToken = loginResponse.body.token;

        // Approve non-existent item
        const approveResponse = await request
          .post("/api/admin/reviews/999/approve")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(404);

        assert.ok(approveResponse.body.message);

        // Reject non-existent item
        const rejectResponse = await request
          .post("/api/admin/reviews/999/reject")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(404);

        assert.ok(rejectResponse.body.message);
      },
      undefined,
      (databasePath) => {
        seedAuthDatabase(databasePath);
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
  const directory = await mkdtemp(join(tmpdir(), "admin-backend-test-"));

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
      authDatabase: { path: databasePath.replace("items.sqlite", "auth.sqlite") },
      koa: { port: null },
    },
  });
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

function seedPendingItems(databasePath: string) {
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

    insert.run(
      1, "待审核商品A", 25.5, 3, "这是商品A的描述",
      "书籍", 1, "admin", "pending", "2026-08-10 12:00:00",
      "https://picsum.photos/seed/itemA/400/300",
    );
    insert.run(
      2, "待审核商品B", 50.0, 1, "这是商品B的描述",
      "电子设备", 1, "admin", "pending", "2026-08-08 12:00:00",
      "https://picsum.photos/seed/itemB/400/300",
    );
  } finally {
    database.close();
  }
}