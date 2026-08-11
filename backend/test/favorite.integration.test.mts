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

describe("favorites API", { concurrency: false }, () => {
  test("AC-01: POST /api/favorites/items/:id favorites an item (toggle)", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "收藏测试1",
          "password123",
        );

        // Toggle favorite (should add)
        const response = await request
          .post("/api/favorites/items/1")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(response.body.data.action, "favorited");

        // Toggle again (should remove)
        const response2 = await request
          .post("/api/favorites/items/1")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(response2.body.data.action, "unfavorited");
      },
      undefined,
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItemsDatabase(databasePaths.itemsPath);
      },
    );
  });

  test("AC-02: DELETE /api/favorites/items/:id unfavorites an item", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "取消收藏测试",
          "password123",
        );

        // First favorite
        await request
          .post("/api/favorites/items/1")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        // Then unfavorite
        const response = await request
          .delete("/api/favorites/items/1")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.ok(response.body.message);
      },
      undefined,
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItemsDatabase(databasePaths.itemsPath);
      },
    );
  });

  test("AC-03: Unauthenticated favorite returns 401", async () => {
    await withApi(async (request) => {
      const response = await request
        .post("/api/favorites/items/1")
        .set(JSON_REQUEST)
        .expect(401);

      assert.ok(response.body.message);
    });
  });

  test("AC-04: GET /api/favorites/items lists favorited items", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "收藏列表测试",
          "password123",
        );

        // Favorite two items
        await request
          .post("/api/favorites/items/1")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        await request
          .post("/api/favorites/items/2")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        // List favorites
        const response = await request
          .get("/api/favorites/items")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(response.body.total, 2);
        assert.equal(response.body.data.length, 2);
        assert.ok(response.body.data[0].item);
        assert.equal(typeof response.body.data[0].item.title, "string");
      },
      undefined,
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItemsDatabase(databasePaths.itemsPath);
      },
    );
  });

  test("AC-05: Toggle favorite seller", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "商家收藏测试",
          "password123",
        );

        // Toggle favorite seller (should add)
        const response = await request
          .post("/api/favorites/sellers/1")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(response.body.data.action, "favorited");

        // Toggle again (should remove)
        const response2 = await request
          .post("/api/favorites/sellers/1")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(response2.body.data.action, "unfavorited");
      },
      undefined,
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItemsDatabase(databasePaths.itemsPath);
      },
    );
  });

  test("AC-06: GET /api/favorites/sellers lists favorited sellers", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "商家列表测试",
          "password123",
        );

        // Favorite seller 1
        await request
          .post("/api/favorites/sellers/1")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        // List favorite sellers
        const response = await request
          .get("/api/favorites/sellers")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(response.body.total, 1);
        assert.equal(response.body.data.length, 1);
        assert.equal(response.body.data[0].sellerName, "admin");
        assert.equal(typeof response.body.data[0].activeItemCount, "number");
      },
      undefined,
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItemsDatabase(databasePaths.itemsPath);
      },
    );
  });

  test("AC-06: Item detail shows favorite status when authenticated", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "详情收藏测试",
          "password123",
        );

        // Favorite the item and seller
        await request
          .post("/api/favorites/items/1")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        await request
          .post("/api/favorites/sellers/1")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        // Get item detail with auth
        const response = await request
          .get("/api/items/1")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(response.body.data.isItemFavorited, true);
        assert.equal(response.body.data.isSellerFavorited, true);
      },
      undefined,
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItemsDatabase(databasePaths.itemsPath);
      },
    );
  });

  test("Item detail without auth returns isItemFavorited=false and isSellerFavorited=false", async () => {
    await withApi(
      async (request) => {
        const response = await request
          .get("/api/items/1")
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(response.body.data.isItemFavorited, false);
        assert.equal(response.body.data.isSellerFavorited, false);
      },
      undefined,
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItemsDatabase(databasePaths.itemsPath);
      },
    );
  });

  test("AC-07: Delisted item still appears in favorites list", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "下架收藏测试",
          "password123",
        );

        // Favorite item 1 (seeded with seller_id=1)
        await request
          .post("/api/favorites/items/1")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        // Login as admin (id=1) to delist the item (since seed items have seller_id=1)
        const loginResponse = await request
          .post("/api/auth/login")
          .set(JSON_REQUEST)
          .send({ username: "admin", password: "admin123" })
          .expect(200);

        const adminToken = loginResponse.body.token;

        // Delist the item
        await request
          .patch("/api/items/1/status")
          .set("Authorization", `Bearer ${adminToken}`)
          .set(JSON_REQUEST)
          .send({ status: "delisted" })
          .expect(200);

        // Favorite list should still include the item (still visible to the original user)
        const response = await request
          .get("/api/favorites/items")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(response.body.total, 1);
        assert.equal(response.body.data[0].item.status, "delisted");
      },
      undefined,
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItemsDatabase(databasePaths.itemsPath);
      },
    );
  });

  test("DELETE /api/favorites/items/:id is idempotent (unfavorite when not favorited)", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(
          request,
          "幂等测试",
          "password123",
        );

        // Unfavorite when not favorited should return 200
        const response = await request
          .delete("/api/favorites/items/1")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.ok(response.body.message);
      },
      undefined,
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
        seedItemsDatabase(databasePaths.itemsPath);
      },
    );
  });
});

