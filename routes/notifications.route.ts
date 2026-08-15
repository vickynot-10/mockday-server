import { FastifyInstance } from "fastify";
import {
  GetNotifications,
  SaveNotifications,
} from "../controllers/notifications.controller";
export async function NotificationRoutes(app: FastifyInstance) {
  app.post("/", SaveNotifications);
  app.get("/", GetNotifications);
}
