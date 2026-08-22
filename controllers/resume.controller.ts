import { get_db } from "../config/mongodb";
import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../service/bucketClient";
import {
  getCachedResumes,
  getCachedResumeUrl,
  invalidateResumeCache,
  invalidateResumeUrlCacheBulk,
  setCachedResumes,
  setCachedResumeUrl,
} from "../cache/resume.cache";
import { DeleteResumesService } from "../service/resume-parser.service";

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
        {
          projection: {
            filename: 1,
            created_at: 1,
            default: 1,
            key: 1,
            suffix: 1,
          },
        },
      )
      .sort({ created_at: -1 })
      .toArray();

    const resumes_with_preview = await Promise.all(
      get_resumes.map(async (resume) => {
        if (resume.suffix !== ".pdf" && resume.suffix !== "pdf") {
          return {
            _id: resume._id,
            filename: resume.filename,
            created_at: resume.created_at,
            default: resume.default,
            preview_url: null,
            suffix: resume.suffix,
          };
        }

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
          suffix: resume.suffix,
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

    const cached = await getCachedResumeUrl(user_id, id, mode ?? "download");
    if (cached) {
      return send_success(reply, cached, 200);
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

    const payload = { download_url: url };

    await setCachedResumeUrl(user_id, id, mode ?? "download", payload);

    return send_success(reply, payload, 200);
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

    await Promise.all([
      db
        .collection("resumes")
        .updateMany({ fk_user_id: user_id_obj }, { $set: { default: false } }),
      db
        .collection("resumes")
        .updateOne(
          { _id: new ObjectId(id), fk_user_id: user_id_obj },
          { $set: { default: true, updated_on: new Date() } },
        ),

      invalidateResumeCache(user_id),
    ]);

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

    const deleted_ids: string[] = [];
    const filter_ids: ObjectId[] = [];

    for (const id of ids) {
      if (!id || !ObjectId.isValid(id)) continue;
      const oid = new ObjectId(id);
      filter_ids.push(oid);
      deleted_ids.push(oid.toString());
    }
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
      DeleteResumesService(keys_map),
      db.collection("resumes").deleteMany({
        _id: { $in: filter_ids },
        fk_user_id: new ObjectId(user_id),
      }),
      invalidateResumeCache(user_id),
      invalidateResumeUrlCacheBulk(user_id, deleted_ids),
    ]);

    if (delete_result.deletedCount === 0) {
      return send_error(reply, "Nothing deleted", 404);
    }

    return send_success(reply, {}, 200, "Deleted Successfully !");
  } catch (err) {
    console.log(err);
    return send_error(reply, "Internal Server Error", 500);
  }
}
