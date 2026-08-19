import { FastifyInstance } from "fastify";
import { AuthRoutes } from "./auth.route";
import { ResumeRoutes } from "./resume.routes";
import { AutoFillRoutes } from "./autofill.routes";
import { ExtensionAuthRoutes } from "./extension_auth.route";
import { ExtensionRoutes } from "./extension.route";
import { StatusRoutes } from "./status.route";
import { NotificationRoutes } from "./notifications.route";
import { DashboardRoutes } from "./dashboard.route";
import { AIRoutes } from "./ai.route";


import { authMiddleware } from "../middlewares/auth.middleware";
import uploadPlugin from "../plugins/upload";
import { extensionAuthMiddleware } from "../middlewares/extension.middleware";
import { JobTrackerRoutes } from "./job_tracker.route";
import { ProfileRoutes } from "./profile.route";

import { ReminderFireWebhook, ResumeParserWebhook } from "../controllers/webhook.controller";

export const RegisterRoutes = async (app: FastifyInstance) => {
  app.register(AuthRoutes, { prefix: "/" });

  app.register(async (instance) => {
    instance.addHook("preHandler", extensionAuthMiddleware);
    instance.register(ExtensionRoutes, { prefix: "/extensions-app" });
  });

  app.register(async (instance) => {
    instance.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (req, body, done) => {
        (req as any).rawBody = body;
        try {
          done(null, JSON.parse(body as string));
        } catch (err) {
          done(err as Error, undefined);
        }
      },
    );
    instance.post("/webhooks/reminder-fire", ReminderFireWebhook);
    instance.post("/webhooks/parse-resume", ResumeParserWebhook);
  });

  app.register(async (instance) => {
    instance.addHook("preHandler", authMiddleware);
    instance.register(uploadPlugin, { prefix: "/" });
    instance.register(ResumeRoutes, { prefix: "/resumes" });
    instance.register(AutoFillRoutes, { prefix: "/autofill" });
    instance.register(ExtensionAuthRoutes, { prefix: "/extensions" });
    instance.register(JobTrackerRoutes, { prefix: "/trackers" });
    instance.register(StatusRoutes, { prefix: "/status" });
    instance.register(NotificationRoutes, { prefix: "/notifications" });
    instance.register(ProfileRoutes, { prefix: "/profile" });
    instance.register(DashboardRoutes, { prefix: "/dashboard" });
    instance.register(AIRoutes, { prefix: "/ai" });
  });
};
