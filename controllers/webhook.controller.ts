import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { get_db } from "../config/mongodb";
import { VerifyQStashSign } from "../service/reminder.service";
import { WEBHOOK_CONSTANTS } from "../constants";
import { sendNotification } from "../service/mail.service";
import { sendPushNotification } from "../service/notification.service";
import { ArrayProps } from "../service/resume-parser.service";
import { getFileSignedUrl } from "../service/bucketClient";
import { pdfToDocx } from "../service/pdf_adobe.service";


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
      fk_user_id,
    });

    const sendAsEmail = get_notyf_settings?.email ?? false;
    const sendAsPush = get_notyf_settings?.push ?? false;

    const note = reminder?.note ?? "";

    if (!get_notyf_settings || (!sendAsEmail && !sendAsPush)) {
      await db.collection("notification-logs").insertOne({
        fk_tracker_id,
        fk_user_id,
        fk_reminder_id: reminder._id,
        fired_at: new Date(),
        status: WEBHOOK_CONSTANTS.NOTIFICATION_TYPE.ERROR,
        msg: "Notification Settings is not enabled",
        notes: note,
      });
      return send_error(reply, "Settings not found !");
    }

    if (sendAsEmail) {
      let email = get_notyf_settings?.notify_email ?? null;

      if (!email) {
        const findUser: any = await db
          .collection("users")
          .findOne({ _id: fk_user_id }, { projection: { email: 1 } });

        email = findUser?.email ?? null;
      }

      if (!email) {
        await db.collection("notification-logs").insertOne({
          fk_tracker_id,
          fk_user_id,
          fk_reminder_id: reminder._id,
          fired_at: new Date(),
          status: WEBHOOK_CONSTANTS.NOTIFICATION_TYPE.ERROR,
          provider: WEBHOOK_CONSTANTS.PROVIDER.EMAIL,
          msg: "Email is not configured !",
          notes: note,
        });
      } else {
        try {
          await sendNotification(email, note);
          await db.collection("notification-logs").insertOne({
            fk_tracker_id,
            fk_user_id,
            fk_reminder_id: reminder._id,
            fired_at: new Date(),
            status: WEBHOOK_CONSTANTS.NOTIFICATION_TYPE.SUCCESS,
            provider: WEBHOOK_CONSTANTS.PROVIDER.EMAIL,
            msg: "Email sent successfully",
            notes: note,
          });
        } catch (err) {
          await db.collection("notification-logs").insertOne({
            fk_tracker_id,
            fk_user_id,
            fk_reminder_id: reminder._id,
            fired_at: new Date(),
            status: WEBHOOK_CONSTANTS.NOTIFICATION_TYPE.ERROR,
            provider: WEBHOOK_CONSTANTS.PROVIDER.EMAIL,
            msg: err instanceof Error ? err.message : "Failed to send email",
            notes: note,
          });
        }
      }
    }

    if (sendAsPush) {
      if (!get_notyf_settings.push_registered) {
        await db.collection("notification-logs").insertOne({
          fk_tracker_id,
          fk_user_id,
          fk_reminder_id: reminder._id,
          fired_at: new Date(),
          status: WEBHOOK_CONSTANTS.NOTIFICATION_TYPE.ERROR,
          provider: WEBHOOK_CONSTANTS.PROVIDER.PUSH,
          msg: "Please Register your Device for notifications !",
          notes: note,
        });
      } else {
        try {
          await sendPushNotification(user_id, note);
          await db.collection("notification-logs").insertOne({
            fk_tracker_id,
            fk_user_id,
            fk_reminder_id: reminder._id,
            fired_at: new Date(),
            status: WEBHOOK_CONSTANTS.NOTIFICATION_TYPE.SUCCESS,
            provider: WEBHOOK_CONSTANTS.PROVIDER.PUSH,
            msg: "Push notification sent",
            notes: note,
          });
        } catch (err) {
          await db.collection("notification-logs").insertOne({
            fk_tracker_id,
            fk_user_id,
            fk_reminder_id: reminder._id,
            fired_at: new Date(),
            status: WEBHOOK_CONSTANTS.NOTIFICATION_TYPE.ERROR,
            provider: WEBHOOK_CONSTANTS.PROVIDER.PUSH,
            msg: err instanceof Error ? err.message : "Failed to send push",
            notes: note,
          });
        }
      }
    }

    return send_success(reply, {}, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

type ResumeParserWebhookBody = {
  items: ArrayProps[];
};

export async function ResumeParserWebhook(
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

    const body: ResumeParserWebhookBody = JSON.parse(raw_body);

    const filtered = body.items.filter(
      (el) => el.fk_user_id && ObjectId.isValid(el.fk_user_id),
    );

    if (!filtered || filtered.length <= 0) {
      return send_error(reply, "Unauthorized", 401);
    }

    for (const file of filtered) {
      const signedUrl = await getFileSignedUrl(file.key);
      const docxBuffer = await pdfToDocx(signedUrl);
      
    }

    return send_success(reply, {}, 200);
  } catch (err) {
    console.error("Resume parser webhook error:", err);

    return send_error(reply, "Internal Server Error", 500);
  }
}
