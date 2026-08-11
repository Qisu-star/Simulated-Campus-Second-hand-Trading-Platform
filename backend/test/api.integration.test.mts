import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  close,
  createApp,
  createHttpRequest,
  mockClassProperty,
  restoreMocks,
} from "@midwayjs/mock";
import type { CourseService as CourseServiceInstance } from "../src/service/course.service";

process.env.MIDWAY_TS_MODE = "false";
process.env.NODE_ENV = "unittest";

const require = createRequire(import.meta.url);
const { CourseService } = require("../dist/service/course.service.js") as {
  CourseService: new () => CourseServiceInstance;
};
const backendDirectory = fileURLToPath(new URL("..", import.meta.url));
const compiledSourceDirectory = join(backendDirectory, "dist");

type TestApplication = Awaited<ReturnType<typeof createApp>>;
type SeedCourse = {
  id: number;
  title: string;
  description: string;
  createdAt: string;
};

describe("course API integration", { concurrency: false }, () => {
  test("AC-01: GET /api/health returns the documented healthy response", async () => {
    await withApi(async (request) => {
      const response = await request.get("/api/health").expect(200);

      assert.equal(response.body.status, "ok");
      assert.equal(response.body.service, "course-demo-api");
      assertIsoTimestamp(response.body.timestamp);
    });
  });

  test("AC-02: GET /api/courses sorts persisted courses by id", async () => {
    await withApi(
      async (request) => {
        const response = await request.get("/api/courses").expect(200);

        assert.deepEqual(
          response.body.data.map((course: SeedCourse) => course.id),
          [2, 7, 40],
        );
        assert.deepEqual(
          response.body.data.map((course: SeedCourse) => course.title),
          ["第二门", "第七门", "第四十门"],
        );
        response.body.data.forEach((course: SeedCourse) => {
          assertIsoTimestamp(course.createdAt);
        });
      },
      (databasePath) => {
        seedDatabase(databasePath, [
          {
            id: 40,
            title: "第四十门",
            description: "最后返回的课程",
            createdAt: "2026-07-12 03:00:00",
          },
          {
            id: 2,
            title: "第二门",
            description: "最先返回的课程",
            createdAt: "2026-07-12 01:00:00",
          },
          {
            id: 7,
            title: "第七门",
            description: "中间返回的课程",
            createdAt: "2026-07-12 02:00:00",
          },
        ]);
      },
    );
  });

  test("BR-02: GET /api/courses returns 200 with an empty data array", async () => {
    await withApi(async (request) => {
      const mockGroup = "empty-course-list";
      mockClassProperty(CourseService, "list", () => [], mockGroup);

      try {
        const emptyResponse = await request.get("/api/courses").expect(200);
        assert.deepEqual(emptyResponse.body, { data: [] });
      } finally {
        restoreMocks(mockGroup);
      }
    });
  });

  test("AC-03: initialization seeds exactly three courses and is restart-safe", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      let application: TestApplication | undefined;

      const stopApplication = async () => {
        const currentApplication = application;
        application = undefined;
        if (currentApplication) {
          await close(currentApplication, { cleanLogsDir: true });
        }
      };

      try {
        application = await openApplication(databasePath);
        const firstResponse = await createHttpRequest(application)
          .get("/api/courses")
          .expect(200);

        assert.deepEqual(
          firstResponse.body.data.map((course: SeedCourse) => course.title),
          ["HTML 与 CSS", "React 与 Next.js", "API 与数据持久化"],
        );
        assert.equal(firstResponse.body.data.length, 3);

        await stopApplication();

        application = await openApplication(databasePath);
        const secondResponse = await createHttpRequest(application)
          .get("/api/courses")
          .expect(200);

        assert.equal(secondResponse.body.data.length, 3);
        assert.deepEqual(secondResponse.body.data, firstResponse.body.data);
      } finally {
        await stopApplication();
      }
    });
  });

  test("OpenAPI createCourse: POST accepts the documented length boundaries", async () => {
    await withApi(async (request) => {
      const minimumResponse = await request
        .post("/api/courses")
        .send({ title: "TS", description: "入门" })
        .expect(200);

      assert.equal(minimumResponse.body.data.title, "TS");
      assert.equal(minimumResponse.body.data.description, "入门");
      assertIsoTimestamp(minimumResponse.body.data.createdAt);

      const maximumResponse = await request
        .post("/api/courses")
        .send({ title: "T".repeat(80), description: "D".repeat(500) })
        .expect(200);

      assert.equal(maximumResponse.body.data.title.length, 80);
      assert.equal(maximumResponse.body.data.description.length, 500);
      assertIsoTimestamp(maximumResponse.body.data.createdAt);

      const listResponse = await request.get("/api/courses").expect(200);
      const ids = listResponse.body.data.map((course: SeedCourse) => course.id);
      assert.deepEqual(
        ids,
        [...ids].sort((left, right) => left - right),
      );
      assert.equal(
        ids.at(-1),
        maximumResponse.body.data.id,
        "the boundary course remains persisted and listable",
      );
    });
  });

  test("OpenAPI createCourse: POST maps invalid input to 400", async (t) => {
    await withApi(async (request) => {
      const invalidInputs = [
        {
          name: "non-object body",
          body: [],
          message: "请求体必须是 JSON 对象",
        },
        {
          name: "title below minimum",
          body: { title: "T", description: "有效简介" },
          message: "title 长度必须在 2 到 80 个字符之间",
        },
        {
          name: "title above maximum",
          body: { title: "T".repeat(81), description: "有效简介" },
          message: "title 长度必须在 2 到 80 个字符之间",
        },
        {
          name: "description below minimum",
          body: { title: "有效标题", description: "D" },
          message: "description 长度必须在 2 到 500 个字符之间",
        },
        {
          name: "description above maximum",
          body: { title: "有效标题", description: "D".repeat(501) },
          message: "description 长度必须在 2 到 500 个字符之间",
        },
      ];

      for (const invalidInput of invalidInputs) {
        await t.test(invalidInput.name, async () => {
          const response = await request
            .post("/api/courses")
            .set("Accept", "application/json")
            .send(invalidInput.body)
            .expect(400);

          assert.equal(response.body.message, invalidInput.message);
        });
      }

      const listResponse = await request.get("/api/courses").expect(200);
      assert.equal(
        listResponse.body.data.length,
        3,
        "invalid requests must not create courses",
      );
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
      await close(application, { cleanLogsDir: true });
    }
  });
}

async function withTemporaryDatabase(
  run: (databasePath: string) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "course-demo-backend-test-"));

  try {
    await run(join(directory, "courses.sqlite"));
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
      courseDatabase: { path: databasePath },
      authDatabase: { path: databasePath.replace("courses.sqlite", "auth.sqlite") },
      koa: { port: null },
    },
  });
}

function seedDatabase(databasePath: string, courses: SeedCourse[]) {
  const database = new DatabaseSync(databasePath);

  try {
    database.exec(`
      CREATE TABLE courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const insert = database.prepare(`
      INSERT INTO courses (id, title, description, created_at)
      VALUES (?, ?, ?, ?)
    `);

    for (const course of courses) {
      insert.run(course.id, course.title, course.description, course.createdAt);
    }
  } finally {
    database.close();
  }
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
