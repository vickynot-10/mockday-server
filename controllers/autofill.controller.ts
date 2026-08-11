import { get_db } from "../config/mongodb";
import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { getCachedAutoFill, setCachedAutoFill } from "../cache/autofill.cache";
import { invalidateExtensionCache } from "../cache/extension_app.cache";
export async function GetAutoFills(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const cached = await getCachedAutoFill(user_id);
    if (cached) {
      return send_success(reply, cached, 200);
    }

    const db = get_db();

    const data = await db
      .collection("autofills")
      .findOne(
        { fk_user_id: new ObjectId(user_id) },
        { projection: { fk_user_id: 0 } },
      );

    if (data) {
      await setCachedAutoFill(user_id, data);
    }

    return send_success(reply, data, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function SaveAutoFill(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const data = req.body as any;

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return send_error(reply, "Invalid Data", 400);
    }

    const db = get_db();
    const now = new Date();
    const user_obj_id = new ObjectId(user_id);

    const newDoc = {
      ...data,
      fk_user_id: user_obj_id,
      updated_on: now,
    };

    const result = await db
      .collection("autofills")
      .replaceOne({ fk_user_id: user_obj_id }, newDoc, { upsert: true });

    if (!result || !result.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }

    const { fk_user_id, ...cacheable } = newDoc;
    await Promise.all([
      setCachedAutoFill(user_id, cacheable),
      invalidateExtensionCache(user_id),
    ]);

    return send_success(reply, {}, 200, "AutoFill Saved Successfully!");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
