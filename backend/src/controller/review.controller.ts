import { Body, Controller, Get, Headers, httpError, Inject, Param, Post, Query } from "@midwayjs/core";
import { Context } from "@midwayjs/koa";
import { AuthService } from "../service/auth.service";
import { ItemService } from "../service/item.service";
import { OrderService } from "../service/order.service";
import { ReviewService } from "../service/review.service";
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

function getUserIdFromToken(authorization: string | undefined): number | null {
  const token = extractToken(authorization);
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  return payload.userId;
}

@Controller("/api")
export class ReviewController {
  @Inject()
  ctx: Context;

  @Inject()
  reviewService: ReviewService;

  @Inject()
  orderService: OrderService;

  @Inject()
  authService: AuthService;

  @Inject()
  itemService: ItemService;

  @Post("/reviews")
  async createReview(
    @Headers("authorization") authorization: string,
    @Body() body: unknown,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    // Get current user for username
    const token = extractToken(authorization);
    const user = token ? this.authService.getCurrentUser(token) : null;
    if (!user) {
      throw new httpError.UnauthorizedError("登录已过期");
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new httpError.BadRequestError("请求体必须是 JSON 对象");
    }

    const record = body as Record<string, unknown>;
    const orderId = Number(record.orderId);
    const itemId = Number(record.itemId);
    const rating = Number(record.rating);
    const comment = typeof record.comment === "string" ? record.comment : "";

    if (!Number.isInteger(orderId) || orderId < 1) {
      throw new httpError.BadRequestError("无效的订单 ID");
    }

    if (!Number.isInteger(itemId) || itemId < 1) {
      throw new httpError.BadRequestError("无效的商品 ID");
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      throw new httpError.BadRequestError("评分必须在 1-10 之间");
    }

    // Verify the order exists and belongs to this user
    const order = this.orderService.getOrderById(orderId);
    if (!order) {
      throw new httpError.BadRequestError("订单不存在");
    }

    if (order.userId !== userId) {
      throw new httpError.ForbiddenError("无权评价此订单");
    }

    if (order.status !== "received") {
      throw new httpError.ForbiddenError("订单未签收，无法评价");
    }

    // Verify the item is part of this order
    const orderItem = order.items.find((i) => i.itemId === itemId);
    if (!orderItem) {
      throw new httpError.BadRequestError("该商品不在此订单中");
    }

    // Create the review
    try {
      const review = this.reviewService.createReview(userId, user.username, {
        orderId,
        itemId,
        rating,
        comment,
      });

      // Update the seller_id on the review
      this.reviewService.setSellerId(review.id, orderItem.sellerId);

      this.ctx.status = 201;
      return { data: review };
    } catch (reason) {
      if (reason instanceof Error) {
        if (reason.message === "已评价") {
          throw new httpError.ConflictError("已评价");
        }
        throw new httpError.BadRequestError(reason.message);
      }
      throw reason;
    }
  }

  @Get("/items/:id/reviews")
  async listItemReviews(
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const itemId = Number(id);
    if (!Number.isFinite(itemId)) {
      throw new httpError.BadRequestError("无效的商品 ID");
    }

    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;

    return this.reviewService.listReviewsByItem(itemId, p, ps);
  }
}