import { FastifyInstance } from "fastify";
import { DeleteReminders, DeleteTracker, GetTrackerbyID, GetTrackerRemindersID, GetTrackers, SaveReminders, SaveTracker, UpdateTrackerStatus } from "../controllers/job_tracker.controller";
export async function JobTrackerRoutes(app: FastifyInstance) {
  app.get("/", GetTrackers);
  app.get("/get", GetTrackerbyID);
  app.get("/reminders", GetTrackerRemindersID);
  app.post("/reminders", SaveReminders);
  app.delete("/", DeleteTracker);
  app.delete("/reminders", DeleteReminders);
  app.post("/", SaveTracker);
  app.post("/update", UpdateTrackerStatus);
}
