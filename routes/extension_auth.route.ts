import { FastifyInstance } from "fastify";
import { GenerateExtensionToken } from "../controllers/extension_auth.controller";
export async function ExtensionAuthRoutes(app: FastifyInstance) {
  app.post("/", GenerateExtensionToken);
}
