/**
 * GDPR TypeScript interfaces and types
 * UK GDPR and Data Protection Act 2018 compliance
 */

export type ConsentStatus = 'granted' | 'denied' | 'withdrawn' | 'pending';
export type ProcessingLawfulBasis = 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
export type DataCategory = 'identity' | 'contact' | 'financial' | 'demographic' | 'education' | 'technical' | 'usage' | 'special';
export type UserRightType = 'access' | 'rectification' | 'erasure' | 'restriction' | 'objection' | 'portability';
export type UserRightStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'expired';
export type BreachSeverity = 'low' | 'medium' | 'high' | 'critical';
export type BreachStatus = 'detected' | 'assessed' | 'notified_ico' | 'notified_subjects' | 'resolved';
export type CookieCategory = 'strictly_necessary' | 'functional' | 'analytics' | 'advertising';
export type MarketingConsentType = 'email' | 'sms' | 'phone' | 'post' | 'push_notifications';

// Consent Management
export interface ConsentRecord {
  id: string;
  userId: string;
  organisationId: string;
  consentType: string;
  status: ConsentStatus;
  lawfulBasis: ProcessingLawfulBasis;
  purpose: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  policyVersion: string;
  withdrawnAt?: Date;
  expiresAt?: Date;
  marketingConsents: Record<MarketingConsentType, ConsentStatus>;
  cookieConsents: Record<CookieCategory, ConsentStatus>;
  metadata: Record<string, any>;
}

// Privacy Settings
export interface PrivacySettings {
  id: string;
  organisationId: string;
  dataRetentionPeriod: number;
  cookieSettings: {
    bannerEnabled: boolean;
    bannerText: string;
    categories: Record<CookieCategory, { name: string; description: string; required: boolean }>;
  };
  privacyContacts: {
    dpoName?: string;
    dpoEmail?: string;
    privacyEmail: string;
    complaintsProcedure: string;
  };
  internationalTransfers: {
    enabled: boolean;
    countries: string[];
    safeguards: string;
  };
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// User Rights (DSAR)
export interface UserRightRequest {
  id: string;
  userId: string;
  organisationId: string;
  type: UserRightType;
  status: UserRightStatus;
  description: string;
  requestedAt: Date;
  verifiedAt?: Date;
  processedAt?: Date;
  completedAt?: Date;
  rejectionReason?: string;
  adminNotes: string;
  attachments: string[];
  metadata: Record<string, any>;
}

// Register of Processing Activities (RoPA)
export interface ProcessingActivity {
  id: string;
  organisationId: string;
  name: string;
  purpose: string;
  description: string;
  lawfulBasis: ProcessingLawfulBasis;
  dataCategories: DataCategory[];
  dataSubjects: string[];
  recipients: string[];
  internationalTransfers: boolean;
  transferCountries: string[];
  retentionPeriod: string;
  securityMeasures: string[];
  dpia: {
    required: boolean;
    completed: boolean;
    attachmentId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Data Breach Management
export interface DataBreach {
  id: string;
  organisationId: string;
  title: string;
  description: string;
  severity: BreachSeverity;
  status: BreachStatus;
  detectedAt: Date;
  reportedAt?: Date;
  icoNotifiedAt?: Date;
  subjectsNotifiedAt?: Date;
  affectedSubjects: number;
  dataCategories: DataCategory[];
  cause: string;
  impact: string;
  containmentMeasures: string;
  preventiveMeasures: string;
  notificationDeadline: Date;
  responsible: string;
  attachments: string[];
  metadata: Record<string, any>;
}

// Data Retention
export interface RetentionRule {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  dataType: string;
  retentionPeriod: number; // days
  deletionMethod: 'soft' | 'hard';
  legalBasis: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetentionSchedule {
  id: string;
  organisationId: string;
  userId: string;
  dataType: string;
  scheduledDeletion: Date;
  status: 'scheduled' | 'completed' | 'cancelled';
  retentionRuleId: string;
  processedAt?: Date;
  metadata: Record<string, any>;
}

// Audit Log
export interface GdprAuditLog {
  id: string;
  organisationId: string;
  userId?: string;
  adminId?: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

// Age Verification
export interface AgeVerification {
  id: string;
  userId: string;
  organisationId: string;
  dateOfBirth?: Date;
  ageVerified: boolean;
  parentalConsentRequired: boolean;
  parentalConsentGiven: boolean;
  parentEmail?: string;
  parentName?: string;
  verificationMethod: string;
  verifiedAt?: Date;
  metadata: Record<string, any>;
}

// Cookie Management
export interface CookieInventory {
  id: string;
  organisationId: string;
  name: string;
  purpose: string;
  category: CookieCategory;
  duration: string;
  provider: string;
  domain: string;
  essential: boolean;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}