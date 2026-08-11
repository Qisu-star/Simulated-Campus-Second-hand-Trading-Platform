import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("frontend test runner is configured", () => {
  assert.equal(typeof fetch, "function");
});

test("course dashboard keeps responsive grid and explicit empty state", async () => {
  const componentPath = path.join(
    process.cwd(),
    "src/components/course-dashboard.tsx",
  );
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /grid-cols-1 gap-5 lg:grid-cols-2/);
  assert.match(source, /\[overflow-wrap:anywhere\]/);
  assert.match(source, /当前还没有课程/);
  assert.doesNotMatch(source, /lg:grid-cols-3/);
});
