import { redis } from "../config/redis";

const USER_DETAILS_RESUME_CACHE_TTL = 3300;

function getUserProfile(user_id: string) {
  return `user-profile:${user_id}`;
}

export async function getUserProfileCache(user_id: string) {
  const cached = await redis().get(getUserProfile(user_id));
  return cached ? JSON.parse(cached) : null;
}

export async function setUserProfileCache(userId: string, data: any) {
  await redis().set(
    getUserProfile(userId),
    JSON.stringify(data),
    "EX",
    USER_DETAILS_RESUME_CACHE_TTL,
  );
}

export async function invalidateUserProfileCache(userId: string) {
  await redis().del(getUserProfile(userId));
}
