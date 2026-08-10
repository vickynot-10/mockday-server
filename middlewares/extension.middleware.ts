import { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { send_error } from "../utils/response";

export interface AuthJwtPayload extends jwt.JwtPayload {
  user_id: string;
}

declare module "fastify" {
  interface FastifyRequest {
    ext_user: AuthJwtPayload;
  }
}

export async function extensionAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return send_error(reply, "Not Logged In, Try Login Again!", 401);
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return send_error(reply, "Not Logged In, Try Login Again!", 401);
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY_EXT as string,
    ) as AuthJwtPayload;
    if (
      !decoded.fk_user_id ||
      !ObjectId.isValid(decoded.fk_user_id) ||
      decoded.scope !== "extension"
    ) {
      return send_error(reply, "Not Logged In, Try Login Again!", 401);
    }

    request.ext_user = decoded;
  } catch (err) {
    return send_error(reply, "Not Logged In, Try Login Again!", 401);
  }
}
