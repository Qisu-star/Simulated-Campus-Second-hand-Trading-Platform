# 校园二手交易平台 · 实施计划

> **For agentic workers:** 使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 按任务逐步实施。步骤使用 `- [ ]` 语法追踪进度。

**目标：** 基于课程模板脚手架，实现一个完整的校园二手交易与闲置物品流转平台

**架构：** 前端 Next.js (App Router) + 后端 Midway.js (Koa) + SQLite，monorepo 结构。后端遵循 Controller → Service 分层，所有业务逻辑在 Service 中；前端使用 'use client' 交互组件，API 调用统一在 `lib/api.ts` 中。

**Tech Stack:** Next.js ^16.2, React ^19.2, Midway.js ^4.2, node:sqlite (内置), Tailwind CSS v4, TypeScript

---

## 全局约束

- 所有代码使用 TypeScript
- 不使用额外的状态管理库（Redux、Zustand 等），使用 React 内置 useState/useContext
- 不使用额外的 UI 组件库（Ant Design、MUI 等），使用 Tailwind utility class
- 数据库仅使用 SQLite（node:sqlite 内置模块），不引入其他数据库
- 不引入 Redis、消息队列等中间件
- 不在浏览器端直接调用外部 API，通过 Next.js rewrite 代理
- 后端分层：Controller → Service → Entity；Controller 只做参数解析和响应返回
- 前端交互组件使用 'use client'；API 调用统一放在 `lib/api.ts` 中
- 提交前必须通过 `npm run check`
- 每次 git 提交只完成一个功能的完整实现（完成一个 Spec 提交一次）

---

## 文件结构规划

### 后端 (`backend/src/`)

```
backend/src/
├── configuration.ts          # Midway 应用配置
├── interface.ts              # 全局类型定义
├── config/
│   └── config.default.ts     # 数据库路径、端口等配置
├── controller/
│   ├── api.controller.ts     # 公开 API（商品浏览、详情、搜索、分类）
│   ├── auth.controller.ts    # 认证相关（登录、注册、修改密码）
│   ├── cart.controller.ts    # 购物车相关
│   ├── order.controller.ts   # 订单相关（购买、售出、签收）
│   ├── account.controller.ts # 虚拟账户相关
│   ├── favorite.controller.ts # 收藏相关
│   └── admin.controller.ts   # 管理后台（审核）
├── service/
│   ├── course.service.ts     # 模板示例（后续可删除或保留）
│   ├── item.service.ts       # 商品 CRUD、搜索、分类筛选
│   ├── auth.service.ts       # 用户注册、登录、密码管理
│   ├── cart.service.ts       # 购物车管理
│   ├── order.service.ts      # 订单创建、状态管理、并发控制
│   ├── account.service.ts    # 虚拟账户余额、支付密码
│   ├── favorite.service.ts   # 收藏管理
│   └── admin.service.ts      # 审核管理
├── utils/
│   ├── course-input.ts       # 模板示例
│   ├── auth.ts               # JWT/Token 生成与验证
│   └── validate.ts           # 输入校验工具
└── entity/                   # 数据访问层（按需，或直接在 Service 中管理 SQL）
    ├── user.ts
    ├── item.ts
    ├── order.ts
    ├── cart.ts
    ├── review.ts
    ├── favorite.ts
    └── account.ts
```

### 前端 (`frontend/src/`)

