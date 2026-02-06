import env from '@whyops/shared/env';
import fs from 'fs';
import path from 'path';

interface EmailObject {
  address: string;
  display_name?: string;
}

interface AttachmentObject {
  file_name: string;
  content_type?: string;
  content: string;
  inline?: boolean;
}

interface MailerooEmailRequest {
  from: EmailObject;
  to: EmailObject | EmailObject[];
  cc?: EmailObject | EmailObject[];
  bcc?: EmailObject | EmailObject[];
  reply_to?: EmailObject | EmailObject[];
  subject: string;
  template_id?: number;
  template_data?: Record<string, unknown>;
  html?: string;
  plain?: string;
  tracking?: boolean;
  tags?: Record<string, string>;
  headers?: Record<string, string>;
  attachments?: AttachmentObject[];
  scheduled_at?: string;
  reference_id?: string;
}

interface MailerooResponse {
  success: boolean;
  message: string;
  data?: {
    reference_id: string;
  };
}

interface MailerooErrorResponse {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

class MailerooService {
  private apiKey: string;
  private baseUrl = 'https://smtp.maileroo.com/api/v2/emails';
  private templateUrl = 'https://smtp.maileroo.com/api/v2/emails/template';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Maileroo API key is required');
    }
    this.apiKey = apiKey;
  }

  async sendEmail(emailData: MailerooEmailRequest, useTemplate: boolean = false): Promise<MailerooResponse> {
    try {
      const url = useTemplate ? this.templateUrl : this.baseUrl;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(emailData),
      });

      const data = await response.json() as MailerooResponse | MailerooErrorResponse;

      if (!response.ok) {
        const errorResponse = data as MailerooErrorResponse;
        const errorMessage = this.getErrorMessage(response.status, errorResponse);
        throw new Error(errorMessage);
      }

      const successResponse = data as MailerooResponse;
      if (!successResponse.success) {
        throw new Error(`Maileroo API error: ${successResponse.message}`);
      }

      return successResponse;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Maileroo send email error:', error.message);
        throw error;
      }
      console.error('Maileroo send email error:', error);
      throw new Error('Failed to send email via Maileroo');
    }
  }

  /**
   * Load email template from file
   */
  private loadEmailTemplate(templateName: string, variables: Record<string, string>): string {
    const templatePath = path.join(__dirname, '../utils/email-templates', templateName);
    let html = fs.readFileSync(templatePath, 'utf-8');
    
    // Replace all variables in the template
    Object.entries(variables).forEach(([key, value]) => {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    return html;
  }

  /**
   * Send magic link email for passwordless authentication
   */
  async sendMagicLink(params: {
    to: string;
    magicLinkUrl: string;
  }): Promise<MailerooResponse> {
    const { to, magicLinkUrl } = params;

    // Load and populate the email template
    const html = this.loadEmailTemplate('verifyEmail.html', {
      MAGIC_LINK_URL: magicLinkUrl,
    });

    const emailData: MailerooEmailRequest = {
      from: {
        address: env.MAILEROO_FROM_EMAIL,
        display_name: env.MAILEROO_FROM_NAME,
      },
      to: {
        address: to,
      },
      subject: 'Verify your email address - WhyOps',
      html,
      plain: `
Thanks for signing up for WhyOps! We're excited to help you build more reliable, decision-aware agents.

To get started and verify your email address, please click the link below:

${magicLinkUrl}

This link will expire in 15 minutes for security reasons.

If you didn't create an account with WhyOps, you can safely ignore and delete this email.

© 2026 WhyOps. All rights reserved

If you didn't request this sign-in link, you can safely ignore this email.
      `,
      tracking: true,
      tags: {
        type: 'magic_link',
        source: 'auth',
      },
    };

    return this.sendEmail(emailData, false);
  }

  /**
   * Verify Maileroo API connection
   */
  async verify(): Promise<boolean> {
    try {
      if (!env.MAILEROO_API_KEY) {
        console.warn('Maileroo API key not configured');
        return false;
      }

      // Simple validation - just check if API key is present
      // Maileroo doesn't have a dedicated verification endpoint
      console.log('Maileroo API key configured');
      return true;
    } catch (error) {
      console.error('Maileroo verification failed:', error);
      return false;
    }
  }

  private getErrorMessage(status: number, errorResponse: MailerooErrorResponse): string {
    const baseMessage = errorResponse.message || 'Unknown error occurred';
    
    switch (status) {
      case 400:
        return `Bad Request: ${baseMessage}`;
      case 401:
        return 'Authentication failed. Please check your Maileroo API key.';
      case 403:
        return 'Access forbidden. Your IP address may not have permission to access this resource.';
      case 404:
        return 'API endpoint not found. Please check the request URL.';
      case 429:
        return 'Rate limit exceeded. Please wait before making another request.';
      case 500:
        return `Internal server error: ${baseMessage}`;
      default:
        return `HTTP ${status}: ${baseMessage}`;
    }
  }
}

// Export singleton instance
export const mailerooService = env.MAILEROO_API_KEY 
  ? new MailerooService(env.MAILEROO_API_KEY)
  : null;

// Export types for use in other files
export type {
    AttachmentObject,
    EmailObject,
    MailerooEmailRequest,
    MailerooErrorResponse,
    MailerooResponse
};

