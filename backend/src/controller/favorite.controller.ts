import {
  Controller,
  Get,
  Headers,
  httpError,
  Inject,
  Param,
  Post,
  Del,
  Query,
} from "@midwayjs/core";
import { AuthService } from "../service/auth.service";
import { FavoriteService } from "../service/favorite.service";
import { ItemService } from "../service/item.service";
import { verifyToken } from "../utils/auth";
import type {
  FavoriteItemWithInfo,
  FavoriteSellerWithInfo,
} from "../interface";

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

@Controller("/api/favorites")
export class FavoriteController {
  @Inject()
  authService: AuthService;

  @Inject()
  favoriteService: FavoriteService;

  @Inject()
  itemService: ItemService;

  @Post("/items/:id")
  async toggleFavoriteItem(
    @Headers("authorization") authorization: string,
    @Param("id") id: string,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const itemId = Number(id);
    if (!Number.isFinite(itemId)) {
      throw new httpError.BadRequestError("无效的商品 ID");
    }

    const result = this.favoriteService.toggleFavoriteItem(userId, itemId);
    return { data: result };
  }

  @Del("/items/:id")
  async unfavoriteItem(
    @Headers("authorization") authorization: string,
    @Param("id") id: string,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const itemId = Number(id);
    if (!Number.isFinite(itemId)) {
      throw new httpError.BadRequestError("无效的商品 ID");
    }

    this.favoriteService.unfavoriteItem(userId, itemId);
    return { message: "已取消收藏" };
  }

  @Get("/items")
  async listFavoriteItems(
    @Headers("authorization") authorization: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));

    const result = this.favoriteService.listFavoriteItemIds(userId, p, ps);

    // Fetch full item info for each favorite
    const data: FavoriteItemWithInfo[] = result.rows.map((row) => {
      const item = this.itemService.getItemById(row.itemId);
      return {
        id: row.id,
        userId,
        itemId: row.itemId,
        createdAt: row.createdAt,
        item: item ?? {
          id: row.itemId,
          title: "商品已不存在",
          price: 0,
          quantity: 0,
          description: "",
          images: [],
          coverImage: "",
          category: "",
          sellerId: 0,
          sellerName: "",
          status: "delisted" as const,
          createdAt: new Date().toISOString(),
          quantityUpdatedAt: null,
        },
      };
    });

    return { data, total: result.total, totalPages: result.totalPages };
  }

  @Post("/sellers/:id")
  async toggleFavoriteSeller(
    @Headers("authorization") authorization: string,
    @Param("id") id: string,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const sellerId = Number(id);
    if (!Number.isFinite(sellerId)) {
      throw new httpError.BadRequestError("无效的商家 ID");
    }

    // Verify seller exists
    const seller = this.authService.getUserById(sellerId);
    if (!seller) {
      throw new httpError.NotFoundError("商家不存在");
    }

    const result = this.favoriteService.toggleFavoriteSeller(userId, sellerId);
    return { data: result };
  }

  @Del("/sellers/:id")
  async unfavoriteSeller(
    @Headers("authorization") authorization: string,
    @Param("id") id: string,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const sellerId = Number(id);
    if (!Number.isFinite(sellerId)) {
      throw new httpError.BadRequestError("无效的商家 ID");
    }

    this.favoriteService.unfavoriteSeller(userId, sellerId);
    return { message: "已取消收藏" };
  }

  @Get("/sellers")
  async listFavoriteSellers(
    @Headers("authorization") authorization: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const userId = getUserIdFromToken(authorization);
    if (!userId) {
      throw new httpError.UnauthorizedError("未登录");
    }

    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));

    const result = this.favoriteService.listFavoriteSellerIds(userId, p, ps);

    // Enrich with seller names and active item counts
    const data: FavoriteSellerWithInfo[] = result.rows.map((row) => {
      const seller = this.authService.getUserById(row.sellerId);
      const sellerItems = this.itemService.listSellerItems(row.sellerId, undefined, 1, 1);
      return {
        id: row.id,
        userId,
        sellerId: row.sellerId,
        createdAt: row.createdAt,
        sellerName: seller?.username ?? "未知用户",
        activeItemCount: sellerItems.total,
      };
    });

    return { data, total: result.total, totalPages: result.totalPages };
  }
}