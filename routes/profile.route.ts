import { FastifyInstance } from "fastify";
import { GetUserDetails } from "../controllers/profile.controller";
export async function ProfileRoutes(app: FastifyInstance) {
  app.get("/me", GetUserDetails);
}
