import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { get_db } from "../config/mongodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../service/bucketClient";
import {
  getCachedExtension,
  setCachedExtension,
} from "../cache/extension_app.cache";
const BUCKET = process.env.B2_BUCKET_NAME!;

export async function GetAutoFillFields(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const user = req.ext_user;
    if (!user) {
      return send_error(reply, "Unauthorized", 401);
    }

    const user_id = user.fk_user_id;

    const user_obj_id = new ObjectId(user_id);
    const isCache = await getCachedExtension(user_id);

    if (isCache) {
      return send_success(reply, isCache, 200, "Data are fetched ");
    }

    const db = get_db();
    let [rules, resume] = await Promise.all([
      db.collection("autofills").findOne(
        {
          fk_user_id: user_obj_id,
        },
        {
          projection: {
            fk_user_id: 0,
            _id: 0,
            updated_on: 0,
          },
        },
      ),
      db.collection("resumes").findOne(
        {
          fk_user_id: user_obj_id,
          default: true,
        },
        {
          projection: {
            key: 1,
            filename: 1,
          },
        },
      ),
    ]);

    if (resume && resume.key && BUCKET) {
      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: resume.key,
      });
      const download_url = await getSignedUrl(s3, command, {
        expiresIn: 300,
      });
      delete resume["key"];

      resume.url = download_url;
    }

    const payload = { rules, resume };

    setCachedExtension(user_id, payload);

    return send_success(reply, payload, 200, "Data are fetched ");
  } catch (err) {
    return send_error(reply, "Something went wrong", 500);
  }
}
