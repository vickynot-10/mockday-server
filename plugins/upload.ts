import { FastifyInstance } from "fastify";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../service/bucketClient";
import { randomUUID } from "crypto";
import path from "path";
import { get_db } from "../config/mongodb";
import { ObjectId } from "mongodb";
import { send_error, send_success } from "../utils/response";
import { MAXIMUM_RESUME_UPLOADS } from "../constants";
import { deleteFilesFromS3 } from "../service/bucketClient";

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
  deleted_file_keys: string[];
}

export default async function uploadPlugin(app: FastifyInstance) {
  app.post<{ Body: UploadUrlRequest }>(
    "/upload/get-urls",
    async (req, reply) => {
      try {
        const { filenames } = req.body;

        if (!filenames || filenames.length === 0) {
          return send_error(
            reply,
            "Please pick at least 1 file to import",
            400,
          );
        }

        if (filenames.length > MAXIMUM_RESUME_UPLOADS) {
          return send_error(
            reply,
            `Maximum is ${MAXIMUM_RESUME_UPLOADS} resumes per upload`,
            400,
          );
        }

        const userId = req.user.user_id;
        if (!userId) {
          return send_error(reply, "Try logging in again", 400);
        }

        const user_obj_id = new ObjectId(userId);
        const db = get_db();

        const existingCount = await db.collection("resumes").countDocuments({
          fk_user_id: user_obj_id,
        });

        if (existingCount + filenames.length > MAXIMUM_RESUME_UPLOADS) {
          return send_error(
            reply,
            `You can only have ${MAXIMUM_RESUME_UPLOADS} resumes total. You have ${existingCount} already.`,
            400,
          );
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

          const uploadUrl = await getSignedUrl(s3, command, {
            expiresIn: 300,
          });

          results.push({
            filename,
            upload_url: uploadUrl,
            file_id: fileId,
            key,
          });
        }

        return send_success(reply, { files: results });
      } catch (err) {
        return send_error(reply, "Internal Server Error !", 500);
      }
    },
  );

  app.post<{ Body: ConfirmUploadRequest }>(
    "/upload/confirm",
    async (req, reply) => {
      try {
        const userId = req.user.user_id;
        if (!userId) {
          return send_error(reply, "Try logging in again", 401);
        }

        const { files, deleted_file_keys } = req.body;

        const user_obj_id = new ObjectId(userId);

        if (deleted_file_keys && deleted_file_keys.length > 0) {
          await deleteFilesFromS3(deleted_file_keys);
        }
        if (!files || files.length === 0) {
          return send_error(reply, "No files to upload", 400);
        }
        const db = get_db();

        const existingCount = await db.collection("resumes").countDocuments({
          fk_user_id: user_obj_id,
        });

        if (existingCount + files.length > MAXIMUM_RESUME_UPLOADS) {
          return send_error(
            reply,
            `You can only have ${MAXIMUM_RESUME_UPLOADS} resumes total. You have ${existingCount} already.`,
            400,
          );
        }

        const docs = files.map((f) => ({
          file_id: f.file_id,
          key: f.key,
          suffix: path.extname(f.filename).toLowerCase(),
          filename: f.filename,
          fk_user_id: user_obj_id,
          created_at: new Date(),
          updated_on: new Date(),
        }));

        const insert_doc = await db.collection("resumes").insertMany(docs);

        if (!insert_doc || !insert_doc.acknowledged) {
          return send_error(reply, "Internal Server Error !", 500);
        }

        return send_success(
          reply,
          { inserted: insert_doc.insertedCount },
          200,
          `${docs.length} documents uploaded successfully`,
        );
      } catch (err) {
        return send_error(reply, "Internal Server Error !", 500);
      }
    },
  );
}
