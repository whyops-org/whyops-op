import env from '@whyops/shared/env';
import { mailerooService } from '../services/maileroo.service';

/**
 * Send magic link email for passwordless authentication
 */
export async function sendMagicLinkEmail(params: {
  to: string;
  magicLinkUrl: string;
}) {
  const { to, magicLinkUrl } = params;

  try {
    if (!mailerooService) {
      throw new Error('Maileroo service not configured. Please set MAILEROO_API_KEY environment variable.');
    }

    await mailerooService.sendMagicLink({
      to,
      magicLinkUrl,
    });

    console.log(`Magic link email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send magic link email:', error);
    throw error;
  }
}

/**
 * Verify email service connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    if (!env.MAILEROO_API_KEY) {
      console.warn('Maileroo API key not configured');
      return false;
    }

    if (!mailerooService) {
      console.warn('Maileroo service not initialized');
      return false;
    }

    const isValid = await mailerooService.verify();
    if (isValid) {
      console.log('Maileroo service configured successfully');
    }
    return isValid;
  } catch (error) {
    console.error('Maileroo connection verification failed:', error);
    return false;
  }
}
