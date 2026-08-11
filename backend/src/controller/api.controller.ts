import { Body, Controller, Get, httpError, Inject, Param, Post, Query } from "@midwayjs/core";
import { CourseService } from "../service/course.service";
import { ItemService } from "../service/item.service";
import { parseCourseInput } from "../utils/course-input";

@Controller("/api")
export class ApiController {
  @Inject()
  courseService: CourseService;

  @Inject()
  itemService: ItemService;

  @Get("/health")
  async health() {
    return {
      status: "ok" as const,
      service: "course-demo-api",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/courses")
  async listCourses() {
    return { data: this.courseService.list() };
  }

  @Post("/courses")
  async createCourse(@Body() body: unknown) {
    try {
      const input = parseCourseInput(body);
      return { data: this.courseService.create(input) };
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "课程数据无效";
      throw new httpError.BadRequestError(message);
    }
  }

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

  @Get("/items/:id")
  async getItemById(@Param("id") id: string) {
    const itemId = Number(id);
    if (!Number.isFinite(itemId)) {
      throw new httpError.BadRequestError("无效的商品 ID");
    }

    const item = this.itemService.getItemById(itemId);
    if (!item) {
      throw new httpError.NotFoundError("商品不存在或已下架");
    }

    return { data: item };
  }
}
