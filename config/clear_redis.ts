import { get_redis } from "./redis";

export async function RemoveRedisKeys() {
  const redis = get_redis();
  const keys = await redis.keys("open_incident:*");

  if (keys.length) {
    console.log("Deleting Keys")
    await redis.del(...keys);
  }
}
