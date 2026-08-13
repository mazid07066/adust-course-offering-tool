import nodemailer from "nodemailer";

type PasswordResetMailInput = {
  recipientEmail: string;
  facultyName: string;
  resetToken: string;
};

function requiredEnv(name: string) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function smtpSecure() {
  return String(process.env.SMTP_SECURE || "false")
    .trim()
    .toLowerCase() === "true";
}

function appBaseUrl() {
  return requiredEnv("UNIFLOW_APP_URL").replace(/\/+$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createTransporter() {
  const host = requiredEnv("SMTP_HOST");
  const port = Number(requiredEnv("SMTP_PORT"));
  const secure = smtpSecure();
  const user = requiredEnv("SMTP_USER");
  const password = requiredEnv("SMTP_PASSWORD");

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a valid positive integer.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,

    auth: {
      user,
      pass: password,
    },

    /*
     * Port 587 uses STARTTLS.
     * Port 465 normally uses secure=true.
     */
    requireTLS: !secure,
  });
}

export async function verifyUniFlowMailTransport() {
  const transporter = createTransporter();

  await transporter.verify();

  return true;
}

export async function sendFacultyPasswordResetEmail(
  input: PasswordResetMailInput
) {
  const fromName =
    process.env.UNIFLOW_MAIL_FROM_NAME?.trim() ||
    "UniFlow Academic Planner";

  const fromAddress =
    process.env.UNIFLOW_MAIL_FROM_ADDRESS?.trim() ||
    requiredEnv("SMTP_USER");

  const replyTo =
    process.env.UNIFLOW_MAIL_REPLY_TO?.trim() ||
    fromAddress;

  const resetUrl =
    `${appBaseUrl()}/auth/reset-password?token=${encodeURIComponent(
      input.resetToken
    )}`;

  const safeFacultyName =
    escapeHtml(
      input.facultyName || "Faculty Member"
    );

  const safeResetUrl =
    escapeHtml(resetUrl);

  const transporter =
    createTransporter();

  const subject =
    "UniFlow Password Reset Request";

  const text = [
    `Dear ${input.facultyName || "Faculty Member"},`,
    "",
    "A request was received to reset the password for your UniFlow Academic Planner faculty account.",
    "",
    "Use the secure link below to choose a new password:",
    "",
    resetUrl,
    "",
    "This password-reset link is valid for 15 minutes and can be used only once.",
    "",
    "If you did not request this password reset, you may safely ignore this email. Your existing password will remain unchanged.",
    "",
    "For security, do not forward or share this password-reset link with anyone.",
    "",
    "Regards,",
    "UniFlow Academic Planner",
  ].join("\n");

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
            <div style="font-size:22px;font-weight:700;margin-bottom:8px;">
              UniFlow Academic Planner
            </div>

            <div style="font-size:14px;color:#64748b;margin-bottom:28px;">
              Faculty Password Management
            </div>

            <p style="font-size:15px;line-height:1.7;">
              Dear <strong>${safeFacultyName}</strong>,
            </p>

            <p style="font-size:15px;line-height:1.7;">
              A request was received to reset the password for your
              UniFlow Academic Planner faculty account.
            </p>

            <p style="font-size:15px;line-height:1.7;">
              Use the button below to choose a new password.
            </p>

            <div style="margin:28px 0;">
              <a
                href="${safeResetUrl}"
                style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:10px;"
              >
                Reset UniFlow Password
              </a>
            </div>

            <p style="font-size:14px;line-height:1.7;color:#475569;">
              This password-reset link is valid for
              <strong>15 minutes</strong> and can be used only once.
            </p>

            <p style="font-size:14px;line-height:1.7;color:#475569;">
              If you did not request this password reset, you may safely
              ignore this email. Your existing password will remain unchanged.
            </p>

            <p style="font-size:14px;line-height:1.7;color:#475569;">
              For security, do not forward or share this password-reset
              link with anyone.
            </p>

            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;">
              <p style="font-size:13px;color:#64748b;margin:0 0 8px;">
                If the button does not work, copy and paste this address into your browser:
              </p>

              <p style="font-size:12px;word-break:break-all;color:#2563eb;margin:0;">
                ${safeResetUrl}
              </p>
            </div>

            <div style="margin-top:30px;font-size:13px;line-height:1.7;color:#64748b;">
              Regards,<br />
              <strong>UniFlow Academic Planner</strong>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const info =
    await transporter.sendMail({
      from:
        `"${fromName}" <${fromAddress}>`,

      replyTo,

      to:
        input.recipientEmail,

      subject,
      text,
      html,
    });

  return {
    messageId:
      info.messageId,
  };
}
