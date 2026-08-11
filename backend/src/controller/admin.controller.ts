import {
  Controller,
  Get,
  Headers,
  httpError,
  Inject,
  Param,
  Post,
  Query,
} from "@midwayjs/core";
import { Context } from "@midwayjs/koa";
import { AuthService } from "../service/auth.service";
import { ItemService } from "../service/item.service";
import { verifyToken } from "../utils/auth";

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

@Controller("/api/admin")
export class AdminController {
  @Inject()
  ctx: Context;

  @Inject()
  itemService: ItemService;

  @Inject()
  authService: AuthService;

  private async checkAdmin(authorization: string | undefined): Promise<number> {
    const token = extractToken(authorization);
    if (!token) {
      this.ctx.status = 401;
      this.ctx.body = { message: "未登录" };
      return 0;
    }

    const payload = verifyToken(token);
    if (!payload) {
      this.ctx.status = 401;
      this.ctx.body = { message: "登录已过期" };
      return 0;
    }

    const user = this.authService.getUserById(payload.userId);
    if (!user) {
      this.ctx.status = 401;
      this.ctx.body = { message: "用户不存在" };
      return 0;
    }

    if (user.role !== "admin") {
      this.ctx.status = 403;
      this.ctx.body = { message: "仅管理员可执行此操作" };
      return 0;
    }

    return payload.userId;
  }

  @Get("/reviews")
  async listPendingReviews(
    @Headers("authorization") authorization: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const userId = await this.checkAdmin(authorization);
    if (!userId) {
      return;
    }

    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;

    return this.itemService.listPendingItems(p, ps);
  }

  @Post("/reviews/:id/approve")
  async approveReview(
    @Headers("authorization") authorization: string,
    @Param("id") id: string,
  ) {
    const userId = await this.checkAdmin(authorization);
    if (!userId) {
      return;
    }

    const itemId = Number(id);
    if (!Number.isFinite(itemId)) {
      this.ctx.status = 400;
      this.ctx.body = { message: "无效的商品 ID" };
      return;
    }

    try {
      this.itemService.approveItem(itemId);
      return { message: "审核通过" };
    } catch (reason) {
      if (reason instanceof Error && reason.message === "商品不存在") {
        this.ctx.status = 404;
        this.ctx.body = { message: "商品不存在" };
        return;
      }
      throw reason;
    }
  }

  @Post("/reviews/:id/reject")
  async rejectReview(
    @Headers("authorization") authorization: string,
    @Param("id") id: string,
  ) {
    const userId = await this.checkAdmin(authorization);
    if (!userId) {
      return;
    }

    const itemId = Number(id);
    if (!Number.isFinite(itemId)) {
      this.ctx.status = 400;
      this.ctx.body = { message: "无效的商品 ID" };
      return;
    }

    try {
      this.itemService.rejectItem(itemId);
      return { message: "已驳回" };
    } catch (reason) {
      if (reason instanceof Error && reason.message === "商品不存在") {
        this.ctx.status = 404;
        this.ctx.body = { message: "商品不存在" };
        return;
      }
      throw reason;
    }
  }
}
