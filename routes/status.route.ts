import { FastifyInstance } from "fastify";
import { SaveStatus , GetStatus, DeleteStatus, SetDefaultStatus } from "../controllers/status.controller";
export async function StatusRoutes(app: FastifyInstance) {
  app.get("/", GetStatus);
  app.post("/", SaveStatus);
  app.delete("/", DeleteStatus);
  app.patch("/", SetDefaultStatus);
}
