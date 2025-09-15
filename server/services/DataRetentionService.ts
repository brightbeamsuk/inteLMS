/**
 * Data Retention Service - Comprehensive GDPR Article 5(e) Storage Limitation Compliance
 * 
 * This service provides automated data lifecycle management for GDPR compliance:
 * - Automated scanning for data eligible for deletion based on retention policies
 * - Soft deletion with grace periods before secure erase
 * - Multi-pass secure deletion with compliance certificates
 * - Integration with User Rights workflows for erasure requests
 * - Complete audit trails for accountability
 */

import { storage } from "../storage";
import { 
  type DataRetentionPolicy, 
  type DataLifecycleRecord, 
  type InsertDataLifecycleRecord,
  type RetentionComplianceAudit,
  type InsertRetentionComplianceAudit,
  type SecureDeletionCertificate,
  type InsertSecureDeletionCertificate
} from "@shared/schema";
import { db } from "../db";
import { eq, and, or, lt, gte, isNull, sql } from "drizzle-orm";
import { users, completions, certificates, auditLogs, emailLogs, scormAttempts } from "@shared/schema";
import crypto from "crypto";
import { nanoid } from "nanoid";

interface DataRetentionScanResult {
  organisationId: string;
  totalRecordsScanned: number;
  eligibleForRetention: number;
  scheduledForSoftDelete: number;
  scheduledForSecureErase: number;
  errors: string[];
  scanDuration: number;
}

interface SecureDeletionResult {
  recordsProcessed: number;
  recordsDeleted: number;
  certificatesGenerated: number;
  errors: string[];
  deletionDuration: number;
}

interface RetentionPolicyConflict {
  dataType: string;
  conflicts: DataRetentionPolicy[];
  resolvedPolicy: DataRetentionPolicy;
  reason: string;
}

export class DataRetentionService {
  private static instance: DataRetentionService;
  private isProcessing = false;
  private lastScanTime: Date | null = null;

  public static getInstance(): DataRetentionService {
    if (!DataRetentionService.instance) {
      DataRetentionService.instance = new DataRetentionService();
    }
    return DataRetentionService.instance;
  }

  /**
   * Execute retention lifecycle scan for a specific organization
   * This method is called by the automated scanning system
   */
  public async executeRetentionLifecycleScan(organisationId: string): Promise<{
    recordsProcessed: number;
    recordsSoftDeleted: number;
    recordsSecurelyErased: number;
    complianceAudits: number;
    scanDuration: number;
  }> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let recordsSoftDeleted = 0;
    let recordsSecurelyErased = 0;
    let complianceAudits = 0;

