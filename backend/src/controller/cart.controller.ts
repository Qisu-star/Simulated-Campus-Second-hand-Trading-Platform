import {
  Body,
  Controller,
  Del,
  Get,
  Headers,
  httpError,
  Inject,
  Param,
  Patch,
  Post,
} from "@midwayjs/core";
import { Context } from "@midwayjs/koa";
import { CartService } from "../service/cart.service";
import { verifyToken } from "../utils/auth";
import type { AddToCartInput, BuyNowInput, CheckoutInput } from "../interface";

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

@Controller("/api/cart")
export class CartController {
  @Inject()
  cartService: CartService;

  @Inject()
  ctx: Context;

  @Post("/")
  async addToCart(
    @Headers("authorization") authorization: string,
    @Body() body: unknown,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    if (typeof body !== "object" || body === null) {
      throw new httpError.BadRequestError("请求体必须是 JSON 对象");
    }

    const { itemId, quantity } = body as Record<string, unknown>;
    if (typeof itemId !== "number" || !Number.isInteger(itemId) || itemId < 1) {
      throw new httpError.BadRequestError("商品 ID 无效");
    }
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      throw new httpError.BadRequestError("数量必须为正整数");
    }

    try {
      this.cartService.addToCart(userId, itemId, quantity);
      this.ctx.status = 201;
      return { message: "已加入购物车" };
    } catch (reason) {
      if (reason instanceof Error) {
        throw new httpError.BadRequestError(reason.message);
      }
      throw reason;
    }
  }

  @Get("/")
  async listCart(@Headers("authorization") authorization: string) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const items = this.cartService.listCart(userId);
    return { data: items };
  }

  @Del("/:id")
  async removeFromCart(
    @Headers("authorization") authorization: string,
    @Param("id") id: string,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const cartItemId = Number(id);
    if (!Number.isInteger(cartItemId) || cartItemId < 1) {
      throw new httpError.BadRequestError("无效的购物车项 ID");
    }

    const success = this.cartService.removeFromCart(cartItemId);
    if (!success) {
      throw new httpError.NotFoundError("购物车项不存在");
    }

    return { message: "已从购物车移除" };
  }

  @Patch("/:id/select")
  async toggleSelect(
    @Headers("authorization") authorization: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const cartItemId = Number(id);
    if (!Number.isInteger(cartItemId) || cartItemId < 1) {
      throw new httpError.BadRequestError("无效的购物车项 ID");
    }

    if (typeof body !== "object" || body === null) {
      throw new httpError.BadRequestError("请求体必须是 JSON 对象");
    }

    const { selected } = body as Record<string, unknown>;
    if (typeof selected !== "boolean") {
      throw new httpError.BadRequestError("selected 必须是布尔值");
    }

    const success = this.cartService.toggleSelect(cartItemId, selected);
    if (!success) {
      throw new httpError.NotFoundError("购物车项不存在");
    }

    return { message: selected ? "已勾选" : "已取消勾选" };
  }

  @Post("/checkout")
  async checkout(
    @Headers("authorization") authorization: string,
    @Body() body: unknown,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    if (typeof body !== "object" || body === null) {
      throw new httpError.BadRequestError("请求体必须是 JSON 对象");
    }

    const { paymentPassword } = body as Record<string, unknown>;
    if (typeof paymentPassword !== "string" || paymentPassword.length === 0) {
      throw new httpError.BadRequestError("支付密码不能为空");
    }

    try {
      const result = this.cartService.checkout(userId, paymentPassword);
      return { message: "结算成功", data: { orderId: result.orderId } };
    } catch (reason) {
      if (reason instanceof Error) {
        if (reason.message === "余额不足") {
          this.ctx.throw(402, "余额不足");
        }
        throw new httpError.BadRequestError(reason.message);
      }
      throw reason;
    }
  }

  @Post("/buy-now")
  async buyNow(
    @Headers("authorization") authorization: string,
    @Body() body: unknown,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    if (typeof body !== "object" || body === null) {
      throw new httpError.BadRequestError("请求体必须是 JSON 对象");
    }

    const { itemId, quantity, paymentPassword } = body as Record<
      string,
      unknown
    >;
    if (typeof itemId !== "number" || !Number.isInteger(itemId) || itemId < 1) {
      throw new httpError.BadRequestError("商品 ID 无效");
    }
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      throw new httpError.BadRequestError("数量必须为正整数");
    }
    if (typeof paymentPassword !== "string" || paymentPassword.length === 0) {
      throw new httpError.BadRequestError("支付密码不能为空");
    }

    try {
      const result = this.cartService.buyNow(
        userId,
        itemId,
        quantity,
        paymentPassword,
      );
      return { message: "购买成功", data: { orderId: result.orderId } };
    } catch (reason) {
      if (reason instanceof Error) {
        if (reason.message === "余额不足") {
          this.ctx.throw(402, "余额不足");
        }
        throw new httpError.BadRequestError(reason.message);
      }
      throw reason;
    }
  }
}
