import nodemailer from 'nodemailer';

// Transporter único y reutilizado entre envíos (evita rehacer el handshake
// SMTP en cada llamada) y con timeouts explícitos: si Gmail no responde en
// 10s, la promesa se rechaza en vez de quedar colgada para siempre.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}

export async function sendEmailWithAttachments(
  to: string,
  subject: string,
  html: string,
  attachments: { filename: string; path: string }[]
): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
    attachments,
  });
}
