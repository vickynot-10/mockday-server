import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function SendReminderEmail(
  to: string,
  note: string,
  reminder_at: Date,
) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Reminder",
    text: `${note}\n\nScheduled for: ${reminder_at.toLocaleString()}`,
  });
}