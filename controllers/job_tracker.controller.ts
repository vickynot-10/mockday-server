import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { get_db } from "../config/mongodb";

export async function GetTrackers(req: FastifyRequest, reply: FastifyReply) {
  try {
    const db = get_db();
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { page = 1, limit = 25, sort = -1, search } = req.query;

    const match = {
      fk_user_id: new ObjectId(user_id),
    };

    if (search) {
    }

    const [docs, total] = await Promise.all([
      db
        .collection("trackers")
        .find(match, {
          projection: {
            fk_user_id: 0,
          },
        })
        .sort({ applied_on: sort }).toArray(),
      db.collection("trackers").countDocuments(match),
    ]);

    return send_success(reply, { docs, total }, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
