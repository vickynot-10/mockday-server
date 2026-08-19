import { FastifyInstance } from "fastify";
import { SendMessage } from "../controllers/ai.controller";
export async function AIRoutes(app: FastifyInstance) {
  app.post("/", SendMessage);
}
