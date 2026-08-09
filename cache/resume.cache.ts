import { redis } from "../config/redis";

const RESUME_CACHE_TTL = 3300;

function resumeCacheKey(userId: string) {
  return `resumes:${userId}`;
}

export async function getCachedResumes(userId: string) {
  const cached = await redis().get(resumeCacheKey(userId));
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedResumes(userId: string, data: unknown) {
  await redis().set(resumeCacheKey(userId), JSON.stringify(data), "EX", RESUME_CACHE_TTL);
}

export async function invalidateResumeCache(userId: string) {
  await redis().del(resumeCacheKey(userId));
}