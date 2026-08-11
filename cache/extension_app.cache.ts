import { redis } from "../config/redis";

const EXTENSION_APP_CACHE_TTL = 3300;

function extensionCacheKey(userId: string) {
  return `extension_app:${userId}`;
}

export async function getCachedExtension(userId: string) {
  const cached = await redis().get(extensionCacheKey(userId));
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedExtension(userId: string, data: unknown) {
  await redis().set(
    extensionCacheKey(userId),
    JSON.stringify(data),
    "EX",
    EXTENSION_APP_CACHE_TTL,
  );
}

export async function invalidateExtensionCache(userId: string) {
  await redis().del(extensionCacheKey(userId));
}
