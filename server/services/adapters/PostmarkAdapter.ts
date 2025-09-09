/**
 * Postmark API Adapter
 * API Documentation: https://postmarkapp.com/developer/api/email-api
 */

import { BaseAdapter, type EmailMessage, type HealthCheckResult, type SendResult } from './BaseAdapter';
import type { EffectiveEmailSettings } from '../MailerService';

export class PostmarkAdapter extends BaseAdapter {
  private readonly baseUrl = 'https://api.postmarkapp.com';

  /**
   * Health check: GET /server (200) or GET /stats/outbound
   */
  async healthCheck(settings: EffectiveEmailSettings): Promise<HealthCheckResult> {
    const endpoint = '/server';
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'X-Postmark-Server-Token': settings.apiKey!,
          'Accept': 'application/json'
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

      // Map Postmark errors
      let errorShort = 'Server token invalid';
      
      if (response.status === 401) {
        errorShort = 'Server token invalid';
      } else if (response.status === 422) {
        errorShort = 'Server configuration invalid';
      }

      return {
        success: false,
        httpStatus: response.status,
        endpoint,
        error: {
          code: `POSTMARK_${response.status}`,
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
            short: 'Network timeout reaching Postmark',
            raw: this.truncateError(error.message)
          }
        };
      }

      return {
        success: false,
        endpoint,
        error: {
          code: 'NETWORK_ERROR',
          short: 'Network error reaching Postmark',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Send email: POST /email (expects 200)
   */
  async send(message: EmailMessage, settings: EffectiveEmailSettings): Promise<SendResult> {
    const endpoint = '/email';
    
    try {
      const emailPayload = {
        From: `${message.fromName} <${message.fromEmail}>`,
        To: message.to,
        Subject: message.subject,
        ...(message.text && { TextBody: message.text }),
        ...(message.html && { HtmlBody: message.html }),
        ...(message.replyTo && { ReplyTo: message.replyTo }),
        Headers: [
          { Name: 'X-Mailer', Value: 'inteLMS-Postmark-Service' }
        ]
      };

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': settings.apiKey!,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(emailPayload),
        signal: this.createTimeoutSignal(25000)
      });

      const responseText = await response.text();
      
      if (response.status === 200) {
        // Parse message ID from response
        let messageId = 'postmark-sent';
        try {
          const responseData = JSON.parse(responseText);
          messageId = responseData.MessageID || messageId;
        } catch {
          // Use default messageId
        }
        
        return {
          success: true,
          httpStatus: 200,
          endpoint,
          messageId
        };
      }

      // Map Postmark API errors
      const errorMapping = this.mapPostmarkError(response.status, responseText);
      
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
            short: 'Network timeout reaching Postmark',
            raw: this.truncateError(error.message)
          }
        };
      }

      return {
        success: false,
        endpoint,
        error: {
          code: 'NETWORK_ERROR',
          short: 'Network error reaching Postmark',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Map Postmark API errors to user-friendly messages
   */
  private mapPostmarkError(status: number, responseBody: string): { code: string; short: string } {
    switch (status) {
      case 401:
        return {
          code: 'POSTMARK_AUTH_FAILED',
          short: 'Server token invalid'
        };
        
      case 422:
        // Parse specific Postmark error
        try {
          const errorData = JSON.parse(responseBody);
          if (errorData.Message) {
            const message = errorData.Message.toLowerCase();
            if (message.includes('sender signature') || message.includes('from')) {
              return {
                code: 'POSTMARK_SENDER_NOT_CONFIRMED',
                short: 'Sender signature not confirmed or payload invalid'
              };
            }
          }
        } catch {
          // Fall through to default
        }
        return {
          code: 'POSTMARK_VALIDATION_ERROR',
          short: 'Sender signature not confirmed or payload invalid'
        };
        
      case 429:
        return {
          code: 'POSTMARK_RATE_LIMITED',
          short: 'Rate limited'
        };
        
      case 500:
      case 502:
      case 503:
        return {
          code: 'POSTMARK_SERVER_ERROR',
          short: 'Postmark service error'
        };
        
      default:
        return {
          code: 'POSTMARK_ERROR',
          short: `Postmark API error (${status})`
        };
    }
  }
}