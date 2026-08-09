import { redis } from "../config/redis";

const AUTOFILL_CACHE_TTL = 3300;

function autofillCacheKey(userId: string) {
  return `autofill:${userId}`;
}

export async function getCachedAutoFill(userId: string) {
  const cached = await redis().get(autofillCacheKey(userId));
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedAutoFill(userId: string, data: unknown) {
  await redis().set(
    autofillCacheKey(userId),
    JSON.stringify(data),
    "EX",
    AUTOFILL_CACHE_TTL,
  );
}

export async function invalidateAutoFillCache(userId: string) {
  await redis().del(autofillCacheKey(userId));
}