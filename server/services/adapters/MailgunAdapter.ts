/**
 * Mailgun API Adapter
 * API Documentation: https://documentation.mailgun.com/en/latest/api_reference.html
 */

import { BaseAdapter, type EmailMessage, type HealthCheckResult, type SendResult } from './BaseAdapter';
import type { EffectiveEmailSettings } from '../MailerService';

export class MailgunAdapter extends BaseAdapter {
  private readonly baseUrl = 'https://api.mailgun.net/v3';

  /**
   * Health check: GET /v3/domains/{domain} or GET /v3/domains and confirm domain present
   */
  async healthCheck(settings: EffectiveEmailSettings): Promise<HealthCheckResult> {
    const domain = settings.apiDomain!;
    const endpoint = `/domains/${domain}`;
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${settings.apiKey}`).toString('base64')}`,
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

      // Map Mailgun errors
      let errorShort = 'API key invalid';
      
      if (response.status === 401) {
        errorShort = 'API key invalid';
      } else if (response.status === 404) {
        errorShort = 'Domain not found (check apiDomain setting)';
      }

      return {
        success: false,
        httpStatus: response.status,
        endpoint,
        error: {
          code: `MAILGUN_${response.status}`,
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
            short: 'Network timeout reaching Mailgun',
            raw: this.truncateError(error.message)
          }
        };
      }

      return {
        success: false,
        endpoint,
        error: {
          code: 'NETWORK_ERROR',
          short: 'Network error reaching Mailgun',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Send email: POST /v3/{domain}/messages (expects 200)
   */
  async send(message: EmailMessage, settings: EffectiveEmailSettings): Promise<SendResult> {
    const domain = settings.apiDomain!;
    const endpoint = `/${domain}/messages`;
    
    try {
      // Mailgun uses form data
      const formData = new FormData();
      formData.append('from', `${message.fromName} <${message.fromEmail}>`);
      formData.append('to', message.to);
      formData.append('subject', message.subject);
      
      if (message.text) {
        formData.append('text', message.text);
      }
      if (message.html) {
        formData.append('html', message.html);
      }
      if (message.replyTo) {
        formData.append('h:Reply-To', message.replyTo);
      }
      
      formData.append('h:X-Mailer', 'inteLMS-Mailgun-Service');

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${settings.apiKey}`).toString('base64')}`
        },
        body: formData,
        signal: this.createTimeoutSignal(25000)
      });

      const responseText = await response.text();
      
      if (response.status === 200) {
        // Parse message ID from response
        let messageId = 'mailgun-sent';
        try {
          const responseData = JSON.parse(responseText);
          messageId = responseData.id || messageId;
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

      // Map Mailgun API errors
      const errorMapping = this.mapMailgunError(response.status, responseText);
      
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
            short: 'Network timeout reaching Mailgun',
            raw: this.truncateError(error.message)
          }
        };
      }

      return {
        success: false,
        endpoint,
        error: {
          code: 'NETWORK_ERROR',
          short: 'Network error reaching Mailgun',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Map Mailgun API errors to user-friendly messages
   */
  private mapMailgunError(status: number, responseBody: string): { code: string; short: string } {
    switch (status) {
      case 400:
        return {
          code: 'MAILGUN_BAD_REQUEST',
          short: 'Domain or payload invalid (check apiDomain setting)'
        };
        
      case 401:
        return {
          code: 'MAILGUN_AUTH_FAILED',
          short: 'API key invalid'
        };
        
      case 404:
        return {
          code: 'MAILGUN_DOMAIN_NOT_FOUND',
          short: 'Domain not found (check apiDomain setting)'
        };
        
      case 429:
        return {
          code: 'MAILGUN_RATE_LIMITED',
          short: 'Rate limited'
        };
        
      case 500:
      case 502:
      case 503:
        return {
          code: 'MAILGUN_SERVER_ERROR',
          short: 'Mailgun service error'
        };
        
      default:
        return {
          code: 'MAILGUN_ERROR',
          short: `Mailgun API error (${status})`
        };
    }
  }
}