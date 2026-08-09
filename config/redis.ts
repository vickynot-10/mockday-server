import { Redis } from "ioredis";

let connection: Redis | null = null;

export async function ConnectRedis() {
  if (connection) return connection;

  try {
    connection = new Redis(process.env.UPSTASH_REDIS_URL!, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    await connection.connect();
    console.log("Redis connected successfully");

    connection.on("error", (err) => {
      console.error("Redis runtime error:", err);
    });

    return connection;
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    connection = null;
    throw err;
  }
}

export const get_redis = () => {
  if (!connection) {
    throw new Error("Redis not connected yet");
  }
  return connection;
};
