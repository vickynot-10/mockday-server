import { qstash } from "../config/qstash";
import { Receiver } from "@upstash/qstash";

export async function CreateReminder(
  tracker_id: string,
  user_id: string,
  reminder_at: Date,
) {
  const delay_seconds = Math.max(
    0,
    Math.floor((reminder_at.getTime() - Date.now()) / 1000),
  );
  const result = await qstash().publishJSON({
    url: `${process.env.API_BASE_URL}/api/webhooks/reminder-fire`,
    body: { tracker_id , user_id},
    delay: delay_seconds,
  });

  return result.messageId;
}

export async function DeleteReminder(message_id: string) {
  if (!message_id) return;
  try {
    await qstash().messages.cancel(message_id);
  } catch (err) {
    console.error("Failed to delete QStash message:", err);
  }
}

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function VerifyQStashSign(
  signature: string | undefined,
  body: string,
) {
  if (!signature) return false;
  try {
    return await receiver.verify({
      signature,
      body,
    });
  } catch (err) {
    return false;
  }
}
