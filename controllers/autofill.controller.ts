import { get_db } from "../config/mongodb";
import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
export async function GetAutoFills(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }
    const db = get_db();

    const data = await db
      .collection("autofills")
      .findOne(
        { fk_user_id: new ObjectId(user_id) },
        { projection: { fk_user_id: 0 } },
      );

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
    const insert = await db.collection("autofills").updateOne(
      {
        fk_user_id: user_obj_id,
      },
      {
        $set: {
          ...data,
          updated_on: now,
        },
        $setOnInsert: {
          fk_user_id: user_obj_id,
          created_on: now,
        },
      },
      {
        upsert: true,
      },
    );

    if (!insert || !insert.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }

    return send_success(reply, {}, 200, "AutoFill Saved Successfully!");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
