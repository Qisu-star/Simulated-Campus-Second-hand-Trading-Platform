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

export interface AccountInfo {
  balance: number;
  hasPaymentPassword: boolean;
}

export interface CartItem {
  id: number;
  userId: number;
  itemId: number;
  quantity: number;
  selected: boolean;
  createdAt: string;
  title: string;
  price: number;
  coverImage: string;
  stock: number;
  status: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  itemId: number;
  sellerId: number;
  title: string;
  price: number;
  quantity: number;
  coverImage: string;
}

export interface Order {
  id: number;
  userId: number;
  totalPrice: number;
  status: 'pending_receipt' | 'received';
  createdAt: string;
  items: OrderItem[];
}

export interface OrderListResponse {
  data: Order[];
  total: number;
  totalPages: number;
}

export interface Review {
  id: number;
  userId: number;
  orderId: number;
  itemId: number;
  sellerId: number;
  rating: number;
  comment: string;
  username: string;
  createdAt: string;
}

export interface ReviewListResponse {
  data: Review[];
  total: number;
  totalPages: number;
}

export interface AdminReviewItem {
  id: number;
  title: string;
  price: number;
  quantity: number;
  description: string;
  coverImage: string;
  category: string;
  sellerName: string;
  createdAt: string;
}