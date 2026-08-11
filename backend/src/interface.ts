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
