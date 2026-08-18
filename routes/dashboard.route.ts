import { FastifyInstance } from "fastify";
import { GetDashboard } from "../controllers/dashboard.controller";
export async function DashboardRoutes(app: FastifyInstance) {
  app.get("/", GetDashboard);
}
