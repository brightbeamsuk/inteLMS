import { nanoid } from "nanoid";
import crypto from "crypto";
import { storage } from "../storage";
import type {
  InsertGdprAuditLog,
  InsertDataProcessingAuditLog,
  InsertUserRightsAuditLog,
  InsertConsentAuditLog,
  InsertSystemAccessAuditLog,
} from "@shared/schema";
import type { Request } from "express";

/**
 * Comprehensive GDPR Audit Logging Service
 * 
 * This service provides a unified interface for all GDPR audit logging requirements,
 * ensuring comprehensive accountability, regulatory transparency, and complete audit coverage.
 * 
 * Features:
 * - Structured audit logging with correlation tracking
 * - Tamper-proof audit trails with integrity verification
 * - Automated compliance monitoring and alerting
 * - Multi-tenant audit isolation and access control
 * - Real-time audit data processing and storage
 */
export class ComprehensiveAuditService {
  private correlationStack: string[] = [];
  private currentSessionId: string | null = null;
  // NOTE: Removed in-memory auditChainCache - now using database-backed chain tracking

  constructor() {
    console.log('[ComprehensiveAuditService] Comprehensive GDPR audit logging service initialized with database-backed chain tracking');
  }

  /**
   * Initialize audit session with correlation ID
   */
  initializeSession(sessionId: string, correlationId?: string): string {
    this.currentSessionId = sessionId;
    const correlation = correlationId || nanoid();
    this.correlationStack = [correlation];
    return correlation;
  }

  /**
   * Generate canonical integrity hash for audit chaining
   * Only includes immutable fields to ensure hash stability and integrity
   */
  private generateIntegrityHash(auditData: InsertGdprAuditLog, previousHash?: string): string {
    // Create canonical payload with only immutable fields in stable order
    const canonicalPayload = {
      // Core audit data (immutable once created)
      organisationId: auditData.organisationId,
      userId: auditData.userId || null,
      adminId: auditData.adminId || null,
      action: auditData.action,
      resource: auditData.resource,
      resourceId: auditData.resourceId,
      category: auditData.category,
      details: auditData.details,
      severity: auditData.severity || 'info',
      outcome: auditData.outcome || 'success',
      
      // Context data (immutable)
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      correlationId: auditData.correlationId,
      parentAuditId: auditData.parentAuditId || null,
      sessionId: auditData.sessionId || null,
      requestId: auditData.requestId || null,
      
      // Business context (immutable)
      businessContext: auditData.businessContext || null,
      legalBasis: auditData.legalBasis || null,
      complianceFramework: auditData.complianceFramework || 'UK_GDPR',
      
      // Chain linkage
      previousLogHash: previousHash || null,
      
      // EXCLUDED mutable fields: id, timestamp, checksumHash, isVerified, 
      // completedAt, isArchived, archiveDate, retentionUntil, etc.
    };
    
    // Create stable string representation with deterministic field ordering
    const canonicalString = JSON.stringify(canonicalPayload, Object.keys(canonicalPayload).sort());
    
    // Generate hash with previous hash chained
    const hashInput = canonicalString + (previousHash || '');
    return crypto.createHash('sha256').update(hashInput, 'utf8').digest('hex');
  }

  /**
   * Store the exact canonical payload that was hashed for verification
   */
  private createCanonicalPayload(auditData: InsertGdprAuditLog, previousHash?: string): Record<string, any> {
    return {
      organisationId: auditData.organisationId,
      userId: auditData.userId || null,
      adminId: auditData.adminId || null,
      action: auditData.action,
      resource: auditData.resource,
      resourceId: auditData.resourceId,
      category: auditData.category,
      details: auditData.details,
      severity: auditData.severity || 'info',
      outcome: auditData.outcome || 'success',
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      correlationId: auditData.correlationId,
      parentAuditId: auditData.parentAuditId || null,
      sessionId: auditData.sessionId || null,
      requestId: auditData.requestId || null,
      businessContext: auditData.businessContext || null,
      legalBasis: auditData.legalBasis || null,
      complianceFramework: auditData.complianceFramework || 'UK_GDPR',
      previousLogHash: previousHash || null,
    };
  }

  /**
   * Extract audit context from request
   */
  private extractAuditContext(req: any): {
    ipAddress: string;
    userAgent: string;
    sessionId: string | null;
    requestId: string | null;
  } {
    return {
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      sessionId: this.currentSessionId || req.sessionID || null,
      requestId: req.id || nanoid(),
    };
  }

