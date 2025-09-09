/**
 * SparkPost API Adapter
 * API Documentation: https://developers.sparkpost.com/api/
 */

import { BaseAdapter, type EmailMessage, type HealthCheckResult, type SendResult } from './BaseAdapter';
import type { EffectiveEmailSettings } from '../MailerService';

export class SparkPostAdapter extends BaseAdapter {
  private readonly baseUrl = 'https://api.sparkpost.com/api/v1';

  /**
   * Health check: GET /account (200)
   */
  async healthCheck(settings: EffectiveEmailSettings): Promise<HealthCheckResult> {
    const endpoint = '/account';
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': settings.apiKey!,
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

      // Map SparkPost errors
      let errorShort = 'API key invalid';
      
      if (response.status === 401) {
        errorShort = 'API key invalid';
      } else if (response.status === 403) {
        errorShort = 'Key lacks required permission (transmissions:read/write)';
      }

      return {
        success: false,
        httpStatus: response.status,
        endpoint,
        error: {
          code: `SPARKPOST_${response.status}`,
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
            short: 'Network timeout reaching SparkPost',
            raw: this.truncateError(error.message)
          }
        };
      }

      return {
        success: false,
        endpoint,
        error: {
          code: 'NETWORK_ERROR',
          short: 'Network error reaching SparkPost',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Send email: POST /transmissions (expects 200/201)
   */
  async send(message: EmailMessage, settings: EffectiveEmailSettings): Promise<SendResult> {
    const endpoint = '/transmissions';
    
    try {
      const emailPayload = {
        content: {
          from: {
            name: message.fromName,
            email: message.fromEmail
          },
          subject: message.subject,
          ...(message.text && { text: message.text }),
          ...(message.html && { html: message.html }),
          ...(message.replyTo && { reply_to: message.replyTo }),
          headers: {
            'X-Mailer': 'inteLMS-SparkPost-Service'
          }
        },
        recipients: [{
          address: message.to
        }]
      };

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': settings.apiKey!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailPayload),
        signal: this.createTimeoutSignal(25000)
      });

      const responseText = await response.text();
      
      if (response.status === 200 || response.status === 201) {
        // Parse transmission ID from response
        let messageId = 'sparkpost-sent';
        try {
          const responseData = JSON.parse(responseText);
          if (responseData.results?.id) {
            messageId = responseData.results.id;
          }
        } catch {
          // Use default messageId
        }
        
        return {
          success: true,
          httpStatus: response.status,
          endpoint,
          messageId
        };
      }

      // Map SparkPost API errors
      const errorMapping = this.mapSparkPostError(response.status, responseText);
      
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
            short: 'Network timeout reaching SparkPost',
            raw: this.truncateError(error.message)
          }
        };
      }

      return {
        success: false,
        endpoint,
        error: {
          code: 'NETWORK_ERROR',
          short: 'Network error reaching SparkPost',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Map SparkPost API errors to user-friendly messages
   */
  private mapSparkPostError(status: number, responseBody: string): { code: string; short: string } {
    switch (status) {
      case 400:
        // Parse specific SparkPost error
        try {
          const errorData = JSON.parse(responseBody);
          if (errorData.errors?.[0]?.message) {
            const message = errorData.errors[0].message.toLowerCase();
            if (message.includes('domain') || message.includes('from')) {
              return {
                code: 'SPARKPOST_DOMAIN_ERROR',
                short: 'Payload invalid (check from domain)'
              };
            }
          }
        } catch {
          // Fall through to default
        }
        return {
          code: 'SPARKPOST_BAD_REQUEST',
          short: 'Payload invalid (check from domain)'
        };
        
      case 401:
        return {
          code: 'SPARKPOST_AUTH_FAILED',
          short: 'API key invalid'
        };
        
      case 403:
        return {
          code: 'SPARKPOST_PERMISSION_DENIED',
          short: 'Key lacks required permission (transmissions:read/write)'
        };
        
      case 429:
        return {
          code: 'SPARKPOST_RATE_LIMITED',
          short: 'Rate limited'
        };
        
      case 500:
      case 502:
      case 503:
        return {
          code: 'SPARKPOST_SERVER_ERROR',
          short: 'SparkPost service error'
        };
        
      default:
        return {
          code: 'SPARKPOST_ERROR',
          short: `SparkPost API error (${status})`
        };
    }
  }
}