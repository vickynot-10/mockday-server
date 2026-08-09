import bcrypt from "bcrypt";
import { get_db } from "../config/mongodb";
import { send_success, send_error } from "../utils/response";
import { SignUpSchema, LoginAuthSchema } from "../schema/auth.schema";
import { FastifyReply, FastifyRequest } from "fastify";
import { generateToken } from "../libs/jwt";

const SetCookie = (reply: FastifyReply, token: string) => {
  reply.setCookie("pulsewatch", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
};

export async function SignUp(req: FastifyRequest, reply: FastifyReply) {
  try {
    const result = SignUpSchema.safeParse(req.body);

    if (!result.success) {
      return send_error(reply, result.error.issues[0].message, 400);
    }

    const { email, password, name } = result.data;
    const db = get_db();

    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      return send_error(reply, "User already exists", 400);
    }

    const hashed_password = await bcrypt.hash(password, 10);

    const payload = {
      email,
      name,
      password: hashed_password,
      created_on: new Date(),
      updated_on: new Date(),
    };

    const insert_data = await db.collection("users").insertOne(payload);

    if (!insert_data?.acknowledged) {
      return send_error(reply, "Failed to create, try again", 400);
    }

    const token = generateToken({
      user_id: insert_data.insertedId,
      email,
      name,
    });

    SetCookie(reply, token);

    return send_success(reply, {}, 201, "Signed up successfully");
  } catch (err) {
    return send_error(reply, "Something went wrong", 500);
  }
}

export async function SignIn(req: FastifyRequest, reply: FastifyReply) {
  try {
    const result = LoginAuthSchema.safeParse(req.body);

    if (!result.success) {
      return send_error(reply, result.error.issues[0].message, 400);
    }

    const { email, password } = result.data;
    const db = get_db();

    const user = await db.collection("users").findOne({ email });

    if (!user || !user.password) {
      return send_error(reply, "Invalid email or password", 400);
    }

    const is_match = await bcrypt.compare(password, user.password);

    if (!is_match) {
      return send_error(reply, "Invalid email or password", 400);
    }

    const token = generateToken({
      user_id: user._id,
      email: user.email,
      name: user.name,
      fk_org_id: user.fk_org_id,
    });

    SetCookie(reply, token);

    return send_success(
      reply,
      { user_name: user.name ?? "User" },
      200,
      "Login successful",
    );
  } catch (err) {
    return send_error(reply, "Something went wrong", 500);
  }
}

export async function SignOut(req: FastifyRequest, reply: FastifyReply) {
  reply.clearCookie("pulsewatch", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return send_success(reply, {}, 200, "Logged out successfully");
}
