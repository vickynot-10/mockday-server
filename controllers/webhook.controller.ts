import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { get_db } from "../config/mongodb";
import { VerifyQStashSign } from "../service/reminder.service";
import { WEBHOOK_CONSTANTS } from "../constants";
import { DeleteReminder } from "../service/reminder.service";
export async function ReminderFireWebhook(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const signature = req.headers["upstash-signature"] as string | undefined;

    const raw_body = (req as any).rawBody as string;
    const is_valid = await VerifyQStashSign(signature, raw_body);

    if (!is_valid) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { tracker_id, user_id } = req.body as {
      tracker_id: string;
      user_id: string;
    };

    if (
      !tracker_id ||
      !ObjectId.isValid(tracker_id) ||
      !user_id ||
      !ObjectId.isValid(user_id)
    ) {
      return send_error(reply, "Invalid Payload !", 400);
    }

    const fk_user_id = new ObjectId(user_id);
    const fk_tracker_id = new ObjectId(tracker_id);
    const db = get_db();
    const reminder = await db.collection("reminders").findOne({
      fk_tracker_id,
      fk_user_id,
    });
    if (!reminder) {
      return send_success(reply, {}, 200);
    }

    const get_notyf_settings = await db.collection("notifications").findOne({
      fk_tracker_id,
      fk_user_id,
    });

    const sendAsEmail = get_notyf_settings?.email ?? false;
    const sendAsPush = get_notyf_settings?.push ?? false;

    if (!get_notyf_settings || (!sendAsEmail && !sendAsPush) ) {
      await db.collection("notification-logs").insertOne({
        fk_tracker_id,
        fk_user_id,
        fk_reminder_id: reminder._id,
        fired_at: new Date(),
        status: WEBHOOK_CONSTANTS.NOTIFICATION_TYPE.ERROR,
        msg: "Notification Settings is not enabled",
        notes: reminder?.note ?? "",
      });
      return send_error(reply , "Settings not found !")
    }

    if(sendAsEmail){

    }

    if(sendAsPush){
        
    }

    return send_success(reply, {}, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
