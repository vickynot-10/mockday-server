import { redis } from "../config/redis";

const RESUME_CACHE_TTL = 3300;
const DOWNLOAD_URL_CACHE_TTL = 270;

function resumeCacheKey(userId: string) {
  return `resumes:${userId}`;
}

export async function getCachedResumes(userId: string) {
  const cached = await redis().get(resumeCacheKey(userId));
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedResumes(userId: string, data: unknown) {
  await redis().set(
    resumeCacheKey(userId),
    JSON.stringify(data),
    "EX",
    RESUME_CACHE_TTL,
  );
}

export async function invalidateResumeCache(userId: string) {
  await redis().del(resumeCacheKey(userId));
}
function resumeUrlCacheKey(userId: string, resumeId: string, mode: string) {
  return `resume:url:${userId}:${resumeId}:${mode}`;
}

export async function getCachedResumeUrl(userId: string, resumeId: string, mode: string) {
  const cached = await redis().get(resumeUrlCacheKey(userId, resumeId, mode));
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedResumeUrl(userId: string, resumeId: string, mode: string, data: unknown) {
  await redis().set(resumeUrlCacheKey(userId, resumeId, mode), JSON.stringify(data), "EX", DOWNLOAD_URL_CACHE_TTL);
}

export async function invalidateResumeUrlCacheBulk(userId: string, resumeIds: string[]) {
  const keys = resumeIds.flatMap((id) => [
    resumeUrlCacheKey(userId, id, "view"),
    resumeUrlCacheKey(userId, id, "download"),
  ]);
  if (keys.length) await redis().del(...keys);
}