import { FastifyInstance } from "fastify";
import {
  GetProjectsAndMonitorData,
  GetIncidentsForCharts,
  GetIncidentsWithStats,
  GetIncidentsLogs,
} from "../controllers/incidents.controller";

export async function IncidentRoutes(app: FastifyInstance) {
  app.get("/metadata", GetProjectsAndMonitorData);
  app.get("/", GetIncidentsWithStats);
  app.get("/stats", GetIncidentsForCharts);
  app.get("/logs", GetIncidentsLogs);
}
