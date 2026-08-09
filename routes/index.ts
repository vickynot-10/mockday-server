import { FastifyInstance } from "fastify";
import { AuthRoutes } from "./auth.route";
import { ResumeRoutes } from "./resume.routes";
import { AutoFillRoutes } from "./autofill.routes";

import { authMiddleware } from "../middlewares/auth.middleware";
import uploadPlugin from "../plugins/upload";

export const RegisterRoutes = async (app: FastifyInstance) => {
  app.register(AuthRoutes, { prefix: "/" });

  app.register(async (instance) => {
    instance.addHook("preHandler", authMiddleware);
    instance.register(uploadPlugin, { prefix: "/" });
    instance.register(ResumeRoutes, { prefix: "/resumes" });
    instance.register(AutoFillRoutes, { prefix: "/autofill" });
  });
};
