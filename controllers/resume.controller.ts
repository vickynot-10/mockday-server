import { get_db } from "../config/mongodb";
import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../service/bucketClient";

export async function GetResumes(req: FastifyRequest, reply: FastifyReply) {
  try {
    const db = get_db();
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const get_resumes = await db
      .collection("resumes")
      .find(
        {
          fk_user_id: new ObjectId(user_id),
        },
        {
          projection: {
            filename: 1,
            created_at: 1,
            default: 1,
            updated_on: 1,
          },
        },
      )
      .sort({ updated_on: -1 })
      .toArray();

    return send_success(reply, get_resumes, 200);
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
