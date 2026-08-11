export interface Course {
  id: number;
  title: string;
  description: string;
  createdAt: string;
}

export interface CreateCourseInput {
  title: string;
  description: string;
}

export interface User {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface UpdatePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export type TokenPayload = {
  userId: number;
};

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

export interface CreateItemInput {
  title: string;
  price: number;
  quantity: number;
  description: string;
  category: string;
  sellerId: number;
  images: string[];
  coverImage: string;
}

export interface UpdateItemInput {
  title?: string;
  price?: number;
  quantity?: number;
  description?: string;
  category?: string;
  images?: string[];
  coverImage?: string;
}

export interface ItemListResponse {
  data: Item[];
  total: number;
  totalPages: number;
}

export interface ToggleFavoriteResponse {
  action: "favorited" | "unfavorited";
}

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

export interface Account {
  id: number;
  userId: number;
  balance: number;
  paymentPassword: string | null;
  createdAt: string;
}

export interface AccountInfo {
  balance: number;
  hasPaymentPassword: boolean;
}

export interface SetBalanceInput {
  balance: number;
}

export interface SetPaymentPasswordInput {
  password: string;
}

export interface VerifyPaymentPasswordInput {
  password: string;
}
