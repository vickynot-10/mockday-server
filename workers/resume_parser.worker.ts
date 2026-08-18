import { Worker, Job } from "bullmq";
import { redis } from "../config/redis";
import { get_db } from "../config/mongodb";
import { ObjectId } from "mongodb";
import { getFileBufferFromS3 } from "../service/bucketClient";
import { extractText, getDocumentProxy } from "unpdf";

interface ResumeParseJobData {
  file_id: string;
  key: string;
  fk_user_id: string;
}

export const resumeParseWorker = new Worker<ResumeParseJobData>(
  "resume-parse",
  async (job: Job<ResumeParseJobData>) => {
    const { file_id, key, fk_user_id } = job.data;
    const db = get_db();

    try {
      const buffer = await getFileBufferFromS3(key);
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });

      if (!text || text.trim().length === 0) {
        throw new Error("No extractable text found in PDF");
      }

      await db.collection("resume_content").updateOne(
        { file_id, fk_user_id: new ObjectId(fk_user_id) },
        {
          $set: {
            raw_text: text,
            updated_on: new Date(),
          },
          $setOnInsert: {
            fk_user_id: new ObjectId(fk_user_id),
            file_id,
          },
        },
        { upsert: true },
      );
    } catch (err) {
      throw err;
    }
  },
  {
    connection: redis(),
    concurrency: 3,
  },
);

resumeParseWorker.on("completed", (job) => {
  console.log(`Resume parse completed: ${job.data.file_id}`);
});

resumeParseWorker.on("failed", (job, err) => {
  console.error(`Resume parse failed: ${job?.data.file_id}`, err.message);
});
