# 本次项目给coding agent的一些提示

## 一般指示：

- 主要使用中文和我对话
- 与我讨论设计时，启用superpower的brainstorming技能
- 每次git提交时，只提交一个功能的完成（完成一个SPEC提交一次）

## 开发时的一些提示：

- 本项目为一个课程项目，课程提供了一个开发模板，在目录D:\resource\暑校-Web开发\webdev-template，可作为开发时的脚手架

## 可能使用的技术栈：

> 补充一下：本“技术栈范围”部分是使用ai根据课程PPT提炼出的，作为参考

### 【前端】

- 框架：Next.js（使用 App Router，不使用 Pages Router）
- UI库：React
- 样式：Tailwind CSS（使用 utility class 方式，不写自定义 CSS 文件）
- 语言：TypeScript
- 关键约定：所有交互组件必须使用 'use client'；样式写在 className 中；API 调用统一放在 lib/api.ts 中

### 【后端】

- 框架：Midway.js（基于 Koa）
- ORM：TypeORM（配合装饰器方式）
- 数据库：SQLite（无需额外服务，数据存储在本地文件）
- 语言：TypeScript
- 关键约定：分层结构为 Controller → Service → Entity；所有业务逻辑写在 Service 中；Controller 只做参数解析和响应返回

### 【契约与测试】

- API契约：OpenAPI（YAML 格式，放在 contracts/openapi.yaml）
- 测试框架：使用 Midway.js 内置测试工具
- 测试范围：至少包含 API/Contract 测试和并发场景测试

### 【部署】

- 容器化：Docker（使用多阶段构建）
- 编排：docker-compose
- 平台要求：linux/amd64

### 【代码规范】

- 所有代码使用 TypeScript
- 使用 ESLint 进行代码检查
- 提交前必须能通过 npm run check

### 【禁止使用】

- 不要使用额外的状态管理库（如 Redux、Zustand），使用 React 内置的 useState/useContext 即可
- 不要使用额外的 UI 组件库（如 Ant Design、MUI），使用 Tailwind utility 即可
- 不要引入其他数据库（如 PostgreSQL、MongoDB），只用 SQLite
- 不要引入 Redis、消息队列等中间件
- 不要在浏览器端直接调用外部 API，必须通过 Next.js 的 rewrite 代理
