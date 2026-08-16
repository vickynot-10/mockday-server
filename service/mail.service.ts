import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOtpEmail(email: string, otp: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Your verification code",
    html: getTemplates(1, { otp }),
  });
}

function getTemplates(type: number, details: any) {
  if (type === 1) {
    const { otp } = details;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Your OTP Code</title>
  <link
    href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
    rel="stylesheet"
  />
</head>
<body style="margin:0;padding:0;font-family:'Poppins',sans-serif;background:#ffffff;font-size:14px;color:#2c3040;">

  <div style="max-width:480px;margin:0 auto;padding:48px 32px 40px;">

    <div style="height:4px;width:48px;background:#3D66DF;border-radius:4px;margin-bottom:28px;"></div>

    <span style="font-size:15px;font-weight:600;color:#0f1011;letter-spacing:-0.2px;">
      MockDay
    </span>

    <h1 style="margin:28px 0 10px;font-size:22px;font-weight:600;color:#0f1011;letter-spacing:-0.3px;">
      Verify it's you
    </h1>

    <p style="margin:0 0 32px;font-size:14px;line-height:1.7;color:#5a6070;">
      Use the code below to continue. It's valid for
      <strong style="color:#0f1011;font-weight:600;">10 minutes</strong>
      &mdash; don't share it with anyone.
    </p>

    <p style="margin:0 0 6px;font-size:44px;font-weight:700;letter-spacing:12px;color:#3D66DF;">
      ${otp}
    </p>
    <p style="margin:0 0 36px;font-size:12px;color:#a8afbe;">
      Expires in 10 minutes
    </p>

    <div style="height:1px;background:#eceef2;margin-bottom:24px;"></div>

    <p style="margin:0 0 4px;font-size:12px;color:#a8afbe;line-height:1.6;">
      Didn't request this? You can safely ignore this email.
    </p>
    <p style="margin:0;font-size:12px;color:#c4c8d1;">
      &copy; ${new Date().getFullYear()} MockDay
    </p>

  </div>

</body>
</html>`;
  }
}