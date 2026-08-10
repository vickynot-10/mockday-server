import { FastifyInstance } from "fastify";
import { GetAutoFillFields } from "../controllers/extension.controller";
export async function ExtensionRoutes(app: FastifyInstance) {
  app.get("/", GetAutoFillFields);
}
