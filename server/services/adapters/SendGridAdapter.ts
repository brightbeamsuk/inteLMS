/**
 * SendGrid API Adapter
 * API Documentation: https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */

import { BaseAdapter, type EmailMessage, type HealthCheckResult, type SendResult } from './BaseAdapter';
import type { EffectiveEmailSettings } from '../MailerService';

export class SendGridAdapter extends BaseAdapter {
  private readonly baseUrl = 'https://api.sendgrid.com/v3';

  /**
   * Health check: GET /v3/user/account or GET /v3/scopes
   */
  async healthCheck(settings: EffectiveEmailSettings): Promise<HealthCheckResult> {
    const endpoint = '/user/account';
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: this.createTimeoutSignal(10000)
      });

      const responseText = await response.text();
      
      if (response.status === 200) {
        return {
          success: true,
          httpStatus: 200,
          endpoint
        };
      }

      // Map specific SendGrid errors
      let errorShort = 'API key invalid or lacks permission';
      
      if (response.status === 401 || response.status === 403) {
        errorShort = 'API key invalid or lacks permission';
      } else if (response.status === 429) {
        errorShort = 'Rate limited';
      }

      return {
        success: false,
        httpStatus: response.status,
        endpoint,
        error: {
          code: `SENDGRID_${response.status}`,
          short: errorShort,
          raw: this.truncateError(responseText)
        }
      };

    } catch (error: any) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return {
          success: false,
          endpoint,
          error: {
            code: 'NETWORK_TIMEOUT',
            short: 'Network timeout reaching SendGrid',
            raw: this.truncateError(error.message)
          }
        };
      }

      return {
        success: false,
        endpoint,
        error: {
          code: 'NETWORK_ERROR',
          short: 'Network error reaching SendGrid',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Send email: POST /v3/mail/send (expects 202)
   */
  async send(message: EmailMessage, settings: EffectiveEmailSettings): Promise<SendResult> {
    const endpoint = '/mail/send';
    
    try {
      const emailPayload = {
        personalizations: [{
          to: [{ email: message.to }],
          subject: message.subject
        }],
        from: {
          email: message.fromEmail,
          name: message.fromName
        },
        content: [
          ...(message.text ? [{ type: 'text/plain', value: message.text }] : []),
          ...(message.html ? [{ type: 'text/html', value: message.html }] : [])
        ],
        ...(message.replyTo && { reply_to: { email: message.replyTo } }),
        headers: {
          'X-Mailer': 'inteLMS-SendGrid-Service'
        }
      };

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailPayload),
        signal: this.createTimeoutSignal(25000)
      });

      const responseText = await response.text();
      
      if (response.status === 202) {
        // SendGrid returns message ID in X-Message-Id header
        const messageId = response.headers.get('X-Message-Id') || 'sendgrid-sent';
        
        return {
          success: true,
          httpStatus: 202,
          endpoint,
          messageId
        };
      }

      // Map SendGrid API errors
      const errorMapping = this.mapSendGridError(response.status, responseText);
      
      return {
        success: false,
        httpStatus: response.status,
        endpoint,
        error: {
          code: errorMapping.code,
          short: errorMapping.short,
          raw: this.truncateError(responseText)
        }
      };

    } catch (error: any) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return {
          success: false,
          endpoint,
          error: {
            code: 'NETWORK_TIMEOUT',
            short: 'Network timeout reaching SendGrid',
            raw: this.truncateError(error.message)
          }
        };
      }

      return {
        success: false,
        endpoint,
        error: {
          code: 'NETWORK_ERROR',
          short: 'Network error reaching SendGrid',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Map SendGrid API errors to user-friendly messages
   */
  private mapSendGridError(status: number, responseBody: string): { code: string; short: string } {
    switch (status) {
      case 400:
        // Parse error details from response
        try {
          const errorData = JSON.parse(responseBody);
          const firstError = errorData.errors?.[0];
          if (firstError) {
            return {
              code: 'SENDGRID_BAD_REQUEST',
              short: firstError.message || 'Bad request - check email content/settings'
            };
          }
        } catch {
          // Fall through to default
        }
        return {
          code: 'SENDGRID_BAD_REQUEST',
          short: 'Bad request - check email content/settings'
        };
        
      case 401:
      case 403:
        return {
          code: 'SENDGRID_AUTH_FAILED',
          short: 'API key invalid or lacks permission'
        };
        
      case 429:
        return {
          code: 'SENDGRID_RATE_LIMITED',
          short: 'Rate limited'
        };
        
      case 500:
      case 502:
      case 503:
        return {
          code: 'SENDGRID_SERVER_ERROR',
          short: 'SendGrid service error'
        };
        
      default:
        return {
          code: 'SENDGRID_ERROR',
          short: `SendGrid API error (${status})`
        };
    }
  }
}