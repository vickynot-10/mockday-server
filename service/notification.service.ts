import * as OneSignal from "@onesignal/node-onesignal";
import { onesignal } from "../config/onesignal";

export async function sendPushNotification(
  onesignal_user_id: string,
  note: string,
) {
  const notification = new OneSignal.Notification();
  notification.app_id = process.env.ONESIGNAL_APP_ID as string;
  notification.include_aliases = {
    external_id: [onesignal_user_id],
  };
  notification.target_channel = "push";
  notification.headings = { en: "Reminder" };
  notification.contents = { en: note || "You have a reminder" };

  const result = await onesignal().createNotification(notification);
  return result;
}