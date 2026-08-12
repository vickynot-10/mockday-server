import { FastifyInstance } from "fastify";
import { GetTrackers } from "../controllers/job_tracker.controller";
export async function JobTrackerRoutes(app: FastifyInstance) {
  app.get("/", GetTrackers);
}