```
frontend/src/
├── app/
│   ├── layout.tsx            # 全局布局（含导航栏）
│   ├── page.tsx              # 浏览页（主界面）
│   ├── globals.css           # 全局样式
│   ├── items/
│   │   └── [id]/
│   │       └── page.tsx      # 商品详情页
│   ├── auth/
│   │   ├── login/
│   │   │   └── page.tsx      # 登录页
│   │   └── register/
│   │       └── page.tsx      # 注册页
│   ├── search/
│   │   └── page.tsx          # 搜索结果页
│   ├── cart/
│   │   └── page.tsx          # 购物车页
│   ├── orders/
│   │   └── page.tsx          # 订单页（购买/售出标签）
│   ├── favorites/
│   │   └── page.tsx          # 收藏页（商品/商家标签）
│   ├── sellers/
│   │   └── [id]/
│   │       └── page.tsx      # 商家主页
│   ├── account/
│   │   └── page.tsx          # 虚拟账户页
│   ├── profile/
│   │   └── page.tsx          # 个人中心页
│   ├── admin/
│   │   └── reviews/
│   │       └── page.tsx      # 审核管理页
│   └── my-items/
│       └── page.tsx          # 商家商品管理页
├── components/
│   ├── navbar.tsx            # 全局导航栏
│   ├── item-card.tsx         # 商品卡片（复用）
│   ├── category-filter.tsx   # 分类筛选栏
│   ├── search-bar.tsx        # 搜索栏
│   └── ...                   # 其他复用组件
└── lib/
    ├── api.ts                # 统一 API 调用
    ├── auth.ts               # 认证状态管理（Token 存储）
    └── types.ts              # 前端类型定义
```

### 契约 (`contracts/`)

```
contracts/
└── openapi.yaml              # OpenAPI 3.1 规范，按 Spec 逐步扩展
```

---

## 实施顺序

按依赖关系分 6 个阶段实施：

```
Phase 1 ─ 003 用户认证 ─────────────── 基础：用户系统、Token、角色
Phase 2 ─ 001 + 005 + 002 + 006 ────── 核心：浏览、分类、详情、搜索
Phase 3 ─ 004 + 007 ────────────────── 商家：商品管理、商家主页
Phase 4 ─ 009 + 010 ────────────────── 框架：导航布局、个人中心
Phase 5 ─ 008 + 012 ────────────────── 交易：收藏、购物车、支付、订单
Phase 6 ─ 011 + 013 ────────────────── 收尾：评价、后台审核
```

---

### Phase 1: 用户认证系统（003）

**依赖：** 无（基础模块）

**Files:**
- Create: `backend/src/controller/auth.controller.ts`
- Create: `backend/src/service/auth.service.ts`
- Create: `backend/src/utils/auth.ts`
- Modify: `backend/src/interface.ts`
- Modify: `backend/src/configuration.ts`
- Create: `frontend/src/app/auth/login/page.tsx`
- Create: `frontend/src/app/auth/register/page.tsx`
- Create: `frontend/src/lib/auth.ts`
- Create: `frontend/src/lib/api.ts`
- Modify: `contracts/openapi.yaml`

**Interfaces:**
- Produces: `User { id, username, role, createdAt }`, `AuthToken`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PUT /api/auth/password`

- [ ] **Step 1: 定义 User 接口和数据库表**

```typescript
// backend/src/interface.ts - 追加
export interface User {
  id: number;
  username: string;
  password: string; // hashed
  role: "user" | "admin";
  createdAt: string;
}

export interface UserPublic {
  id: number;
  username: string;
  role: "user" | "admin";
  createdAt: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  password: string;
}

