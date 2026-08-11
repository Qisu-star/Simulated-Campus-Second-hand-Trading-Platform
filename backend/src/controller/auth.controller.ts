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
import { Context } from "@midwayjs/koa";
import { AuthService } from "../service/auth.service";

const USERNAME_REGEX = /^[一-龥a-zA-Z0-9]+$/;
const MIN_PASSWORD_LENGTH = 6;

@Controller("/api/auth")
export class AuthController {
  @Inject()
  authService: AuthService;

  @Inject()
  ctx: Context;

  @Post("/register")
  async register(@Body() body: unknown) {
    const { username, password } = parseRegisterBody(body);

    try {
      const result = this.authService.register(username, password);
      this.ctx.status = 201;
      return {
        data: result.user,
        token: result.token,
      };
    } catch (reason) {
      if (reason instanceof Error && reason.message === "用户名已存在") {
        throw new httpError.ConflictError("用户名已存在");
      }
      throw reason;
    }
  }

  @Post("/login")
  async login(@Body() body: unknown) {
    const { username, password } = parseLoginBody(body);

    try {
      const result = this.authService.login(username, password);
      return {
        data: result.user,
        token: result.token,
      };
    } catch (reason) {
      if (reason instanceof Error && reason.message === "用户名或密码错误") {
        throw new httpError.UnauthorizedError("用户名或密码错误");
      }
      throw reason;
    }
  }

  @Post("/logout")
  async logout(@Headers("authorization") authorization: string) {
    const token = extractToken(authorization);
    if (!token) {
      throw new httpError.UnauthorizedError("未登录");
    }

    this.authService.logout(token);
    return { message: "已成功退出登录" };
  }

  @Get("/me")
  async getCurrentUser(@Headers("authorization") authorization: string) {
    const token = extractToken(authorization);
    if (!token) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const user = this.authService.getCurrentUser(token);
    if (!user) {
      throw new httpError.UnauthorizedError("登录已过期");
    }

    return { data: user };
  }

  @Put("/password")
  async updatePassword(
    @Headers("authorization") authorization: string,
    @Body() body: unknown,
  ) {
    const token = extractToken(authorization);
    if (!token) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const { currentPassword, newPassword } = parseUpdatePasswordBody(body);

    try {
      this.authService.updatePassword(token, currentPassword, newPassword);
      return { message: "密码修改成功" };
    } catch (reason) {
      if (reason instanceof Error && reason.message === "当前密码错误") {
        throw new httpError.BadRequestError("当前密码错误");
      }
      if (reason instanceof Error && reason.message === "未登录或登录已过期") {
        throw new httpError.UnauthorizedError("未登录或登录已过期");
      }
      throw reason;
    }
  }
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

function parseRegisterBody(value: unknown): {
  username: string;
  password: string;
} {
  if (!isRecord(value)) {
    throw new httpError.BadRequestError("请求体必须是 JSON 对象");
  }

  const username =
    typeof value.username === "string" ? value.username.trim() : "";
  const password =
    typeof value.password === "string" ? value.password : "";

  if (username.length < 1) {
    throw new httpError.BadRequestError("用户名不能为空");
  }

  if (!USERNAME_REGEX.test(username)) {
    throw new httpError.BadRequestError(
      "用户名只允许中文字符、英文字母和数字",
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new httpError.BadRequestError(
      `密码长度不能少于 ${MIN_PASSWORD_LENGTH} 位`,
    );
  }

  return { username, password };
}

function parseLoginBody(value: unknown): {
  username: string;
  password: string;
} {
  if (!isRecord(value)) {
    throw new httpError.BadRequestError("请求体必须是 JSON 对象");
  }

  const username =
    typeof value.username === "string" ? value.username.trim() : "";
  const password =
    typeof value.password === "string" ? value.password : "";

  if (username.length < 1) {
    throw new httpError.BadRequestError("用户名不能为空");
  }

  if (password.length < 1) {
    throw new httpError.BadRequestError("密码不能为空");
  }

  return { username, password };
}

function parseUpdatePasswordBody(value: unknown): {
  currentPassword: string;
  newPassword: string;
} {
  if (!isRecord(value)) {
    throw new httpError.BadRequestError("请求体必须是 JSON 对象");
  }

  const currentPassword =
    typeof value.currentPassword === "string" ? value.currentPassword : "";
  const newPassword =
    typeof value.newPassword === "string" ? value.newPassword : "";

  if (currentPassword.length < 1) {
    throw new httpError.BadRequestError("当前密码不能为空");
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new httpError.BadRequestError(
      `新密码长度不能少于 ${MIN_PASSWORD_LENGTH} 位`,
    );
  }

  return { currentPassword, newPassword };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}