import { FastifyInstance } from "fastify";
import { MonitoringDashboard } from "../controllers/monitor-dashboard.controller";

export async function MonitorDashboardRoutes(app: FastifyInstance) {
  app.get("/", MonitoringDashboard);
}
