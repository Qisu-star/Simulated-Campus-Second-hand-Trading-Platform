import { MidwayConfig } from "@midwayjs/core";

export default {
  keys: "course-demo-development-key",
  koa: {
    port: Number(process.env.BACKEND_PORT ?? 7001),
  },
  courseDatabase: {
    path: process.env.DATABASE_PATH ?? "./data/course-demo.sqlite",
  },
  authDatabase: {
    path: process.env.AUTH_DATABASE_PATH ?? "./data/auth.sqlite",
  },
} as MidwayConfig;
