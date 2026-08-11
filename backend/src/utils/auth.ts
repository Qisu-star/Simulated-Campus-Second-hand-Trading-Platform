import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { TokenPayload } from "../interface";

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const SALT_LENGTH = 16;
const HASH_LENGTH = 64;

const tokenStore = new Map<string, { userId: number; expiresAt: Date }>();

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const hash = scryptSync(password, salt, HASH_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const separatorIndex = stored.indexOf(":");
  if (separatorIndex === -1) {
    return false;
  }

  const salt = stored.slice(0, separatorIndex);
  const hash = stored.slice(separatorIndex + 1);
  const computedHash = scryptSync(password, salt, HASH_LENGTH);

  try {
    return timingSafeEqual(computedHash, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export function generateToken(payload: TokenPayload): string {
  // Remove expired tokens periodically
  if (tokenStore.size > 1000) {
    for (const [token, data] of tokenStore) {
      if (data.expiresAt < new Date()) {
        tokenStore.delete(token);
      }
    }
  }

  const token = randomBytes(32).toString("hex");
  tokenStore.set(token, {
    userId: payload.userId,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
  });

  return token;
}

export function verifyToken(token: string): TokenPayload | null {
  const data = tokenStore.get(token);

  if (!data) {
    return null;
  }

  if (data.expiresAt < new Date()) {
    tokenStore.delete(token);
    return null;
  }

  return { userId: data.userId };
}

export function invalidateToken(token: string): void {
  tokenStore.delete(token);
}
