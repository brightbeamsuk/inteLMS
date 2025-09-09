/**
 * Mailjet API Adapter
 * API Documentation: https://dev.mailjet.com/email/guides/
 */

import { BaseAdapter, type EmailMessage, type HealthCheckResult, type SendResult } from './BaseAdapter';
import type { EffectiveEmailSettings } from '../MailerService';

export class MailjetAdapter extends BaseAdapter {
  private readonly baseUrl = 'https://api.mailjet.com/v3.1';

  /**
   * Health check: GET /v3/REST/user (200)
   */
  async healthCheck(settings: EffectiveEmailSettings): Promise<HealthCheckResult> {
    const endpoint = '/REST/user';
    const baseUrl = 'https://api.mailjet.com/v3'; // Use v3 for user endpoint
    
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64')}`,
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

      // Map Mailjet errors
      let errorShort = 'API key/secret invalid';
      
      if (response.status === 401) {
        errorShort = 'API key/secret invalid';
      }

      return {
        success: false,
        httpStatus: response.status,
        endpoint,
        error: {
          code: `MAILJET_${response.status}`,
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
            short: 'Network timeout reaching Mailjet',
            raw: this.truncateError(error.message)
          }
        };
      }

      return {
        success: false,
        endpoint,
        error: {
          code: 'NETWORK_ERROR',
          short: 'Network error reaching Mailjet',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Send email: POST /send (expects 200)
   */
  async send(message: EmailMessage, settings: EffectiveEmailSettings): Promise<SendResult> {
    const endpoint = '/send';
    
    try {
      const emailPayload = {
        Messages: [{
          From: {
            Email: message.fromEmail,
            Name: message.fromName
          },
          To: [{
            Email: message.to
          }],
          Subject: message.subject,
          ...(message.text && { TextPart: message.text }),
          ...(message.html && { HTMLPart: message.html }),
          ...(message.replyTo && { 
            ReplyTo: {
              Email: message.replyTo
            }
          }),
          Headers: {
            'X-Mailer': 'inteLMS-Mailjet-Service'
          }
        }]
      };

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailPayload),
        signal: this.createTimeoutSignal(25000)
      });

      const responseText = await response.text();
      
      if (response.status === 200) {
        // Parse message ID from response
        let messageId = 'mailjet-sent';
        try {
          const responseData = JSON.parse(responseText);
          if (responseData.Messages?.[0]?.MessageID) {
            messageId = responseData.Messages[0].MessageID.toString();
          }
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

      // Map Mailjet API errors
      const errorMapping = this.mapMailjetError(response.status, responseText);
      
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
            short: 'Network timeout reaching Mailjet',
            raw: this.truncateError(error.message)
          }
        };
      }

      return {
        success: false,
        endpoint,
        error: {
          code: 'NETWORK_ERROR',
          short: 'Network error reaching Mailjet',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Map Mailjet API errors to user-friendly messages
   */
  private mapMailjetError(status: number, responseBody: string): { code: string; short: string } {
    switch (status) {
      case 400:
        return {
          code: 'MAILJET_BAD_REQUEST',
          short: 'From/To/payload invalid'
        };
        
      case 401:
        return {
          code: 'MAILJET_AUTH_FAILED',
          short: 'API key/secret invalid'
        };
        
      case 429:
        return {
          code: 'MAILJET_RATE_LIMITED',
          short: 'Rate limited'
        };
        
      case 500:
      case 502:
      case 503:
        return {
          code: 'MAILJET_SERVER_ERROR',
          short: 'Mailjet service error'
        };
        
      default:
        return {
          code: 'MAILJET_ERROR',
          short: `Mailjet API error (${status})`
        };
    }
  }
}