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

describe("account API", { concurrency: false }, () => {
  test("AC-05: GET /api/account returns account info (auto-create)", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "账户测试1", "password123");

        const response = await request
          .get("/api/account")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.ok(response.body.data);
        assert.equal(typeof response.body.data.balance, "number");
        assert.equal(response.body.data.balance, 0);
        assert.equal(response.body.data.hasPaymentPassword, false);
      },
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
      },
    );
  });

  test("AC-06: PUT /api/account/balance sets balance", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "余额测试", "password123");

        // Set balance
        const setResponse = await request
          .put("/api/account/balance")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ balance: 100.50 })
          .expect(200);

        assert.equal(setResponse.body.data.balance, 100.50);

        // Verify via GET
        const getResponse = await request
          .get("/api/account")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(getResponse.body.data.balance, 100.50);
      },
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
      },
    );
  });

  test("AC-07: PUT /api/account/password with non-6-digit password returns 400", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "密码格式测试", "password123");

        // Too short
        await request
          .put("/api/account/password")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ password: "12345" })
          .expect(400);

        // Contains non-digit
        await request
          .put("/api/account/password")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ password: "12345a" })
          .expect(400);

        // Too long
        await request
          .put("/api/account/password")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ password: "1234567" })
          .expect(400);
      },
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
      },
    );
  });

  test("Set payment password and verify", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "密码验证测试", "password123");

        // Set password
        const setResponse = await request
          .put("/api/account/password")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ password: "123456" })
          .expect(200);

        assert.ok(setResponse.body.message);

        // Verify correct password
        const verifyResponse = await request
          .post("/api/account/verify-password")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ password: "123456" })
          .expect(200);

        assert.ok(verifyResponse.body.message);

        // Verify wrong password
        await request
          .post("/api/account/verify-password")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ password: "654321" })
          .expect(400);
      },
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
      },
    );
  });

  test("Unauthenticated requests return 401", async () => {
    await withApi(async (request) => {
      await request
        .get("/api/account")
        .set(JSON_REQUEST)
        .expect(401);

      await request
        .put("/api/account/balance")
        .set(JSON_REQUEST)
        .send({ balance: 100 })
        .expect(401);

      await request
        .put("/api/account/password")
        .set(JSON_REQUEST)
        .send({ password: "123456" })
        .expect(401);

      await request
        .post("/api/account/verify-password")
        .set(JSON_REQUEST)
        .send({ password: "123456" })
        .expect(401);
    });
  });

  test("Account info shows hasPaymentPassword=true after setting password", async () => {
    await withApi(
      async (request) => {
        const token = await registerAndLogin(request, "密码状态测试", "password123");

        // Initially no password
        const initialResponse = await request
          .get("/api/account")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(initialResponse.body.data.hasPaymentPassword, false);

        // Set password
        await request
          .put("/api/account/password")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .send({ password: "888888" })
          .expect(200);

        // Now should have password
        const afterResponse = await request
          .get("/api/account")
          .set("Authorization", `Bearer ${token}`)
          .set(JSON_REQUEST)
          .expect(200);

        assert.equal(afterResponse.body.data.hasPaymentPassword, true);
      },
      (databasePaths) => {
        seedAuthDatabase(databasePaths.authPath);
      },
    );
  });
});

async function withApi(
  run: (
    request: ReturnType<typeof createHttpRequest>,
    databasePaths: { authPath: string; accountPath: string },
  ) => Promise<void>,
  seed?: (databasePaths: { authPath: string; accountPath: string }) => void,
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
  run: (databasePaths: { authPath: string; accountPath: string }) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "account-backend-test-"));

  try {
    await run({
      authPath: join(directory, "auth.sqlite"),
      accountPath: join(directory, "account.sqlite"),
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

async function openApplication(databasePaths: { authPath: string; accountPath: string }) {
  return createApp(backendDirectory, {
    baseDir: compiledSourceDirectory,
    globalConfig: {
      authDatabase: { path: databasePaths.authPath },
      accountDatabase: { path: databasePaths.accountPath },
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