export interface UpdatePasswordInput {
  currentPassword: string;
  newPassword: string;
}
```

- [ ] **Step 2: 实现 auth.service.ts**（注册、登录、密码验证、预置管理员）

```typescript
// 核心方法：
// register(input: RegisterInput): UserPublic
// login(input: LoginInput): { token, user: UserPublic }
// getUserById(id: number): UserPublic
// updatePassword(userId: number, current: string, newPwd: string): void
// initialize(): void — 创建 users 表 + 预置 admin 账号
```

- [ ] **Step 3: 实现 auth.ts 工具**（JWT Token 生成与验证）

```typescript
// generateToken(userId: number, role: string): string
// verifyToken(token: string): { userId: number, role: string }
```

- [ ] **Step 4: 实现 auth.controller.ts**

```typescript
@Controller("/api/auth")
export class AuthController {
  // POST /register
  // POST /login
  // POST /logout
  // GET /me
  // PUT /password
}
```

- [ ] **Step 5: 编写后端测试**

```typescript
// test/auth.test.mts
// - 注册成功 → 201
// - 重复用户名 → 409
// - 密码不足6位 → 400
// - 登录成功 → 200 + token
// - 登录失败 → 401
// - GET /me 返回用户信息
// - 未登录 → 401
// - 预置 admin 账号存在
```

- [ ] **Step 6: 实现前端登录/注册页**

```typescript
// frontend/src/app/auth/login/page.tsx - 'use client'
// frontend/src/app/auth/register/page.tsx - 'use client'
// frontend/src/lib/auth.ts - Token 存储、认证状态管理
```

- [ ] **Step 7: 更新 contracts/openapi.yaml** 添加认证相关路径和 Schema

- [ ] **Step 8: 运行 `npm run check` 确保通过，提交**

---

### Phase 2: 核心浏览功能（001 + 005 + 002 + 006）

**依赖：** Phase 1

**Files:**
- Create: `backend/src/service/item.service.ts`
- Create: `backend/src/controller/api.controller.ts`（扩展）
- Create: `frontend/src/app/page.tsx`（重写浏览页）
- Create: `frontend/src/components/item-card.tsx`
- Create: `frontend/src/components/category-filter.tsx`
- Create: `frontend/src/components/search-bar.tsx`
- Create: `frontend/src/app/items/[id]/page.tsx`
- Create: `frontend/src/app/search/page.tsx`
- Create: `frontend/src/lib/api.ts`（扩展）
- Modify: `contracts/openapi.yaml`

**Interfaces:**
- Produces: `Item { id, title, price, quantity, description, images, category, seller, status, createdAt }`, `GET /api/items`, `GET /api/items/{id}`, `GET /api/items/search`, `GET /api/categories`

#### Task 2.1: 商品数据模型 + 浏览接口（001）

- [ ] **Step 1: 定义 Item 接口和数据库表**

```typescript
// backend/src/interface.ts
export interface Item {
  id: number;
  title: string;
  price: number;
  quantity: number;
  description: string;
  images: string[];  // JSON array
  coverImage: string;
  category: string;
  sellerId: number;
  sellerName: string;
  status: "pending" | "active" | "sold_out" | "delisted";
  createdAt: string;
  quantityUpdatedAt?: string; // 用于自动下架计时
}
```

- [ ] **Step 2: 实现 item.service.ts** — `listItems(page, pageSize, category?)` 方法

- [ ] **Step 3: 实现 api.controller.ts** — `GET /api/items` 和 `GET /api/categories`

- [ ] **Step 4: 编写前端 item-card.tsx 组件**

- [ ] **Step 5: 重写浏览页 page.tsx** — 商品卡片网格、分页、分类筛选栏、加载/空/错误状态

- [ ] **Step 6: 编写后端测试** — 排序、分页、空结果、分类筛选

#### Task 2.2: 商品详情页（002）

- [ ] **Step 1: 实现 item.service.ts** — `getItemById(id, userId?)` 方法（含收藏状态）

- [ ] **Step 2: 实现 api.controller.ts** — `GET /api/items/{id}`

- [ ] **Step 3: 实现详情页前端** — 图片轮播、商品信息、商家链接、收藏按钮、购买按钮

- [ ] **Step 4: 编写后端测试** — 完整字段、空描述、非在售返回 404、收藏状态

#### Task 2.3: 商品搜索（006）

- [ ] **Step 1: 实现 item.service.ts** — `searchItems(q, category?, page, pageSize)` 方法

- [ ] **Step 2: 实现 api.controller.ts** — `GET /api/items/search`

- [ ] **Step 3: 实现搜索页前端** — 搜索结果展示、分类筛选叠加、搜索历史（localStorage）

- [ ] **Step 4: 编写后端测试** — 关键词匹配、空描述排除、搜索+分类叠加、空关键词

- [ ] **Step 5: 运行 `npm run check` 确保通过，提交**

---

### Phase 3: 商家功能（004 + 007）

**依赖：** Phase 1, Phase 2

**Files:**
- Modify: `backend/src/service/item.service.ts`（扩展：创建、编辑、下架、自动下架）
- Modify: `backend/src/controller/api.controller.ts`（扩展）
- Create: `frontend/src/app/my-items/page.tsx`
- Create: `frontend/src/app/items/new/page.tsx`
- Create: `frontend/src/app/items/[id]/edit/page.tsx`
- Create: `frontend/src/app/sellers/[id]/page.tsx`

#### Task 3.1: 商家商品管理（004）

- [ ] **Step 1: 扩展 item.service.ts** — `createItem()`, `updateItem()`, `updateItemStatus()`, `listMyItems()`

- [ ] **Step 2: 扩展 api.controller.ts** — `POST /api/items`, `PUT /api/items/{id}`, `PATCH /api/items/{id}/status`, `GET /api/items/mine`

- [ ] **Step 3: 实现自动下架定时任务** — 检查 `quantity=0` 且 `quantityUpdatedAt` 超过 7 天的商品

- [ ] **Step 4: 实现前端商家商品管理页** — 商品列表、发布表单、编辑表单、下架操作

- [ ] **Step 5: 编写后端测试** — 发布、编辑、越权、下架后不可见、自动下架

#### Task 3.2: 商家主页（007）

- [ ] **Step 1: 扩展 item.service.ts** — `listSellerItems(sellerId, category?, page, pageSize)`

- [ ] **Step 2: 扩展 api.controller.ts** — `GET /api/sellers/{id}`, `GET /api/sellers/{id}/items`

- [ ] **Step 3: 实现商家主页前端** — 商家信息、商品列表（在售）、分类筛选、近期评价

- [ ] **Step 4: 编写后端测试** — 仅返回在售商品、分类筛选

- [ ] **Step 5: 运行 `npm run check` 确保通过，提交**

---

### Phase 4: 页面框架与个人中心（009 + 010）

**依赖：** Phase 1

**Files:**
- Create: `frontend/src/components/navbar.tsx`
- Create: `frontend/src/app/layout.tsx`（重写）
- Create: `frontend/src/app/profile/page.tsx`

#### Task 4.1: 全局导航栏（009）

- [ ] **Step 1: 实现 navbar.tsx 组件** — 主界面入口、搜索框、个人入口（下拉菜单）、收藏入口、购物车入口

- [ ] **Step 2: 重写 layout.tsx** — 集成导航栏，全局布局

- [ ] **Step 3: 实现前端路由守卫** — 未登录访问受保护页面时跳转登录页

#### Task 4.2: 个人中心（010）

- [ ] **Step 1: 实现 auth.service.ts** — `updatePassword()` 方法

- [ ] **Step 2: 实现 auth.controller.ts** — `PUT /api/auth/password`

- [ ] **Step 3: 实现个人中心前端** — 用户名展示、修改密码表单

- [ ] **Step 4: 编写后端测试** — 修改密码成功、旧密码错误、新密码过短

- [ ] **Step 5: 运行 `npm run check` 确保通过，提交**

---

### Phase 5: 收藏与交易系统（008 + 012）

**依赖：** Phase 1, Phase 2, Phase 4

**Files:**
- Create: `backend/src/service/favorite.service.ts`
- Create: `backend/src/controller/favorite.controller.ts`
- Create: `backend/src/service/cart.service.ts`
- Create: `backend/src/service/order.service.ts`
- Create: `backend/src/service/account.service.ts`
- Create: `backend/src/controller/cart.controller.ts`
- Create: `backend/src/controller/order.controller.ts`
- Create: `backend/src/controller/account.controller.ts`
- Create: `frontend/src/app/favorites/page.tsx`
- Create: `frontend/src/app/cart/page.tsx`
- Create: `frontend/src/app/orders/page.tsx`
- Create: `frontend/src/app/account/page.tsx`

#### Task 5.1: 收藏功能（008）

- [ ] **Step 1: 实现 favorite.service.ts** — 收藏/取消收藏商品、商家，查询收藏列表

- [ ] **Step 2: 实现 favorite.controller.ts** — 收藏相关接口

- [ ] **Step 3: 扩展 api.controller.ts** — 详情页响应增加收藏状态字段

- [ ] **Step 4: 实现收藏页前端** — 商品/商家标签页、点击跳转详情/商家主页

- [ ] **Step 5: 编写后端测试** — 收藏/取消、重复收藏、越权、下架商品仍显示

#### Task 5.2: 虚拟账户（012 部分）

- [ ] **Step 1: 实现 account.service.ts** — 账户创建、余额设置、支付密码设置与验证

- [ ] **Step 2: 实现 account.controller.ts** — 账户相关接口

- [ ] **Step 3: 实现账户页前端** — 余额设置、支付密码设置

- [ ] **Step 4: 编写后端测试** — 余额设置、密码验证、密码格式校验

#### Task 5.3: 购物车与支付（012 核心）

- [ ] **Step 1: 实现 cart.service.ts** — 加购、查看、删除、合并数量

- [ ] **Step 2: 实现 cart.controller.ts** — 购物车接口

- [ ] **Step 3: 实现 order.service.ts** — 核心支付逻辑（含事务并发控制）

```typescript
// checkout 核心逻辑（伪代码）
async checkout(userId, cartItemIds, paymentPassword) {
  // 1. 验证支付密码
  // 2. 计算总价
  // 3. 数据库事务 BEGIN IMMEDIATE
  //    a. 逐件检查库存 ≥ 需求数量
  //    b. 逐件扣减库存
  //    c. 检查买家余额 ≥ 总价
  //    d. 扣减买家余额
  //    e. 逐件增加各卖家余额
  //    f. 逐件创建订单（status: "pending_receipt"）
  //    g. 从购物车中移除已支付的商品
  // 4. 事务提交
  // 5. 返回成功/失败结果
}
```

- [ ] **Step 4: 实现 order.controller.ts** — 结算、订单列表（购买/售出）、确认签收

- [ ] **Step 5: 实现购物车页前端** — 商品列表、勾选、结算按钮

- [ ] **Step 6: 实现支付交互** — 选择支付方式、输入支付密码、支付结果展示

- [ ] **Step 7: 实现订单页前端** — 购买/售出标签页、确认签收按钮

- [ ] **Step 8: 编写并发测试** — 模拟同时支付同一商品，验证仅一单成功

- [ ] **Step 9: 运行 `npm run check` 确保通过，提交**

---

### Phase 6: 评价与后台审核（011 + 013）

**依赖：** Phase 2, Phase 3, Phase 5

**Files:**
- Create: `backend/src/service/review.service.ts`
- Create: `backend/src/controller/review.controller.ts`
- Create: `backend/src/service/admin.service.ts`
- Create: `backend/src/controller/admin.controller.ts`
- Create: `frontend/src/app/admin/reviews/page.tsx`

#### Task 6.1: 商品评价（011）

- [ ] **Step 1: 实现 review.service.ts** — 创建评价、查询商品评价、查询商家近期评价

- [ ] **Step 2: 实现 review.controller.ts** — `POST /api/reviews`

- [ ] **Step 3: 扩展订单接口** — 已签收订单显示"去评价"按钮

- [ ] **Step 4: 编写后端测试** — 评价成功、重复评价、越权、评分范围校验

#### Task 6.2: 后台审核（013）

- [ ] **Step 1: 实现 admin.service.ts** — 待审核列表、审核通过、审核驳回

- [ ] **Step 2: 实现 admin.controller.ts** — 审核接口（仅 admin 角色）

- [ ] **Step 3: 实现审核页前端** — 待审核商品列表、通过/驳回操作

- [ ] **Step 4: 扩展 item.service.ts** — 驳回后重新提交逻辑、审核通过后编辑不重置状态

- [ ] **Step 5: 编写后端测试** — 管理员权限、审核流程、重新提交

- [ ] **Step 6: 运行 `npm run check` 确保通过，提交**

---

## 关键架构决策

### 1. 数据库表结构

```sql
-- users
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,  -- bcrypt hashed
  role TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- items
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]',  -- JSON array
  cover_image TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  seller_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'active' | 'delisted'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  quantity_updated_at TEXT,  -- 用于自动下架计时
  FOREIGN KEY (seller_id) REFERENCES users(id)
);

