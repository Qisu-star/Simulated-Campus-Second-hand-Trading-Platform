# Agent Skills

本目录记录如何把已有 Midway REST 能力写成 Agent 可读的 Skill（指引层）。Skill 本身不发 HTTP；Agent 仍通过已有工具调用后端。

当前示例：

| Skill                             | 对应 API           | 说明                                          |
| --------------------------------- | ------------------ | --------------------------------------------- |
| [find-courses](./find-courses.md) | `GET /api/courses` | 列课程；可选在返回结果上做 Agent 侧关键词过滤 |

可执行副本位于 [`.cursor/skills/find-courses/SKILL.md`](../../.cursor/skills/find-courses/SKILL.md)，供 Cursor Agent 按 description 发现并加载。

## 与 MCP 的关系

- **Skill**：补充何时调用、如何组装请求、如何解释结果与失败。
- **MCP Tool**：把 REST 封装成可发现、可结构化调用的执行入口。

课程作业可二选一；本仓库先提供 Skill。业务规则、鉴权与契约仍以 Midway + OpenAPI 为准，Agent 不是超级用户。
