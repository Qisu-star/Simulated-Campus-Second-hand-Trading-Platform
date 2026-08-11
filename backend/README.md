# Backend

Midway.js + Koa API，使用 Node.js 24 内置的 `node:sqlite` 保存数据。

```bash
npm run dev --workspace backend
```

默认端口为 `7001`，数据库首次启动时会自动创建并写入三条课程示例数据。

开发新的后端行为前，可先阅读 [Spec 003：课程关键词搜索](../specs/003-course-keyword-search.md) 与 [ADR-002](../docs/adr/002-course-search-responsibility-boundary.md)，了解如何把可验收行为与长期技术决策分开记录。二者目前均为提议中，不表示搜索 API 已实现。

主要入口：

- `src/configuration.ts`：Midway 应用配置
- `src/controller/api.controller.ts`：HTTP API
- `src/service/course.service.ts`：SQLite 数据访问
- `src/config/config.default.ts`：运行时配置
