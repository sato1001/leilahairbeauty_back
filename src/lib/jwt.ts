import jwt, { SignOptions } from "jsonwebtoken";

export interface TokenPayload {
  sub: string;
  role: "CLIENT" | "ADMIN";
}

export function generateToken(payload: TokenPayload, customExpiresIn?: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não está configurado nas variáveis de ambiente");
  }

  const expiresIn = (customExpiresIn || process.env.JWT_EXPIRES_IN || "1h") as SignOptions["expiresIn"];

  return jwt.sign(payload, secret, {
    expiresIn,
  });
}

export function verifyToken(token: string): TokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não está configurado nas variáveis de ambiente");
  }

  return jwt.verify(token, secret) as TokenPayload;
}