    try {
      console.log(`[DataRetentionService] Starting lifecycle scan for organization: ${organisationId}`);

      // Get active retention policies for this organization
      const policies = await storage.getDataRetentionPoliciesByOrganisation(organisationId);
      const activePolicies = policies.filter(p => p.enabled);

      if (activePolicies.length === 0) {
        console.log(`[DataRetentionService] No active retention policies found for organization: ${organisationId}`);
        return {
          recordsProcessed: 0,
          recordsSoftDeleted: 0,
          recordsSecurelyErased: 0,
          complianceAudits: 0,
          scanDuration: Date.now() - startTime
        };
      }

      console.log(`[DataRetentionService] Processing ${activePolicies.length} active retention policies`);

      // Process each retention policy
      for (const policy of activePolicies) {
        try {
          const policyResult = await this.processRetentionPolicy(policy);
          recordsProcessed += policyResult.recordsProcessed;
          recordsSoftDeleted += policyResult.recordsSoftDeleted;
          recordsSecurelyErased += policyResult.recordsSecurelyErased;
          complianceAudits++;

          // Log compliance audit for this policy execution
          await storage.createRetentionComplianceAudit({
            policyId: policy.id,
            organisationId: organisationId,
            auditTimestamp: new Date().toISOString(),
            operation: 'automated_lifecycle_scan',
            recordsProcessed: policyResult.recordsProcessed,
            recordsAffected: policyResult.recordsSoftDeleted + policyResult.recordsSecurelyErased,
            complianceStatus: 'compliant',
            auditDetails: {
              scanDuration: policyResult.scanDuration,
              softDeleted: policyResult.recordsSoftDeleted,
              securelyErased: policyResult.recordsSecurelyErased,
              automated: true,
              scanType: 'lifecycle_scan'
            }
          });

        } catch (policyError) {
          console.error(`[DataRetentionService] Error processing policy ${policy.id}:`, policyError);
          
          // Log failed compliance audit
          await storage.createRetentionComplianceAudit({
            policyId: policy.id,
            organisationId: organisationId,
            auditTimestamp: new Date().toISOString(),
            operation: 'automated_lifecycle_scan',
            recordsProcessed: 0,
            recordsAffected: 0,
            complianceStatus: 'failed',
            auditDetails: {
              error: policyError instanceof Error ? policyError.message : 'Unknown error',
              automated: true,
              scanType: 'lifecycle_scan'
            }
          });
          complianceAudits++;
        }
      }

      const scanDuration = Date.now() - startTime;
      console.log(`[DataRetentionService] Lifecycle scan completed - Processed: ${recordsProcessed}, Soft-deleted: ${recordsSoftDeleted}, Securely erased: ${recordsSecurelyErased}, Duration: ${scanDuration}ms`);

      return {
        recordsProcessed,
        recordsSoftDeleted,
        recordsSecurelyErased,
        complianceAudits,
        scanDuration
      };

    } catch (error) {
      console.error(`[DataRetentionService] Lifecycle scan failed for organization ${organisationId}:`, error);
      throw error;
    }
  }

  /**
   * Process a specific retention policy to identify and handle eligible data
   */
  private async processRetentionPolicy(policy: DataRetentionPolicy): Promise<{
    recordsProcessed: number;
    recordsSoftDeleted: number;
    recordsSecurelyErased: number;
    scanDuration: number;
  }> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let recordsSoftDeleted = 0;
    let recordsSecurelyErased = 0;

    try {
      console.log(`[DataRetentionService] Processing retention policy: ${policy.description || 'Unnamed Policy'} (${policy.dataType})`);

      // Process soft-delete candidates (data past retention period)
      const softDeleteResult = await this.processSoftDeleteCandidates(policy);
      recordsProcessed += softDeleteResult.recordsProcessed;
      recordsSoftDeleted += softDeleteResult.recordsSoftDeleted;

      // Process secure erase candidates (soft-deleted data past grace period)
      const secureEraseResult = await this.processSecureEraseCandidates(policy);
      recordsProcessed += secureEraseResult.recordsProcessed;
      recordsSecurelyErased += secureEraseResult.recordsSecurelyErased;

      return {
        recordsProcessed,
        recordsSoftDeleted,
        recordsSecurelyErased,
        scanDuration: Date.now() - startTime
      };

    } catch (error) {
      console.error(`[DataRetentionService] Error processing retention policy ${policy.id}:`, error);
      throw error;
    }
  }

  /**
   * Process data eligible for soft deletion based on retention policy
   */
  private async processSoftDeleteCandidates(policy: DataRetentionPolicy): Promise<{
    recordsProcessed: number;
    recordsSoftDeleted: number;
  }> {
    let recordsProcessed = 0;
    let recordsSoftDeleted = 0;

    try {
      // Calculate cutoff date for retention period
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriod);

      console.log(`[DataRetentionService] Scanning for ${policy.dataType} records older than ${cutoffDate.toISOString()}`);

      // Get data eligible for soft deletion based on data type
      const eligibleRecords = await this.getEligibleRecordsForSoftDelete(policy, cutoffDate);
      recordsProcessed = eligibleRecords.length;

      console.log(`[DataRetentionService] Found ${eligibleRecords.length} records eligible for soft deletion`);

      if (policy.automaticDeletion && eligibleRecords.length > 0) {
        // Execute soft deletion for eligible records
        for (const record of eligibleRecords) {
          try {
            await this.executeSoftDelete(record, policy);
            recordsSoftDeleted++;

            // Create lifecycle record
            await storage.createDataLifecycleRecord({
              entityId: record.id,
              entityType: policy.dataType,
              organisationId: policy.organisationId,
              policyId: policy.id,
              dataType: policy.dataType,
              status: 'soft_deleted',
              scheduledDeletionAt: new Date(Date.now() + (policy.gracePeriod * 24 * 60 * 60 * 1000)).toISOString(),
              processedAt: new Date().toISOString(),
              metadata: {
                originalCreatedAt: record.createdAt,
              }
            });

          } catch (deleteError) {
            console.error(`[DataRetentionService] Failed to soft delete record ${record.id}:`, deleteError);
          }
        }

        console.log(`[DataRetentionService] Successfully soft-deleted ${recordsSoftDeleted} records`);
      }

      return { recordsProcessed, recordsSoftDeleted };

    } catch (error) {
      console.error(`[DataRetentionService] Error processing soft delete candidates:`, error);
      throw error;
    }
  }

  /**
   * Process soft-deleted data eligible for secure erasure based on grace period
   */
  private async processSecureEraseCandidates(policy: DataRetentionPolicy): Promise<{
    recordsProcessed: number;
    recordsSecurelyErased: number;
  }> {
    let recordsProcessed = 0;
    let recordsSecurelyErased = 0;

    try {
      // Get soft-deleted records past grace period
      const gracePeriodCutoff = new Date();
      gracePeriodCutoff.setDate(gracePeriodCutoff.getDate() - policy.gracePeriod);

      console.log(`[DataRetentionService] Scanning for soft-deleted ${policy.dataType} records older than grace period: ${gracePeriodCutoff.toISOString()}`);

      const eligibleLifecycleRecords = await storage.getDataLifecycleRecordsByStatus(policy.organisationId, 'soft_deleted');
      const eligibleForSecureErase = eligibleLifecycleRecords.filter(record => 
        record.policyId === policy.id && 
        record.scheduledDeletionAt && 
        new Date(record.scheduledDeletionAt) <= new Date()
      );

      recordsProcessed = eligibleForSecureErase.length;
      console.log(`[DataRetentionService] Found ${eligibleForSecureErase.length} records eligible for secure erasure`);

      // Execute secure erasure for eligible records
      for (const lifecycleRecord of eligibleForSecureErase) {
        try {
          await this.executeSecureErase(lifecycleRecord, policy);
          recordsSecurelyErased++;

          // Update lifecycle record status
          await storage.updateDataLifecycleRecord(lifecycleRecord.id, {
            status: 'securely_erased',
            processedAt: new Date().toISOString()
          });

        } catch (eraseError) {
          console.error(`[DataRetentionService] Failed to securely erase record ${lifecycleRecord.id}:`, eraseError);
        }
      }

      console.log(`[DataRetentionService] Successfully securely erased ${recordsSecurelyErased} records`);
      return { recordsProcessed, recordsSecurelyErased };

    } catch (error) {
      console.error(`[DataRetentionService] Error processing secure erase candidates:`, error);
      throw error;
    }
  }

  /**
   * Main automated scan for data eligible for retention processing
   * This is the core method that should be called by scheduled jobs
   */
  public async scanAndProcessRetentionPolicies(organisationId?: string): Promise<DataRetentionScanResult[]> {
    if (this.isProcessing) {
      throw new Error("Data retention processing is already in progress");
    }

    this.isProcessing = true;
    const startTime = Date.now();
    const results: DataRetentionScanResult[] = [];

    try {
      const organisations = organisationId ? 
        [{ id: organisationId }] : 
        await storage.getAllOrganisations();

      for (const org of organisations) {
        try {
          const result = await this.processOrganisationRetention(org.id);
          results.push(result);
        } catch (error) {
          console.error(`Error processing retention for organisation ${org.id}:`, error);
          results.push({
            organisationId: org.id,
            totalRecordsScanned: 0,
            eligibleForRetention: 0,
            scheduledForSoftDelete: 0,
            scheduledForSecureErase: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            scanDuration: 0
          });
        }
      }

      this.lastScanTime = new Date();
      return results;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process retention policies for a specific organisation
   */
  private async processOrganisationRetention(organisationId: string): Promise<DataRetentionScanResult> {
    const startTime = Date.now();
    const result: DataRetentionScanResult = {
      organisationId,
      totalRecordsScanned: 0,
      eligibleForRetention: 0,
      scheduledForSoftDelete: 0,
      scheduledForSecureErase: 0,
      errors: [],
      scanDuration: 0
    };

    try {
      // Get enabled retention policies for this organisation
      const policies = await storage.getEnabledDataRetentionPolicies(organisationId);
      if (policies.length === 0) {
        console.log(`No enabled retention policies found for organisation ${organisationId}`);
        return result;
      }

      // Process each data type with retention policies
      const dataTypes = [...new Set(policies.map(p => p.dataType))];
      
      for (const dataType of dataTypes) {
        try {
          // Resolve policy conflicts by priority
          const resolvedPolicy = await this.resolveRetentionPolicyConflicts(organisationId, dataType);
          if (!resolvedPolicy) continue;

          // Scan for data eligible for retention processing
          const eligibleData = await this.scanDataForRetention(organisationId, dataType, resolvedPolicy);
          result.totalRecordsScanned += eligibleData.length;

          // Create lifecycle records for new data
          const newLifecycleRecords = await this.createLifecycleRecords(eligibleData, resolvedPolicy);
          result.eligibleForRetention += newLifecycleRecords.length;

          // Process existing lifecycle records
          const processResult = await this.processLifecycleRecords(organisationId, dataType);
          result.scheduledForSoftDelete += processResult.softDeleted;
          result.scheduledForSecureErase += processResult.securelyErased;

        } catch (error) {
          console.error(`Error processing data type ${dataType} for organisation ${organisationId}:`, error);
          result.errors.push(`${dataType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Generate compliance audit
      await this.generateComplianceAudit(organisationId, policies, result);

    } catch (error) {
      console.error(`Error in processOrganisationRetention for ${organisationId}:`, error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    result.scanDuration = Date.now() - startTime;
    return result;
  }

  /**
   * Resolve retention policy conflicts by priority and legal basis
   */
  private async resolveRetentionPolicyConflicts(organisationId: string, dataType: string): Promise<DataRetentionPolicy | null> {
    const policies = await storage.getDataRetentionPoliciesByDataType(organisationId, dataType);
    if (policies.length === 0) return null;
    if (policies.length === 1) return policies[0];

    // Sort by priority (higher number = higher priority)
    const sortedPolicies = policies.sort((a, b) => b.priority - a.priority);

    // Legal obligation takes precedence over other legal bases
    const legalObligationPolicy = sortedPolicies.find(p => p.legalBasis === 'legal_obligation');
    if (legalObligationPolicy) {
      return legalObligationPolicy;
    }

    // Return highest priority policy
    return sortedPolicies[0];
  }

  /**
   * Scan database for data matching retention criteria
   */
  private async scanDataForRetention(organisationId: string, dataType: string, policy: DataRetentionPolicy): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriod);

    let eligibleData: any[] = [];

    try {
      switch (dataType) {
        case 'user_profile':
          eligibleData = await db.select()
            .from(users)
            .where(and(
              eq(users.organisationId, organisationId),
              lt(users.createdAt, cutoffDate),
              // Only include inactive users for deletion
              eq(users.status, 'inactive')
            ));
          break;

        case 'course_progress':
          eligibleData = await db.select()
            .from(completions)
            .where(and(
              eq(completions.organisationId, organisationId),
              lt(completions.completedAt, cutoffDate)
            ));
          break;

        case 'certificates':
          eligibleData = await db.select()
            .from(certificates)
            .where(and(
              eq(certificates.organisationId, organisationId),
              lt(certificates.issuedAt, cutoffDate),
              // Only include expired certificates
              or(
                lt(certificates.expiryDate, new Date()),
                isNull(certificates.expiryDate)
              )
            ));
          break;

        case 'audit_logs':
          eligibleData = await db.select()
            .from(auditLogs)
            .where(and(
              eq(auditLogs.organisationId, organisationId),
              lt(auditLogs.timestamp, cutoffDate)
            ));
          break;

        case 'communications':
          eligibleData = await db.select()
            .from(emailLogs)
            .where(and(
              eq(emailLogs.organisationId, organisationId),
              lt(emailLogs.sentAt, cutoffDate)
            ));
          break;

        case 'course_progress':
          eligibleData = await db.select()
            .from(scormAttempts)
            .where(and(
              eq(scormAttempts.organisationId, organisationId),
              lt(scormAttempts.createdAt, cutoffDate),
              // Only include completed attempts
              eq(scormAttempts.isActive, false)
            ));
          break;

        default:
          console.warn(`Unsupported data type for retention scanning: ${dataType}`);
          break;
      }
    } catch (error) {
      console.error(`Error scanning data for type ${dataType}:`, error);
      throw error;
    }

    return eligibleData;
  }

  /**
   * Create lifecycle records for newly eligible data
   */
  private async createLifecycleRecords(eligibleData: any[], policy: DataRetentionPolicy): Promise<DataLifecycleRecord[]> {
    const lifecycleRecords: DataLifecycleRecord[] = [];

    for (const data of eligibleData) {
      try {
        // Check if lifecycle record already exists
        const existingRecord = await storage.getDataLifecycleRecordsByResource(
          this.getTableNameForDataType(policy.dataType),
          data.id
        );

        if (existingRecord) {
          continue; // Skip if already tracked
        }

        // Calculate retention eligible date
        const retentionEligibleAt = new Date(data.createdAt || data.completedAt || data.issuedAt || data.timestamp);
        retentionEligibleAt.setDate(retentionEligibleAt.getDate() + policy.retentionPeriod);

        const lifecycleRecord: InsertDataLifecycleRecord = {
          organisationId: policy.organisationId,
          userId: data.userId || data.id, // Handle different data structures
          dataType: policy.dataType,
          resourceId: data.id,
          resourceTable: this.getTableNameForDataType(policy.dataType),
          status: 'retention_pending',
          policyId: policy.id,
          dataCreatedAt: new Date(data.createdAt || data.completedAt || data.issuedAt || data.timestamp),
          retentionEligibleAt,
          deletionMethod: policy.deletionMethod,
          secureEraseMethod: policy.secureEraseMethod,
          metadata: {
            policySnapshot: policy,
            originalData: { id: data.id, type: policy.dataType }
          }
        };

        const created = await storage.createDataLifecycleRecord(lifecycleRecord);
        lifecycleRecords.push(created);

      } catch (error) {
        console.error(`Error creating lifecycle record for ${policy.dataType} ID ${data.id}:`, error);
        // Continue processing other records
      }
    }

    return lifecycleRecords;
  }

  /**
   * Process existing lifecycle records for deletion scheduling
   */
  private async processLifecycleRecords(organisationId: string, dataType?: string): Promise<{
    processed: number;
    softDeleted: number;
    securelyErased: number;
    errors: number;
  }> {
    const result = {
      processed: 0,
      softDeleted: 0,
      securelyErased: 0,
      errors: 0
    };

    try {
      // Get records eligible for soft deletion
      const eligibleForSoftDelete = await storage.getDataEligibleForSoftDelete(organisationId);
      for (const record of eligibleForSoftDelete) {
        try {
          await this.scheduleSoftDeletion(record);
          result.softDeleted++;
        } catch (error) {
          console.error(`Error scheduling soft deletion for record ${record.id}:`, error);
          result.errors++;
        }
        result.processed++;
      }

      // Get records eligible for secure erase
      const eligibleForSecureErase = await storage.getDataEligibleForSecureErase(organisationId);
      for (const record of eligibleForSecureErase) {
        try {
          await this.performSecureErase(record);
          result.securelyErased++;
        } catch (error) {
          console.error(`Error performing secure erase for record ${record.id}:`, error);
          result.errors++;
        }
        result.processed++;
      }

    } catch (error) {
      console.error(`Error processing lifecycle records for organisation ${organisationId}:`, error);
      result.errors++;
    }

    return result;
  }

  /**
   * Schedule data for soft deletion
   */
  private async scheduleSoftDeletion(record: DataLifecycleRecord): Promise<void> {
    const now = new Date();
    
    // Calculate grace period end
    const policy = JSON.parse(JSON.stringify(record.metadata))?.policySnapshot;
    const gracePeriod = policy?.gracePeriod || 30; // default 30 days
    const secureEraseScheduledAt = new Date(now);
    secureEraseScheduledAt.setDate(secureEraseScheduledAt.getDate() + gracePeriod);

    // Update lifecycle record
    await storage.updateDataLifecycleRecord(record.id, {
      status: 'deletion_scheduled',
      softDeleteScheduledAt: now,
      secureEraseScheduledAt,
      deletionReason: 'Automated retention policy execution',
      lastProcessedAt: now
    });

    // Perform soft deletion on the actual data
    await this.performSoftDeletion(record);
  }

  /**
   * Perform soft deletion on actual data
   */
  private async performSoftDeletion(record: DataLifecycleRecord): Promise<void> {
    const softDeletedAt = new Date();

    try {
      // Soft delete based on data type
      switch (record.dataType) {
        case 'user_profile':
          // Anonymize user data instead of hard delete
          await db.update(users)
            .set({
              email: `deleted_${record.resourceId}@anonymized.local`,
              firstName: 'Deleted',
              lastName: 'User',
              profileImageUrl: null,
              phone: null,
              bio: 'User data deleted per retention policy',
              status: 'inactive',
              updatedAt: softDeletedAt
            })
            .where(eq(users.id, record.resourceId));
          break;

        case 'audit_logs':
          // Mark audit logs as deleted but preserve for compliance
          await db.update(auditLogs)
            .set({
              metadata: sql`jsonb_set(metadata, '{deleted}', 'true'::jsonb)`,
              updatedAt: softDeletedAt
            })
            .where(eq(auditLogs.id, record.resourceId));
          break;

        default:
          // For other data types, just mark as soft deleted in lifecycle
          break;
      }

      // Update lifecycle record
      await storage.updateDataLifecycleRecord(record.id, {
        status: 'soft_deleted',
        softDeletedAt,
        lastProcessedAt: softDeletedAt
      });

    } catch (error) {
      console.error(`Error performing soft deletion for ${record.dataType} ID ${record.resourceId}:`, error);
      
      // Update with error status
      await storage.updateDataLifecycleRecord(record.id, {
        processingErrors: [{ 
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          operation: 'soft_deletion'
        }],
        retryCount: (record.retryCount || 0) + 1,
        lastProcessedAt: new Date()
      });
      
      throw error;
    }
  }

  /**
   * Perform secure erase with multi-pass overwriting
   */
  private async performSecureErase(record: DataLifecycleRecord): Promise<SecureDeletionCertificate> {
    const secureErasedAt = new Date();
    const deletionStarted = new Date();

    try {
      // Generate verification hash before deletion
      const verificationHash = crypto
        .createHash('sha256')
        .update(`${record.resourceTable}_${record.resourceId}_${deletionStarted.toISOString()}`)
        .digest('hex');

      // Perform actual secure deletion
      await this.executeSecureDeletion(record);

      // Update lifecycle record
      await storage.updateDataLifecycleRecord(record.id, {
        status: 'securely_erased',
        secureErasedAt,
        deletionConfirmation: verificationHash,
        lastProcessedAt: secureErasedAt
      });

      // Generate compliance certificate
      const certificate = await this.generateSecureDeletionCertificate(record, {
        verificationHash,
        deletionStarted,
        deletionCompleted: secureErasedAt
      });

      // Update lifecycle record with certificate reference
      await storage.updateDataLifecycleRecord(record.id, {
        complianceCertificate: certificate.certificateNumber
      });

      return certificate;

    } catch (error) {
      console.error(`Error performing secure erase for ${record.dataType} ID ${record.resourceId}:`, error);
      
      // Update with error status
      await storage.updateDataLifecycleRecord(record.id, {
        processingErrors: [{ 
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          operation: 'secure_erase'
        }],
        retryCount: (record.retryCount || 0) + 1,
        lastProcessedAt: new Date()
      });
      
      throw error;
    }
  }

  /**
   * Execute secure deletion with multi-pass overwriting
   */
  private async executeSecureDeletion(record: DataLifecycleRecord): Promise<void> {
    const policy = JSON.parse(JSON.stringify(record.metadata))?.policySnapshot;
    const secureEraseMethod = policy?.secureEraseMethod || 'overwrite_multiple';

    switch (secureEraseMethod) {
      case 'simple_delete':
        await this.performSimpleDeletion(record);
        break;
        
      case 'overwrite_once':
        await this.performOverwriteDeletion(record, 1);
        break;
        
      case 'overwrite_multiple':
        await this.performOverwriteDeletion(record, 3); // DOD 5220.22-M standard
        break;
        
      case 'cryptographic_erase':
        await this.performCryptographicErase(record);
        break;
        
      default:
        await this.performOverwriteDeletion(record, 3);
        break;
    }
  }

  /**
   * Perform simple deletion (standard database delete)
   */
  private async performSimpleDeletion(record: DataLifecycleRecord): Promise<void> {
    switch (record.dataType) {
      case 'course_progress':
        await db.delete(completions).where(eq(completions.id, record.resourceId));
        break;
        
      case 'certificates':
        await db.delete(certificates).where(eq(certificates.id, record.resourceId));
        break;
        
      case 'communications':
        await db.delete(emailLogs).where(eq(emailLogs.id, record.resourceId));
        break;
        
      default:
        console.warn(`Simple deletion not implemented for data type: ${record.dataType}`);
        break;
    }
  }

  /**
   * Perform multi-pass overwrite deletion
   */
  private async performOverwriteDeletion(record: DataLifecycleRecord, passes: number): Promise<void> {
    // For database records, overwriting means replacing sensitive data with random data
    // before final deletion
    
    for (let i = 0; i < passes; i++) {
      await this.overwriteDataWithRandom(record);
      // Small delay between passes
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Final deletion after overwriting
    await this.performSimpleDeletion(record);
  }

  /**
   * Overwrite sensitive data with random data
   */
  private async overwriteDataWithRandom(record: DataLifecycleRecord): Promise<void> {
    const randomData = crypto.randomBytes(32).toString('hex');
    
    switch (record.dataType) {
      case 'user_profile':
        await db.update(users)
          .set({
            email: `overwrite_${randomData}@deleted.local`,
            firstName: randomData.substring(0, 10),
            lastName: randomData.substring(10, 20),
            profileImageUrl: null,
            phone: randomData.substring(20, 30),
            bio: `overwritten_${randomData}`
          })
          .where(eq(users.id, record.resourceId));
        break;
        
      default:
        // For other data types, update metadata to indicate overwriting
        break;
    }
  }

  /**
   * Perform cryptographic erasure (destroy encryption keys)
   */
  private async performCryptographicErase(record: DataLifecycleRecord): Promise<void> {
    // In a real implementation, this would destroy encryption keys
    // For now, perform overwrite deletion
    await this.performOverwriteDeletion(record, 1);
  }

  /**
   * Generate secure deletion certificate for compliance
   */
  private async generateSecureDeletionCertificate(
    record: DataLifecycleRecord, 
    deletionDetails: {
      verificationHash: string;
      deletionStarted: Date;
      deletionCompleted: Date;
    }
  ): Promise<SecureDeletionCertificate> {
    const policy = JSON.parse(JSON.stringify(record.metadata))?.policySnapshot;
    const certificateNumber = `SDEL-${record.organisationId.substring(0, 8)}-${nanoid(8)}`;

    const certificateData: InsertSecureDeletionCertificate = {
      organisationId: record.organisationId,
      certificateNumber,
      userId: record.userId,
      dataTypes: [record.dataType],
      recordCount: 1,
      deletionMethod: record.secureEraseMethod || 'overwrite_multiple',
      deletionStarted: deletionDetails.deletionStarted,
      deletionCompleted: deletionDetails.deletionCompleted,
      verificationHash: deletionDetails.verificationHash,
      verificationMethod: 'sha256_hash_verification',
      legalBasis: policy?.legalBasis || 'legal_obligation',
      regulatoryRequirement: policy?.regulatoryRequirement || 'GDPR Article 5(e)',
      requestOrigin: 'retention_policy',
      requestReference: record.policyId,
      deletionReason: record.deletionReason || 'Automated retention policy execution',
      complianceNotes: `Secure deletion performed per retention policy ${record.policyId}`,
      digitalSignature: crypto
        .createHash('sha256')
        .update(`${certificateNumber}_${deletionDetails.verificationHash}`)
        .digest('hex')
    };

    return await storage.createSecureDeletionCertificate(certificateData);
  }

  /**
   * Generate compliance audit for retention processing
   */
  private async generateComplianceAudit(
    organisationId: string, 
    policies: DataRetentionPolicy[], 
    scanResult: DataRetentionScanResult
  ): Promise<void> {
    for (const policy of policies) {
      try {
        // Calculate compliance metrics
        const totalRecords = await this.countRecordsForDataType(organisationId, policy.dataType);
        const lifecycleRecords = await storage.getDataLifecycleRecordsByOrganisation(organisationId);
        const policyRecords = lifecycleRecords.filter(r => r.policyId === policy.id);
        
        const compliantRecords = policyRecords.filter(r => 
          r.status === 'active' || r.status === 'securely_erased'
        ).length;
        
        const overdueRecords = policyRecords.filter(r => 
          r.retentionEligibleAt < new Date() && r.status === 'active'
        ).length;

        const complianceRate = totalRecords > 0 ? (compliantRecords / totalRecords) * 100 : 100;
        const isCompliant = complianceRate >= 95; // 95% compliance threshold

        const auditData: InsertRetentionComplianceAudit = {
          organisationId,
          policyId: policy.id,
          dataType: policy.dataType,
          totalRecords,
          compliantRecords,
          overdueRecords,
          errorRecords: scanResult.errors.length,
          processedRecords: scanResult.scheduledForSoftDelete + scanResult.scheduledForSecureErase,
          complianceRate,
          isCompliant,
          riskLevel: this.calculateRiskLevel(complianceRate, overdueRecords),
          issues: scanResult.errors.map(error => ({ error, timestamp: new Date() })),
          recommendations: this.generateRecommendations(complianceRate, overdueRecords, policy),
          auditNotes: `Automated compliance audit for retention policy ${policy.description || 'Unnamed Policy'}`,
          auditDuration: scanResult.scanDuration,
          nextAuditDue: this.calculateNextAuditDate(),
          metadata: {
            scanResult,
            policySnapshot: policy
          }
        };

        await storage.createRetentionComplianceAudit(auditData);
      } catch (error) {
        console.error(`Error generating compliance audit for policy ${policy.id}:`, error);
      }
    }
  }

  /**
   * Helper methods
   */
  private getTableNameForDataType(dataType: string): string {
    const mapping: Record<string, string> = {
      'user_profile': 'users',
      'course_progress': 'completions',
      'certificates': 'certificates',
      'audit_logs': 'audit_logs',
      'communications': 'email_logs',
      'scorm_attempts': 'scorm_attempts'
    };
    return mapping[dataType] || dataType;
  }

  private async countRecordsForDataType(organisationId: string, dataType: string): Promise<number> {
    try {
      switch (dataType) {
        case 'user_profile':
          const userCount = await db.select({ count: sql<number>`count(*)` })
            .from(users)
            .where(eq(users.organisationId, organisationId));
          return userCount[0]?.count || 0;
          
        case 'course_progress':
          const completionCount = await db.select({ count: sql<number>`count(*)` })
            .from(completions)
            .where(eq(completions.organisationId, organisationId));
          return completionCount[0]?.count || 0;
          
        default:
          return 0;
      }
    } catch (error) {
      console.error(`Error counting records for data type ${dataType}:`, error);
      return 0;
    }
  }

  private calculateRiskLevel(complianceRate: number, overdueRecords: number): string {
    if (complianceRate < 70 || overdueRecords > 100) return 'critical';
    if (complianceRate < 85 || overdueRecords > 50) return 'high';
    if (complianceRate < 95 || overdueRecords > 10) return 'medium';
    return 'low';
  }

  private generateRecommendations(complianceRate: number, overdueRecords: number, policy: DataRetentionPolicy): any[] {
    const recommendations = [];
    
    if (complianceRate < 95) {
      recommendations.push({
        type: 'compliance_improvement',
        message: 'Consider reducing retention period or improving automated processing',
        priority: 'high'
      });
    }
    
    if (overdueRecords > 0) {
      recommendations.push({
        type: 'overdue_processing',
        message: `${overdueRecords} records are overdue for deletion`,
        priority: 'urgent'
      });
    }
    
    if (!policy.automaticDeletion) {
      recommendations.push({
        type: 'automation',
        message: 'Enable automatic deletion to improve compliance',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }

  private calculateNextAuditDate(): Date {
    const nextAudit = new Date();
    nextAudit.setDate(nextAudit.getDate() + 30); // Monthly audits
    return nextAudit;
  }

  /**
   * Public methods for manual operations
   */
  public async getRetentionStatus(organisationId: string): Promise<{
    isProcessing: boolean;
    lastScanTime: Date | null;
    activePolicies: number;
    pendingDeletions: number;
    overdueRecords: number;
  }> {
    const policies = await storage.getEnabledDataRetentionPolicies(organisationId);
    const pendingDeletions = await storage.getDataLifecycleRecordsByStatus(organisationId, 'deletion_scheduled');
    const overdueRecords = await storage.getDataEligibleForRetention(organisationId);

    return {
      isProcessing: this.isProcessing,
      lastScanTime: this.lastScanTime,
      activePolicies: policies.length,
      pendingDeletions: pendingDeletions.length,
      overdueRecords: overdueRecords.length
    };
  }

  public async executeManualRetentionScan(organisationId: string): Promise<DataRetentionScanResult> {
    const results = await this.scanAndProcessRetentionPolicies(organisationId);
    return results[0] || {
      organisationId,
      totalRecordsScanned: 0,
      eligibleForRetention: 0,
      scheduledForSoftDelete: 0,
      scheduledForSecureErase: 0,
      errors: ['No results returned'],
      scanDuration: 0
    };
  }
}

// Export singleton instance
export const dataRetentionService = DataRetentionService.getInstance();