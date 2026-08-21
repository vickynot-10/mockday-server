import { FastifyInstance } from "fastify";
import {
  GetConversationLists,
  GetConversationListsTotal,
  GetResumesList,
  SendMessage,
} from "../controllers/ai.controller";
export async function AIRoutes(app: FastifyInstance) {
  app.post("/", SendMessage);
  app.get("/resumes", GetResumesList);
  app.get("/", GetConversationLists);
  app.get("/count", GetConversationListsTotal);
}