  /**
   * Log comprehensive GDPR audit event
   */
  /**
   * Create audit log with database-backed chain tracking and concurrency control
   */
  async logGdprAudit(params: {
    organisationId: string;
    userId?: string;
    adminId?: string;
    action: any; // auditActionEnum
    resource: any; // auditResourceEnum
    resourceId: string;
    category: any; // auditCategoryEnum
    details: Record<string, any>;
    severity?: any; // auditSeverityEnum
    outcome?: any; // auditOutcomeEnum
    businessContext?: string;
    legalBasis?: any; // processingLawfulBasisEnum
    req?: any;
    correlationId?: string;
    parentAuditId?: string;
  }): Promise<string> {
    const maxRetries = 3; // For handling optimistic lock conflicts
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.createAuditLogWithChainIntegrity(params, attempt);
      } catch (error: any) {
        lastError = error;
        
        // If it's a concurrency conflict (optimistic lock failure), retry
        if (error.message?.includes('version conflict') && attempt < maxRetries) {
          console.warn(`[ComprehensiveAuditService] Chain head version conflict, retrying attempt ${attempt + 1}`);
          // Add small delay with jitter to reduce thundering herd
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
          continue;
        }
        
        // For other errors or max retries exceeded, rethrow
        throw error;
      }
    }

    throw lastError || new Error('Failed to create audit log after retries');
  }

  /**
   * Create audit log with proper database-backed chain integrity and concurrency control
   */
  private async createAuditLogWithChainIntegrity(params: any, attemptNumber: number): Promise<string> {
    const auditContext = params.req ? this.extractAuditContext(params.req) : {
      ipAddress: 'system',
      userAgent: 'system',
      sessionId: null,
      requestId: null,
    };

    const correlationId = params.correlationId || 
      this.correlationStack[this.correlationStack.length - 1] || 
      nanoid();

    // Get current chain head from database (with optimistic lock)
    const chainHead = await storage.getAuditChainHead(params.organisationId);
    const previousHash = chainHead?.lastChainHash || null;
    const currentVersion = chainHead?.version || 0;

    const auditData: InsertGdprAuditLog = {
      organisationId: params.organisationId,
      userId: params.userId || null,
      adminId: params.adminId || null,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      category: params.category,
      details: params.details,
      severity: params.severity || 'info',
      outcome: params.outcome || 'success',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      correlationId,
      parentAuditId: params.parentAuditId || null,
      sessionId: auditContext.sessionId,
      requestId: auditContext.requestId,
      businessContext: params.businessContext || null,
      legalBasis: params.legalBasis || null,
      complianceFramework: 'UK_GDPR',
      previousLogHash: previousHash,
    };

    // Create canonical payload and generate integrity hash
    const canonicalPayload = this.createCanonicalPayload(auditData, previousHash);
    const integrityHash = this.generateIntegrityHash(auditData, previousHash);

    // Complete audit data with integrity info
    auditData.checksumHash = integrityHash;
    auditData.canonicalPayload = canonicalPayload;

    // Create audit log
    const auditLog = await storage.createGdprAuditLog(auditData);

    // Update chain head with optimistic locking (concurrency control)
    const chainHeadUpdate = {
      organisationId: params.organisationId,
      lastAuditLogId: auditLog.id,
      lastChainHash: integrityHash,
      chainLength: (chainHead?.chainLength || 0) + 1,
    };

    let updatedChainHead;
    if (chainHead) {
      // Update existing chain head with optimistic lock
      updatedChainHead = await storage.updateAuditChainHeadWithOptimisticLock(
        params.organisationId,
        currentVersion,
        chainHeadUpdate
      );
      
      if (!updatedChainHead) {
        // Optimistic lock failed - concurrent modification detected
        throw new Error(`Chain head version conflict for organisation ${params.organisationId} (attempt ${attemptNumber})`);
      }
    } else {
      // Create initial chain head
      updatedChainHead = await storage.upsertAuditChainHead({
        ...chainHeadUpdate,
        version: 1,
      });
    }

    console.log(`[ComprehensiveAuditService] GDPR audit logged: ${params.action} on ${params.resource} (${auditLog.id}) - Chain length: ${updatedChainHead.chainLength}`);

    return auditLog.id;
  }

  /**
   * Full-chain verification system that doesn't mutate records
   */
  
  /**
   * Verify integrity of a single audit log without mutation
   */
  async verifyAuditLogIntegrity(auditLogId: string): Promise<{
    isValid: boolean;
    expectedHash: string;
    actualHash: string;
    canonicalPayload: Record<string, any> | null;
    errors: string[];
  }> {
    const auditLog = await storage.getGdprAuditLog(auditLogId);
    if (!auditLog) {
      return {
        isValid: false,
        expectedHash: '',
        actualHash: '',
        canonicalPayload: null,
        errors: ['Audit log not found'],
      };
    }

    const errors: string[] = [];

    // Verify canonical payload exists
    if (!auditLog.canonicalPayload) {
      errors.push('Missing canonical payload - cannot verify integrity');
      return {
        isValid: false,
        expectedHash: auditLog.checksumHash || '',
        actualHash: '',
        canonicalPayload: null,
        errors,
      };
    }

    try {
      // Recreate hash from stored canonical payload
      const canonicalString = JSON.stringify(
        auditLog.canonicalPayload, 
        Object.keys(auditLog.canonicalPayload as Record<string, any>).sort()
      );
      const hashInput = canonicalString + (auditLog.previousLogHash || '');
      const recomputedHash = crypto.createHash('sha256').update(hashInput, 'utf8').digest('hex');

      const isValid = recomputedHash === auditLog.checksumHash;

      if (!isValid) {
        errors.push('Hash mismatch - audit log may have been tampered with');
      }

      return {
        isValid,
        expectedHash: auditLog.checksumHash || '',
        actualHash: recomputedHash,
        canonicalPayload: auditLog.canonicalPayload as Record<string, any>,
        errors,
      };

    } catch (error: any) {
      errors.push(`Hash verification failed: ${error.message}`);
      return {
        isValid: false,
        expectedHash: auditLog.checksumHash || '',
        actualHash: '',
        canonicalPayload: auditLog.canonicalPayload as Record<string, any>,
        errors,
      };
    }
  }

  /**
   * Verify the entire audit chain for an organisation
   */
  async verifyAuditChain(organisationId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<{
    isValid: boolean;
    totalLogs: number;
    verifiedLogs: number;
    brokenChainAt?: string;
    verificationResults: Array<{
      logId: string;
      timestamp: Date;
      isValid: boolean;
      errors: string[];
    }>;
    chainIntegrityIssues: string[];
  }> {
    const chainIntegrityIssues: string[] = [];
    const verificationResults: Array<{
      logId: string;
      timestamp: Date;
      isValid: boolean;
      errors: string[];
    }> = [];

    // Get audit logs in chronological order
    const auditLogsResult = await storage.getGdprAuditLogs(organisationId, {
      fromDate: options?.startDate,
      toDate: options?.endDate,
      limit: options?.limit || 1000,
      orderBy: 'timestamp',
      orderDirection: 'asc',
    });

    const auditLogs = auditLogsResult.logs;
    let previousHash: string | null = null;

    for (const auditLog of auditLogs) {
      // Verify individual log integrity
      const logVerification = await this.verifyAuditLogIntegrity(auditLog.id);
      
      // Check chain linkage
      const expectedPreviousHash = auditLog.previousLogHash;
      if (expectedPreviousHash !== previousHash) {
        logVerification.errors.push(
          `Chain linkage broken: expected previous hash '${expectedPreviousHash}' but chain shows '${previousHash}'`
        );
        logVerification.isValid = false;

        if (!chainIntegrityIssues.length) {
          // First broken link found
          chainIntegrityIssues.push(`Chain integrity broken at log ${auditLog.id} (${auditLog.timestamp})`);
        }
      }

      verificationResults.push({
        logId: auditLog.id,
        timestamp: auditLog.timestamp,
        isValid: logVerification.isValid,
        errors: logVerification.errors,
      });

      // Update previous hash for next iteration
      previousHash = auditLog.checksumHash || null;
    }

    const verifiedLogs = verificationResults.filter(r => r.isValid).length;
    const isValid = verifiedLogs === auditLogs.length && chainIntegrityIssues.length === 0;

    // Verify chain head consistency
    const chainHead = await storage.getAuditChainHead(organisationId);
    if (chainHead && auditLogs.length > 0) {
      const lastLog = auditLogs[auditLogs.length - 1];
      if (chainHead.lastChainHash !== lastLog.checksumHash) {
        chainIntegrityIssues.push(
          `Chain head inconsistency: head hash '${chainHead.lastChainHash}' doesn't match latest log hash '${lastLog.checksumHash}'`
        );
      }
      if (chainHead.lastAuditLogId !== lastLog.id) {
        chainIntegrityIssues.push(
          `Chain head inconsistency: head references log '${chainHead.lastAuditLogId}' but latest log is '${lastLog.id}'`
        );
      }
    }

    return {
      isValid: isValid && chainIntegrityIssues.length === 0,
      totalLogs: auditLogs.length,
      verifiedLogs,
      brokenChainAt: chainIntegrityIssues.length > 0 ? verificationResults.find(r => !r.isValid)?.logId : undefined,
      verificationResults,
      chainIntegrityIssues,
    };
  }

  /**
   * Update chain head verification status (separate from audit records)
   */
  async updateChainVerificationStatus(
    organisationId: string, 
    verificationStatus: 'pending' | 'valid' | 'broken',
    brokenAtLogId?: string
  ): Promise<void> {
    const chainHead = await storage.getAuditChainHead(organisationId);
    if (!chainHead) {
      console.warn(`[ComprehensiveAuditService] Cannot update verification status - no chain head found for organisation ${organisationId}`);
      return;
    }

    await storage.updateAuditChainHeadWithOptimisticLock(
      organisationId,
      chainHead.version,
      {
        lastVerified: new Date(),
        verificationStatus,
        brokenAtLogId: brokenAtLogId || null,
      }
    );

    console.log(`[ComprehensiveAuditService] Chain verification status updated to '${verificationStatus}' for organisation ${organisationId}`);
  }

  /**
   * Background verification job that can be scheduled
   */
  async performScheduledChainVerification(organisationId: string): Promise<{
    organisationId: string;
    verificationCompleted: boolean;
    chainValid: boolean;
    issues: string[];
  }> {
    try {
      console.log(`[ComprehensiveAuditService] Starting scheduled chain verification for organisation ${organisationId}`);

      const verificationResult = await this.verifyAuditChain(organisationId, {
        // Verify last 30 days for performance
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });

      // Update chain verification status
      await this.updateChainVerificationStatus(
        organisationId,
        verificationResult.isValid ? 'valid' : 'broken',
        verificationResult.brokenChainAt
      );

      console.log(`[ComprehensiveAuditService] Scheduled verification completed for organisation ${organisationId} - Valid: ${verificationResult.isValid}`);

      return {
        organisationId,
        verificationCompleted: true,
        chainValid: verificationResult.isValid,
        issues: verificationResult.chainIntegrityIssues,
      };

    } catch (error: any) {
      console.error(`[ComprehensiveAuditService] Scheduled verification failed for organisation ${organisationId}:`, error);

      return {
        organisationId,
        verificationCompleted: false,
        chainValid: false,
        issues: [`Verification failed: ${error.message}`],
      };
    }
  }

  /**
   * Log data processing activity
   */
  async logDataProcessingActivity(params: {
    organisationId: string;
    processingActivityId?: string;
    processingPurpose: string;
    dataCategory: any; // dataCategoryEnum
    operation: string;
    dataSubjects: string[];
    personalDataTypes: string[];
    specialCategoryData?: string[];
    legalBasis: any; // processingLawfulBasisEnum
    dataSource: string;
    triggeredBy?: string;
    recordCount?: number;
    req?: any;
    correlationId?: string;
  }): Promise<string> {
    try {
      const correlationId = params.correlationId || nanoid();

      const processingData: InsertDataProcessingAuditLog = {
        organisationId: params.organisationId,
        processingActivityId: params.processingActivityId || null,
        processingPurpose: params.processingPurpose,
        dataCategory: params.dataCategory,
        operation: params.operation,
        dataSubjects: params.dataSubjects,
        personalDataTypes: params.personalDataTypes,
        specialCategoryData: params.specialCategoryData || [],
        legalBasis: params.legalBasis,
        dataSource: params.dataSource,
        dataDestination: null,
        thirdPartyRecipients: [],
        internationalTransfers: false,
        triggeredBy: params.triggeredBy || null,
        automaticProcessing: true,
        humanReviewRequired: params.specialCategoryData ? params.specialCategoryData.length > 0 : false,
        riskLevel: params.specialCategoryData && params.specialCategoryData.length > 0 ? 'high' : 'low',
        correlationId,
        processingStarted: new Date(),
        recordCount: params.recordCount || 0,
      };

      const processingLog = await storage.createDataProcessingAuditLog(processingData);

      // Also create a corresponding GDPR audit entry
      await this.logGdprAudit({
        organisationId: params.organisationId,
        action: 'data_processed' as any,
        resource: 'personal_data' as any,
        resourceId: processingLog.id,
        category: 'data_processing' as any,
        details: {
          processingPurpose: params.processingPurpose,
          operation: params.operation,
          dataTypes: params.personalDataTypes,
          recordCount: params.recordCount || 0,
        },
        legalBasis: params.legalBasis,
        req: params.req,
        correlationId,
      });

      console.log(`[ComprehensiveAuditService] Data processing logged: ${params.operation} (${processingLog.id})`);

      return processingLog.id;
    } catch (error) {
      console.error('[ComprehensiveAuditService] Failed to log data processing activity:', error);
      throw error;
    }
  }

  /**
   * Log user rights request activity
   */
  async logUserRightsActivity(params: {
    organisationId: string;
    userRightRequestId: string;
    requestType: any; // userRightTypeEnum
    requestReference: string;
    actionTaken: string;
    actionDescription: string;
    processedBy?: string;
    stepInProcess: string;
    slaStatus: string;
    outcome?: string;
    req?: any;
    correlationId?: string;
  }): Promise<string> {
    try {
      const correlationId = params.correlationId || nanoid();

      const rightsData: InsertUserRightsAuditLog = {
        organisationId: params.organisationId,
        userRightRequestId: params.userRightRequestId,
        requestType: params.requestType,
        requestReference: params.requestReference,
        actionTaken: params.actionTaken,
        actionDescription: params.actionDescription,
        processedBy: params.processedBy || null,
        stepInProcess: params.stepInProcess,
        slaStatus: params.slaStatus,
        outcome: params.outcome || null,
        correlationId,
        evidenceCollected: [],
        documentsGenerated: [],
        qualityCheckPerformed: false,
      };

      const rightsLog = await storage.createUserRightsAuditLog(rightsData);

      // Also create a corresponding GDPR audit entry
      await this.logGdprAudit({
        organisationId: params.organisationId,
        action: 'rights_request_processed' as any,
        resource: 'user_rights_request' as any,
        resourceId: params.userRightRequestId,
        category: 'user_rights' as any,
        details: {
          requestType: params.requestType,
          actionTaken: params.actionTaken,
          stepInProcess: params.stepInProcess,
          slaStatus: params.slaStatus,
        },
        req: params.req,
        correlationId,
      });

      console.log(`[ComprehensiveAuditService] User rights activity logged: ${params.actionTaken} (${rightsLog.id})`);

      return rightsLog.id;
    } catch (error) {
      console.error('[ComprehensiveAuditService] Failed to log user rights activity:', error);
      throw error;
    }
  }

  /**
   * Log consent management activity
   */
  async logConsentActivity(params: {
    organisationId: string;
    userId?: string;
    consentRecordId?: string;
    marketingConsentId?: string;
    consentAction: string;
    newStatus: any; // consentStatusEnum
    consentMethod: string;
    consentSource: any; // consentSourceEnum
    evidenceData: Record<string, any>;
    previousStatus?: any; // consentStatusEnum
    req?: any;
    correlationId?: string;
  }): Promise<string> {
    try {
      const auditContext = params.req ? this.extractAuditContext(params.req) : {
        ipAddress: 'system',
        userAgent: 'system',
        sessionId: null,
        requestId: null,
      };

      const correlationId = params.correlationId || nanoid();

      const consentData: InsertConsentAuditLog = {
        organisationId: params.organisationId,
        consentRecordId: params.consentRecordId || null,
        marketingConsentId: params.marketingConsentId || null,
        userId: params.userId || null,
        consentAction: params.consentAction,
        previousStatus: params.previousStatus || null,
        newStatus: params.newStatus,
        consentMethod: params.consentMethod,
        consentSource: params.consentSource,
        evidenceData: params.evidenceData,
        doubleOptIn: false,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        sessionId: auditContext.sessionId,
        legalBasis: 'consent' as any,
        pecrCompliance: true,
        correlationId,
        evidenceHash: crypto.createHash('sha256').update(JSON.stringify(params.evidenceData)).digest('hex'),
      };

      const consentLog = await storage.createConsentAuditLog(consentData);

      // Also create a corresponding GDPR audit entry
      await this.logGdprAudit({
        organisationId: params.organisationId,
        userId: params.userId,
        action: 'consent_modified' as any,
        resource: 'consent_record' as any,
        resourceId: params.consentRecordId || params.marketingConsentId || 'unknown',
        category: 'consent_management' as any,
        details: {
          consentAction: params.consentAction,
          previousStatus: params.previousStatus,
          newStatus: params.newStatus,
          consentMethod: params.consentMethod,
          evidenceHash: consentData.evidenceHash,
        },
        legalBasis: 'consent' as any,
        req: params.req,
        correlationId,
      });

      console.log(`[ComprehensiveAuditService] Consent activity logged: ${params.consentAction} (${consentLog.id})`);

      return consentLog.id;
    } catch (error) {
      console.error('[ComprehensiveAuditService] Failed to log consent activity:', error);
      throw error;
    }
  }

  /**
   * Log system access activity
   */
  async logSystemAccess(params: {
    organisationId: string;
    userId?: string;
    userEmail?: string;
    userRole?: any; // userRoleEnum
    accessType: string;
    accessMethod: string;
    outcome: string;
    privilegedOperation?: boolean;
    personalDataAccessed?: boolean;
    resourceAccessed?: string;
    actionPerformed?: string;
    req?: any;
    correlationId?: string;
  }): Promise<string> {
    try {
      const auditContext = params.req ? this.extractAuditContext(params.req) : {
        ipAddress: 'system',
        userAgent: 'system',
        sessionId: null,
        requestId: null,
      };

      const correlationId = params.correlationId || nanoid();

      const accessData: InsertSystemAccessAuditLog = {
        organisationId: params.organisationId,
        userId: params.userId || null,
        userEmail: params.userEmail || null,
        userRole: params.userRole || null,
        accessType: params.accessType,
        accessMethod: params.accessMethod,
        outcome: params.outcome,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        sessionId: auditContext.sessionId,
        privilegedOperation: params.privilegedOperation || false,
        dataAccessAttempt: params.personalDataAccessed || false,
        resourceAccessed: params.resourceAccessed || null,
        actionPerformed: params.actionPerformed || null,
        gdprRelevant: params.personalDataAccessed || params.privilegedOperation || false,
        personalDataAccessed: params.personalDataAccessed || false,
        specialCategoryAccessed: false,
        riskScore: params.privilegedOperation ? 75 : 25,
        anomalyDetected: false,
        securityFlags: [],
      };

      const accessLog = await storage.createSystemAccessAuditLog(accessData);

      // Also create a corresponding GDPR audit entry for high-risk access
      if (params.privilegedOperation || params.personalDataAccessed) {
        await this.logGdprAudit({
          organisationId: params.organisationId,
          userId: params.userId,
          action: params.privilegedOperation ? 'privileged_operation' as any : 'admin_action_performed' as any,
          resource: 'user_account' as any,
          resourceId: params.userId || 'system',
          category: 'system_access' as any,
          severity: params.privilegedOperation ? 'high' as any : 'medium' as any,
          details: {
            accessType: params.accessType,
            accessMethod: params.accessMethod,
            resourceAccessed: params.resourceAccessed,
            actionPerformed: params.actionPerformed,
          },
          req: params.req,
          correlationId,
        });
      }

      console.log(`[ComprehensiveAuditService] System access logged: ${params.accessType} - ${params.outcome} (${accessLog.id})`);

      return accessLog.id;
    } catch (error) {
      console.error('[ComprehensiveAuditService] Failed to log system access:', error);
      throw error;
    }
  }

  /**
   * Push correlation ID to stack for nested operations
   */
  pushCorrelation(correlationId: string): void {
    this.correlationStack.push(correlationId);
  }

  /**
   * Pop correlation ID from stack
   */
  popCorrelation(): string | undefined {
    return this.correlationStack.pop();
  }

  /**
   * Get current correlation ID
   */
  getCurrentCorrelation(): string | null {
    return this.correlationStack.length > 0 
      ? this.correlationStack[this.correlationStack.length - 1] 
      : null;
  }

  /**
   * Verify audit integrity chain for an organization
   */
  async verifyAuditIntegrity(organisationId: string): Promise<{
    isValid: boolean;
    brokenChain: boolean;
    verifiedCount: number;
    totalCount: number;
    errors: string[];
  }> {
    try {
      const auditLogs = await storage.getGdprAuditLogs(organisationId, {
        limit: 1000, // Verify last 1000 entries
        orderBy: 'timestamp',
        orderDirection: 'asc',
      });

      let isValid = true;
      let brokenChain = false;
      let verifiedCount = 0;
      const errors: string[] = [];

      let previousHash: string | null = null;

      for (const log of auditLogs.logs) {
        try {
          // Reconstruct audit data without hash using destructuring (isVerified moved to chain head table)
          const { checksumHash, ...auditData } = log;

          // Verify integrity hash (convert null to undefined for method compatibility)
          // Cast all jsonb properties to proper types for generateIntegrityHash compatibility
          const typedAuditData = {
            ...auditData,
            details: auditData.details as any, // Cast jsonb to Json for method compatibility
            riskAssessment: auditData.riskAssessment as any, // Cast jsonb to Json for method compatibility
            canonicalPayload: auditData.canonicalPayload as any, // Cast jsonb to Json for method compatibility
          };
          const expectedHash = this.generateIntegrityHash(typedAuditData, previousHash || undefined);
          
          if (log.checksumHash !== expectedHash) {
            isValid = false;
            errors.push(`Hash mismatch for audit log ${log.id}`);
          } else {
            verifiedCount++;
          }

          // Check chain continuity
          if (log.previousLogHash !== previousHash) {
            brokenChain = true;
            errors.push(`Chain broken at audit log ${log.id}`);
          }

          previousHash = log.checksumHash;

        } catch (error) {
          isValid = false;
          errors.push(`Verification error for audit log ${log.id}: ${error}`);
        }
      }

      console.log(`[ComprehensiveAuditService] Integrity verification for ${organisationId}: ${verifiedCount}/${auditLogs.logs.length} verified`);

      return {
        isValid,
        brokenChain,
        verifiedCount,
        totalCount: auditLogs.logs.length,
        errors,
      };
    } catch (error) {
      console.error('[ComprehensiveAuditService] Failed to verify audit integrity:', error);
      throw error;
    }
  }

  /**
   * Generate compliance report for audit activities
   */
  async generateComplianceReport(organisationId: string, dateRange: {
    startDate: Date;
    endDate: Date;
  }): Promise<{
    totalAuditEvents: number;
    dataProcessingActivities: number;
    userRightsRequests: number;
    consentChanges: number;
    systemAccessEvents: number;
    complianceScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    try {
      const [gdprAuditCount, dataProcessingCount, userRightsCount, consentCount, systemAccessCount] = await Promise.all([
        storage.getGdprAuditLogCount(organisationId, dateRange),
        storage.getDataProcessingAuditLogCount(organisationId, dateRange),
        storage.getUserRightsAuditLogCount(organisationId, dateRange),
        storage.getConsentAuditLogCount(organisationId, dateRange),
        storage.getSystemAccessAuditLogCount(organisationId, dateRange),
      ]);

      const totalEvents = gdprAuditCount + dataProcessingCount + userRightsCount + consentCount + systemAccessCount;
      
      // Calculate compliance score based on audit coverage
      let complianceScore = 100;
      const recommendations: string[] = [];

      if (dataProcessingCount === 0) {
        complianceScore -= 20;
        recommendations.push('No data processing activities logged - ensure all processing is monitored');
      }

      if (userRightsCount === 0) {
        complianceScore -= 15;
        recommendations.push('No user rights activities logged - verify rights request handling');
      }

      if (consentCount === 0) {
        complianceScore -= 10;
        recommendations.push('No consent changes logged - ensure consent tracking is active');
      }

      if (systemAccessCount < 50) {
        complianceScore -= 5;
        recommendations.push('Limited system access logging - verify comprehensive access monitoring');
      }

      const riskLevel: 'low' | 'medium' | 'high' = 
        complianceScore >= 90 ? 'low' :
        complianceScore >= 70 ? 'medium' : 'high';

      console.log(`[ComprehensiveAuditService] Compliance report generated for ${organisationId}: Score ${complianceScore}, Risk ${riskLevel}`);

      return {
        totalAuditEvents: totalEvents,
        dataProcessingActivities: dataProcessingCount,
        userRightsRequests: userRightsCount,
        consentChanges: consentCount,
        systemAccessEvents: systemAccessCount,
        complianceScore,
        riskLevel,
        recommendations,
      };
    } catch (error) {
      console.error('[ComprehensiveAuditService] Failed to generate compliance report:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const comprehensiveAuditService = new ComprehensiveAuditService();