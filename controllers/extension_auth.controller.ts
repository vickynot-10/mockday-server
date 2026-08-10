import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { generateExtensionToken } from "../libs/jwt";

export async function GenerateExtensionToken(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const user = req.user;

    if (!user) {
      return send_error(reply, "Unauthorized", 401);
    }

    const token = generateExtensionToken({
      fk_user_id: user.user_id,
      scope: "extension",
    });

    return send_success(reply, token, 200, "Extension token generated");
  } catch (err) {
    return send_error(reply, "Something went wrong", 500);
  }
}

export async function Get(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const user = req.user;

    if (!user) {
      return send_error(reply, "Unauthorized", 401);
    }

    const token = generateExtensionToken({
      fk_user_id: user.user_id,
      scope: "extension",
    });

    return send_success(reply, token, 200, "Extension token generated");
  } catch (err) {
    return send_error(reply, "Something went wrong", 500);
  }
}