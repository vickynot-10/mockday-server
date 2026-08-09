import { FastifyInstance } from "fastify";
import { GetAutoFills  , SaveAutoFill} from "../controllers/autofill.controller";
export async function AutoFillRoutes(app: FastifyInstance) {
  app.get("/", GetAutoFills);
  app.post("/", SaveAutoFill);
}
