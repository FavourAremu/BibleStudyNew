// server/lib/email.js
import nodemailer from "nodemailer";
import "dotenv/config";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"Christian Community Centre" <${process.env.SMTP_USER}>`;
const APP_URL = process.env.APP_URL || "http://localhost:5173";

export async function sendVerificationEmail(email, name, token) {
  if (!process.env.SMTP_USER) return; // skip if not configured
  const link = `${APP_URL}/verify?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Verify your Christian Community Centre account",
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;background:#f3ecd9;border-radius:8px">
        <div style="font-size:11px;letter-spacing:0.3em;color:#a9762f;margin-bottom:8px">CHRISTIAN COMMUNITY CENTRE</div>
        <h2 style="font-weight:400;margin:0 0 16px">Welcome, ${name}</h2>
        <p style="line-height:1.7;color:#3a2f1e">Click the button below to verify your email address and start studying scripture with the community.</p>
        <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#a9762f;color:#fff;text-decoration:none;border-radius:4px;font-size:14px">Verify email</a>
        <p style="font-size:12px;color:#9a8c6f">Link expires in 24 hours. If you didn't create an account, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email, name, token) {
  if (!process.env.SMTP_USER) return;
  const link = `${APP_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Reset your Christian Community Centre password",
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;background:#f3ecd9;border-radius:8px">
        <div style="font-size:11px;letter-spacing:0.3em;color:#a9762f;margin-bottom:8px">CHRISTIAN COMMUNITY CENTRE</div>
        <h2 style="font-weight:400;margin:0 0 16px">Password reset</h2>
        <p style="line-height:1.7;color:#3a2f1e">Hi ${name}, click below to reset your password. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#a9762f;color:#fff;text-decoration:none;border-radius:4px;font-size:14px">Reset password</a>
        <p style="font-size:12px;color:#9a8c6f">If you didn't request this, ignore this email — your password won't change.</p>
      </div>
    `,
  });
}

export async function sendReplyNotification(toEmail, toName, fromName, context) {
  if (!process.env.SMTP_USER) return;
  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: `${fromName} replied to your note — Christian Community Centre`,
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;background:#f3ecd9;border-radius:8px">
        <div style="font-size:11px;letter-spacing:0.3em;color:#a9762f;margin-bottom:8px">CHRISTIAN COMMUNITY CENTRE</div>
        <h2 style="font-weight:400;margin:0 0 16px">New reply from ${fromName}</h2>
        <p style="line-height:1.7;color:#3a2f1e">${context}</p>
        <a href="${APP_URL}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#a9762f;color:#fff;text-decoration:none;border-radius:4px;font-size:14px">View in app</a>
      </div>
    `,
  });
}
