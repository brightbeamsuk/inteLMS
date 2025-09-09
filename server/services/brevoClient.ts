/**
 * Centralized Brevo API Client
 * Ensures all Brevo API requests use the correct endpoint and proper error handling
 */

import { storage } from '../storage';

const BREVO_BASE_URL = "https://api.brevo.com/v3";

/**
 * Environment variable cleaning utility
 */
const cleanEnvVar = (value: string | undefined): string => {
  return (value || "").replace(/^["']|["']$/g, "").trim();
};

/**
 * Key resolution with org/platform fallback (prevents empty org key from overriding valid platform key)
 */
interface KeyResolution {
  key: string;
  source: "org" | "platform" | "none";
  isValid: boolean;
}

export function resolveBrevoKey(orgSettings: any, platformSettings: any): KeyResolution {
  // Debug: Log what we received
  console.log('🔧 resolveBrevoKey DEBUG:');
  console.log('  orgSettings:', orgSettings ? Object.keys(orgSettings) : 'null');
  console.log('  platformSettings:', platformSettings ? Object.keys(platformSettings) : 'null');
  
  // Check org key first (trim and validate length) 
  const orgKeyRaw = orgSettings?.brevoApiKey || orgSettings?.brevo?.apiKey || "";
  const orgKey = orgKeyRaw.trim();
  console.log(`  orgKey RAW: "${orgKeyRaw.substring(0, 12)}..." (length=${orgKeyRaw.length})`);
  console.log(`  orgKey CLEAN: "${orgKey.substring(0, 12)}..." (length=${orgKey.length})`);
  console.log(`  orgKey has issues: spaces=${orgKey.includes(' ')}, newlines=${orgKey.includes('\n')}, returns=${orgKey.includes('\r')}`);
  
  if (orgKey.length >= 20) {
    console.log('  ✅ Using ORG key');
    return { key: orgKey, source: "org", isValid: true };
  }

  // Fall back to platform key (trim and validate length)
  const platKeyRaw = platformSettings?.brevoApiKey || "";
  const platKey = platKeyRaw.trim();
  console.log(`  platKey: length=${platKey.length}, preview="${platKey.substring(0, 8)}..."`);
  
  if (platKey.length >= 20) {
    console.log('  ✅ Using PLATFORM key');
    return { key: platKey, source: "platform", isValid: true };
  }

  // No valid key found
  console.log('  ❌ NO VALID KEY FOUND');
  return { key: "", source: "none", isValid: false };
}

interface BrevoSendEmailParams {
  fromName: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  textContent: string;
  htmlContent?: string;
}

interface BrevoResponse {
  success: boolean;
  httpStatus: number;
  message: string;
  messageId?: string;
  data?: any;
  endpoint: string;
  latencyMs?: number;
  // Enhanced diagnostics
  provider?: string;
  endpointHost?: string;
  apiKeySource?: "org" | "platform" | "none";
  apiKeyPreview?: string;
  apiKeyLength?: number;
}

export class BrevoClient {
  private apiKey: string;
  private organizationId?: string;
  private keySource: "org" | "platform" | "none";

  constructor(apiKey: string, organizationId?: string, keySource: "org" | "platform" | "none" = "none") {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Brevo API key is required');
    }
    this.apiKey = apiKey.trim();
    this.organizationId = organizationId;
    this.keySource = keySource;
    
    // Enhanced debug for key issues
    console.log(`🔧 BrevoClient created: source=${keySource}, keyLength=${this.apiKey.length}, preview="${this.getMaskedKey()}"`);
    console.log(`🔧 Key check: starts="${this.apiKey.substring(0, 12)}", ends="${this.apiKey.substring(this.apiKey.length - 8)}"`);
    console.log(`🔧 Key format: contains spaces=${this.apiKey.includes(' ')}, contains newlines=${this.apiKey.includes('\n')}, contains quotes=${this.apiKey.includes('"')}`);
  }

  /**
   * Creates masked preview of API key for diagnostics
   */
  private getMaskedKey(): string {
    if (this.apiKey.length < 8) return "••••••••";
    const first4 = this.apiKey.substring(0, 4);
    const last4 = this.apiKey.substring(this.apiKey.length - 4);
    return `${first4}…${last4}`;
  }

  /**
   * Gets parsed host from BREVO_BASE_URL for diagnostics
   */
  private getEndpointHost(): string {
    try {
      return new URL(BREVO_BASE_URL).hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Validates that we're using the correct Brevo API endpoint
   */
  private validateEndpoint(): void {
    try {
      const url = new URL(BREVO_BASE_URL);
      if (!url.hostname.includes('api.brevo.com')) {
        throw new Error('Wrong Brevo API host. Must use https://api.brevo.com/v3');
      }
    } catch (error) {
      throw new Error('Invalid Brevo API base URL');
    }
  }

  /**
   * Creates standardized headers for Brevo API requests
   */
  private getHeaders(): Record<string, string> {
    return {
      'api-key': this.apiKey,
      'accept': 'application/json',
      'content-type': 'application/json'
    };
  }

  /**
   * Makes a request to Brevo API with proper error handling
   */
  private async makeRequest(
    endpoint: string, 
    method: 'GET' | 'POST', 
    body?: any,
    timeoutMs: number = 15000
  ): Promise<BrevoResponse> {
    this.validateEndpoint();

    const url = `${BREVO_BASE_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs)
      });

      const responseText = await response.text();
      let responseJson: any;
      
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = { message: responseText };
      }

      return {
        success: response.ok,
        httpStatus: response.status,
        message: responseJson.message || responseText,
        messageId: responseJson.messageId,
        data: responseJson,
        endpoint,
        // Enhanced diagnostics
        provider: "brevo_api",
        endpointHost: this.getEndpointHost(),
        apiKeySource: this.keySource,
        apiKeyPreview: this.getMaskedKey(),
        apiKeyLength: this.apiKey.length
      };
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return {
          success: false,
          httpStatus: 0,
          message: 'Network timeout reaching Brevo',
          endpoint,
          provider: "brevo_api",
          endpointHost: this.getEndpointHost(),
          apiKeySource: this.keySource,
          apiKeyPreview: this.getMaskedKey(),
          apiKeyLength: this.apiKey.length
        };
      }

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return {
          success: false,
          httpStatus: 0,
          message: 'Network issue reaching Brevo',
          endpoint,
          provider: "brevo_api",
          endpointHost: this.getEndpointHost(),
          apiKeySource: this.keySource,
          apiKeyPreview: this.getMaskedKey(),
          apiKeyLength: this.apiKey.length
        };
      }

      return {
        success: false,
        httpStatus: 0,
        message: `Network error: ${error.message}`,
        endpoint,
        provider: "brevo_api",
        endpointHost: this.getEndpointHost(),
        apiKeySource: this.keySource,
        apiKeyPreview: this.getMaskedKey(),
        apiKeyLength: this.apiKey.length
      };
    }
  }

  /**
   * Health check to verify API key and account access
   */
  async checkAccount(): Promise<BrevoResponse> {
    // Debug: Show the exact key being used
    console.log(`🔧 checkAccount DEBUG: Using key with length=${this.apiKey.length}, source=${this.keySource}, preview="${this.getMaskedKey()}"`);
    console.log(`🔧 Request will use headers: api-key=${this.apiKey.substring(0, 8)}..., accept=application/json`);
    
    const response = await this.makeRequest('/account', 'GET', undefined, 10000);

    // Enhanced debugging for 401 errors
    if (response.httpStatus === 401 || response.httpStatus === 403) {
      console.log(`🚨 BREVO 401/403 ERROR DEBUG:`);
      console.log(`  Full key being sent: "${this.apiKey.substring(0, 12)}...${this.apiKey.substring(this.apiKey.length - 4)}"`);
      console.log(`  Key length: ${this.apiKey.length}`);
      console.log(`  Key source: ${this.keySource}`);
      console.log(`  Response body:`, response.data);
      
      return {
        ...response,
        message: 'Brevo rejected the API key. Generate a new one and paste it here.'
      };
    }

    if (response.httpStatus === 429) {
      return {
        ...response,
        message: 'Brevo rate limited the request. Try again later.'
      };
    }

    if (response.httpStatus >= 500) {
      return {
        ...response,
        message: `Brevo service error (${response.httpStatus}). Try again later.`
      };
    }

    if (response.httpStatus === 200) {
      return {
        ...response,
        message: 'Brevo API key is valid and account is accessible'
      };
    }

    return {
      ...response,
      message: `Unexpected response from Brevo (${response.httpStatus})`
    };
  }

  /**
   * Send email via Brevo API
   */
  async sendEmail(params: BrevoSendEmailParams): Promise<BrevoResponse> {
    const emailPayload = {
      sender: { 
        name: params.fromName, 
        email: params.fromEmail 
      },
      to: [{ email: params.toEmail }],
      subject: params.subject,
      textContent: params.textContent,
      ...(params.htmlContent && { htmlContent: params.htmlContent })
    };

    const response = await this.makeRequest('/smtp/email', 'POST', emailPayload, 20000);

    // Handle specific status codes with user-friendly messages
    if (response.httpStatus === 201) {
      return {
        ...response,
        message: 'Email sent successfully via Brevo API'
      };
    }

    if (response.httpStatus === 400) {
      let errorMessage = 'Bad request - please check your configuration';
      
      if (response.data?.message) {
        const msg = response.data.message.toLowerCase();
        if (msg.includes('sender') || msg.includes('domain')) {
          errorMessage = 'Sender not allowed (verify domain in Brevo)';
        } else if (msg.includes('recipient') || msg.includes('email')) {
          errorMessage = 'Recipient email appears invalid';
        } else if (msg.includes('content')) {
          errorMessage = 'Email content validation failed';
        } else {
          errorMessage = response.data.message;
        }
      }

      return {
        ...response,
        message: errorMessage
      };
    }

    if (response.httpStatus === 401 || response.httpStatus === 403) {
      return {
        ...response,
        message: 'Invalid API key'
      };
    }

    if (response.httpStatus === 429) {
      return {
        ...response,
        message: 'Rate limited'
      };
    }

    if (response.httpStatus >= 500) {
      return {
        ...response,
        message: 'Brevo service error'
      };
    }

    return {
      ...response,
      message: response.message || `Unexpected error (${response.httpStatus})`
    };
  }

  /**
   * Log delivery attempt to database
   */
  private async logDelivery(
    endpoint: string,
    httpStatus: number,
    messageId: string | null,
    errorText: string | null,
    recipientEmail?: string
  ): Promise<void> {
    if (!this.organizationId) return;

    try {
      await storage.createEmailLog({
        organisationId: this.organizationId,
        toEmail: recipientEmail || 'unknown',
        subject: 'Test Email',
        status: httpStatus >= 200 && httpStatus < 300 ? 'sent' : 'failed',
        timestamp: new Date(),
        smtpHost: 'api.brevo.com',
        smtpPort: 443,
        fromEmail: 'system@inteLMS.com',
        metadata: {
          provider: 'brevo_api',
          endpoint,
          httpStatus,
          messageId,
          errorText
        }
      });
    } catch (error) {
      console.warn('Failed to log email delivery:', error);
    }
  }

  /**
   * Send email with delivery logging
   */
  async sendEmailWithLogging(params: BrevoSendEmailParams): Promise<BrevoResponse> {
    const startTime = Date.now();
    const response = await this.sendEmail(params);
    const latencyMs = Date.now() - startTime;

    // Log the delivery attempt
    await this.logDelivery(
      response.endpoint,
      response.httpStatus,
      response.messageId || null,
      response.success ? null : response.message,
      params.toEmail
    );

    return {
      ...response,
      latencyMs
    } as BrevoResponse;
  }

  /**
   * Static method to create a client with validation and key source
   */
  static create(apiKey: string, organizationId?: string, keySource: "org" | "platform" | "none" = "none"): BrevoClient {
    return new BrevoClient(apiKey, organizationId, keySource);
  }

  /**
   * Static method to create client with automatic key resolution
   */
  static createWithKeyResolution(orgSettings: any, platformSettings: any, organizationId?: string): BrevoClient {
    const resolution = resolveBrevoKey(orgSettings, platformSettings);
    
    if (!resolution.isValid) {
      throw new Error(`API key appears empty/invalid (length: ${resolution.key.length})`);
    }
    
    return new BrevoClient(resolution.key, organizationId, resolution.source);
  }
}