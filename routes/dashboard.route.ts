import { FastifyInstance } from "fastify";
import { GetBarChartData, GetDashboard } from "../controllers/dashboard.controller";
export async function DashboardRoutes(app: FastifyInstance) {
  app.get("/", GetDashboard);
  app.get("/chart", GetBarChartData);
}
