import { qstash } from "../config/qstash";

export async function CreateReminder(
  tracker_id: string,
  reminder_date: Date,
  reminder_time: string,
) {
  const [hours, minutes] = reminder_time.split(":").map(Number);
  const fire_at = new Date(reminder_date);
  fire_at.setHours(hours, minutes, 0, 0);

  const delay_seconds = Math.max(
    0,
    Math.floor((fire_at.getTime() - Date.now()) / 1000),
  );

  const result = await qstash().publishJSON({
    url: `${process.env.API_BASE_URL}/webhooks/reminder-fire`,
    body: { tracker_id },
    delay: delay_seconds,
  });

  return result.messageId;
}

export async function DeleteReminder(message_id?: string) {
  if (!message_id) return;
  try {
    await qstash().messages.cancel(message_id);
  } catch (err) {
    console.error("Failed to delete QStash message:", err);
  }
}
