import { FastifyInstance } from "fastify";
import { SaveStatus , GetStatus, DeleteStatus, SetDefaultStatus, GetAllStatus } from "../controllers/status.controller";
export async function StatusRoutes(app: FastifyInstance) {
  app.get("/", GetStatus);
  app.get("/all", GetAllStatus);
  app.post("/", SaveStatus);
  app.delete("/", DeleteStatus);
  app.patch("/", SetDefaultStatus);
}
