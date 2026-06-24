import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

const configured = !!(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);

const transporter = configured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT!, 10),
      secure: parseInt(SMTP_PORT!, 10) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!transporter) return; // SMTP not configured, silently skip
  try {
    await transporter.sendMail({
      from: SMTP_FROM ?? SMTP_USER,
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error('Email send failed:', err);
  }
}
