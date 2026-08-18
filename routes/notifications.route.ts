import { FastifyInstance } from "fastify";
import {
  GetNotifications,
  GetNotificationsList,
  GetNotificationsLogs,
  RegisterDevice,
  SaveNotifications,
  SendOTP,
} from "../controllers/notifications.controller";
export async function NotificationRoutes(app: FastifyInstance) {
  app.post("/", SaveNotifications);
  app.get("/", GetNotifications);
  app.get("/all", GetNotificationsList);
  app.get("/logs", GetNotificationsLogs);
  app.post("/register-device", RegisterDevice);
  app.post("/send-otp", SendOTP);
  app.post("/verify-otp", RegisterDevice);
}
