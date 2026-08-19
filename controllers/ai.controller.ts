import { get_db } from "../config/mongodb";
import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function SendMessage(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { message } = req.body as { message: string };

    if (!message) {
      return send_error(reply, "Message is required", 400);
    }

    const result = await genAI.models.generateContent({
      model: "gemini-3.6-flash",
      contents: message,
    });

    return send_success(
      reply,
      { reply: result.text },
      200,
      "Status Updated Successfully !",
    );
  } catch (err) {
    console.log(err);
    return send_error(reply, "Internal Server Error", 500);
  }
}
