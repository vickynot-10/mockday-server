import { redis } from "../config/redis";

const AI_RESUME_CACHE_TTL = 3300;

function aiGetResumeCacheKey(user_id: string, resume_id: string) {
  return `resume:${resume_id}-${user_id}`;
}

export async function getResumeParagraphs(user_id: string, resume_id: string) {
  const cached = await redis().get(aiGetResumeCacheKey(user_id, resume_id));
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedResumeParaTexts(
  userId: string,
  resume_id: string,
  data: any[],
) {
  await redis().set(
    aiGetResumeCacheKey(userId, resume_id),
    JSON.stringify(data),
    "EX",
    AI_RESUME_CACHE_TTL,
  );
}

export async function invalidateAIResumeCache(
  userId: string,
  resume_id: string,
) {
  await redis().del(aiGetResumeCacheKey(userId, resume_id));
}
