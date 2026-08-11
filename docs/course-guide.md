# 课程使用指南

## 推荐学习顺序

1. 运行项目，观察前后端日志和浏览器网络请求。
2. 阅读 `specs/001-course-catalog.md`，把验收标准对应到代码。
3. 阅读 [`specs/003-course-keyword-search.md`](../specs/003-course-keyword-search.md) 与 [ADR-002](./adr/002-course-search-responsibility-boundary.md)，比较 Spec 与 ADR 各自保留的信息。
4. 阅读 [Agent Skills：find-courses](./skills/find-courses.md)，用已有 `GET /api/courses` 演示 Skill 指引层（可选 Agent 侧过滤）。
5. 修改一个页面组件，并通过 ESLint 和构建检查。
6. 新增一个 API 字段，同时修改 OpenAPI 契约、后端和前端。
7. 完成创建课程表单，为校验逻辑补充测试。
8. 使用 Docker Compose 运行完整应用。

## 每次功能迭代

1. 按 [`specs/README.md`](../specs/README.md) 创建或更新 Spec，先确认目标、范围、非目标、业务规则和 `AC-xx`。
2. 有 HTTP 影响时，按 [`contracts/README.md`](../contracts/README.md) 先更新 OpenAPI，并把 operation 追溯到对应 Spec / AC。
3. 实现后端并测试合法输入、边界、空结果、错误、权限和并发中的适用项。
4. 实现前端的加载、空、成功和错误状态，并检查语义、键盘操作和可见焦点。
5. 将自动测试或人工步骤映射回每条 AC，运行 `npm run check`，记录可复现的验收证据。

纯文档、格式化或不改变外部行为的内部重构可以不新增 Spec；HTTP 外部行为不变时也无需改 Contract，但交付说明必须明确这一点。

## 教学提示

脚手架刻意保持依赖较少。引入状态库、ORM、认证方案或组件库前，先说明它解决的具体问题，并记录取舍。这样学生看到的是工程决策，而不只是工具清单。
