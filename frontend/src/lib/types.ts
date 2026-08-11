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
  data: Item & {
    isItemFavorited: boolean;
    isSellerFavorited: boolean;
  };
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

export interface FavoriteItemWithInfo {
  id: number;
  userId: number;
  itemId: number;
  createdAt: string;
  item: Item;
}

export interface FavoriteSellerWithInfo {
  id: number;
  userId: number;
  sellerId: number;
  createdAt: string;
  sellerName: string;
  activeItemCount: number;
}

export interface FavoriteItemListResponse {
  data: FavoriteItemWithInfo[];
  total: number;
  totalPages: number;
}

export interface FavoriteSellerListResponse {
  data: FavoriteSellerWithInfo[];
  total: number;
  totalPages: number;
}

export interface ToggleFavoriteResponse {
  data: {
    action: "favorited" | "unfavorited";
  };
}