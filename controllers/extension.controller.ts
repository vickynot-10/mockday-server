import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { generateExtensionToken } from "../libs/jwt";
import { ObjectId } from "mongodb";
import { get_db } from "../config/mongodb";

export async function GetAutoFillFields(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const user = req.ext_user;
    if (!user) {
      return send_error(reply, "Unauthorized", 401);
    }

    const user_obj_id = new ObjectId(user.fk_user_id);

    const db = get_db();
    const rules = await db.collection("autofills").findOne(
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
    );

    return send_success(reply, rules, 200, "Data are fetched ");
  } catch (err) {
    return send_error(reply, "Something went wrong", 500);
  }
}
