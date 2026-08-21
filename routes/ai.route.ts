import { FastifyInstance } from "fastify";
import {
  GetConversationLists,
  GetConversationMessage,
  GetResumesList,
  SendMessage,
} from "../controllers/ai.controller";
export async function AIRoutes(app: FastifyInstance) {
  app.post("/", SendMessage);
  app.get("/resumes", GetResumesList);
  app.get("/", GetConversationLists);
  app.get("/conversation", GetConversationMessage);
}
