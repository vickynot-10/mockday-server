import { FastifyInstance } from "fastify";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../service/bucketClient";
import { randomUUID } from "crypto";
import path from "path";
import { ObjectId } from "mongodb";

const BUCKET = process.env.B2_BUCKET_NAME!;

interface UploadUrlRequest {
  filenames: string[];
}

interface ConfirmUploadRequest {
  files: {
    filename: string;
    file_id: string;
    key: string;
  }[];
}

export default async function uploadPlugin(app: FastifyInstance) {
  app.post<{ Body: UploadUrlRequest }>(
    "/upload/get-urls",
    async (req, reply) => {
      const { filenames } = req.body;

      if (!filenames || filenames.length === 0) {
        return reply
          .code(400)
          .send({ error: "Please pick at least 1 file to import" });
      }

      const userId = req.user.user_id;
      if (!userId) {
        return reply.code(400).send({ error: "Try logging in again" });
      }

      const results = [];

      for (const filename of filenames) {
        const fileId = randomUUID();
        const suffix = path.extname(filename);
        const key = `${userId}/${fileId}${suffix}`;

        const command = new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          ContentType: "application/pdf",
        });

        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

        results.push({
          filename,
          upload_url: uploadUrl,
          file_id: fileId,
          key,
        });
      }

      return reply.send({ files: results });
    },
  );

  app.post<{ Body: ConfirmUploadRequest }>(
    "/upload/confirm",
    async (req, reply) => {
      const userId = req.user.user_id;
      if (!userId) {
        return reply.code(401).send({ error: "Try logging in again" });
      }

      const { files } = req.body;

      const docs = files.map((f) => ({
        file_id: f.file_id,
        key: f.key,
        suffix: path.extname(f.filename).toLowerCase(),
        filename: f.filename,
        fk_user_id: new ObjectId(userId),
        created_at: new Date(),
      }));

      return reply.send({
        message: `${docs.length} documents uploaded successfully`,
      });
    },
  );
}