async function withApi(
  run: (
    request: ReturnType<typeof createHttpRequest>,
    databasePaths: {
      authPath: string;
      itemsPath: string;
      favoritePath: string;
    },
  ) => Promise<void>,
  prepare?: (databasePaths: {
    authPath: string;
    itemsPath: string;
    favoritePath: string;
  }) => void,
  seed?: (databasePaths: {
    authPath: string;
    itemsPath: string;
    favoritePath: string;
  }) => void,
) {
  await withTemporaryDatabases(async (databasePaths) => {
    if (seed) {
      seed(databasePaths);
    }

    prepare?.(databasePaths);
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
    itemsPath: string;
    favoritePath: string;
  }) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "favorite-backend-test-"));

  try {
    await run({
      authPath: join(directory, "auth.sqlite"),
      itemsPath: join(directory, "items.sqlite"),
      favoritePath: join(directory, "favorite.sqlite"),
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
  itemsPath: string;
  favoritePath: string;
}) {
  return createApp(backendDirectory, {
    baseDir: compiledSourceDirectory,
    globalConfig: {
      itemDatabase: { path: databasePaths.itemsPath },
      authDatabase: { path: databasePaths.authPath },
      favoriteDatabase: { path: databasePaths.favoritePath },
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

    // Seed admin user with id=1 (same as the item seller_id)
    // The admin password hash is for "admin123"
    const adminRow = database
      .prepare("SELECT id FROM users WHERE username = ?")
      .get("admin") as { id: number } | undefined;

    if (!adminRow) {
      // We need to generate the same hash as the auth service does
      // For simplicity, we'll insert a placeholder and let the auth service handle it
      // Actually, the auth service seeds the admin on init, so we just need users table
    }
  } finally {
    database.close();
  }
}

function seedItemsDatabase(databasePath: string) {
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
      1,
      "测试商品1",
      25.5,
      3,
      "描述1",
      "书籍",
      1,
      "admin",
      "active",
      "2026-08-10 12:00:00",
      "https://picsum.photos/seed/1/400/300",
    );
    insert.run(
      2,
      "测试商品2",
      30.0,
      5,
      "描述2",
      "衣物",
      1,
      "admin",
      "active",
      "2026-08-09 12:00:00",
      "https://picsum.photos/seed/2/400/300",
    );
    insert.run(
      3,
      "测试商品3",
      15.0,
      0,
      "描述3",
      "书籍",
      1,
      "admin",
      "active",
      "2026-08-08 12:00:00",
      "https://picsum.photos/seed/3/400/300",
    );
  } finally {
    database.close();
  }
}
