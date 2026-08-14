import { redis } from "../config/redis";

const DEFAULT_STATUS_CACHE_TTL = 86400;

function defaultCacheKey(userId: string) {
  return `default-status:${userId}`;
}

export async function setCachedDefaultStatus(userId: string, statusId: string) {
  await redis().set(
    defaultCacheKey(userId),
    statusId,
    "EX",
    DEFAULT_STATUS_CACHE_TTL,
  );
}

export async function getDefaultStatus(userId: string) {
  return await redis().get(defaultCacheKey(userId));
}

export async function invalidateResumeCache(userId: string) {
  await redis().del(defaultCacheKey(userId));
}