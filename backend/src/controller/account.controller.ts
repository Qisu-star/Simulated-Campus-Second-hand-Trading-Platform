import {
  Body,
  Controller,
  Get,
  Headers,
  httpError,
  Inject,
  Post,
  Put,
} from "@midwayjs/core";
import { AccountService } from "../service/account.service";
import { verifyToken } from "../utils/auth";
import type { AccountInfo } from "../interface";

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

@Controller("/api/account")
export class AccountController {
  @Inject()
  accountService: AccountService;

  @Get("/")
  async getAccount(@Headers("authorization") authorization: string) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const accountInfo = this.accountService.getOrCreateAccount(userId);
    return { data: accountInfo };
  }

  @Put("/balance")
  async setBalance(
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

    const { balance } = body as Record<string, unknown>;
    if (typeof balance !== "number" || !Number.isFinite(balance)) {
      throw new httpError.BadRequestError("余额必须是数字");
    }

    // Ensure account exists
    this.accountService.getOrCreateAccount(userId);
    this.accountService.setBalance(userId, balance);

    return { message: "余额更新成功", data: { balance } };
  }

  @Put("/password")
  async setPaymentPassword(
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

    const { password } = body as Record<string, unknown>;
    if (typeof password !== "string") {
      throw new httpError.BadRequestError("支付密码必须是字符串");
    }

    try {
      // Ensure account exists
      this.accountService.getOrCreateAccount(userId);
      this.accountService.setPaymentPassword(userId, password);
      return { message: "支付密码设置成功" };
    } catch (reason) {
      if (reason instanceof Error) {
        throw new httpError.BadRequestError(reason.message);
      }
      throw reason;
    }
  }

  @Post("/verify-password")
  async verifyPaymentPassword(
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

    const { password } = body as Record<string, unknown>;
    if (typeof password !== "string") {
      throw new httpError.BadRequestError("支付密码必须是字符串");
    }

    const isValid = this.accountService.verifyPaymentPassword(userId, password);
    if (!isValid) {
      throw new httpError.BadRequestError("支付密码错误");
    }

    return { message: "支付密码验证通过" };
  }
}