import { UserRole } from "@prisma/client";

export interface AuthUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
}

export interface UserResponse {
  user: AuthUser;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
