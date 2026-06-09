import nodemailer from 'nodemailer';
import { supabaseAdmin } from '../automations/admin-client';

/**
 * Load the active SMTP config for a given user.
 */
async function getSmtpConfig(userId: string) {
  const { data, error } = await supabaseAdmin()
    .from('smtp_configs')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw new Error(`SMTP config not found for user ${userId}: ${error.message}`);
  return data as {
    host: string;
    port: number;
    username: string;
    password: string;
    tls: boolean;
  };
}

/**
 * Send an email using the user's SMTP configuration.
 * Returns a message ID (UUID) for reference.
 */
export async function engineSendEmail(
  userId: string,
  to: string | string[],
  subject: string,
  body: string,
  html?: string
): Promise<string> {
  const cfg = await getSmtpConfig(userId);

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.tls, // true for 465, false for other ports
    auth: {
      user: cfg.username,
      pass: cfg.password,
    },
  });

  const info = await transporter.sendMail({
    from: cfg.username,
    to,
    subject,
    text: body,
    ...(html ? { html } : {}),
  });

  // Nodemailer returns a messageId like "<1234567890@example.com>"; strip brackets.
  return info.messageId?.replace(/[<>]/g, '') ?? Date.now().toString();
}
