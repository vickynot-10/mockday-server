import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent } from "https";
import dotenv from "dotenv";

dotenv.config();

export const s3 = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  requestHandler: new NodeHttpHandler({
    httpsAgent: new Agent({ family: 4, keepAlive: true }),
    connectionTimeout: 10000,
    requestTimeout: 30000,
  }),
});

export async function deleteFilesFromS3(keys: string[]) {
  if (keys.length === 0) return;
  const command = new DeleteObjectsCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Delete: {
      Objects: keys.map((key) => ({ Key: key })),
      Quiet: false,
    },
  });
  const result = await s3.send(command);
  if (result.Errors && result.Errors.length > 0) {
    throw new Error(
      `Failed to delete: ${result.Errors.map((e) => e.Key).join(", ")}`,
    );
  }
}