/**
 * Base adapter interface for all email providers
 * Defines standard interface for SMTP and API providers
 */

import type { EffectiveEmailSettings } from '../MailerService';

export interface EmailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
}

export interface HealthCheckResult {
  success: boolean;
  httpStatus?: number;
  endpoint?: string;
  host?: string;
  port?: number;
  tls?: boolean;
  error?: {
    code?: string;
    short?: string;
    raw?: string;
  };
}

export interface SendResult {
  success: boolean;
  httpStatus?: number;
  smtpStatus?: string;
  endpoint?: string;
  host?: string;
  port?: number;
  tls?: boolean;
  messageId?: string;
  error?: {
    code?: string;
    short?: string;
    raw?: string;
  };
}

export abstract class BaseAdapter {
  /**
   * Health check to verify provider connectivity and credentials
   */
  abstract healthCheck(settings: EffectiveEmailSettings): Promise<HealthCheckResult>;

  /**
   * Send email via the provider
   */
  abstract send(message: EmailMessage, settings: EffectiveEmailSettings): Promise<SendResult>;

  /**
   * Create masked preview of API key for diagnostics
   */
  protected maskApiKey(apiKey?: string): string {
    if (!apiKey || apiKey.length < 8) return '';
    return `${apiKey.substring(0, 4)}…${apiKey.substring(apiKey.length - 4)}`;
  }

  /**
   * Truncate error message to 200 characters for storage
   */
  protected truncateError(error: string): string {
    return error.length > 200 ? error.substring(0, 200) + '...' : error;
  }

  /**
   * Create timeout signal for HTTP requests
   */
  protected createTimeoutSignal(timeoutMs: number = 25000): AbortSignal {
    return AbortSignal.timeout(timeoutMs);
  }
}