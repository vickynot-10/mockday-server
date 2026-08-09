import { get_db } from "../config/mongodb";
import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { deleteFilesFromS3, s3 } from "../service/bucketClient";
import {
  getCachedResumes,
  invalidateResumeCache,
  setCachedResumes,
} from "../cache/resume.cache";

export async function GetResumes(req: FastifyRequest, reply: FastifyReply) {
  try {
    const db = get_db();
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const cached = await getCachedResumes(user_id);
    if (cached) {
      return send_success(reply, cached, 200);
    }

    const get_resumes = await db
      .collection("resumes")
      .find(
        { fk_user_id: new ObjectId(user_id) },
        { projection: { filename: 1, created_at: 1, default: 1, key: 1 } },
      )
      .sort({ created_at: -1 })
      .toArray();

    const resumes_with_preview = await Promise.all(
      get_resumes.map(async (resume) => {
        const command = new GetObjectCommand({
          Bucket: process.env.B2_BUCKET_NAME!,
          Key: resume.key,
          ResponseContentDisposition: `inline; filename="${resume.filename}"`,
        });

        const preview_url = await getSignedUrl(s3, command, {
          expiresIn: 3600,
        });

        return {
          _id: resume._id,
          filename: resume.filename,
          created_at: resume.created_at,
          default: resume.default,
          preview_url,
        };
      }),
    );

    await setCachedResumes(user_id, resumes_with_preview);

    return send_success(reply, resumes_with_preview, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function GetResumeDownloadUrl(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { id, mode } = req.body as { id: string; mode?: "view" | "download" };

    if (!ObjectId.isValid(id)) {
      return send_error(reply, "Invalid resume id", 400);
    }

    const db = get_db();

    const resume = await db.collection("resumes").findOne({
      _id: new ObjectId(id),
      fk_user_id: new ObjectId(user_id),
    });

    if (!resume) {
      return send_error(reply, "Resume not found", 404);
    }

    const disposition =
      mode === "view"
        ? `inline; filename="${resume.filename}"`
        : `attachment; filename="${resume.filename}"`;

    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: resume.key,
      ResponseContentDisposition: disposition,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 300 });

    return send_success(reply, { download_url: url }, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function MarkasDefault(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { id } = req.body as { id: string };

    if (!ObjectId.isValid(id)) {
      return send_error(reply, "Invalid resume id", 400);
    }
    const db = get_db();
    const user_id_obj = new ObjectId(user_id);

    await db
      .collection("resumes")
      .updateMany({ fk_user_id: user_id_obj }, { $set: { default: false } });

    await db
      .collection("resumes")
      .updateOne(
        { _id: new ObjectId(id), fk_user_id: user_id_obj },
        { $set: { default: true, updated_on: new Date() } },
      );

    return send_success(reply, {}, 200, "Default resume updated");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function DeleteResumes(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { ids } = req.body as { ids: string[] };

    if (!ids || ids.length <= 0) {
      return send_error(reply, "Invalid Resumes ", 400);
    }

    const filter_ids = ids
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    if (filter_ids.length <= 0) {
      return send_error(reply, "Invalid Resumes ", 400);
    }

    const db = get_db();

    const resume = await db
      .collection("resumes")
      .find(
        {
          _id: { $in: filter_ids },
          fk_user_id: new ObjectId(user_id),
        },
        {
          projection: {
            key: 1,
          },
        },
      )
      .toArray();

    if (!resume) {
      return send_error(reply, "Resume not found", 404);
    }

    const keys_map = resume.map((item) => item.key);
    const [, delete_result] = await Promise.all([
      deleteFilesFromS3(keys_map),
      db.collection("resumes").deleteMany({
        _id: { $in: filter_ids },
        fk_user_id: new ObjectId(user_id),
      }),
    ]);

    if (delete_result.deletedCount === 0) {
      return send_error(reply, "Nothing deleted", 404);
    }

    await invalidateResumeCache(user_id);

    return send_success(reply, {}, 200, "Deleted Successfully !");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
