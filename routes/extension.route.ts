import { FastifyInstance } from "fastify";
import { GetAutoFillFields, SaveJobTrackerFromExt } from "../controllers/extension.controller";
export async function ExtensionRoutes(app: FastifyInstance) {
  app.get("/", GetAutoFillFields);
  app.post("/save", SaveJobTrackerFromExt);
}
