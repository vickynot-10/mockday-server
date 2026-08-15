import { FastifyInstance } from "fastify";
import { GetTrackers, UpdateTrackerStatus } from "../controllers/job_tracker.controller";
export async function JobTrackerRoutes(app: FastifyInstance) {
  app.get("/", GetTrackers);
  app.post("/update", UpdateTrackerStatus);
}
