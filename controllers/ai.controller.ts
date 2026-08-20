import { get_db } from "../config/mongodb";
import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { GoogleGenAI } from "@google/genai";
import {
  getResumeParagraphs,
  setCachedResumeParaTexts,
} from "../cache/ai.cache";
import { AI_COMMANDS } from "../constants";
import { getUserProfileCache, setUserProfileCache } from "../cache/user_details.cache";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function SendMessage(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { message, resumeId } = req.body as {
      message: string;
      resumeId?: string;
    };

    if (!message || typeof message !== "string" || message.trim().length <= 0) {
      return send_error(reply, "Please Enter a Message !", 400);
    }

    const isResumeReworkNeed = message.includes(
      AI_COMMANDS.COMMANDS.RESUME_REWORK,
    );
    const isCoverLetterNeed = message.includes(
      AI_COMMANDS.COMMANDS.COVER_LETTER,
    );
    const isJobMatchNeed = message.includes(AI_COMMANDS.COMMANDS.JOB_MATCH);
    const isCommandNeed =
      isCoverLetterNeed || isResumeReworkNeed || isJobMatchNeed;

    if (isCommandNeed && (!resumeId || !ObjectId.isValid(resumeId))) {
      return send_error(
        reply,
        "For using commands, please select a resume",
        400,
      );
    }

    let paragraphs: any[] = [];

    const fk_user_id = new ObjectId(user_id);

    const db = get_db();

    if (resumeId && ObjectId.isValid(resumeId)) {
      const resumeInCache = await getResumeParagraphs(user_id, resumeId);

      if (resumeInCache) {
        paragraphs = resumeInCache;
      } else {
        const get_resume_para = await db.collection("resumes").findOne(
          {
            _id: new ObjectId(resumeId),
            fk_user_id,
          },
          {
            projection: {
              extracted_paragraphs: 1,
            },
          },
        );

        if (get_resume_para && get_resume_para?.extracted_paragraphs) {
          paragraphs = get_resume_para?.extracted_paragraphs ?? [];
          setCachedResumeParaTexts(user_id, resumeId, paragraphs);
        }
      }
    }

    let user_details = null;

    const isUserIncache = await getUserProfileCache(user_id);

    if (isUserIncache) {
      user_details = isUserIncache;
    } else {
      const get_user_details = await db.collection("autofills").findOne(
        {
          fk_user_id,
        },
        {
          projection: {
            password: 0,
            _id: 0,
            fk_user_id: 0,
            updated_on: 0,
          },
        },
      );
      if (get_user_details) {
        user_details = get_user_details;
        await setUserProfileCache(user_id , user_details)
      }
    }

    // const result = await genAI.models.generateContent({
    //   model: "gemini-3.6-flash",
    //   contents: message,
    // });

    return send_success(reply, { reply: " result.text" }, 200);
  } catch (err) {
    console.log(err);
    return send_error(reply, "Internal Server Error", 500);
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
