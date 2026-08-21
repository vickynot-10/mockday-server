import { get_db } from "../config/mongodb";
import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { GoogleGenAI } from "@google/genai";
import {
  getResumeParagraphs,
  setCachedResumeParaTexts,
} from "../cache/ai.cache";
import {
  getUserProfileCache,
  setUserProfileCache,
} from "../cache/user_details.cache";
import {
  buildBatchPrompt,
  buildPlainChatPrompt,
  extractCommandsAndContent,
  generateTitleFromMessage,
} from "../service/resume-parser.service";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MAX_CONVERSATION_LIMIT = 20;

export async function SendMessage(req: FastifyRequest, reply: FastifyReply) {
  const { user_id } = req.user;

  if (!user_id || !ObjectId.isValid(user_id)) {
    return send_error(reply, "Unauthorized", 401);
  }

  const { message, resumeId, conversation_id } = req.body as {
    message: string;
    resumeId?: string;
    conversation_id?: string;
  };

  if (!message || typeof message !== "string" || message.trim().length <= 0) {
    return send_error(reply, "Please Enter a Message !", 400);
  }

  const abortController = new AbortController();
  req.raw.on("close", () => {
    if (!reply.raw.writableEnded) {
      abortController.abort();
    }
  });

  const { commands, content: jdText } = extractCommandsAndContent(message);
  const isCommandNeed = commands.length > 0;

  if (isCommandNeed && (!resumeId || !ObjectId.isValid(resumeId))) {
    return send_error(reply, "For using commands, please select a resume", 400);
  }
  if (isCommandNeed && (!jdText || jdText.length === 0)) {
    return send_error(
      reply,
      "Please provide a job description after the command",
      400,
    );
  }

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": process.env.UI_APP || "*",
    "Access-Control-Allow-Credentials": "true",
  });

  const send = (event: string, data: any) => {
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const fk_user_id = new ObjectId(user_id);
    const db = get_db();

    send("status", { message: "Loading resume..." });

    let paragraphs: any[] = [];
    if (resumeId && ObjectId.isValid(resumeId)) {
      const resumeInCache = await getResumeParagraphs(user_id, resumeId);
      if (resumeInCache) {
        paragraphs = resumeInCache;
      } else {
        const get_resume_para = await db
          .collection("resumes")
          .findOne(
            { _id: new ObjectId(resumeId), fk_user_id },
            { projection: { extracted_paragraphs: 1 } },
          );
        if (get_resume_para?.extracted_paragraphs) {
          paragraphs = get_resume_para.extracted_paragraphs;
          await setCachedResumeParaTexts(user_id, resumeId, paragraphs);
        }
      }
    }

    send("status", { message: "Loading profile..." });

    let user_details = null;
    const isUserIncache = await getUserProfileCache(user_id);
    if (isUserIncache) {
      user_details = isUserIncache;
    } else {
      const get_user_details = await db
        .collection("autofills")
        .findOne(
          { fk_user_id },
          { projection: { password: 0, _id: 0, fk_user_id: 0, updated_on: 0 } },
        );
      if (get_user_details) {
        user_details = get_user_details;
        await setUserProfileCache(user_id, user_details);
      }
    }

    let prompt = "";
    if (commands.length > 0) {
      send("status", { message: "Running requested tasks..." });
      prompt = buildBatchPrompt(commands, paragraphs, user_details, jdText);
    } else {
      prompt = buildPlainChatPrompt(message, user_details);
    }

    const isPlainChat = commands.length === 0;
    const result = await genAI.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        abortSignal: abortController.signal,
        ...(isPlainChat ? {} : { responseMimeType: "application/json" }),
      },
    });

    if (abortController.signal.aborted) {
      return reply.raw.end();
    }

    const raw = result.text;
    if (!raw) {
      send("error", { message: "AI returned no response" });
      return reply.raw.end();
    }

    const parsed = isPlainChat ? { message: raw } : JSON.parse(raw);

    if (parsed.error) {
      send("error", { message: parsed.error });
      return reply.raw.end();
    }

    send("complete", { reply: parsed });

    let fk_conversation_id: ObjectId;
    const assistantContent = isPlainChat
      ? { kind: "text", text: parsed.message }
      : { kind: "batch", ...parsed };

    if (conversation_id && ObjectId.isValid(conversation_id)) {
      fk_conversation_id = new ObjectId(conversation_id);
    } else {
      const created = await db.collection("conversations").insertOne({
        fk_user_id,
        title: generateTitleFromMessage(message),
        created_on: new Date(),
      });
      fk_conversation_id = created.insertedId;
    }

    await db.collection("messages").insertMany([
      {
        fk_conversation_id,
        fk_user_id,
        role: "user",
        content: { kind: "text", text: message },
        created_on: new Date(),
      },
      {
        fk_conversation_id,
        fk_user_id,
        role: "assistant",
        content: assistantContent,
        created_on: new Date(),
      },
    ]);

    reply.raw.end();
  } catch (err: any) {
    if (err.name === "AbortError") {
      return;
    }
    console.log(err);
    send("error", { message: "Internal Server Error" });
    reply.raw.end();
  }
}

export async function GetResumesList(req: FastifyRequest, reply: FastifyReply) {
  try {
    const db = get_db();
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const resumes = await db
      .collection("resumes")
      .find(
        { fk_user_id: new ObjectId(user_id) },
        { projection: { filename: 1, default: 1 } },
      )
      .sort({ created_at: -1 })
      .toArray();

    return send_success(reply, resumes, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function GetConversationLists(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const db = get_db();
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { page = 1 } = req.query as {
      page?: string | number;
    };

    const currentPage = Math.max(Number(page) || 1, 1);

    const skip = (currentPage - 1) * MAX_CONVERSATION_LIMIT;

    const fk_user_id = new ObjectId(user_id);
    const conversations = await db
      .collection("conversations")
      .find(
        { fk_user_id },
        {
          projection: {
            fk_user_id: 0,
          },
        },
      )
      .sort({ created_on: -1 })
      .skip(skip)
      .limit(MAX_CONVERSATION_LIMIT)
      .toArray();

    return send_success(reply, conversations, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function GetConversationMessage(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const db = get_db();
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { page = 1, conversation_id } = req.query as {
      conversation_id: string;
      page?: string | number;
    };

    if (!conversation_id || !ObjectId.isValid(conversation_id)) {
      return send_error(reply, "Invalid Body");
    }

    const currentPage = Math.max(Number(page) || 1, 1);

    const skip = (currentPage - 1) * MAX_CONVERSATION_LIMIT;

    const conversations = await db
      .collection("messages")
      .find(
        {
          fk_user_id: new ObjectId(user_id),
          fk_conversation_id: new ObjectId(conversation_id),
        },
        {
          projection: {
            fk_user_id: 0,
          },
        },
      )
      .sort({ created_on: -1 })
      .skip(skip)
      .limit(MAX_CONVERSATION_LIMIT)
      .toArray();

    return send_success(reply, conversations, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
