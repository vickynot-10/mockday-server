import { FastifyInstance } from "fastify";
import { SaveStatus , GetStatus, DeleteStatus } from "../controllers/status.controller";
export async function StatusRoutes(app: FastifyInstance) {
  app.get("/", GetStatus);
  app.post("/", SaveStatus);
  app.delete("/", DeleteStatus);
}
