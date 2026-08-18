import { Queue } from "bullmq";
import { redis } from "../config/redis";

let _queue: Queue | null = null;

export function getResumeParseQueue(): Queue {
  if (!_queue) {
    _queue = new Queue("resume-parse", {
      connection: redis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  return _queue;
}
