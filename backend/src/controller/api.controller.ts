import { Body, Controller, Get, Headers, httpError, Inject, Param, Patch, Post, Put, Query } from "@midwayjs/core";
import { Context } from "@midwayjs/koa";
import { AuthService } from "../service/auth.service";
import { FavoriteService } from "../service/favorite.service";
import { ItemService } from "../service/item.service";
import { ReviewService } from "../service/review.service";
import { verifyToken } from "../utils/auth";

@Controller("/api")
export class ApiController {
  @Inject()
  authService: AuthService;

  @Inject()
  itemService: ItemService;

  @Inject()
  favoriteService: FavoriteService;

  @Inject()
  reviewService: ReviewService;

  @Inject()
  ctx: Context;

  @Get("/items")
  async listItems(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("category") category?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));

    return this.itemService.listItems(p, ps, category);
  }

  @Get("/categories")
  async listCategories() {
    return { data: this.itemService.listCategories() };
  }

  @Get("/items/search")
  async searchItems(
    @Query("q") q: string,
    @Query("category") category?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));

    return this.itemService.searchItems(q, category, p, ps);
  }

  @Get("/items/mine")
  async listMyItems(
    @Headers("authorization") authorization: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const user = getCurrentUserFromToken(authorization);
    if (!user) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));

    return this.itemService.listMyItems(user.userId, p, ps);
  }

  @Get("/items/:id")
  async getItemById(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    const itemId = Number(id);
    if (!Number.isFinite(itemId)) {
      throw new httpError.BadRequestError("无效的商品 ID");
    }

    const item = this.itemService.getItemById(itemId);
    if (!item) {
      throw new httpError.NotFoundError("商品不存在或已下架");
    }

    let isItemFavorited = false;
    let isSellerFavorited = false;
    const token = extractToken(authorization);
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        isItemFavorited = this.favoriteService.isItemFavorited(payload.userId, item.id);
        isSellerFavorited = this.favoriteService.isSellerFavorited(payload.userId, item.sellerId);
      }
    }

    return { data: { ...item, isItemFavorited, isSellerFavorited } };
  }

  @Post("/items")
  async createItem(
    @Headers("authorization") authorization: string,
    @Body() body: unknown,
  ) {
    const user = getCurrentUserFromToken(authorization);
    if (!user) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const username = getCurrentUserName(this.authService, authorization);
    if (!username) {
      throw new httpError.UnauthorizedError("登录已过期");
    }

    if (!isRecord(body)) {
      throw new httpError.BadRequestError("请求体必须是 JSON 对象");
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const price = typeof body.price === "number" ? body.price : Number(body.price);
    const quantity = typeof body.quantity === "number" ? body.quantity : Number(body.quantity);
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const description = typeof body.description === "string" ? body.description : "";
    const images = Array.isArray(body.images) ? body.images.filter((i: unknown) => typeof i === "string") : [];

    // Validation
    if (!title) {
      throw new httpError.BadRequestError("商品名称不能为空");
    }

    if (!Number.isFinite(price) || price <= 0) {
      throw new httpError.BadRequestError("商品价格必须大于 0");
    }

    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
      throw new httpError.BadRequestError("商品数量必须是非负整数");
    }

    const validCategories = this.itemService.listCategories();
    if (!category || !validCategories.includes(category)) {
      throw new httpError.BadRequestError(`无效的商品分类，可选: ${validCategories.join(", ")}`);
    }

    const item = this.itemService.createItem(user.userId, username, {
      title,
      price,
      quantity,
      description,
      category,
      images,
      coverImage: images.length > 0 ? images[0] : "",
      sellerId: user.userId,
    });

    this.ctx.status = 201;
    return { data: item };
  }

  @Put("/items/:id")
  async updateItem(
    @Headers("authorization") authorization: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const user = getCurrentUserFromToken(authorization);
    if (!user) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const itemId = Number(id);
    if (!Number.isFinite(itemId)) {
      throw new httpError.BadRequestError("无效的商品 ID");
    }

    if (!isRecord(body)) {
      throw new httpError.BadRequestError("请求体必须是 JSON 对象");
    }

    // Build update input from body
    const input: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) {
        throw new httpError.BadRequestError("商品名称不能为空");
      }
      input.title = title;
    }

    if (body.price !== undefined) {
      const price = typeof body.price === "number" ? body.price : Number(body.price);
      if (!Number.isFinite(price) || price <= 0) {
        throw new httpError.BadRequestError("商品价格必须大于 0");
      }
      input.price = price;
    }

    if (body.quantity !== undefined) {
      const quantity = typeof body.quantity === "number" ? body.quantity : Number(body.quantity);
      if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
        throw new httpError.BadRequestError("商品数量必须是非负整数");
      }
      input.quantity = quantity;
    }

    if (body.description !== undefined) {
      input.description = typeof body.description === "string" ? body.description : "";
    }

    if (body.category !== undefined) {
      const category = typeof body.category === "string" ? body.category.trim() : "";
      const validCategories = this.itemService.listCategories();
      if (!category || !validCategories.includes(category)) {
        throw new httpError.BadRequestError(`无效的商品分类，可选: ${validCategories.join(", ")}`);
      }
      input.category = category;
    }

    if (body.images !== undefined) {
      if (!Array.isArray(body.images)) {
        throw new httpError.BadRequestError("images 必须是数组");
      }
      input.images = body.images.filter((i: unknown) => typeof i === "string");
    }

    if (body.coverImage !== undefined) {
      input.coverImage = typeof body.coverImage === "string" ? body.coverImage : "";
    }

    try {
      const item = this.itemService.updateItem(user.userId, itemId, input);
      return { data: item };
    } catch (reason) {
      if (reason instanceof Error) {
        if (reason.message === "商品不存在") {
          throw new httpError.NotFoundError("商品不存在");
        }
        if (reason.message === "无权修改此商品") {
          throw new httpError.ForbiddenError("无权修改此商品");
        }
      }
      throw reason;
    }
  }

  @Patch("/items/:id/status")
  async updateItemStatus(
    @Headers("authorization") authorization: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const user = getCurrentUserFromToken(authorization);
    if (!user) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const itemId = Number(id);
    if (!Number.isFinite(itemId)) {
      throw new httpError.BadRequestError("无效的商品 ID");
    }

    if (!isRecord(body)) {
      throw new httpError.BadRequestError("请求体必须是 JSON 对象");
    }

    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (status !== "delisted" && status !== "active") {
      throw new httpError.BadRequestError("无效的状态，仅支持 delisted 或 active");
    }

    try {
      this.itemService.updateItemStatus(user.userId, itemId, status);
      return { message: status === "delisted" ? "商品已下架" : "商品已上架" };
    } catch (reason) {
      if (reason instanceof Error) {
        if (reason.message === "商品不存在") {
          throw new httpError.NotFoundError("商品不存在");
        }
        if (reason.message === "无权修改此商品") {
          throw new httpError.ForbiddenError("无权修改此商品");
        }
      }
      throw reason;
    }
  }

  @Get("/sellers/:id/items")
  async listSellerItems(
    @Param("id") id: string,
    @Query("category") category?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const sellerId = Number(id);
    if (!Number.isFinite(sellerId)) {
      throw new httpError.BadRequestError("无效的商家 ID");
    }

    // Verify seller exists
    const seller = this.authService.getUserById(sellerId);
    if (!seller) {
      throw new httpError.NotFoundError("商家不存在");
    }

    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));

    return this.itemService.listSellerItems(sellerId, category, p, ps);
  }

  @Get("/sellers/:id")
  async getSellerInfo(@Param("id") id: string) {
    const sellerId = Number(id);
    if (!Number.isFinite(sellerId)) {
      throw new httpError.BadRequestError("无效的商家 ID");
    }

    const seller = this.authService.getUserById(sellerId);
    if (!seller) {
      throw new httpError.NotFoundError("商家不存在");
    }

    return { data: { id: seller.id, username: seller.username, createdAt: seller.createdAt } };
  }

  @Get("/sellers/:id/reviews")
  async getSellerReviews(
    @Param("id") id: string,
    @Query("days") days?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const sellerId = Number(id);
    if (!Number.isFinite(sellerId)) {
      throw new httpError.BadRequestError("无效的商家 ID");
    }

    const seller = this.authService.getUserById(sellerId);
    if (!seller) {
      throw new httpError.NotFoundError("商家不存在");
    }

    const d = Math.max(1, Number(days) || 30);
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));

    return this.reviewService.listReviewsBySeller(sellerId, d, p, ps);
  }
}

function getCurrentUserFromToken(authorization: string | undefined): { userId: number } | null {
  if (!authorization || typeof authorization !== "string") {
    return null;
  }

  const parts = authorization.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  const token = parts[1];
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  return { userId: payload.userId };
}

function extractToken(authorization: string | undefined): string | null {
  if (!authorization || typeof authorization !== "string") {
    return null;
  }

  const parts = authorization.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

function getCurrentUserName(authService: AuthService, authorization: string | undefined): string | null {
  if (!authorization || typeof authorization !== "string") {
    return null;
  }

  const parts = authorization.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  const token = parts[1];
  const user = authService.getCurrentUser(token);
  if (!user) {
    return null;
  }

  return user.username;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