-- cart_items (预订单)
CREATE TABLE cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

-- orders
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  total_price REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_receipt',  -- 'pending_receipt' | 'received'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (buyer_id) REFERENCES users(id),
  FOREIGN KEY (seller_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

-- reviews
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE,
  item_id INTEGER NOT NULL,
  buyer_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,  -- 1-10
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (item_id) REFERENCES items(id),
  FOREIGN KEY (buyer_id) REFERENCES users(id)
);

-- favorites
CREATE TABLE favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_id INTEGER,      -- 收藏商品（可为空）
  seller_id INTEGER,    -- 收藏商家（可为空）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES items(id),
  FOREIGN KEY (seller_id) REFERENCES users(id)
);

-- accounts (虚拟账户)
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  balance REAL NOT NULL DEFAULT 0,
  payment_password TEXT,  -- 6位数字，哈希存储
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 2. 并发控制策略

支付时使用 `BEGIN IMMEDIATE` 事务 + 串行化：

```typescript
// 伪代码 — 并发安全的支付流程
this.database.exec("BEGIN IMMEDIATE");
try {
  // 1. 检查并扣减库存（在同一事务中）
  const item = this.database.prepare(
    "SELECT quantity FROM items WHERE id = ? FOR UPDATE"
  ).get(itemId);
  if (item.quantity < requestedQty) throw new Error("库存不足");
  this.database.prepare(
    "UPDATE items SET quantity = ?, quantity_updated_at = ? WHERE id = ?"
  ).run(item.quantity - requestedQty, now, itemId);

  // 2. 检查并扣减买家余额
  // 3. 增加卖家余额
  // 4. 创建订单

  this.database.exec("COMMIT");
} catch (error) {
  this.database.exec("ROLLBACK");
  throw error;
}
```

