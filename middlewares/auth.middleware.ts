import { FastifyRequest, FastifyReply } from "fastify";
import jwt, { JwtPayload } from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { send_error } from "../utils/response";

interface AuthUser extends JwtPayload {
  user_id: string;
  email: string;
  name: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const token = request.cookies.mockday;

  if (!token) {
    return send_error(reply, "Not Logged In , Try Login Again !", 401);
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY as string,
    ) as AuthUser;

    if (!decoded || !decoded.user_id || !ObjectId.isValid(decoded.user_id)) {
      return send_error(reply, "Not Logged In , Try Login Again !", 401);
    }

    request.user = decoded;
  } catch (err) {
    return send_error(reply, "Not Logged In , Try Login Again !", 401);
  }
}
