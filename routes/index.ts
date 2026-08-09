import { FastifyInstance } from "fastify";
import { AuthRoutes } from "./auth.route";
import { ProjectRoutes } from "./projects.route";
import { MonitoringRoutes } from "./monitoring.route";
import { MonitorDashboardRoutes } from "./monitor-dashboard.route";
import { IncidentRoutes } from "./incident.route";
import { authMiddleware } from "../middlewares/auth.middleware";

export const RegisterRoutes = async (app: FastifyInstance) => {
  app.register(AuthRoutes, { prefix: "/" });

  app.register(async (instance) => {
    instance.addHook("preHandler", authMiddleware);
    instance.register(ProjectRoutes, { prefix: "/projects" });
    instance.register(MonitorDashboardRoutes, { prefix: "/monitor-dashboard" });
    instance.register(MonitoringRoutes, { prefix: "/monitors" });
    instance.register(IncidentRoutes, { prefix: "/incidents" });
  });
};