> 注意：`node:sqlite` 的 `DatabaseSync` 是同步 API，但多个请求在 Midway.js 中可能并发执行。`BEGIN IMMEDIATE` 确保 SQLite 级别的写锁，即使多个请求同时到达，也会排队执行事务。

### 3. 自动下架实现

在 `item.service.ts` 中实现一个 `autoDelistExpiredItems()` 方法，在服务启动时和每次商品查询时调用：

```typescript
autoDelistExpiredItems(): void {
  this.database.exec(`
    UPDATE items SET status = 'delisted'
    WHERE status = 'active'
      AND quantity = 0
      AND quantity_updated_at IS NOT NULL
      AND datetime(quantity_updated_at, '+7 days') <= datetime('now')
  `);
}
```

### 4. 认证中间件

创建 `@Authenticate()` 装饰器或中间件函数，提取 Token → 验证 → 注入用户信息到请求上下文。用于需要登录的接口。

```typescript
// 在 controller 中标记需要认证的路由
@Get("/me", { middleware: [authMiddleware] })
async me(@Headers("authorization") auth: string) { ... }
```

---

## 验证策略

| 类型 | 工具 | 覆盖范围 |
|------|------|----------|
| API 测试 | `node:test` + `@midwayjs/mock` | 后端接口：状态码、JSON 结构、边界值、权限 |
| 并发测试 | `node:test` 模拟并发请求 | 同商品同时支付场景 |
| 组件测试 | `node --test` + JSDOM | 前端组件渲染、交互状态 |
| 人工验收 | 浏览器手动测试 | 页面跳转、UI 展示、交互流程 |
| 完整性检查 | `npm run check` | 格式化、Lint、类型检查、测试、构建 |