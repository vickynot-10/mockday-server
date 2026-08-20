import { FastifyInstance } from "fastify";
import { GetResumesList, SendMessage } from "../controllers/ai.controller";
export async function AIRoutes(app: FastifyInstance) {
  app.post("/", SendMessage);
  app.get("/resumes", GetResumesList);
}
