import { get_db } from "../config/mongodb";
import { send_success, send_error, send_info } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { StatusSchema } from "../schema/status.schema";
export async function GetAutoFills(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const db = get_db();

    const data = await db
      .collection("status")
      .find(
        { fk_user_id: new ObjectId(user_id) },
        { projection: { fk_user_id: 0 } },
      )
      .toArray();
    return send_success(reply, data, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function SaveStatus(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const body = req.body;

    const validate = StatusSchema.safeParse(body);

    if (!validate.success) {
      return send_error(reply, validate.error.issues[0].message);
    }

    const db = get_db();
    const now = new Date();
    const user_obj_id = new ObjectId(user_id);

    const { name, color, _id } = validate.data;
    if (_id && ObjectId.isValid(_id)) {
      const res = await db.collection("status").updateOne(
        {
          _id: new ObjectId(_id),
        },
        {
          $set: {
            updated_on: now,
            name,
            color,
          },
        },
      );

      if (!res || !res.acknowledged) {
        return send_error(reply, "Internal Server Error ", 500);
      }
      if (res.matchedCount <= 0) {
        return send_error(reply, "No Status found ", 400);
      }

      return send_success(reply, {}, 200, "Status Updated Successfully !");
    }

    const doc = {
      name,
      color,
      fk_user_id: user_obj_id,
      updated_on: now,
      created_on: now,
    };

    const result = await db.collection("status").insertOne(doc);
  if (!result || !result.acknowledged) {
        return send_error(reply, "Internal Server Error ", 500);
      }
    return send_success(reply, {}, 200, "Status Updated Successfully !");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
