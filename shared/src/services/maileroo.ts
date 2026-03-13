import env from '../config/env';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('shared:maileroo');

interface EmailObject {
  address: string;
  display_name?: string;
}

interface MailerooEmailRequest {
  from: EmailObject;
  to: EmailObject | EmailObject[];
  cc?: EmailObject | EmailObject[];
  bcc?: EmailObject | EmailObject[];
  reply_to?: EmailObject | EmailObject[];
  subject: string;
  html?: string;
  plain?: string;
  tracking?: boolean;
  tags?: Record<string, string>;
}

interface MailerooResponse {
  success: boolean;
  message: string;
  data?: { reference_id: string };
}

const MAILEROO_URL = 'https://smtp.maileroo.com/api/v2/emails';

async function sendRaw(emailData: MailerooEmailRequest): Promise<MailerooResponse> {
  const apiKey = env.MAILEROO_API_KEY;
  if (!apiKey) throw new Error('MAILEROO_NOT_CONFIGURED');

  const response = await fetch(MAILEROO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(emailData),
  });

  const data = (await response.json()) as MailerooResponse;
  if (!response.ok || !data.success) {
    throw new Error(`Maileroo error (${response.status}): ${data.message}`);
  }
  return data;
}

export async function sendPlainEmail(params: {
  to: string;
  subject: string;
  html?: string;
  plain?: string;
  tags?: Record<string, string>;
}): Promise<void> {
  await sendRaw({
    from: {
      address: env.MAILEROO_FROM_EMAIL,
      display_name: env.MAILEROO_FROM_NAME,
    },
    to: { address: params.to },
    subject: params.subject,
    html: params.html,
    plain: params.plain,
    tracking: true,
    tags: params.tags,
  });

  logger.info({ to: params.to, subject: params.subject }, 'Email sent');
}

export function isMailerooConfigured(): boolean {
  return !!env.MAILEROO_API_KEY;
}
