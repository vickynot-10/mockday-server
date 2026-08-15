import { FastifyInstance } from "fastify";
import { GetTrackerbyID, GetTrackers, SaveTracker, UpdateTrackerStatus } from "../controllers/job_tracker.controller";
export async function JobTrackerRoutes(app: FastifyInstance) {
  app.get("/", GetTrackers);
  app.get("/get", GetTrackerbyID);
  app.post("/", SaveTracker);
  app.post("/update", UpdateTrackerStatus);
}
