# 008：收藏功能

> 状态：草案  
> 关联事项：依赖 002（商品详情）中的收藏入口；003（用户登录与注册）中的用户认证

## 目标

已登录用户可以在商品详情页收藏商品或商家，并通过收藏页面统一查看已收藏的商品和商家。

## 用户故事

作为一名已登录用户，我希望收藏感兴趣的商品和商家，以便日后快速找到它们。

## 范围

- 商品详情页提供收藏商品和收藏商家的操作按钮
- 商品详情页显示当前商品和商家的收藏状态
- 收藏操作为切换式（已收藏则取消收藏，未收藏则收藏）
- 收藏界面分为"商品"和"商家"两个分类标签页
- 收藏列表按收藏时间倒序排列

## 非目标

- 收藏页面的入口导航（后续设计）
- 收藏夹分组或自定义标签
- 收藏商品数量上限
- 收藏后通知（如商品降价、商家上新）
- 收藏列表搜索或筛选

## 业务规则

- **BR-01**：仅已登录用户可执行收藏和取消收藏操作；未登录用户点击收藏按钮时引导登录。
- **BR-02**：收藏操作为切换式：未收藏时点击执行收藏，已收藏时点击取消收藏。
- **BR-03**：同一用户对同一商品或同一商家只能收藏一次，重复收藏视为无效（或等价于取消收藏后再收藏）。
- **BR-04**：收藏列表按收藏时间倒序排列，最新收藏的排在最前。
- **BR-05**：商品收藏列表中的商品卡片与浏览页一致（展示图片、名称、价格、数量），可点击进入商品详情页。
- **BR-06**：商家收藏列表仅展示商家名称；可点击进入商家主页。
- **BR-07**：商品被下架后，仍保留在用户的商品收藏列表中，但卡片上显示"已下架"标识。

## Contract 影响

- 结论：新增
- 理由或影响摘要：新增收藏相关接口，供前端实现收藏/取消收藏操作及收藏列表查询。
- OpenAPI operation：
  - `POST /api/favorites/items/{id}`（`favoriteItem`）— 收藏商品
  - `DELETE /api/favorites/items/{id}`（`unfavoriteItem`）— 取消收藏商品
  - `GET /api/favorites/items?page=&pageSize=`（`listFavoriteItems`）— 收藏商品列表
  - `POST /api/favorites/sellers/{id}`（`favoriteSeller`）— 收藏商家
  - `DELETE /api/favorites/sellers/{id}`（`unfavoriteSeller`）— 取消收藏商家
  - `GET /api/favorites/sellers?page=&pageSize=`（`listFavoriteSellers`）— 收藏商家列表
  - `GET /api/items/{id}`（`getItemById`）— 变更，响应新增 `isItemFavorited` 和 `isSellerFavorited` 布尔字段（仅已登录用户返回有效值）
- 迁移 / 废弃安排：不适用

## 验收标准

- **AC-01**：给定已登录用户且商品未收藏，当请求 `POST /api/favorites/items/{id}` 时，返回 201，收藏成功。
- **AC-02**：给定已登录用户且商品已收藏，当请求 `DELETE /api/favorites/items/{id}` 时，返回 200，取消收藏成功。
- **AC-03**：给定未登录用户，当请求 `POST /api/favorites/items/{id}` 时，返回 401。
- **AC-04**：给定已登录用户收藏了多件商品，当请求 `GET /api/favorites/items` 时，返回按收藏时间倒序排列的商品列表，每件商品包含完整商品卡片信息。
- **AC-05**：给定已登录用户收藏了多个商家，当请求 `GET /api/favorites/sellers` 时，返回按收藏时间倒序排列的商家列表，每家包含商家名称和在售商品数量。
- **AC-06**：给定已登录用户访问商品详情页，响应中 `isItemFavorited` 和 `isSellerFavorited` 字段反映真实的收藏状态。
- **AC-07**：给定商品已被下架，该商品仍出现在用户的商品收藏列表中，但显示"已下架"标识。
- **AC-08**：收藏页面包含"商品"和"商家"两个分类标签页，点击切换。

## 验证映射

| AC    | 验证方式         | 命令或可复现步骤                   | 结果 / 证据 |
| ----- | ---------------- | ---------------------------------- | ----------- |
| AC-01 | API Test         | `npm run test --workspace backend` | 实现后填写  |
| AC-02 | API Test         | `npm run test --workspace backend` | 实现后填写  |
| AC-03 | API Test         | `npm run test --workspace backend` | 实现后填写  |
| AC-04 | API Test         | `npm run test --workspace backend` | 实现后填写  |
| AC-05 | API Test         | `npm run test --workspace backend` | 实现后填写  |
| AC-06 | API Test         | `npm run test --workspace backend` | 实现后填写  |
| AC-07 | API Test         | `npm run test --workspace backend` | 实现后填写  |
| AC-08 | 组件或浏览器测试 | 查看收藏页面的分类标签页切换       | 实现后填写  |

## 验收记录

- `npm run check`：[待执行]
- 人工验收：[待执行]
- 已知限制：无
