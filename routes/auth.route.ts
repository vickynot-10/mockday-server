import { FastifyInstance } from "fastify";
import { SignUp, SignIn, SignOut } from "../controllers/auth.controller";
export async function AuthRoutes(app: FastifyInstance) {
  app.post("/sign-up", SignUp);
  app.post("/sign-in", SignIn);
  app.post("/sign-out", SignOut);
}
