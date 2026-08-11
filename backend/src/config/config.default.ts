import { MidwayConfig } from "@midwayjs/core";

export default {
  keys: "campus-trading-platform-development-key",
  koa: {
    port: Number(process.env.BACKEND_PORT ?? 7001),
  },
  authDatabase: {
    path: process.env.AUTH_DATABASE_PATH ?? "./data/auth.sqlite",
  },
  itemDatabase: {
    path: process.env.ITEM_DATABASE_PATH ?? "./data/items.sqlite",
  },
  favoriteDatabase: {
    path: process.env.FAVORITE_DATABASE_PATH ?? "./data/favorite.sqlite",
  },
  accountDatabase: {
    path: process.env.ACCOUNT_DATABASE_PATH ?? "./data/account.sqlite",
  },
  tradeDatabase: {
    path: process.env.TRADE_DATABASE_PATH ?? "./data/trade.sqlite",
  },
  reviewDatabase: {
    path: process.env.REVIEW_DATABASE_PATH ?? "./data/review.sqlite",
  },
} as MidwayConfig;
