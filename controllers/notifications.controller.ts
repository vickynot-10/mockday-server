import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { get_db } from "../config/mongodb";

export async function GetNotifications(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const db = get_db();
    const doc = await db.collection("notifications").findOne(
      {
        fk_user_id: new ObjectId(user_id),
      },
      {
        projection: {
          email: 1,
          push: 1,
        },
      },
    );

    return send_success(reply, doc, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function SaveNotifications(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { email, push } = req.body as {
      email: boolean;
      push: boolean;
    };

    const db = get_db();

    const result = await db.collection("notifications").updateOne(
      {
        fk_user_id: new ObjectId(user_id),
      },
      {
        $set: {
          email,
          push,
          updated_on: new Date(),
        },
        $setOnInsert: {
          fk_user_id: new ObjectId(user_id),
          created_on: new Date(),
        },
      },
      {
        upsert: true,
      },
    );

    if (!result.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }

    return send_success(
      reply,
      {
       
      },
      200,
      "Notification settings saved successfully!",
    );
  } catch (err) {
 
    return send_error(reply, "Internal Server Error", 500);
  }
}