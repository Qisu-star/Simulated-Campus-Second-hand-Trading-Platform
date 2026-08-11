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

// Cart types
export interface AddToCartInput {
  itemId: number;
  quantity: number;
}

export interface CartItem {
  id: number;
  userId: number;
  itemId: number;
  quantity: number;
  selected: boolean;
  createdAt: string;
  // 商品信息
  title: string;
  price: number;
  coverImage: string;
  stock: number;
  status: string;
}

export interface CheckoutInput {
  paymentPassword: string;
}

export interface BuyNowInput {
  itemId: number;
  quantity: number;
  paymentPassword: string;
}

// Order types
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

// Review types
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

export interface CreateReviewInput {
  orderId: number;
  itemId: number;
  rating: number;
  comment?: string;
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
