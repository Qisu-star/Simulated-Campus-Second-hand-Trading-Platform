export interface Item {
  id: number;
  title: string;
  price: number;
  quantity: number;
  description: string;
  images: string[];
  coverImage: string;
  category: string;
  sellerId: number;
  sellerName: string;
  status: "pending" | "active" | "delisted";
  createdAt: string;
  quantityUpdatedAt: string | null;
}

export interface ItemListResponse {
  data: Item[];
  total: number;
  totalPages: number;
}

export interface ItemDetailResponse {
  data: Item;
}

export type Category = "全部" | "衣物" | "书籍" | "电子设备" | "运动" | "食物" | "其它";

export const CATEGORIES: Category[] = [
  "全部",
  "衣物",
  "书籍",
  "电子设备",
  "运动",
  "食物",
  "其它",
];