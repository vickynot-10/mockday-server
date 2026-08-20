import {
  S3Client,
  DeleteObjectsCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent } from "https";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

export async function getFileBufferFromS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: key,
  });

  const result = await s3.send(command);

  if (!result.Body) {
    throw new Error(`No file body returned for key: ${key}`);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of result.Body as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function getFileSignedUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: key,
  });

  return await getSignedUrl(s3, command, {
    expiresIn: 300, // 5 minutes
  });
}

import { PutObjectCommand } from "@aws-sdk/client-s3";

export async function uploadBufferToS3(
  key: string,
  buffer: Buffer,
  contentType: string,
) {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3.send(command);

  return key;
}