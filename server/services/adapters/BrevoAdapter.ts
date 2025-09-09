/**
 * Brevo API Adapter (formerly Sendinblue)
 * API Documentation: https://developers.brevo.com/
 */

import { BaseAdapter, type EmailMessage, type HealthCheckResult, type SendResult } from './BaseAdapter';
import type { EffectiveEmailSettings } from '../MailerService';

export class BrevoAdapter extends BaseAdapter {
  private readonly baseUrl = 'https://api.brevo.com/v3';

  /**
   * Health check: GET /v3/account (expects 200)
   */
  async healthCheck(settings: EffectiveEmailSettings): Promise<HealthCheckResult> {
    const endpoint = '/account';
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'api-key': settings.apiKey!,
          'accept': 'application/json'
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

      // Handle specific Brevo errors
      let errorShort = 'API key rejected';
      
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message) {
          if (errorData.message.includes('IP address')) {
            errorShort = 'API key valid but IP address not authorized (check Brevo security settings)';
          } else if (errorData.message.includes('unauthorized')) {
            errorShort = 'API key rejected';
          }
        }
      } catch {
        // Use default error message
      }

      return {
        success: false,
        httpStatus: response.status,
        endpoint,
        error: {
          code: `BREVO_${response.status}`,
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
            short: 'Network timeout reaching Brevo',
            raw: this.truncateError(error.message)
          }
        };
      }

      return {
        success: false,
        endpoint,
        error: {
          code: 'NETWORK_ERROR',
          short: 'Network error reaching Brevo',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Send email: POST /v3/smtp/email (expects 201)
   */
  async send(message: EmailMessage, settings: EffectiveEmailSettings): Promise<SendResult> {
    const endpoint = '/smtp/email';
    
    try {
      const emailPayload = {
        sender: {
          name: message.fromName,
          email: message.fromEmail
        },
        to: [{ email: message.to }],
        subject: message.subject,
        ...(message.text && { textContent: message.text }),
        ...(message.html && { htmlContent: message.html }),
        ...(message.replyTo && { replyTo: { email: message.replyTo } }),
        headers: {
          'X-Mailer': 'inteLMS-Brevo-Service'
        }
      };

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'api-key': settings.apiKey!,
          'content-type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify(emailPayload),
        signal: this.createTimeoutSignal(25000)
      });

      const responseText = await response.text();
      
      if (response.status === 201) {
        // Parse message ID from response
        let messageId = 'brevo-sent';
        try {
          const responseData = JSON.parse(responseText);
          messageId = responseData.messageId || messageId;
        } catch {
          // Use default messageId
        }
        
        return {
          success: true,
          httpStatus: 201,
          endpoint,
          messageId
        };
      }

      // Map Brevo API errors
      const errorMapping = this.mapBrevoError(response.status, responseText);
      
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
            short: 'Network timeout reaching Brevo',
            raw: this.truncateError(error.message)
          }
        };
      }

      return {
        success: false,
        endpoint,
        error: {
          code: 'NETWORK_ERROR',
          short: 'Network error reaching Brevo',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Map Brevo API errors to user-friendly messages
   */
  private mapBrevoError(status: number, responseBody: string): { code: string; short: string } {
    switch (status) {
      case 400:
        // Parse specific Brevo error messages
        try {
          const errorData = JSON.parse(responseBody);
          if (errorData.message) {
            const message = errorData.message.toLowerCase();
            if (message.includes('sender') || message.includes('domain')) {
              return {
                code: 'BREVO_SENDER_NOT_AUTHORIZED',
                short: 'Sender/domain not authorised or invalid payload'
              };
            }
          }
        } catch {
          // Fall through to default
        }
        return {
          code: 'BREVO_BAD_REQUEST',
          short: 'Sender/domain not authorised or invalid payload'
        };
        
      case 401:
      case 403:
        return {
          code: 'BREVO_AUTH_FAILED',
          short: 'API key rejected'
        };
        
      case 429:
        return {
          code: 'BREVO_RATE_LIMITED',
          short: 'Rate limited'
        };
        
      case 500:
      case 502:
      case 503:
        return {
          code: 'BREVO_SERVER_ERROR',
          short: 'Brevo service error'
        };
        
      default:
        return {
          code: 'BREVO_ERROR',
          short: `Brevo API error (${status})`
        };
    }
  }
}