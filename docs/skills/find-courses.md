# find-courses Skill

> 状态：已落地（指引层）  
> 关联 Spec：[001：课程目录](../../specs/001-course-catalog.md)  
> Agent 文件：[`.cursor/skills/find-courses/SKILL.md`](../../.cursor/skills/find-courses/SKILL.md)

本 Skill 演示如何把**已经实现**的课程列表 API 交给 Agent 使用。它不依赖 Spec 003 的服务端 `keyword` 搜索。

## 为什么这样做

课件中的 `search-courses` 示例假设存在 `GET /api/courses?keyword=`。当前仓库只实现了无 Query 的 `listCourses`。因此本 Skill：

1. 只调用已有 `GET /api/courses`；
2. 若用户提供关键词，在响应 `data` 上对 `title` / `description` 做本地包含匹配；
3. 明确告诉用户：过滤发生在 Agent 侧，不是服务端搜索。

等 Spec 003 落地后，可新增或演进为真正传 `keyword` 的 Skill，而不改变「Agent 接入层不复制后端逻辑」这一底线。

## 契约对齐

| 项 | 当前事实 |
| -- | -------- |
| Method / Path | `GET /api/courses` |
| 成功体 | `{ "data": Course[] }`，`Course` 含 `id`、`title`、`description`、`createdAt` |
| 空列表 | `200` + `{ "data": [] }`，不是错误 |
| 服务端筛选 | 无；禁止在请求中虚构 `?keyword=` |

权威 Schema 见 [`contracts/openapi.yaml`](../../contracts/openapi.yaml)。

## 验收清单

- [ ] 用户说「列出课程 / 找 Web 相关课程」时，Agent 会加载本 Skill
- [ ] 实际 HTTP 仅为 `GET /api/courses`（可带用户指定的 base URL）
- [ ] 关键词只来自用户表述，不虚构筛选条件
- [ ] 空列表或过滤后为空时报告「没有匹配课程」，不报失败
- [ ] 错误信息不含堆栈、数据库路径或密钥
- [ ] 做过本地过滤时，回复中说明过滤在 Agent 侧

## 演示步骤

1. 启动后端：`npm run dev --workspace backend`（默认 `http://localhost:7001`）
2. 在 Cursor 中提出：「帮我找和 React 相关的课程」
3. 确认 Agent 调用 `GET /api/courses`，并在结果中按 `title` / `description` 筛选后回复
