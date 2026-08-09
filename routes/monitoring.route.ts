import { FastifyInstance } from "fastify";
import {
  GetMonitoringURLs,
  RunPingCheck,
  GetMonitoringURLConfig,
  UpdateMonitorCOnfig,
  DuplicateMonitor,
  RemoveMonitorConfig,
  UpdateConfigStatus,
  BulkUpdates
} from "../controllers/monitoring.controller";

export async function MonitoringRoutes(app: FastifyInstance) {
  app.get("/", GetMonitoringURLs);
  app.get("/config", GetMonitoringURLConfig);
  app.post("/run-check", RunPingCheck);
  app.post("/", UpdateMonitorCOnfig);
  app.post("/duplicate", DuplicateMonitor);
  app.delete("/", RemoveMonitorConfig);
    app.post("/bulk-updates" , BulkUpdates);
  app.patch("/", UpdateConfigStatus);
}
