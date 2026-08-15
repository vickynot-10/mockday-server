import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { get_db } from "../config/mongodb";

export async function GetUserDetails(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id , email , name} = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

  
    return send_success(reply, {user_id , email , name}, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

