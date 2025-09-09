/**
 * Generic SMTP Adapter
 * Supports all SMTP providers: Microsoft 365, Gmail, Amazon SES SMTP, SMTP2GO, cPanel, Zoho, Postmark SMTP, etc.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { createConnection } from 'net';
import { lookup } from 'dns';
import { promisify } from 'util';
import { BaseAdapter, type EmailMessage, type HealthCheckResult, type SendResult } from './BaseAdapter';
import type { EffectiveEmailSettings } from '../MailerService';

const dnsLookup = promisify(lookup);

export class SMTPAdapter extends BaseAdapter {
  
  /**
   * Health check: DNS resolve → TCP connect → STARTTLS/TLS handshake → AUTH test
   */
  async healthCheck(settings: EffectiveEmailSettings): Promise<HealthCheckResult> {
    const host = settings.smtpHost!;
    const port = settings.smtpPort || 587;
    
    try {
      // Step 1: DNS Resolution
      let resolvedIp: string;
      try {
        const result = await dnsLookup(host);
        resolvedIp = Array.isArray(result) ? result[0].address : result.address;
      } catch (error: any) {
        return {
          success: false,
          host,
          port,
          error: {
            code: 'DNS_RESOLUTION_FAILED',
            short: "Couldn't resolve SMTP host",
            raw: this.truncateError(error.message)
          }
        };
      }
      
      // Step 2: TCP Connection
      const tcpResult = await this.testTcpConnection(host, port);
      if (!tcpResult.success) {
        return {
          success: false,
          host,
          port,
          error: {
            code: 'TCP_CONNECTION_FAILED',
            short: "Couldn't connect to SMTP host/port",
            raw: this.truncateError(tcpResult.error || 'Connection failed')
          }
        };
      }
      
      // Step 3: STARTTLS/TLS and AUTH test
      const authResult = await this.testSmtpAuth(settings);
      if (!authResult.success) {
        return {
          success: false,
          host,
          port,
          tls: false,
          error: authResult.error
        };
      }
      
      return {
        success: true,
        host,
        port,
        tls: true
      };
      
    } catch (error: any) {
      return {
        success: false,
        host,
        port,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          short: 'SMTP health check failed',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Send email via SMTP
   */
  async send(message: EmailMessage, settings: EffectiveEmailSettings): Promise<SendResult> {
    const host = settings.smtpHost!;
    const port = settings.smtpPort || 587;
    
    try {
      // Create secure transporter
      const transporter = this.createSecureTransporter(settings);
      
      // Prepare email options
      const mailOptions = {
        from: `"${message.fromName}" <${message.fromEmail}>`,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
        headers: {
          'X-Mailer': 'inteLMS-SMTP-Service',
          'X-SMTP-Provider': this.detectProvider(host),
          'X-TLS-Enforced': 'true'
        }
      };

      // Send email
      const info = await transporter.sendMail(mailOptions);
      
      return {
        success: true,
        host,
        port,
        tls: true,
        messageId: info.messageId,
        smtpStatus: info.response
      };
      
    } catch (error: any) {
      // Map SMTP errors to user-friendly messages
      const errorMapping = this.mapSmtpError(error.message);
      
      return {
        success: false,
        host,
        port,
        error: {
          code: errorMapping.code,
          short: errorMapping.short,
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Test TCP connection to SMTP server
   */
  private async testTcpConnection(host: string, port: number): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const socket = createConnection({ 
        host, 
        port, 
        timeout: 10000 
      });
      
      socket.on('connect', () => {
        socket.destroy();
        resolve({ success: true });
      });
      
      socket.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ success: false, error: 'Connection timeout' });
      });
    });
  }

  /**
   * Test SMTP authentication and STARTTLS
   */
  private async testSmtpAuth(settings: EffectiveEmailSettings): Promise<{ success: boolean; error?: any }> {
    try {
      const transporter = this.createSecureTransporter(settings);
      
      // Test connection and authentication
      await transporter.verify();
      
      return { success: true };
    } catch (error: any) {
      // Parse SMTP auth errors
      const message = error.message.toLowerCase();
      
      if (message.includes('authentication') || message.includes('credentials') || message.includes('login')) {
        return {
          success: false,
          error: {
            code: 'SMTP_AUTH_FAILED',
            short: 'SMTP authentication failed (check username/password)',
            raw: this.truncateError(error.message)
          }
        };
      }
      
      if (message.includes('tls') || message.includes('starttls') || message.includes('ssl')) {
        return {
          success: false,
          error: {
            code: 'TLS_HANDSHAKE_FAILED',
            short: 'TLS/STARTTLS handshake failed',
            raw: this.truncateError(error.message)
          }
        };
      }
      
      return {
        success: false,
        error: {
          code: 'SMTP_CONNECTION_ERROR',
          short: 'SMTP connection failed',
          raw: this.truncateError(error.message)
        }
      };
    }
  }

  /**
   * Create secure SMTP transporter with provider-specific optimizations
   */
  private createSecureTransporter(settings: EffectiveEmailSettings): Transporter {
    const port = settings.smtpPort || 587;
    const provider = this.detectProvider(settings.smtpHost!);
    
    const transportConfig: any = {
      host: settings.smtpHost,
      port: port,
      auth: {
        user: settings.smtpUsername,
        pass: settings.smtpPassword,
      },
      // Default security settings
      secure: port === 465, // true for 465, false for 587
      requireTLS: true, // Force TLS
      timeout: 25000, // 25 second timeout
      connectionTimeout: 10000, // 10 second connection timeout
    };

    // Provider-specific optimizations
    switch (provider) {
      case 'Microsoft 365/Exchange':
        transportConfig.tls = {
          servername: settings.smtpHost,
          rejectUnauthorized: false
        };
        break;
        
      case 'Gmail/Google Workspace':
        transportConfig.tls = {
          rejectUnauthorized: false
        };
        break;
        
      case 'Amazon SES':
        transportConfig.tls = {
          rejectUnauthorized: true
        };
        break;
        
      case 'Brevo':
        transportConfig.tls = {
          ciphers: 'SSLv3',
          rejectUnauthorized: false,
          servername: settings.smtpHost
        };
        break;
        
      default:
        // Generic secure configuration
        transportConfig.tls = {
          rejectUnauthorized: false,
          ciphers: 'ALL'
        };
    }

    console.log(`Creating SMTP transport for ${provider}:`, {
      host: settings.smtpHost,
      port: port,
      secure: transportConfig.secure,
      requireTLS: true
    });

    return nodemailer.createTransport(transportConfig);
  }

  /**
   * Detect SMTP provider from hostname for optimizations
   */
  private detectProvider(host: string): string {
    const hostLower = host.toLowerCase();
    
    if (hostLower.includes('smtp.office365.com') || hostLower.includes('outlook.office365.com')) {
      return 'Microsoft 365/Exchange';
    }
    if (hostLower.includes('smtp.gmail.com')) {
      return 'Gmail/Google Workspace';
    }
    if (hostLower.includes('email-smtp.') && hostLower.includes('amazonaws.com')) {
      return 'Amazon SES';
    }
    if (hostLower.includes('mail.smtp2go.com')) {
      return 'SMTP2GO';
    }
    if (hostLower.includes('brevo.com') || hostLower.includes('sendinblue.com')) {
      return 'Brevo';
    }
    if (hostLower.includes('mailgun')) {
      return 'Mailgun SMTP';
    }
    if (hostLower.includes('sendgrid')) {
      return 'SendGrid SMTP';
    }
    if (hostLower.includes('postmarkapp.com')) {
      return 'Postmark SMTP';
    }
    
    return 'Custom SMTP';
  }

  /**
   * Map SMTP errors to user-friendly messages
   */
  private mapSmtpError(errorMessage: string): { code: string; short: string } {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('authentication') || message.includes('credentials') || message.includes('login')) {
      return {
        code: 'SMTP_AUTH_FAILED',
        short: 'SMTP authentication failed (check username/password)'
      };
    }
    
    if (message.includes('dns') || message.includes('getaddrinfo')) {
      return {
        code: 'DNS_RESOLUTION_FAILED',
        short: "Couldn't resolve SMTP host"
      };
    }
    
    if (message.includes('connect') || message.includes('econnrefused')) {
      return {
        code: 'TCP_CONNECTION_FAILED',
        short: "Couldn't connect to SMTP host/port"
      };
    }
    
    if (message.includes('tls') || message.includes('starttls') || message.includes('ssl')) {
      return {
        code: 'TLS_HANDSHAKE_FAILED',
        short: 'TLS/STARTTLS handshake failed'
      };
    }
    
    if (message.includes('550') || message.includes('553') || message.includes('554')) {
      return {
        code: 'SMTP_REJECTION',
        short: 'Sender/recipient rejected by SMTP server'
      };
    }
    
    if (message.includes('timeout')) {
      return {
        code: 'SMTP_TIMEOUT',
        short: 'SMTP connection timeout'
      };
    }
    
    return {
      code: 'SMTP_ERROR',
      short: 'SMTP delivery failed'
    };
  }
}