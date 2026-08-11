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

export interface ItemListResponse {
  data: Item[];
  total: number;
  totalPages: number;
}
