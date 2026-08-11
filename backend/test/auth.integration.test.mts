import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { close, createApp, createHttpRequest } from "@midwayjs/mock";

process.env.MIDWAY_TS_MODE = "false";
process.env.NODE_ENV = "unittest";

const backendDirectory = fileURLToPath(new URL("..", import.meta.url));
const compiledSourceDirectory = join(backendDirectory, "dist");

type TestApplication = Awaited<ReturnType<typeof createApp>>;

const JSON_REQUEST = { Accept: "application/json" };

describe("auth API integration", { concurrency: false }, () => {
  test("AC-10: admin user is seeded on first startup", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      let application: TestApplication | undefined;

      const stopApplication = async () => {
        const currentApplication = application;
        application = undefined;
        if (currentApplication) {
          await close(currentApplication);
        }
      };

      try {
        application = await openApplication(databasePath);

        // Verify admin can login via API
        const loginResponse = await createHttpRequest(application)
          .post("/api/auth/login")
          .set(JSON_REQUEST)
          .send({ username: "admin", password: "admin123" })
          .expect(200);

        assert.ok(loginResponse.body.token);
        assert.equal(loginResponse.body.data.role, "admin");
        const adminToken = loginResponse.body.token;

        // Check admin user info via /me
        const meResponse = await createHttpRequest(application)
          .get("/api/auth/me")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        assert.equal(meResponse.body.data.username, "admin");
        assert.equal(meResponse.body.data.role, "admin");

        // Restart: admin should still exist and be seed-safe
        await stopApplication();
        application = await openApplication(databasePath);

        const loginAgainResponse = await createHttpRequest(application)
          .post("/api/auth/login")
          .set(JSON_REQUEST)
          .send({ username: "admin", password: "admin123" })
          .expect(200);

        assert.ok(loginAgainResponse.body.token);
        assert.equal(loginAgainResponse.body.data.role, "admin");
      } finally {
        await stopApplication();
      }
    });
  });

  test("AC-01: POST /api/auth/register with valid input returns 201 and token", async () => {
    await withApi(async (request) => {
      const response = await request
        .post("/api/auth/register")
        .set(JSON_REQUEST)
        .send({ username: "测试用户1", password: "password123" })
        .expect(201);

      assert.ok(response.body.token, "should return a token");
      assert.equal(response.body.data.username, "测试用户1");
      assert.equal(response.body.data.role, "user");
      assert.ok(response.body.data.id);
      assert.ok(response.body.data.createdAt);
      assertIsoTimestamp(response.body.data.createdAt);
    });
  });

  test("AC-02: POST /api/auth/register with duplicate username returns 409", async () => {
    await withApi(async (request) => {
      await request
        .post("/api/auth/register")
        .set(JSON_REQUEST)
        .send({ username: "duplicate", password: "password123" })
        .expect(201);

      const response = await request
        .post("/api/auth/register")
        .set(JSON_REQUEST)
        .send({ username: "duplicate", password: "password456" })
        .expect(409);

      assert.equal(response.body.message, "用户名已存在");
    });
  });

  test("AC-03: POST /api/auth/register with short password returns 400", async () => {
    await withApi(async (request) => {
      const response = await request
        .post("/api/auth/register")
        .set(JSON_REQUEST)
        .send({ username: "shortpw", password: "12345" })
        .expect(400);

      assert.ok(response.body.message.includes("密码"));
    });
  });

  test("AC-04: POST /api/auth/register with special characters in username returns 400", async () => {
    await withApi(async (request) => {
      const response = await request
        .post("/api/auth/register")
        .set(JSON_REQUEST)
        .send({ username: "user@name!", password: "password123" })
        .expect(400);

      assert.ok(response.body.message.includes("用户名"));
    });
  });

  test("AC-05: POST /api/auth/login with correct credentials returns 200 and token", async () => {
    await withApi(async (request) => {
      // First register a user
      await request
        .post("/api/auth/register")
        .set(JSON_REQUEST)
        .send({ username: "logintest", password: "password123" })
        .expect(201);

      // Then login
      const response = await request
        .post("/api/auth/login")
        .set(JSON_REQUEST)
        .send({ username: "logintest", password: "password123" })
        .expect(200);

      assert.ok(response.body.token, "should return a token");
      assert.equal(response.body.data.username, "logintest");
      assert.equal(response.body.data.role, "user");
    });
  });

  test("AC-06: POST /api/auth/login with wrong password returns 401 with uniform message", async () => {
    await withApi(async (request) => {
      // First register a user
      await request
        .post("/api/auth/register")
        .set(JSON_REQUEST)
        .send({ username: "logintest2", password: "password123" })
        .expect(201);

      const wrongPasswordResponse = await request
        .post("/api/auth/login")
        .set(JSON_REQUEST)
        .send({ username: "logintest2", password: "wrongpassword" })
        .expect(401);

      assert.equal(
        wrongPasswordResponse.body.message,
        "用户名或密码错误",
      );

      const wrongUsernameResponse = await request
        .post("/api/auth/login")
        .set(JSON_REQUEST)
        .send({ username: "nonexistent", password: "password123" })
        .expect(401);

      assert.equal(
        wrongUsernameResponse.body.message,
        "用户名或密码错误",
      );
    });
  });

  test("AC-08: GET /api/auth/me with valid token returns user info", async () => {
    await withApi(async (request) => {
      const registerResponse = await request
        .post("/api/auth/register")
        .set(JSON_REQUEST)
        .send({ username: "meTest", password: "password123" })
        .expect(201);

      const token = registerResponse.body.token;

      const meResponse = await request
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      assert.equal(meResponse.body.data.username, "meTest");
      assert.equal(meResponse.body.data.role, "user");
      assert.ok(meResponse.body.data.id);
      assert.ok(meResponse.body.data.createdAt);
      assertIsoTimestamp(meResponse.body.data.createdAt);
    });
  });

  test("AC-09: GET /api/auth/me without token returns 401", async () => {
    await withApi(async (request) => {
      const response = await request
        .get("/api/auth/me")
        .set(JSON_REQUEST)
        .expect(401);

      assert.equal(response.body.message, "未登录");
    });
  });

  test("AC-07: POST /api/auth/logout invalidates the token", async () => {
    await withApi(async (request) => {
      const registerResponse = await request
        .post("/api/auth/register")
        .set(JSON_REQUEST)
        .send({ username: "logoutTest", password: "password123" })
        .expect(201);

      const token = registerResponse.body.token;

      // Verify token works
      await request
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .set(JSON_REQUEST)
        .expect(200);

      // Logout
      await request
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`)
        .set(JSON_REQUEST)
        .expect(200);

      // Token should now be invalid
      const meResponse = await request
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .set(JSON_REQUEST)
        .expect(401);

      assert.equal(meResponse.body.message, "登录已过期");
    });
  });

  test("AC-03: PUT /api/auth/password with short new password returns 400", async () => {
    await withApi(async (request) => {
      const registerResponse = await request
        .post("/api/auth/register")
        .set(JSON_REQUEST)
        .send({ username: "pwTest", password: "password123" })
        .expect(201);

      const token = registerResponse.body.token;

      const response = await request
        .put("/api/auth/password")
        .set("Authorization", `Bearer ${token}`)
        .set(JSON_REQUEST)
        .send({ currentPassword: "password123", newPassword: "12345" })
        .expect(400);

      assert.ok(response.body.message.includes("密码"));
    });
  });

  test("PUT /api/auth/password with wrong current password returns 400", async () => {
    await withApi(async (request) => {
      const registerResponse = await request
        .post("/api/auth/register")
        .set(JSON_REQUEST)
        .send({ username: "pwTest2", password: "password123" })
        .expect(201);

      const token = registerResponse.body.token;

      const response = await request
        .put("/api/auth/password")
        .set("Authorization", `Bearer ${token}`)
        .set(JSON_REQUEST)
        .send({ currentPassword: "wrongpassword", newPassword: "newpassword123" })
        .expect(400);

      assert.equal(response.body.message, "当前密码错误");
    });
  });

  test("AC-03: PUT /api/auth/password without token returns 401", async () => {
    await withApi(async (request) => {
      const response = await request
        .put("/api/auth/password")
        .set(JSON_REQUEST)
        .send({ currentPassword: "password123", newPassword: "newpassword123" })
        .expect(401);

      assert.equal(response.body.message, "未登录");
    });
  });
});

async function withApi(
  run: (
    request: ReturnType<typeof createHttpRequest>,
    databasePath: string,
  ) => Promise<void>,
  prepare?: (databasePath: string) => void,
) {
  await withTemporaryDatabase(async (databasePath) => {
    prepare?.(databasePath);
    const application = await openApplication(databasePath);

    try {
      await run(createHttpRequest(application), databasePath);
    } finally {
      await close(application);
    }
  });
}

async function withTemporaryDatabase(
  run: (databasePath: string) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "auth-backend-test-"));

  try {
    await run(join(directory, "auth.sqlite"));
  } finally {
    try {
      await rm(directory, { recursive: true, force: true });
    } catch {
      // On Windows, SQLite file handles may still be held briefly
      await new Promise((resolve) => setTimeout(resolve, 300));
      await rm(directory, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function openApplication(databasePath: string) {
  return createApp(backendDirectory, {
    baseDir: compiledSourceDirectory,
    globalConfig: {
      authDatabase: { path: databasePath },
      itemDatabase: { path: databasePath.replace("auth.sqlite", "items.sqlite") },
      koa: { port: null },
    },
  });
}

function assertIsoTimestamp(value: unknown) {
  assert.equal(typeof value, "string");
  if (typeof value !== "string") {
    return;
  }
  const parsedTimestamp = new Date(value);
  assert.equal(Number.isNaN(parsedTimestamp.getTime()), false);
  assert.equal(parsedTimestamp.toISOString(), value);
}