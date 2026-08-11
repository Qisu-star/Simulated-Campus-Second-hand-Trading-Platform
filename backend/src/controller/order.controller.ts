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
import { OrderService } from "../service/order.service";
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

@Controller("/api/orders")
export class OrderController {
  @Inject()
  orderService: OrderService;

  @Get("/")
  async listOrders(
    @Headers("authorization") authorization: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;

    const result = this.orderService.listOrders(userId, p, ps);
    return result;
  }

  @Get("/sales")
  async listSales(
    @Headers("authorization") authorization: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;

    const result = this.orderService.listSales(userId, p, ps);
    return result;
  }

  @Post("/:id/receive")
  async confirmReceive(
    @Headers("authorization") authorization: string,
    @Param("id") id: string,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId < 1) {
      throw new httpError.BadRequestError("无效的订单 ID");
    }

    try {
      this.orderService.confirmReceive(userId, orderId);
      return { message: "已确认签收" };
    } catch (reason) {
      if (reason instanceof Error) {
        if (reason.message === "无权操作此订单") {
          throw new httpError.ForbiddenError("无权操作此订单");
        }
        throw new httpError.BadRequestError(reason.message);
      }
      throw reason;
    }
  }
}