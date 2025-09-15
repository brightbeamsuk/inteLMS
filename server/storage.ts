import {
  users,
  organisations,
  courses,
  courseFolders,
  organisationCourseFolders,
  assignments,
  completions,
  certificates,
  certificateTemplates,
  organisationSettings,
  platformSettings,
  todoItems,
  scormAttempts,
  plans,
  planFeatures,
  planFeatureMappings,
  auditLogs,
  emailTemplates, // NEW: Platform default templates
  orgEmailTemplates, // NEW: Organization override templates
  // emailTemplateDefaults, // DEPRECATED
  // emailTemplateOverrides, // DEPRECATED
  systemEmailSettings,
  emailLogs,
  emailSends, // NEW: Email orchestrator sends tracking
  emailSettingsLock, // NEW: Email settings lock table
  billingLocks, // NEW: Billing/subscription distributed lock table
  orgNotificationSettings, // Organization notification settings
  emailProviderConfigs, // Email provider configurations
  supportTickets,
  supportTicketResponses,
  webhookEvents,
  // GDPR tables
  consentRecords,
  privacySettings,
  userRightRequests,
  processingActivities,
  dataBreaches,
  retentionRules,
  retentionSchedules,
  gdprAuditLogs,
  ageVerifications,
  // UK GDPR Article 8 - Parental Consent tables
  parentalConsentRecords,
  familyAccounts,
  childAccountLinks,
  childProtectionSettings,
  cookieInventory,
  // Enhanced data retention tables
  dataRetentionPolicies,
  dataLifecycleRecords,
  retentionComplianceAudits,
  secureDeletionCertificates,
  // Compliance documents tables
  complianceDocuments,
  complianceDocumentTemplates,
  complianceDocumentAudit,
  complianceDocumentPublications,
  // PECR Marketing Consent tables
  marketingConsent,
  communicationPreferences,
  marketingCampaigns,
  consentHistory,
  suppressionList,
  // GDPR Dashboard tables
  gdprDashboardConfig,
  complianceReports,
  exportJobs,
  type User,
  type UpsertUser,
  type InsertUser,
  type Organisation,
  type InsertOrganisation,
  type Course,
  type InsertCourse,
  type CourseFolder,
  type InsertCourseFolder,
  type OrganisationCourseFolder,
  type InsertOrganisationCourseFolder,
  type Assignment,
  type InsertAssignment,
  type Completion,
  type InsertCompletion,
  type Certificate,
  type InsertCertificate,
  type CertificateTemplate,
  type InsertCertificateTemplate,
  type OrganisationSettings,
  type InsertOrganisationSettings,
  type PlatformSettings,
  type InsertPlatformSettings,
  type TodoItem,
  type InsertTodoItem,
  type ScormAttempt,
  type InsertScormAttempt,
  type Plan,
  type InsertPlan,
  type PlanFeature,
  type InsertPlanFeature,
  type PlanFeatureMapping,
  type InsertPlanFeatureMapping,
  type AuditLog,
  type InsertAuditLog,
  type EmailTemplate, // NEW: Platform default template type
  type InsertEmailTemplate,
  type OrgEmailTemplate, // NEW: Organization override template type
  type InsertOrgEmailTemplate,
  // type EmailTemplateDefaults, // DEPRECATED
  // type InsertEmailTemplateDefaults, // DEPRECATED
  // type EmailTemplateOverrides, // DEPRECATED
  // type InsertEmailTemplateOverrides, // DEPRECATED
  type SystemEmailSettings,
  type InsertSystemEmailSettings,
  type EmailLog,
  type InsertEmailLog,
  type EmailSend, // NEW: Email orchestrator send record type  
  type InsertEmailSend,
  type EmailSettingsLock, // NEW: Email settings lock type
  type InsertEmailSettingsLock,
  type BillingLock, // NEW: Billing distributed lock type
  type InsertBillingLock,
  type EmailProviderConfigs, // Email provider configurations
  type InsertEmailProviderConfigs,
  type SupportTicket,
  type InsertSupportTicket,
  type SupportTicketResponse,
  type InsertSupportTicketResponse,
  type WebhookEvent,
  type InsertWebhookEvent,
  // GDPR types
  type ConsentRecord,
  type InsertConsentRecord,
  type PrivacySettings,
  type InsertPrivacySettings,
  type UserRightRequest,
  type InsertUserRightRequest,
  type ProcessingActivity,
  type InsertProcessingActivity,
  type DataBreach,
  type InsertDataBreach,
  type RetentionRule,
  type InsertRetentionRule,
  type RetentionSchedule,
  type InsertRetentionSchedule,
  type GdprAuditLog,
  type InsertGdprAuditLog,
  type AgeVerification,
  type InsertAgeVerification,
  // UK GDPR Article 8 - Parental Consent types
  type ParentalConsentRecord,
  type InsertParentalConsentRecord,
  type FamilyAccount,
  type InsertFamilyAccount,
  type ChildAccountLink,
  type InsertChildAccountLink,
  type ChildProtectionSettings,
  type InsertChildProtectionSettings,
  type CookieInventory,
  type InsertCookieInventory,
  // Enhanced data retention types
  type DataRetentionPolicy,
  type InsertDataRetentionPolicy,
  type DataLifecycleRecord,
  type InsertDataLifecycleRecord,
  type RetentionComplianceAudit,
  type InsertRetentionComplianceAudit,
  type SecureDeletionCertificate,
  type InsertSecureDeletionCertificate,
  // Compliance documents types
  type ComplianceDocument,
  type InsertComplianceDocument,
  type ComplianceDocumentTemplate,
  type InsertComplianceDocumentTemplate,
  type ComplianceDocumentAudit,
  type InsertComplianceDocumentAudit,
  type ComplianceDocumentPublication,
  type InsertComplianceDocumentPublication,
  // PECR Marketing Consent types
  type MarketingConsent,
  type InsertMarketingConsent,
  type CommunicationPreferences,
  type InsertCommunicationPreferences,
  type MarketingCampaigns,
  type InsertMarketingCampaigns,
  type ConsentHistory,
  type InsertConsentHistory,
  type SuppressionList,
  type InsertSuppressionList,
  // GDPR Dashboard types
  type GdprDashboardConfig,
  type InsertGdprDashboardConfig,
  type ComplianceReports,
  type InsertComplianceReports,
  type ExportJobs,
  type InsertExportJobs,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, count, sql, like, or, isNull, avg, ilike, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getUsersByOrganisation(organisationId: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  getUsersWithFilters(filters: {
    role?: string | string[];
    organisationId?: string;
    status?: string;
    search?: string;
  }): Promise<User[]>;

  // Organisation operations
  getOrganisation(id: string): Promise<Organisation | undefined>;
  getOrganisationBySubdomain(subdomain: string): Promise<Organisation | undefined>;
  createOrganisation(organisation: InsertOrganisation): Promise<Organisation>;
  updateOrganisation(id: string, organisation: Partial<InsertOrganisation>): Promise<Organisation>;
  deleteOrganisation(id: string): Promise<void>;
  getAllOrganisations(): Promise<Organisation[]>;
  
  // Organisation billing operations
  getOrganisationWithPlan(id: string): Promise<(Organisation & { plan: Plan | null }) | undefined>;
  updateOrganisationBilling(id: string, billing: {
    planId?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripeSubscriptionItemId?: string;
    billingStatus?: string;
    activeUserCount?: number;
    currentPeriodEnd?: Date;
    lastBillingSync?: Date;
  }): Promise<Organisation>;
  syncOrganisationUsage(id: string): Promise<{
    activeUserCount: number;
    lastSyncTime: Date;
  }>;

  // Course operations
  getCourse(id: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: string, course: Partial<InsertCourse>): Promise<Course>;
  deleteCourse(id: string): Promise<void>;
  getAllCourses(): Promise<Course[]>;
  getCoursesByStatus(status: string): Promise<Course[]>;

  // Course folder operations
  getCourseFolder(id: string): Promise<CourseFolder | undefined>;
  createCourseFolder(folder: InsertCourseFolder): Promise<CourseFolder>;
  updateCourseFolder(id: string, folder: Partial<InsertCourseFolder>): Promise<CourseFolder>;
  deleteCourseFolder(id: string): Promise<void>;
  getAllCourseFolders(): Promise<CourseFolder[]>;
  getCoursesByFolder(folderId: string): Promise<Course[]>;

  // Organisation course folder access operations
  grantOrganisationFolderAccess(access: InsertOrganisationCourseFolder): Promise<OrganisationCourseFolder>;
  revokeOrganisationFolderAccess(organisationId: string, folderId: string): Promise<void>;
  getOrganisationFolderAccess(organisationId: string): Promise<CourseFolder[]>;
  getOrganisationsWithFolderAccess(folderId: string): Promise<Organisation[]>;

  // Assignment operations
  getAssignment(id: string): Promise<Assignment | undefined>;
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  updateAssignment(id: string, assignment: Partial<InsertAssignment>): Promise<Assignment>;
  deleteAssignment(id: string): Promise<void>;
  getAssignmentsByUser(userId: string): Promise<Assignment[]>;
  getAssignmentsByOrganisation(organisationId: string): Promise<Assignment[]>;
  getAssignmentsByCourse(courseId: string): Promise<Assignment[]>;
  getExistingAssignment(courseId: string, userId: string): Promise<Assignment | undefined>;
  findDuplicateAssignments(): Promise<{ courseId: string; userId: string; count: number; duplicateIds: string[] }[]>;
  removeDuplicateAssignments(): Promise<{ duplicatesRemoved: number; duplicateGroups: number }>;
  findDuplicateAssignmentsByOrganisation(organisationId: string): Promise<{ courseId: string; userId: string; count: number; duplicateIds: string[] }[]>;
  removeDuplicateAssignmentsByOrganisation(organisationId: string): Promise<{ duplicatesRemoved: number; duplicateGroups: number }>;

  // Completion operations
  getCompletion(id: string): Promise<Completion | undefined>;
  createCompletion(completion: InsertCompletion): Promise<Completion>;
  updateCompletion(id: string, completion: Partial<InsertCompletion>): Promise<Completion>;
  getCompletionsByUser(userId: string): Promise<Completion[]>;
  getCompletionsByOrganisation(organisationId: string): Promise<Completion[]>;
  getCompletionsByAssignment(assignmentId: string): Promise<Completion[]>;

  // Certificate operations
  getCertificate(id: string): Promise<Certificate | undefined>;
  createCertificate(certificate: InsertCertificate): Promise<Certificate>;
  updateCertificate(id: string, certificate: Partial<InsertCertificate>): Promise<Certificate>;
  getCertificatesByUser(userId: string): Promise<Certificate[]>;
  getCertificatesByOrganisation(organisationId: string): Promise<Certificate[]>;

  // Certificate template operations
  getCertificateTemplate(id: string): Promise<CertificateTemplate | undefined>;
  createCertificateTemplate(template: InsertCertificateTemplate): Promise<CertificateTemplate>;
  updateCertificateTemplate(id: string, template: Partial<InsertCertificateTemplate>): Promise<CertificateTemplate>;
  deleteCertificateTemplate(id: string): Promise<void>;
  getCertificateTemplates(): Promise<CertificateTemplate[]>;
  getDefaultCertificateTemplate(): Promise<CertificateTemplate | undefined>;

  // Organisation settings operations
  getOrganisationSettings(organisationId: string): Promise<OrganisationSettings | undefined>;
  createOrganisationSettings(settings: InsertOrganisationSettings): Promise<OrganisationSettings>;
  updateOrganisationSettings(organisationId: string, settings: Partial<InsertOrganisationSettings>): Promise<OrganisationSettings>;

  // Platform settings operations
  getPlatformSetting(key: string): Promise<PlatformSettings | undefined>;
  setPlatformSetting(key: string, value: string, description?: string): Promise<PlatformSettings>;
  getAllPlatformSettings(): Promise<PlatformSettings[]>;

  // Todo item operations
  getTodoItem(id: string): Promise<TodoItem | undefined>;
  createTodoItem(todoItem: InsertTodoItem): Promise<TodoItem>;
  updateTodoItem(id: string, todoItem: Partial<InsertTodoItem>): Promise<TodoItem>;
  deleteTodoItem(id: string): Promise<void>;
  getTodoItemsByUser(userId: string): Promise<TodoItem[]>;

  // SCORM attempt operations
  getScormAttempt(id: string): Promise<ScormAttempt | undefined>;
  getScormAttemptByAttemptId(attemptId: string): Promise<ScormAttempt | undefined>;
  createScormAttempt(attempt: InsertScormAttempt): Promise<ScormAttempt>;
  updateScormAttempt(attemptId: string, attempt: Partial<InsertScormAttempt>): Promise<ScormAttempt>;
  getScormAttemptsByUser(userId: string): Promise<ScormAttempt[]>;
  getScormAttemptsByAssignment(assignmentId: string): Promise<ScormAttempt[]>;
  getScormAttemptsByOrganisation(organisationId: string): Promise<ScormAttempt[]>;
  getActiveScormAttempt(userId: string, assignmentId: string): Promise<ScormAttempt | undefined>;

  // Analytics operations
  getPlatformStats(): Promise<{
    totalOrganisations: number;
    totalUsers: number;
    totalCourses: number;
    totalCompletions: number;
  }>;
  getCompletionAnalytics(): Promise<any[]>;
  getPopularCoursesThisMonth(): Promise<any[]>;
  getOrganisationStats(organisationId: string): Promise<{
    activeUsers: number;
    adminUsers: number;
    totalUsers: number;
    coursesAssigned: number;
    completedCourses: number;
    averageScore: number;
  }>;
  getCourseAnalytics(courseId: string): Promise<{
    courseId: string;
    totalAssignments: number;
    totalCompletions: number;
    successfulCompletions: number;
    averageScore: number;
    completionRate: number;
    organizationsUsing: number;
    averageTimeToComplete: number;
  }>;

  // Plan operations
  getPlan(id: string): Promise<Plan | undefined>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  updatePlan(id: string, plan: Partial<InsertPlan>): Promise<Plan>;
  deletePlan(id: string): Promise<void>;
  getAllPlans(): Promise<Plan[]>;
  getPlanWithFeatures(id: string): Promise<Plan & { features: PlanFeature[] } | undefined>;

  // Plan feature operations
  getPlanFeature(id: string): Promise<PlanFeature | undefined>;
  createPlanFeature(feature: InsertPlanFeature): Promise<PlanFeature>;
  updatePlanFeature(id: string, feature: Partial<InsertPlanFeature>): Promise<PlanFeature>;
  deletePlanFeature(id: string): Promise<void>;
  getAllPlanFeatures(): Promise<PlanFeature[]>;

  // Plan feature mapping operations
  getPlanFeatureMapping(id: string): Promise<PlanFeatureMapping | undefined>;
  createPlanFeatureMapping(mapping: InsertPlanFeatureMapping): Promise<PlanFeatureMapping>;
  deletePlanFeatureMapping(id: string): Promise<void>;
  getPlanFeatureMappings(planId: string): Promise<PlanFeatureMapping[]>;
  setPlanFeatures(planId: string, featureIds: string[]): Promise<void>;

  // Audit log operations
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(organisationId: string, limit?: number, offset?: number): Promise<AuditLog[]>;
  getAuditLogsByUser(userId: string, limit?: number, offset?: number): Promise<AuditLog[]>;

  // NEW ROBUST EMAIL TEMPLATE OPERATIONS

  // Platform email templates (defaults) operations
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplateByKey(key: string): Promise<EmailTemplate | undefined>;
  getAllEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplatesByCategory(category: string): Promise<EmailTemplate[]>;
  updateEmailTemplate(key: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate>;
  deleteEmailTemplate(key: string): Promise<void>;
  
  // Organization email template overrides operations
  createOrgEmailTemplate(override: InsertOrgEmailTemplate): Promise<OrgEmailTemplate>;
  getOrgEmailTemplate(id: string): Promise<OrgEmailTemplate | undefined>;
  getOrgEmailTemplateByKey(orgId: string, templateKey: string): Promise<OrgEmailTemplate | undefined>;
  getOrgEmailTemplatesByOrg(orgId: string): Promise<OrgEmailTemplate[]>;
  updateOrgEmailTemplate(id: string, override: Partial<InsertOrgEmailTemplate>): Promise<OrgEmailTemplate>;
  upsertOrgEmailTemplate(orgId: string, templateKey: string, override: Partial<InsertOrgEmailTemplate>): Promise<OrgEmailTemplate>;
  deleteOrgEmailTemplate(id: string): Promise<void>;
  disableOrgEmailTemplate(orgId: string, templateKey: string): Promise<void>;
  
  // Comprehensive email template resolution (platform + org overrides)
  getEffectiveEmailTemplate(orgId: string, templateKey: string): Promise<{
    template: EmailTemplate;
    override: OrgEmailTemplate | null;
    effectiveSubject: string;
    effectiveHtml: string;
    effectiveMjml: string;
    effectiveText: string | null;
  } | undefined>;

  // DEPRECATED - OLD EMAIL TEMPLATE OPERATIONS (TO BE REMOVED)
  // createEmailTemplateDefault(template: InsertEmailTemplateDefaults): Promise<EmailTemplateDefaults>;
  // getEmailTemplateDefault(key: string): Promise<EmailTemplateDefaults | undefined>;
  // getAllEmailTemplateDefaults(): Promise<EmailTemplateDefaults[]>;
  // updateEmailTemplateDefault(key: string, template: Partial<InsertEmailTemplateDefaults>): Promise<EmailTemplateDefaults>;
  // deleteEmailTemplateDefault(key: string): Promise<void>;
  // createEmailTemplateOverride(override: InsertEmailTemplateOverrides): Promise<EmailTemplateOverrides>;
  // getEmailTemplateOverride(orgId: string, templateKey: string): Promise<EmailTemplateOverrides | undefined>;
  // getEmailTemplateOverridesByOrg(orgId: string): Promise<EmailTemplateOverrides[]>;
  // updateEmailTemplateOverride(id: string, override: Partial<InsertEmailTemplateOverrides>): Promise<EmailTemplateOverrides>;
  // upsertEmailTemplateOverride(orgId: string, templateKey: string, override: Partial<InsertEmailTemplateOverrides>): Promise<EmailTemplateOverrides>;
  // deleteEmailTemplateOverride(id: string): Promise<void>;
  // disableEmailTemplateOverride(orgId: string, templateKey: string): Promise<void>;

  // System SMTP settings operations (SuperAdmin level)
  getSystemEmailSettings(): Promise<SystemEmailSettings | undefined>;
  createSystemEmailSettings(settings: InsertSystemEmailSettings): Promise<SystemEmailSettings>;
  updateSystemEmailSettings(settings: Partial<InsertSystemEmailSettings>): Promise<SystemEmailSettings>;
  
  // Email logs operations
  createEmailLog(log: InsertEmailLog): Promise<EmailLog>;
  getEmailLogs(filters?: {
    organisationId?: string;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<EmailLog[]>;
  getEmailLogById(id: string): Promise<EmailLog | undefined>;

  // Email orchestrator send operations
  createEmailSend(emailSend: InsertEmailSend): Promise<EmailSend>;
  getEmailSend(id: string): Promise<EmailSend | undefined>;
  getEmailSendByIdempotencyKey(idempotencyKey: string, windowStart?: Date): Promise<EmailSend | undefined>;
  updateEmailSend(id: string, updates: Partial<InsertEmailSend>): Promise<EmailSend>;
  getEmailSends(filters?: {
    organisationId?: string;
    triggerEvent?: string;
    status?: string;
    templateKey?: string;
    toEmail?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<EmailSend[]>;
  getEmailSendsForRetry(maxRetries?: number): Promise<EmailSend[]>;

  // Email settings lock operations
  createEmailSettingsLock(lock: InsertEmailSettingsLock): Promise<EmailSettingsLock>;
  getEmailSettingsLock(lockType: string, resourceId: string): Promise<EmailSettingsLock | undefined>;
  deleteEmailSettingsLock(id: string): Promise<void>;
  cleanupExpiredEmailLocks(): Promise<number>;

  // Email provider config operations
  createEmailProviderConfig(config: InsertEmailProviderConfigs): Promise<EmailProviderConfigs>;
  getEmailProviderConfig(id: string): Promise<EmailProviderConfigs | undefined>;
  getEmailProviderConfigByOrg(orgId: string): Promise<EmailProviderConfigs | undefined>;
  updateEmailProviderConfig(id: string, config: Partial<InsertEmailProviderConfigs>): Promise<EmailProviderConfigs>;
  upsertEmailProviderConfig(orgId: string, config: Partial<InsertEmailProviderConfigs>): Promise<EmailProviderConfigs>;
  deleteEmailProviderConfig(id: string): Promise<void>;

  // Billing distributed lock operations - critical for enterprise-grade concurrency protection
  acquireBillingLock(lockType: string, resourceId: string, lockedBy: string, options?: {
    lockReason?: string;
    timeoutMs?: number;
    correlationId?: string;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; lock?: BillingLock; waitTime?: number; queuePosition?: number }>;
  renewBillingLock(lockId: string, additionalTimeMs?: number): Promise<{ success: boolean; lock?: BillingLock }>;
  releaseBillingLock(lockId: string): Promise<void>;
  getBillingLock(lockType: string, resourceId: string): Promise<BillingLock | undefined>;
  getBillingLockById(lockId: string): Promise<BillingLock | undefined>;
  cleanupExpiredBillingLocks(): Promise<number>;
  getBillingLockQueue(lockType: string, resourceId: string): Promise<BillingLock[]>;
  getActiveBillingLocks(filters?: { 
    lockType?: string; 
    resourceId?: string; 
    lockedBy?: string;
    correlationId?: string; 
  }): Promise<BillingLock[]>;

  // Support ticket operations
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  getSupportTicket(id: string): Promise<SupportTicket | undefined>;
  getSupportTickets(filters?: {
    organisationId?: string;
    createdBy?: string;
    assignedTo?: string;
    status?: string;
    priority?: string;
    category?: string;
    search?: string; // Search by ticket number or title
    limit?: number;
    offset?: number;
  }): Promise<SupportTicket[]>;
  updateSupportTicket(id: string, ticket: Partial<InsertSupportTicket>): Promise<SupportTicket>;
  deleteSupportTicket(id: string): Promise<void>;
  getUnreadTicketCount(filters?: { organisationId?: string; assignedTo?: string; createdBy?: string }): Promise<number>;

  // Support ticket response operations
  createSupportTicketResponse(response: InsertSupportTicketResponse): Promise<SupportTicketResponse>;
  getSupportTicketResponses(ticketId: string): Promise<SupportTicketResponse[]>;
  deleteSupportTicketResponse(id: string): Promise<void>;

  // Feature checking and admin validation helpers
  hasFeature(organisationId: string, featureKey: string): Promise<boolean>;
  countAdminsByOrg(organisationId: string): Promise<number>;
  enforceAdminLimit(organisationId: string): Promise<{ allowed: boolean; error?: { code: string; featureKey: string; maxAllowed: number } }>;

  // Webhook event operations for persistent deduplication
  isWebhookEventProcessed(stripeEventId: string): Promise<boolean>;
  recordWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent>;
  cleanupOldWebhookEvents(olderThanDays: number): Promise<number>; // Returns number of deleted events

  // GDPR operations (UK GDPR and Data Protection Act 2018 compliance)
  // Consent records
  createConsentRecord(consentRecord: InsertConsentRecord): Promise<ConsentRecord>;
  getConsentRecord(id: string): Promise<ConsentRecord | undefined>;
  getConsentRecordsByUser(userId: string): Promise<ConsentRecord[]>;
  getConsentRecordsByOrganisation(organisationId: string): Promise<ConsentRecord[]>;
  updateConsentRecord(id: string, consentRecord: Partial<InsertConsentRecord>): Promise<ConsentRecord>;
  deleteConsentRecord(id: string): Promise<void>;
  
  // Privacy settings
  createPrivacySettings(privacySettings: InsertPrivacySettings): Promise<PrivacySettings>;
  getPrivacySettings(id: string): Promise<PrivacySettings | undefined>;
  getPrivacySettingsByOrganisation(organisationId: string): Promise<PrivacySettings | undefined>;
  updatePrivacySettings(id: string, privacySettings: Partial<InsertPrivacySettings>): Promise<PrivacySettings>;
  upsertPrivacySettings(organisationId: string, privacySettings: Partial<InsertPrivacySettings>): Promise<PrivacySettings>;
  deletePrivacySettings(id: string): Promise<void>;
  
  // User rights (DSAR)
  createUserRightRequest(userRightRequest: InsertUserRightRequest): Promise<UserRightRequest>;
  getUserRightRequest(id: string): Promise<UserRightRequest | undefined>;
  getUserRightRequestsByUser(userId: string): Promise<UserRightRequest[]>;
  getUserRightRequestsByOrganisation(organisationId: string): Promise<UserRightRequest[]>;
  updateUserRightRequest(id: string, userRightRequest: Partial<InsertUserRightRequest>): Promise<UserRightRequest>;
  deleteUserRightRequest(id: string): Promise<void>;
  
  // Processing activities (RoPA)
  createProcessingActivity(processingActivity: InsertProcessingActivity): Promise<ProcessingActivity>;
  getProcessingActivity(id: string): Promise<ProcessingActivity | undefined>;
  getProcessingActivitiesByOrganisation(organisationId: string): Promise<ProcessingActivity[]>;
  updateProcessingActivity(id: string, processingActivity: Partial<InsertProcessingActivity>): Promise<ProcessingActivity>;
  deleteProcessingActivity(id: string): Promise<void>;
  
  // Data breaches
  createDataBreach(dataBreach: InsertDataBreach): Promise<DataBreach>;
  getDataBreach(id: string): Promise<DataBreach | undefined>;
  getDataBreachesByOrganisation(organisationId: string): Promise<DataBreach[]>;
  updateDataBreach(id: string, dataBreach: Partial<InsertDataBreach>): Promise<DataBreach>;
  deleteDataBreach(id: string): Promise<void>;
  getDataBreachesByStatus(organisationId: string, status: string): Promise<DataBreach[]>;
  getOverdueDataBreaches(organisationId: string): Promise<DataBreach[]>;
  
  // Retention rules
  createRetentionRule(retentionRule: InsertRetentionRule): Promise<RetentionRule>;
  getRetentionRule(id: string): Promise<RetentionRule | undefined>;
  getRetentionRulesByOrganisation(organisationId: string): Promise<RetentionRule[]>;
  updateRetentionRule(id: string, retentionRule: Partial<InsertRetentionRule>): Promise<RetentionRule>;
  deleteRetentionRule(id: string): Promise<void>;
  getRetentionRulesByDataType(organisationId: string, dataType: string): Promise<RetentionRule[]>;
  
  // Retention schedules
  createRetentionSchedule(retentionSchedule: InsertRetentionSchedule): Promise<RetentionSchedule>;
  getRetentionSchedule(id: string): Promise<RetentionSchedule | undefined>;
  getRetentionSchedulesByOrganisation(organisationId: string): Promise<RetentionSchedule[]>;
  getRetentionSchedulesByUser(userId: string): Promise<RetentionSchedule[]>;
  updateRetentionSchedule(id: string, retentionSchedule: Partial<InsertRetentionSchedule>): Promise<RetentionSchedule>;
  deleteRetentionSchedule(id: string): Promise<void>;
  getOverdueRetentionSchedules(organisationId: string): Promise<RetentionSchedule[]>;
  processRetentionSchedule(id: string): Promise<RetentionSchedule>;
  
  // GDPR audit logs
  createGdprAuditLog(gdprAuditLog: InsertGdprAuditLog): Promise<GdprAuditLog>;
  getGdprAuditLog(id: string): Promise<GdprAuditLog | undefined>;
  getGdprAuditLogsByOrganisation(organisationId: string, filters?: {
    userId?: string;
    adminId?: string;
    action?: string;
    resource?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<GdprAuditLog[]>;
  getGdprAuditLogsByUser(userId: string): Promise<GdprAuditLog[]>;
  cleanupOldGdprAuditLogs(organisationId: string, olderThanDays: number): Promise<number>;
  
  // Age verification
  createAgeVerification(ageVerification: InsertAgeVerification): Promise<AgeVerification>;
  getAgeVerification(id: string): Promise<AgeVerification | undefined>;
  getAgeVerificationByUser(userId: string): Promise<AgeVerification | undefined>;
  getAgeVerificationsByOrganisation(organisationId: string): Promise<AgeVerification[]>;
  updateAgeVerification(id: string, ageVerification: Partial<InsertAgeVerification>): Promise<AgeVerification>;
  upsertAgeVerification(userId: string, ageVerification: Partial<InsertAgeVerification>): Promise<AgeVerification>;
  deleteAgeVerification(id: string): Promise<void>;
  
  // UK GDPR Article 8 - Parental Consent Records
  createParentalConsentRecord(record: InsertParentalConsentRecord): Promise<ParentalConsentRecord>;
  getParentalConsentRecord(id: string): Promise<ParentalConsentRecord | undefined>;
  getParentalConsentRecordByChild(childUserId: string): Promise<ParentalConsentRecord | undefined>;
  getParentalConsentRecordsByParent(parentEmail: string): Promise<ParentalConsentRecord[]>;
  getParentalConsentRecordsByOrganisation(organisationId: string): Promise<ParentalConsentRecord[]>;
  updateParentalConsentRecord(id: string, record: Partial<InsertParentalConsentRecord>): Promise<ParentalConsentRecord>;
  deleteParentalConsentRecord(id: string): Promise<void>;
  getParentalConsentRecordsByStatus(organisationId: string, status: string): Promise<ParentalConsentRecord[]>;
  getExpiringParentalConsents(organisationId: string, daysFromNow: number): Promise<ParentalConsentRecord[]>;
  updateConsentStatus(id: string, status: string, adminId?: string): Promise<ParentalConsentRecord>;
  
  // Family Accounts
  createFamilyAccount(account: InsertFamilyAccount): Promise<FamilyAccount>;
  getFamilyAccount(id: string): Promise<FamilyAccount | undefined>;
  getFamilyAccountByParent(parentUserId: string): Promise<FamilyAccount | undefined>;
  getFamilyAccountByEmail(email: string): Promise<FamilyAccount | undefined>;
  getFamilyAccountsByOrganisation(organisationId: string): Promise<FamilyAccount[]>;
  updateFamilyAccount(id: string, account: Partial<InsertFamilyAccount>): Promise<FamilyAccount>;
  deleteFamilyAccount(id: string): Promise<void>;
  getFamilyAccountsByStatus(organisationId: string, status: string): Promise<FamilyAccount[]>;
  activateFamilyAccount(id: string, activatedBy: string): Promise<FamilyAccount>;
  suspendFamilyAccount(id: string, reason: string, suspendedBy: string): Promise<FamilyAccount>;
  
  // Child Account Links
  createChildAccountLink(link: InsertChildAccountLink): Promise<ChildAccountLink>;
  getChildAccountLink(id: string): Promise<ChildAccountLink | undefined>;
  getChildAccountLinkByChild(childUserId: string): Promise<ChildAccountLink | undefined>;
  getChildAccountLinksByFamily(familyAccountId: string): Promise<ChildAccountLink[]>;
  getChildAccountLinksByOrganisation(organisationId: string): Promise<ChildAccountLink[]>;
  updateChildAccountLink(id: string, link: Partial<InsertChildAccountLink>): Promise<ChildAccountLink>;
  deleteChildAccountLink(id: string): Promise<void>;
  getChildAccountLinksByStatus(organisationId: string, status: string): Promise<ChildAccountLink[]>;
  getChildrenTransitioningToAdult(organisationId: string, daysFromNow: number): Promise<ChildAccountLink[]>;
  transitionChildToAdult(childUserId: string, transitionedBy: string): Promise<void>;
  
  // Child Protection Settings
  createChildProtectionSettings(settings: InsertChildProtectionSettings): Promise<ChildProtectionSettings>;
  getChildProtectionSettings(id: string): Promise<ChildProtectionSettings | undefined>;
  getChildProtectionSettingsByOrganisation(organisationId: string): Promise<ChildProtectionSettings | undefined>;
  updateChildProtectionSettings(id: string, settings: Partial<InsertChildProtectionSettings>): Promise<ChildProtectionSettings>;
  deleteChildProtectionSettings(id: string): Promise<void>;
  upsertChildProtectionSettings(organisationId: string, settings: Partial<InsertChildProtectionSettings>): Promise<ChildProtectionSettings>;
  
  // Cookie inventory
  createCookieInventory(cookieInventory: InsertCookieInventory): Promise<CookieInventory>;
  getCookieInventory(id: string): Promise<CookieInventory | undefined>;
  getCookieInventoriesByOrganisation(organisationId: string): Promise<CookieInventory[]>;
  updateCookieInventory(id: string, cookieInventory: Partial<InsertCookieInventory>): Promise<CookieInventory>;
  deleteCookieInventory(id: string): Promise<void>;
  getCookieInventoriesByCategory(organisationId: string, category: string): Promise<CookieInventory[]>;

  // Enhanced Data Retention Policies - comprehensive GDPR Article 5(e) compliance
  createDataRetentionPolicy(policy: InsertDataRetentionPolicy): Promise<DataRetentionPolicy>;
  getDataRetentionPolicy(id: string): Promise<DataRetentionPolicy | undefined>;
  getDataRetentionPoliciesByOrganisation(organisationId: string): Promise<DataRetentionPolicy[]>;
  getDataRetentionPoliciesByDataType(organisationId: string, dataType: string): Promise<DataRetentionPolicy[]>;
  updateDataRetentionPolicy(id: string, policy: Partial<InsertDataRetentionPolicy>): Promise<DataRetentionPolicy>;
  deleteDataRetentionPolicy(id: string): Promise<void>;
  getEnabledDataRetentionPolicies(organisationId: string): Promise<DataRetentionPolicy[]>;
  getDataRetentionPolicyByPriority(organisationId: string, dataType: string): Promise<DataRetentionPolicy | undefined>;

  // Compliance Documents operations - auto-generated legal documents for GDPR regulatory compliance
  // Document management
  createComplianceDocument(document: InsertComplianceDocument): Promise<ComplianceDocument>;
  getComplianceDocument(id: string): Promise<ComplianceDocument | undefined>;
  getComplianceDocumentsByOrganisation(organisationId: string): Promise<ComplianceDocument[]>;
  getComplianceDocumentsByType(organisationId: string, documentType: string): Promise<ComplianceDocument[]>;
  getComplianceDocumentsByStatus(organisationId: string, status: string): Promise<ComplianceDocument[]>;
  getCurrentVersionComplianceDocument(organisationId: string, documentType: string): Promise<ComplianceDocument | undefined>;
  updateComplianceDocument(id: string, document: Partial<InsertComplianceDocument>): Promise<ComplianceDocument>;
  deleteComplianceDocument(id: string): Promise<void>;
  archiveComplianceDocument(id: string): Promise<ComplianceDocument>;
  publishComplianceDocument(id: string, publishedBy: string): Promise<ComplianceDocument>;
  supersederComplianceDocument(oldDocumentId: string, newDocumentId: string): Promise<void>;
  getDocumentsRequiringRegeneration(organisationId: string): Promise<ComplianceDocument[]>;
  markDocumentForRegeneration(id: string): Promise<ComplianceDocument>;

  // Document templates
  createComplianceDocumentTemplate(template: InsertComplianceDocumentTemplate): Promise<ComplianceDocumentTemplate>;
  getComplianceDocumentTemplate(id: string): Promise<ComplianceDocumentTemplate | undefined>;
  getComplianceDocumentTemplatesByType(documentType: string): Promise<ComplianceDocumentTemplate[]>;
  getDefaultComplianceDocumentTemplate(documentType: string): Promise<ComplianceDocumentTemplate | undefined>;
  getActiveComplianceDocumentTemplates(): Promise<ComplianceDocumentTemplate[]>;
  updateComplianceDocumentTemplate(id: string, template: Partial<InsertComplianceDocumentTemplate>): Promise<ComplianceDocumentTemplate>;
  deleteComplianceDocumentTemplate(id: string): Promise<void>;
  incrementTemplateUsage(id: string): Promise<void>;

  // Document audit trail
  createComplianceDocumentAudit(audit: InsertComplianceDocumentAudit): Promise<ComplianceDocumentAudit>;
  getComplianceDocumentAudit(id: string): Promise<ComplianceDocumentAudit | undefined>;
  getComplianceDocumentAuditsByDocument(documentId: string): Promise<ComplianceDocumentAudit[]>;
  getComplianceDocumentAuditsByOrganisation(organisationId: string, filters?: {
    documentId?: string;
    action?: string;
    actionBy?: string;
    legalReviewRequired?: boolean;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ComplianceDocumentAudit[]>;
  getComplianceDocumentAuditsRequiringLegalReview(organisationId: string): Promise<ComplianceDocumentAudit[]>;

  // Document publications
  createComplianceDocumentPublication(publication: InsertComplianceDocumentPublication): Promise<ComplianceDocumentPublication>;
  getComplianceDocumentPublication(id: string): Promise<ComplianceDocumentPublication | undefined>;
  getComplianceDocumentPublicationByDocument(documentId: string): Promise<ComplianceDocumentPublication | undefined>;
  getComplianceDocumentPublicationByUrl(publicUrl: string): Promise<ComplianceDocumentPublication | undefined>;
  getPublishedComplianceDocumentsByOrganisation(organisationId: string): Promise<ComplianceDocumentPublication[]>;
  updateComplianceDocumentPublication(id: string, publication: Partial<InsertComplianceDocumentPublication>): Promise<ComplianceDocumentPublication>;
  deleteComplianceDocumentPublication(id: string): Promise<void>;
  incrementPublicationViews(id: string): Promise<void>;
  incrementPublicationDownloads(id: string): Promise<void>;
  getPublicComplianceDocument(publicUrl: string): Promise<{ document: ComplianceDocument; publication: ComplianceDocumentPublication } | undefined>;

  // International Transfers operations (GDPR Chapter V Articles 44-49)
  // International transfers
  createInternationalTransfer(transfer: InsertInternationalTransfer): Promise<InternationalTransfer>;
  getInternationalTransfer(id: string): Promise<InternationalTransfer | undefined>;
  getInternationalTransfersByOrganisation(organisationId: string): Promise<InternationalTransfer[]>;
  getInternationalTransfersByDestinationCountry(organisationId: string, countryCode: string): Promise<InternationalTransfer[]>;
  getInternationalTransfersByRiskLevel(organisationId: string, riskLevel: string): Promise<InternationalTransfer[]>;
  getInternationalTransfersByStatus(organisationId: string, status: string): Promise<InternationalTransfer[]>;
  updateInternationalTransfer(id: string, transfer: Partial<InsertInternationalTransfer>): Promise<InternationalTransfer>;
  deleteInternationalTransfer(id: string): Promise<void>;
  getOverdueTransferReviews(organisationId: string): Promise<InternationalTransfer[]>;
  getTransfersByMechanism(organisationId: string, mechanism: string): Promise<InternationalTransfer[]>;
  
  // Transfer Impact Assessments (TIA)
  createTransferImpactAssessment(tia: InsertTransferImpactAssessment): Promise<TransferImpactAssessment>;
  getTransferImpactAssessment(id: string): Promise<TransferImpactAssessment | undefined>;
  getTransferImpactAssessmentsByOrganisation(organisationId: string): Promise<TransferImpactAssessment[]>;
  getTransferImpactAssessmentsByStatus(organisationId: string, status: string): Promise<TransferImpactAssessment[]>;
  getTransferImpactAssessmentsByDestinationCountry(organisationId: string, countryCode: string): Promise<TransferImpactAssessment[]>;
  updateTransferImpactAssessment(id: string, tia: Partial<InsertTransferImpactAssessment>): Promise<TransferImpactAssessment>;
  deleteTransferImpactAssessment(id: string): Promise<void>;
  getOverdueTiaReviews(organisationId: string): Promise<TransferImpactAssessment[]>;
  getTiaByReference(organisationId: string, reference: string): Promise<TransferImpactAssessment | undefined>;
  
  // Transfer Mechanisms
  createTransferMechanism(mechanism: InsertTransferMechanism): Promise<TransferMechanism>;
  getTransferMechanism(id: string): Promise<TransferMechanism | undefined>;
  getTransferMechanismsByOrganisation(organisationId: string): Promise<TransferMechanism[]>;
  getTransferMechanismsByType(organisationId: string, mechanismType: string): Promise<TransferMechanism[]>;
  getActiveTransferMechanisms(organisationId: string): Promise<TransferMechanism[]>;
  updateTransferMechanism(id: string, mechanism: Partial<InsertTransferMechanism>): Promise<TransferMechanism>;
  deleteTransferMechanism(id: string): Promise<void>;
  getExpiringTransferMechanisms(organisationId: string, daysAhead?: number): Promise<TransferMechanism[]>;
  getMechanismsByCountry(organisationId: string, countryCode: string): Promise<TransferMechanism[]>;
  
  // Standard Contractual Clauses (SCCs)
  createStandardContractualClauses(scc: InsertStandardContractualClauses): Promise<StandardContractualClauses>;
  getStandardContractualClauses(id: string): Promise<StandardContractualClauses | undefined>;
  getStandardContractualClausesByOrganisation(organisationId: string): Promise<StandardContractualClauses[]>;
  getStandardContractualClausesByTransferMechanism(mechanismId: string): Promise<StandardContractualClauses[]>;
  getStandardContractualClausesByType(organisationId: string, sccType: string): Promise<StandardContractualClauses[]>;
  getActiveStandardContractualClauses(organisationId: string): Promise<StandardContractualClauses[]>;
  updateStandardContractualClauses(id: string, scc: Partial<InsertStandardContractualClauses>): Promise<StandardContractualClauses>;
  deleteStandardContractualClauses(id: string): Promise<void>;
  getSccByDataImporter(organisationId: string, importerName: string): Promise<StandardContractualClauses[]>;
  getOverdueSccReviews(organisationId: string): Promise<StandardContractualClauses[]>;
  
  // Adequacy Decisions (cached from ICO/EU)
  getAdequacyDecision(id: string): Promise<AdequacyDecision | undefined>;
  getAdequacyDecisionByCountry(countryCode: string): Promise<AdequacyDecision | undefined>;
  getAllAdequacyDecisions(): Promise<AdequacyDecision[]>;
  getAdequateCountries(): Promise<AdequacyDecision[]>;
  getInadequateCountries(): Promise<AdequacyDecision[]>;
  createAdequacyDecision(decision: InsertAdequacyDecision): Promise<AdequacyDecision>;
  updateAdequacyDecision(id: string, decision: Partial<InsertAdequacyDecision>): Promise<AdequacyDecision>;
  deleteAdequacyDecision(id: string): Promise<void>;
  getAdequacyDecisionsByRiskLevel(riskLevel: string): Promise<AdequacyDecision[]>;
  syncAdequacyDecisions(): Promise<{ updated: number; errors: string[] }>;
  
  // International transfers analytics and compliance
  getTransferAnalytics(organisationId: string): Promise<{
    totalTransfers: number;
    transfersByCountry: { country: string; count: number }[];
    transfersByRiskLevel: { riskLevel: string; count: number }[];
    transfersByMechanism: { mechanism: string; count: number }[];
    pendingTias: number;
    overdueReviews: number;
    complianceScore: number;
  }>;
  calculateTransferRisk(destinationCountry: string, dataCategories: string[], mechanism: string): Promise<{
    riskLevel: string;
    riskScore: number;
    riskFactors: string[];
    recommendations: string[];
  }>;
  validateTransferCompliance(transferId: string): Promise<{
    isCompliant: boolean;
    issues: string[];
    recommendations: string[];
    requiredActions: string[];
  }>;

  // Data Lifecycle Management - automated deletion tracking and processing
  createDataLifecycleRecord(record: InsertDataLifecycleRecord): Promise<DataLifecycleRecord>;
  getDataLifecycleRecord(id: string): Promise<DataLifecycleRecord | undefined>;
  getDataLifecycleRecordsByUser(userId: string): Promise<DataLifecycleRecord[]>;
  getDataLifecycleRecordsByOrganisation(organisationId: string): Promise<DataLifecycleRecord[]>;
  getDataLifecycleRecordsByStatus(organisationId: string, status: string): Promise<DataLifecycleRecord[]>;
  getDataLifecycleRecordsByResource(resourceTable: string, resourceId: string): Promise<DataLifecycleRecord | undefined>;
  updateDataLifecycleRecord(id: string, record: Partial<InsertDataLifecycleRecord>): Promise<DataLifecycleRecord>;
  deleteDataLifecycleRecord(id: string): Promise<void>;
  getDataEligibleForRetention(organisationId: string): Promise<DataLifecycleRecord[]>;
  getDataEligibleForSoftDelete(organisationId: string): Promise<DataLifecycleRecord[]>;
  getDataEligibleForSecureErase(organisationId: string): Promise<DataLifecycleRecord[]>;
  scheduleDataForSoftDelete(recordIds: string[]): Promise<number>;
  scheduleDataForSecureErase(recordIds: string[]): Promise<number>;
  processDataLifecycleRecords(organisationId: string, batchSize?: number): Promise<{
    processed: number;
    softDeleted: number;
    securelyErased: number;
    errors: number;
  }>;

  // Retention Compliance Auditing - tracking adherence to retention policies
  createRetentionComplianceAudit(audit: InsertRetentionComplianceAudit): Promise<RetentionComplianceAudit>;
  getRetentionComplianceAudit(id: string): Promise<RetentionComplianceAudit | undefined>;
  getRetentionComplianceAuditsByOrganisation(organisationId: string): Promise<RetentionComplianceAudit[]>;
  getRetentionComplianceAuditsByPolicy(policyId: string): Promise<RetentionComplianceAudit[]>;
  getLatestRetentionComplianceAudit(organisationId: string, policyId: string): Promise<RetentionComplianceAudit | undefined>;
  updateRetentionComplianceAudit(id: string, audit: Partial<InsertRetentionComplianceAudit>): Promise<RetentionComplianceAudit>;
  deleteRetentionComplianceAudit(id: string): Promise<void>;
  getRetentionComplianceReport(organisationId: string): Promise<{
    overallCompliance: number;
    policiesAudited: number;
    highRiskPolicies: number;
    overdueRecords: number;
    lastAuditDate: Date | null;
  }>;

  // Secure Deletion Certificates - proof of secure data deletion for compliance
  createSecureDeletionCertificate(certificate: InsertSecureDeletionCertificate): Promise<SecureDeletionCertificate>;
  getSecureDeletionCertificate(id: string): Promise<SecureDeletionCertificate | undefined>;
  getSecureDeletionCertificateByNumber(certificateNumber: string): Promise<SecureDeletionCertificate | undefined>;
  getSecureDeletionCertificatesByOrganisation(organisationId: string): Promise<SecureDeletionCertificate[]>;
  getSecureDeletionCertificatesByUser(userId: string): Promise<SecureDeletionCertificate[]>;
  updateSecureDeletionCertificate(id: string, certificate: Partial<InsertSecureDeletionCertificate>): Promise<SecureDeletionCertificate>;
  deleteSecureDeletionCertificate(id: string): Promise<void>;
  generateSecureDeletionCertificate(organisationId: string, deletionDetails: {
    userId?: string;
    dataTypes: string[];
    recordCount: number;
    deletionMethod: string;
    legalBasis: string;
    deletionReason: string;
    requestReference?: string;
  }): Promise<SecureDeletionCertificate>;

  // ===== PECR MARKETING CONSENT OPERATIONS =====
  
  // Marketing consent operations
  getMarketingConsent(id: string): Promise<MarketingConsent | undefined>;
  getMarketingConsentByUserAndType(userId: string, organisationId: string, consentType: string): Promise<MarketingConsent | undefined>;
  getMarketingConsentsByUser(userId: string, organisationId?: string): Promise<MarketingConsent[]>;
  getMarketingConsentsByOrganisation(organisationId: string): Promise<MarketingConsent[]>;
  createMarketingConsent(consent: InsertMarketingConsent): Promise<MarketingConsent>;
  updateMarketingConsent(id: string, consent: Partial<InsertMarketingConsent>): Promise<MarketingConsent>;
  withdrawMarketingConsent(id: string, withdrawalReason?: string): Promise<MarketingConsent>;
  deleteMarketingConsent(id: string): Promise<void>;
  verifyMarketingConsent(userId: string, organisationId: string, consentType: string): Promise<boolean>;
  getMarketingConsentsRequiringRenewal(daysBeforeExpiry: number): Promise<MarketingConsent[]>;
  bulkWithdrawMarketingConsent(userIds: string[], organisationId: string, consentType: string, reason?: string): Promise<number>;

  // Communication preferences operations
  getCommunicationPreferences(id: string): Promise<CommunicationPreferences | undefined>;
  getCommunicationPreferencesByUser(userId: string, organisationId: string): Promise<CommunicationPreferences[]>;
  getCommunicationPreferencesByUserAndType(userId: string, organisationId: string, communicationType: string, channel: string): Promise<CommunicationPreferences | undefined>;
  createCommunicationPreferences(preferences: InsertCommunicationPreferences): Promise<CommunicationPreferences>;
  updateCommunicationPreferences(id: string, preferences: Partial<InsertCommunicationPreferences>): Promise<CommunicationPreferences>;
  deleteCommunicationPreferences(id: string): Promise<void>;
  bulkUpdateCommunicationPreferences(userId: string, organisationId: string, preferences: Partial<InsertCommunicationPreferences>[]): Promise<CommunicationPreferences[]>;
  checkCommunicationAllowed(userId: string, organisationId: string, communicationType: string, channel: string): Promise<boolean>;
  getGlobalOptOuts(organisationId: string): Promise<CommunicationPreferences[]>;

  // Marketing campaigns operations
  getMarketingCampaign(id: string): Promise<MarketingCampaigns | undefined>;
  getMarketingCampaignsByOrganisation(organisationId: string, status?: string): Promise<MarketingCampaigns[]>;
  createMarketingCampaign(campaign: InsertMarketingCampaigns): Promise<MarketingCampaigns>;
  updateMarketingCampaign(id: string, campaign: Partial<InsertMarketingCampaigns>): Promise<MarketingCampaigns>;
  deleteMarketingCampaign(id: string): Promise<void>;
  getScheduledCampaigns(cutoffDate: Date): Promise<MarketingCampaigns[]>;
  getCampaignRecipients(campaignId: string): Promise<{ userId: string; email: string; consentStatus: string; }[]>;
  validateCampaignCompliance(campaignId: string): Promise<{ isCompliant: boolean; issues: string[]; recipientCount: number; }>;
  updateCampaignStats(campaignId: string, stats: { sentCount?: number; deliveredCount?: number; openedCount?: number; clickedCount?: number; unsubscribedCount?: number; bounceCount?: number; }): Promise<MarketingCampaigns>;
  
  // Consent history operations
  getConsentHistory(id: string): Promise<ConsentHistory | undefined>;
  getConsentHistoryByUser(userId: string, organisationId?: string): Promise<ConsentHistory[]>;
  getConsentHistoryByConsentId(marketingConsentId: string): Promise<ConsentHistory[]>;
  createConsentHistoryEntry(history: InsertConsentHistory): Promise<ConsentHistory>;
  getConsentAuditTrail(userId: string, organisationId: string, consentType?: string): Promise<ConsentHistory[]>;
  getConsentHistoryReport(organisationId: string, startDate: Date, endDate: Date): Promise<{ 
    totalGrants: number; 
    totalWithdrawals: number; 
    totalModifications: number; 
    consentsByType: { [key: string]: number };
    dailyActivity: { date: string; grants: number; withdrawals: number; }[];
  }>;

  // Suppression list operations
  getSuppressionListEntry(id: string): Promise<SuppressionList | undefined>;
  getSuppressionListByOrganisation(organisationId: string): Promise<SuppressionList[]>;
  getSuppressionListByEmail(email: string, organisationId?: string): Promise<SuppressionList[]>;
  getSuppressionListByPhone(phone: string, organisationId?: string): Promise<SuppressionList[]>;
  createSuppressionListEntry(entry: InsertSuppressionList): Promise<SuppressionList>;
  updateSuppressionListEntry(id: string, entry: Partial<InsertSuppressionList>): Promise<SuppressionList>;
  deleteSuppressionListEntry(id: string): Promise<void>;
  isEmailSuppressed(email: string, organisationId: string, channel: string): Promise<boolean>;
  isPhoneSuppressed(phone: string, organisationId: string, channel: string): Promise<boolean>;
  addToSuppressionList(contact: { email?: string; phone?: string; }, organisationId: string, reason: string, channels: string[]): Promise<SuppressionList>;
  bulkAddToSuppressionList(contacts: { email?: string; phone?: string; }[], organisationId: string, reason: string, channels: string[]): Promise<number>;
  getGlobalSuppressions(): Promise<SuppressionList[]>;

  // GDPR Dashboard operations
  // Dashboard configuration
  getGdprDashboardConfig(organisationId: string): Promise<GdprDashboardConfig | undefined>;
  createGdprDashboardConfig(config: InsertGdprDashboardConfig): Promise<GdprDashboardConfig>;
  updateGdprDashboardConfig(organisationId: string, config: Partial<InsertGdprDashboardConfig>): Promise<GdprDashboardConfig>;
  
  // Dashboard metrics aggregation
  getDashboardComplianceMetrics(organisationId: string, dateRange?: { start: Date; end: Date }): Promise<{
    consentMetrics: {
      totalConsents: number;
      consentRate: number;
      withdrawalRate: number;
      consentsByType: { [key: string]: number };
      recentActivity: { date: string; grants: number; withdrawals: number; }[];
    };
    userRightsMetrics: {
      totalRequests: number;
      pendingRequests: number;
      overdueRequests: number;
      avgResponseTime: number;
      requestsByType: { [key: string]: number };
      complianceRate: number;
    };
    dataRetentionMetrics: {
      totalPolicies: number;
      recordsProcessed: number;
      recordsPendingDeletion: number;
      retentionCompliance: number;
      upcomingDeletions: number;
    };
    breachMetrics: {
      totalBreaches: number;
      activeBreaches: number;
      overdueNotifications: number;
      avgResponseTime: number;
      breachesBySeverity: { [key: string]: number };
    };
    transferMetrics: {
      totalTransfers: number;
      activeTransfers: number;
      overdueReviews: number;
      transfersByRisk: { [key: string]: number };
      complianceRate: number;
    };
    overallComplianceScore: number;
    complianceStatus: 'compliant' | 'attention_required' | 'non_compliant' | 'unknown';
    criticalAlerts: Array<{
      type: string;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      dueDate?: Date;
    }>;
  }>;
  
  // Compliance reports
  createComplianceReport(report: InsertComplianceReports): Promise<ComplianceReports>;
  getComplianceReport(id: string): Promise<ComplianceReports | undefined>;
  getComplianceReportsByOrganisation(organisationId: string, limit?: number): Promise<ComplianceReports[]>;
  updateComplianceReport(id: string, report: Partial<InsertComplianceReports>): Promise<ComplianceReports>;
  deleteComplianceReport(id: string): Promise<void>;
  
  // Export jobs
  createExportJob(job: InsertExportJobs): Promise<ExportJobs>;
  getExportJob(id: string): Promise<ExportJobs | undefined>;
  getExportJobsByOrganisation(organisationId: string, status?: string): Promise<ExportJobs[]>;
  updateExportJob(id: string, job: Partial<InsertExportJobs>): Promise<ExportJobs>;
  deleteExportJob(id: string): Promise<void>;
  getActiveExportJobs(): Promise<ExportJobs[]>; // For background processing
  
  // Compliance analytics for dashboard
  getConsentTrends(organisationId: string, days?: number): Promise<Array<{
    date: string;
    totalConsents: number;
    grantedConsents: number;
    withdrawnConsents: number;
    consentRate: number;
  }>>;
  
  getUserRightsTrends(organisationId: string, days?: number): Promise<Array<{
    date: string;
    totalRequests: number;
    completedRequests: number;
    responseTime: number;
  }>>;
  
  getBreachResponseMetrics(organisationId: string): Promise<{
    totalBreaches: number;
    avgNotificationTime: number;
    icoCompliance: number;
    subjectNotificationCompliance: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getUsersByOrganisation(organisationId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.organisationId, organisationId));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.firstName));
  }

  async getUsersWithFilters(filters: {
    role?: string | string[];
    organisationId?: string;
    status?: string;
    search?: string;
  }): Promise<User[]> {
    const conditions = [];
    if (filters.role) {
      if (Array.isArray(filters.role)) {
        conditions.push(or(...filters.role.map(role => eq(users.role, role as any))));
      } else {
        conditions.push(eq(users.role, filters.role as any));
      }
    }
    if (filters.organisationId) conditions.push(eq(users.organisationId, filters.organisationId));
    if (filters.status) conditions.push(eq(users.status, filters.status as any));
    if (filters.search) {
      conditions.push(
        or(
          like(users.firstName, `%${filters.search}%`),
          like(users.lastName, `%${filters.search}%`),
          like(users.email, `%${filters.search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      return await db.select().from(users).where(and(...conditions)).orderBy(asc(users.firstName));
    } else {
      return await db.select().from(users).orderBy(asc(users.firstName));
    }
  }

  // Organisation operations
  async getOrganisation(id: string): Promise<Organisation | undefined> {
    const [organisation] = await db.select().from(organisations).where(eq(organisations.id, id));
    return organisation;
  }

  async getOrganisationBySubdomain(subdomain: string): Promise<Organisation | undefined> {
    const [organisation] = await db.select().from(organisations).where(eq(organisations.subdomain, subdomain));
    return organisation;
  }

  async createOrganisation(organisationData: InsertOrganisation): Promise<Organisation> {
    const [organisation] = await db
      .insert(organisations)
      .values(organisationData)
      .returning();
    return organisation;
  }

  async updateOrganisation(id: string, organisationData: Partial<InsertOrganisation>): Promise<Organisation> {
    const [organisation] = await db
      .update(organisations)
      .set({ ...organisationData, updatedAt: new Date() })
      .where(eq(organisations.id, id))
      .returning();
    return organisation;
  }

  async deleteOrganisation(id: string): Promise<void> {
    // Cascade delete all organization-related data in correct order
    // to avoid foreign key constraint violations
    
    // 1. Delete SCORM attempts first (they depend on assignments/users)
    await db.delete(scormAttempts).where(eq(scormAttempts.organisationId, id));
    
    // 2. Delete completions (they depend on assignments)
    await db.delete(completions).where(eq(completions.organisationId, id));
    
    // 3. Delete certificates (they depend on completions/users)
    await db.delete(certificates).where(eq(certificates.organisationId, id));
    
    // 4. Delete assignments (they depend on users)
    await db.delete(assignments).where(eq(assignments.organisationId, id));
    
    // 5. Delete organisation-specific email and settings data
    await db.delete(orgEmailTemplates).where(eq(orgEmailTemplates.orgId, id));
    await db.delete(emailLogs).where(eq(emailLogs.organisationId, id));
    await db.delete(emailSends).where(eq(emailSends.organisationId, id));
    await db.delete(emailProviderConfigs).where(eq(emailProviderConfigs.orgId, id));
    
    // 5a. Delete organisation notification settings
    await db.delete(orgNotificationSettings).where(eq(orgNotificationSettings.orgId, id));
    
    // 5b. Delete billing locks for this organisation
    await db.delete(billingLocks).where(eq(billingLocks.resourceId, id));
    
    // 6. Delete support tickets and responses
    const orgTickets = await db.select({ id: supportTickets.id }).from(supportTickets).where(eq(supportTickets.organisationId, id));
    for (const ticket of orgTickets) {
      await db.delete(supportTicketResponses).where(eq(supportTicketResponses.ticketId, ticket.id));
    }
    await db.delete(supportTickets).where(eq(supportTickets.organisationId, id));
    
    // 7. Delete audit logs
    await db.delete(auditLogs).where(eq(auditLogs.organisationId, id));
    
    // 8. Delete organisation course folder access
    await db.delete(organisationCourseFolders).where(eq(organisationCourseFolders.organisationId, id));
    
    // 9. Delete organisation settings
    await db.delete(organisationSettings).where(eq(organisationSettings.organisationId, id));
    
    // 10. Delete certificate templates owned by this organisation
    await db.delete(certificateTemplates).where(eq(certificateTemplates.organisationId, id));
    
    // 11. Delete todo items for users in this organisation
    const orgUsers = await db.select({ id: users.id }).from(users).where(eq(users.organisationId, id));
    for (const user of orgUsers) {
      await db.delete(todoItems).where(eq(todoItems.userId, user.id));
    }
    
    // 12. Delete users (this is critical for email reuse)
    await db.delete(users).where(eq(users.organisationId, id));
    
    // 13. Finally delete the organisation itself
    await db.delete(organisations).where(eq(organisations.id, id));
  }

  async getAllOrganisations(): Promise<Organisation[]> {
    return await db.select().from(organisations).orderBy(asc(organisations.name));
  }

  // Organisation billing operations
  async getOrganisationWithPlan(id: string): Promise<(Organisation & { plan: Plan | null }) | undefined> {
    const [result] = await db
      .select({
        organisation: organisations,
        plan: plans,
      })
      .from(organisations)
      .leftJoin(plans, eq(organisations.planId, plans.id))
      .where(eq(organisations.id, id));

    if (!result) return undefined;

    return {
      ...result.organisation,
      plan: result.plan,
    };
  }

  async updateOrganisationBilling(id: string, billing: {
    planId?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripeSubscriptionItemId?: string;
    billingStatus?: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'paused';
    activeUserCount?: number;
    currentPeriodEnd?: Date;
    lastBillingSync?: Date;
  }): Promise<Organisation> {
    const [organisation] = await db
      .update(organisations)
      .set({ 
        ...billing, 
        updatedAt: new Date() 
      })
      .where(eq(organisations.id, id))
      .returning();
    return organisation;
  }

  async syncOrganisationUsage(id: string): Promise<{
    activeUserCount: number;
    lastSyncTime: Date;
  }> {
    // Count active users in this organisation
    const [activeUserResult] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.organisationId, id),
          eq(users.status, 'active')
        )
      );

    const activeUserCount = Number(activeUserResult?.count) || 0;
    const lastSyncTime = new Date();

    // Update the organisation with the current active user count
    await db
      .update(organisations)
      .set({ 
        activeUserCount,
        lastBillingSync: lastSyncTime,
        updatedAt: lastSyncTime
      })
      .where(eq(organisations.id, id));

    return {
      activeUserCount,
      lastSyncTime,
    };
  }

  // Course operations
  async getCourse(id: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course;
  }

  async createCourse(courseData: InsertCourse): Promise<Course> {
    const [course] = await db
      .insert(courses)
      .values(courseData)
      .returning();
    return course;
  }

  async updateCourse(id: string, courseData: Partial<InsertCourse>): Promise<Course> {
    const [course] = await db
      .update(courses)
      .set({ ...courseData, updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning();
    return course;
  }

  async deleteCourse(id: string): Promise<void> {
    await db.delete(courses).where(eq(courses.id, id));
  }

  async getAllCourses(): Promise<Course[]> {
    return await db.select().from(courses).orderBy(desc(courses.createdAt));
  }

  async getCoursesByStatus(status: string): Promise<Course[]> {
    return await db.select().from(courses).where(eq(courses.status, status as any)).orderBy(desc(courses.createdAt));
  }

  // Course folder operations
  async getCourseFolder(id: string): Promise<CourseFolder | undefined> {
    const [folder] = await db.select().from(courseFolders).where(eq(courseFolders.id, id));
    return folder;
  }

  async createCourseFolder(folderData: InsertCourseFolder): Promise<CourseFolder> {
    const [folder] = await db
      .insert(courseFolders)
      .values(folderData)
      .returning();
    return folder;
  }

  async updateCourseFolder(id: string, folderData: Partial<InsertCourseFolder>): Promise<CourseFolder> {
    const [folder] = await db
      .update(courseFolders)
      .set({ ...folderData, updatedAt: new Date() })
      .where(eq(courseFolders.id, id))
      .returning();
    return folder;
  }

  async deleteCourseFolder(id: string): Promise<void> {
    await db.delete(courseFolders).where(eq(courseFolders.id, id));
  }

  async getAllCourseFolders(): Promise<CourseFolder[]> {
    return await db.select().from(courseFolders).orderBy(asc(courseFolders.sortOrder), asc(courseFolders.name));
  }

  async getCoursesByFolder(folderId: string): Promise<Course[]> {
    return await db.select().from(courses).where(eq(courses.folderId, folderId)).orderBy(desc(courses.createdAt));
  }

  // Organisation course folder access operations
  async grantOrganisationFolderAccess(accessData: InsertOrganisationCourseFolder): Promise<OrganisationCourseFolder> {
    const [access] = await db
      .insert(organisationCourseFolders)
      .values(accessData)
      .returning();
    return access;
  }

  async revokeOrganisationFolderAccess(organisationId: string, folderId: string): Promise<void> {
    await db
      .delete(organisationCourseFolders)
      .where(
        and(
          eq(organisationCourseFolders.organisationId, organisationId),
          eq(organisationCourseFolders.folderId, folderId)
        )
      );
  }

  async getOrganisationFolderAccess(organisationId: string): Promise<CourseFolder[]> {
    const result = await db
      .select({ folder: courseFolders })
      .from(organisationCourseFolders)
      .innerJoin(courseFolders, eq(organisationCourseFolders.folderId, courseFolders.id))
      .where(eq(organisationCourseFolders.organisationId, organisationId))
      .orderBy(asc(courseFolders.sortOrder), asc(courseFolders.name));
    return result.map(row => row.folder);
  }

  async getOrganisationsWithFolderAccess(folderId: string): Promise<Organisation[]> {
    const result = await db
      .select({ organisation: organisations })
      .from(organisationCourseFolders)
      .innerJoin(organisations, eq(organisationCourseFolders.organisationId, organisations.id))
      .where(eq(organisationCourseFolders.folderId, folderId))
      .orderBy(asc(organisations.name));
    return result.map(row => row.organisation);
  }

  // Assignment operations
  async getAssignment(id: string): Promise<Assignment | undefined> {
    const [assignment] = await db.select().from(assignments).where(eq(assignments.id, id));
    return assignment;
  }

  async createAssignment(assignmentData: InsertAssignment): Promise<Assignment> {
    const [assignment] = await db
      .insert(assignments)
      .values(assignmentData)
      .returning();
    return assignment;
  }

  async updateAssignment(id: string, assignmentData: Partial<InsertAssignment>): Promise<Assignment> {
    const [assignment] = await db
      .update(assignments)
      .set(assignmentData)
      .where(eq(assignments.id, id))
      .returning();
    return assignment;
  }

  async deleteAssignment(id: string): Promise<void> {
    await db.delete(assignments).where(eq(assignments.id, id));
  }

  async getAssignmentsByUser(userId: string): Promise<Assignment[]> {
    return await db
      .select({
        id: assignments.id,
        courseId: assignments.courseId,
        userId: assignments.userId,
        organisationId: assignments.organisationId,
        dueDate: assignments.dueDate,
        status: assignments.status,
        assignedBy: assignments.assignedBy,
        assignedAt: assignments.assignedAt,
        startedAt: assignments.startedAt,
        completedAt: assignments.completedAt,
        notificationsEnabled: assignments.notificationsEnabled,
        // Include course details
        courseTitle: courses.title,
        courseDescription: courses.description,
        coverImageUrl: courses.coverImageUrl,
        estimatedDuration: courses.estimatedDuration,
        passmark: courses.passmark,
      })
      .from(assignments)
      .innerJoin(courses, eq(assignments.courseId, courses.id))
      .where(eq(assignments.userId, userId))
      .orderBy(desc(assignments.assignedAt));
  }

  async getAssignmentsByOrganisation(organisationId: string): Promise<Assignment[]> {
    return await db.select().from(assignments).where(eq(assignments.organisationId, organisationId)).orderBy(desc(assignments.assignedAt));
  }

  async getAssignmentsByCourse(courseId: string): Promise<Assignment[]> {
    return await db.select().from(assignments).where(eq(assignments.courseId, courseId)).orderBy(desc(assignments.assignedAt));
  }

  async getExistingAssignment(courseId: string, userId: string): Promise<Assignment | undefined> {
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.courseId, courseId), eq(assignments.userId, userId)));
    return assignment;
  }

  async findDuplicateAssignments(): Promise<{ courseId: string; userId: string; count: number; duplicateIds: string[] }[]> {
    // GLOBAL duplicate search - SUPERADMIN only
    // Find duplicate assignments (same courseId + userId combination)
    const duplicateGroups = await db
      .select({
        courseId: assignments.courseId,
        userId: assignments.userId,
        count: count(assignments.id).as('count'),
      })
      .from(assignments)
      .groupBy(assignments.courseId, assignments.userId)
      .having(sql`count(${assignments.id}) > 1`);

    // Get the actual assignment IDs for each duplicate group
    const result = [];
    for (const group of duplicateGroups) {
      const duplicateAssignments = await db
        .select({
          id: assignments.id,
          assignedAt: assignments.assignedAt,
        })
        .from(assignments)
        .where(and(eq(assignments.courseId, group.courseId), eq(assignments.userId, group.userId)))
        .orderBy(asc(assignments.assignedAt)); // Earliest first

      result.push({
        courseId: group.courseId,
        userId: group.userId,
        count: group.count,
        duplicateIds: duplicateAssignments.slice(1).map(a => a.id) // Keep first (earliest), remove rest
      });
    }

    return result;
  }

  async findDuplicateAssignmentsByOrganisation(organisationId: string): Promise<{ courseId: string; userId: string; count: number; duplicateIds: string[] }[]> {
    // ORGANIZATION-SCOPED duplicate search - ADMIN safe
    // Find duplicate assignments within a specific organization
    const duplicateGroups = await db
      .select({
        courseId: assignments.courseId,
        userId: assignments.userId,
        count: count(assignments.id).as('count'),
      })
      .from(assignments)
      .where(eq(assignments.organisationId, organisationId))
      .groupBy(assignments.courseId, assignments.userId)
      .having(sql`count(${assignments.id}) > 1`);

    // Get the actual assignment IDs for each duplicate group
    const result = [];
    for (const group of duplicateGroups) {
      const duplicateAssignments = await db
        .select({
          id: assignments.id,
          assignedAt: assignments.assignedAt,
        })
        .from(assignments)
        .where(and(eq(assignments.courseId, group.courseId), eq(assignments.userId, group.userId)))
        .orderBy(asc(assignments.assignedAt)); // Earliest first

      result.push({
        courseId: group.courseId,
        userId: group.userId,
        count: group.count,
        duplicateIds: duplicateAssignments.slice(1).map(a => a.id) // Keep first (earliest), remove rest
      });
    }

    return result;
  }

  async removeDuplicateAssignments(): Promise<{ duplicatesRemoved: number; duplicateGroups: number }> {
    // GLOBAL cleanup - SUPERADMIN only
    const duplicateGroups = await this.findDuplicateAssignments();
    let totalRemoved = 0;

    for (const group of duplicateGroups) {
      if (group.duplicateIds.length > 0) {
        // Delete duplicate assignments (keeping the earliest one)
        await db
          .delete(assignments)
          .where(sql`${assignments.id} = ANY(${group.duplicateIds})`);
        
        totalRemoved += group.duplicateIds.length;
      }
    }

    return {
      duplicatesRemoved: totalRemoved,
      duplicateGroups: duplicateGroups.length
    };
  }

  async removeDuplicateAssignmentsByOrganisation(organisationId: string): Promise<{ duplicatesRemoved: number; duplicateGroups: number }> {
    // ORGANIZATION-SCOPED cleanup - ADMIN safe
    const duplicateGroups = await this.findDuplicateAssignmentsByOrganisation(organisationId);
    let totalRemoved = 0;

    for (const group of duplicateGroups) {
      if (group.duplicateIds.length > 0) {
        // Delete duplicate assignments (keeping the earliest one) - only within the organization
        await db
          .delete(assignments)
          .where(and(
            sql`${assignments.id} = ANY(${group.duplicateIds})`,
            eq(assignments.organisationId, organisationId) // Double-check organization boundary
          ));
        
        totalRemoved += group.duplicateIds.length;
      }
    }

    return {
      duplicatesRemoved: totalRemoved,
      duplicateGroups: duplicateGroups.length
    };
  }

  // Completion operations
  async getCompletion(id: string): Promise<Completion | undefined> {
    const [completion] = await db.select().from(completions).where(eq(completions.id, id));
    return completion;
  }

  async createCompletion(completionData: InsertCompletion): Promise<Completion> {
    const [completion] = await db
      .insert(completions)
      .values(completionData)
      .returning();
    return completion;
  }

  async updateCompletion(id: string, completionData: Partial<InsertCompletion>): Promise<Completion> {
    const [completion] = await db
      .update(completions)
      .set(completionData)
      .where(eq(completions.id, id))
      .returning();
    return completion;
  }

  async getCompletionsByUser(userId: string): Promise<Completion[]> {
    return await db.select().from(completions).where(eq(completions.userId, userId)).orderBy(desc(completions.completedAt));
  }

  async getCompletionsByOrganisation(organisationId: string): Promise<Completion[]> {
    return await db.select().from(completions).where(eq(completions.organisationId, organisationId)).orderBy(desc(completions.completedAt));
  }

  async getCompletionsByAssignment(assignmentId: string): Promise<Completion[]> {
    return await db.select().from(completions).where(eq(completions.assignmentId, assignmentId)).orderBy(desc(completions.completedAt));
  }

  // Certificate operations
  async getCertificate(id: string): Promise<Certificate | undefined> {
    const [certificate] = await db.select().from(certificates).where(eq(certificates.id, id));
    return certificate;
  }

  async createCertificate(certificateData: InsertCertificate): Promise<Certificate> {
    const [certificate] = await db
      .insert(certificates)
      .values(certificateData)
      .returning();
    return certificate;
  }

  async updateCertificate(id: string, certificateData: Partial<InsertCertificate>): Promise<Certificate> {
    const [certificate] = await db
      .update(certificates)
      .set(certificateData)
      .where(eq(certificates.id, id))
      .returning();
    return certificate;
  }

  async getCertificatesByUser(userId: string): Promise<any[]> {
    return await db.select({
      id: certificates.id,
      completionId: certificates.completionId,
      userId: certificates.userId,
      courseId: certificates.courseId,
      organisationId: certificates.organisationId,
      certificateUrl: certificates.certificateUrl,
      expiryDate: certificates.expiryDate,
      issuedAt: certificates.issuedAt,
      courseTitle: courses.title,
      score: completions.score,
    }).from(certificates)
      .leftJoin(courses, eq(certificates.courseId, courses.id))
      .leftJoin(completions, eq(certificates.completionId, completions.id))
      .where(eq(certificates.userId, userId))
      .orderBy(desc(certificates.issuedAt));
  }

  async getCertificatesByOrganisation(organisationId: string): Promise<Certificate[]> {
    return await db.select().from(certificates).where(eq(certificates.organisationId, organisationId)).orderBy(desc(certificates.issuedAt));
  }

  // Certificate template operations
  async getCertificateTemplate(id: string): Promise<CertificateTemplate | undefined> {
    const [template] = await db.select().from(certificateTemplates).where(eq(certificateTemplates.id, id));
    return template;
  }

  async createCertificateTemplate(templateData: InsertCertificateTemplate): Promise<CertificateTemplate> {
    const [template] = await db
      .insert(certificateTemplates)
      .values(templateData)
      .returning();
    return template;
  }

  async updateCertificateTemplate(id: string, templateData: Partial<InsertCertificateTemplate>): Promise<CertificateTemplate> {
    const [template] = await db
      .update(certificateTemplates)
      .set({ ...templateData, updatedAt: new Date() })
      .where(eq(certificateTemplates.id, id))
      .returning();
    return template;
  }

  async deleteCertificateTemplate(id: string): Promise<void> {
    await db.delete(certificateTemplates).where(eq(certificateTemplates.id, id));
  }

  async getCertificateTemplates(): Promise<CertificateTemplate[]> {
    return await db.select().from(certificateTemplates).orderBy(desc(certificateTemplates.createdAt));
  }

  async getDefaultCertificateTemplate(): Promise<CertificateTemplate | undefined> {
    const [template] = await db.select().from(certificateTemplates).where(and(eq(certificateTemplates.isDefault, true), isNull(certificateTemplates.organisationId)));
    return template;
  }

  // Organisation settings operations
  async getOrganisationSettings(organisationId: string): Promise<OrganisationSettings | undefined> {
    const [settings] = await db.select().from(organisationSettings).where(eq(organisationSettings.organisationId, organisationId));
    return settings;
  }

  async createOrganisationSettings(settingsData: InsertOrganisationSettings): Promise<OrganisationSettings> {
    const [settings] = await db
      .insert(organisationSettings)
      .values(settingsData)
      .returning();
    return settings;
  }

  async updateOrganisationSettings(organisationId: string, settingsData: Partial<InsertOrganisationSettings>): Promise<OrganisationSettings> {
    const [settings] = await db
      .update(organisationSettings)
      .set({ ...settingsData, updatedAt: new Date() })
      .where(eq(organisationSettings.organisationId, organisationId))
      .returning();
    return settings;
  }

  // Platform settings operations
  async getPlatformSetting(key: string): Promise<PlatformSettings | undefined> {
    const [setting] = await db.select().from(platformSettings).where(eq(platformSettings.key, key));
    return setting;
  }

  async setPlatformSetting(key: string, value: string, description?: string): Promise<PlatformSettings> {
    const [setting] = await db
      .insert(platformSettings)
      .values({ key, value, description })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value, description, updatedAt: new Date() },
      })
      .returning();
    return setting;
  }

  async getAllPlatformSettings(): Promise<PlatformSettings[]> {
    return await db.select().from(platformSettings).orderBy(asc(platformSettings.key));
  }

  // Todo item operations
  async getTodoItem(id: string): Promise<TodoItem | undefined> {
    const [todoItem] = await db.select().from(todoItems).where(eq(todoItems.id, id));
    return todoItem;
  }

  async createTodoItem(todoItemData: InsertTodoItem): Promise<TodoItem> {
    const [todoItem] = await db
      .insert(todoItems)
      .values(todoItemData)
      .returning();
    return todoItem;
  }

  async updateTodoItem(id: string, todoItemData: Partial<InsertTodoItem>): Promise<TodoItem> {
    const [todoItem] = await db
      .update(todoItems)
      .set({ ...todoItemData, updatedAt: new Date() })
      .where(eq(todoItems.id, id))
      .returning();
    return todoItem;
  }

  async deleteTodoItem(id: string): Promise<void> {
    await db.delete(todoItems).where(eq(todoItems.id, id));
  }

  async getTodoItemsByUser(userId: string): Promise<TodoItem[]> {
    return await db.select().from(todoItems).where(eq(todoItems.userId, userId)).orderBy(asc(todoItems.order), desc(todoItems.createdAt));
  }

  // Analytics operations
  async getPlatformStats(): Promise<{
    totalOrganisations: number;
    totalUsers: number;
    totalCourses: number;
    totalCompletions: number;
  }> {
    const [orgCount] = await db.select({ count: count() }).from(organisations).where(eq(organisations.status, 'active'));
    const [userCount] = await db.select({ count: count() }).from(users).where(eq(users.status, 'active'));
    const [courseCount] = await db.select({ count: count() }).from(courses).where(eq(courses.status, 'published'));
    const [completionCount] = await db.select({ count: count() }).from(completions);

    return {
      totalOrganisations: orgCount.count,
      totalUsers: userCount.count,
      totalCourses: courseCount.count,
      totalCompletions: completionCount.count,
    };
  }

  // Get completion analytics for charts
  async getCompletionAnalytics(): Promise<any[]> {
    // Get completion data grouped by month for the last 12 months
    const completionsByMonth = await db
      .select({
        month: sql<string>`TO_CHAR(${completions.completedAt}, 'YYYY-MM')`,
        total: count(),
        successful: sql<number>`COUNT(CASE WHEN ${completions.status} = 'pass' THEN 1 END)`,
        failed: sql<number>`COUNT(CASE WHEN ${completions.status} = 'fail' THEN 1 END)`
      })
      .from(completions)
      .where(sql`${completions.completedAt} >= NOW() - INTERVAL '12 months'`)
      .groupBy(sql`TO_CHAR(${completions.completedAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${completions.completedAt}, 'YYYY-MM')`);

    // Format the data for the chart
    const formattedData = completionsByMonth.map(row => ({
      month: row.month,
      monthName: new Date(row.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      total: row.total,
      successful: row.successful,
      failed: row.failed
    }));

    return formattedData;
  }

  // Get popular courses analytics for current month
  async getPopularCoursesThisMonth(): Promise<any[]> {
    // Get course completion data for current month
    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const popularCourses = await db
      .select({
        courseId: assignments.courseId,
        courseName: courses.title,
        totalTaken: count()
      })
      .from(assignments)
      .innerJoin(courses, eq(assignments.courseId, courses.id))
      .where(
        and(
          sql`${assignments.assignedAt} >= ${startOfMonth}`,
          sql`${assignments.assignedAt} <= ${endOfMonth}`
        )
      )
      .groupBy(assignments.courseId, courses.title)
      .orderBy(desc(count()))
      .limit(3);

    return popularCourses.map(course => ({
      courseName: course.courseName,
      totalTaken: course.totalTaken,
    }));
  }

  async getOrganisationStats(organisationId: string): Promise<{
    activeUsers: number;
    adminUsers: number;
    totalUsers: number;
    coursesAssigned: number;
    completedCourses: number;
    averageScore: number;
  }> {
    const [activeUserCount] = await db.select({ count: count() }).from(users).where(and(eq(users.organisationId, organisationId), eq(users.status, 'active')));
    const [totalUserCount] = await db.select({ count: count() }).from(users).where(eq(users.organisationId, organisationId));
    const [adminCount] = await db.select({ count: count() }).from(users).where(and(eq(users.organisationId, organisationId), eq(users.role, 'admin')));
    const [assignmentCount] = await db.select({ count: count() }).from(assignments).where(eq(assignments.organisationId, organisationId));
    const [completionCount] = await db.select({ count: count() }).from(completions).where(eq(completions.organisationId, organisationId));
    
    // Get average score
    const [scoreResult] = await db.select({ avg: avg(completions.score) }).from(completions).where(eq(completions.organisationId, organisationId));
    const averageScore = scoreResult.avg ? parseFloat(scoreResult.avg.toString()) : 0;

    return {
      activeUsers: activeUserCount.count,
      totalUsers: totalUserCount.count,
      adminUsers: adminCount.count,
      coursesAssigned: assignmentCount.count,
      completedCourses: completionCount.count,
      averageScore: Math.round(averageScore * 100) / 100, // Round to 2 decimal places
    };
  }

  async getCourseAnalytics(courseId: string): Promise<{
    courseId: string;
    totalAssignments: number;
    totalCompletions: number;
    successfulCompletions: number;
    averageScore: number;
    completionRate: number;
    organizationsUsing: number;
    averageTimeToComplete: number;
  }> {
    const [assignmentCount] = await db.select({ count: count() }).from(assignments).where(eq(assignments.courseId, courseId));
    const [completionCount] = await db.select({ count: count() }).from(completions).where(eq(completions.courseId, courseId));
    const [successfulCount] = await db.select({ count: count() }).from(completions).where(and(eq(completions.courseId, courseId), eq(completions.status, 'pass')));
    
    // Get unique organizations using this course
    const organizationsUsing = await db
      .selectDistinct({ orgId: assignments.organisationId })
      .from(assignments)
      .where(eq(assignments.courseId, courseId));
    
    // Calculate average score from successful completions
    const scoreResults = await db
      .select({ score: completions.score })
      .from(completions)
      .where(and(eq(completions.courseId, courseId), eq(completions.status, 'pass')));
    
    const averageScore = scoreResults.length > 0 
      ? scoreResults.reduce((sum, c) => sum + (Number(c.score) || 0), 0) / scoreResults.length
      : 0;
    
    // Calculate average time to complete (in minutes)
    const timeResults = await db
      .select({
        assignedAt: assignments.assignedAt,
        completedAt: completions.completedAt
      })
      .from(assignments)
      .innerJoin(completions, eq(assignments.id, completions.assignmentId))
      .where(and(eq(assignments.courseId, courseId), eq(completions.status, 'pass')));
    
    const averageTimeToComplete = timeResults.length > 0
      ? timeResults.reduce((sum, t) => {
          if (t.assignedAt && t.completedAt) {
            const diffInMs = new Date(t.completedAt).getTime() - new Date(t.assignedAt).getTime();
            return sum + (diffInMs / (1000 * 60)); // Convert to minutes
          }
          return sum;
        }, 0) / timeResults.length
      : 0;
    
    const completionRate = Number(assignmentCount.count) > 0 
      ? (Number(successfulCount.count) / Number(assignmentCount.count)) * 100
      : 0;

    return {
      courseId,
      totalAssignments: Number(assignmentCount.count),
      totalCompletions: Number(completionCount.count),
      successfulCompletions: Number(successfulCount.count),
      averageScore,
      completionRate,
      organizationsUsing: organizationsUsing.length,
      averageTimeToComplete,
    };
  }

  // SCORM attempt operations
  async getScormAttempt(id: string): Promise<ScormAttempt | undefined> {
    const [attempt] = await db.select().from(scormAttempts).where(eq(scormAttempts.id, id));
    return attempt;
  }

  async getScormAttemptByAttemptId(attemptId: string): Promise<ScormAttempt | undefined> {
    const [attempt] = await db.select().from(scormAttempts).where(eq(scormAttempts.attemptId, attemptId));
    return attempt;
  }

  async createScormAttempt(attemptData: InsertScormAttempt): Promise<ScormAttempt> {
    const [attempt] = await db.insert(scormAttempts).values(attemptData).returning();
    return attempt;
  }

  async updateScormAttempt(attemptId: string, attemptData: Partial<InsertScormAttempt>): Promise<ScormAttempt> {
    const [attempt] = await db
      .update(scormAttempts)
      .set({ ...attemptData, updatedAt: new Date() })
      .where(eq(scormAttempts.attemptId, attemptId))
      .returning();
    return attempt;
  }

  async getScormAttemptsByUser(userId: string): Promise<ScormAttempt[]> {
    return await db
      .select()
      .from(scormAttempts)
      .where(eq(scormAttempts.userId, userId))
      .orderBy(desc(scormAttempts.createdAt));
  }

  async getScormAttemptsByAssignment(assignmentId: string): Promise<ScormAttempt[]> {
    return await db
      .select()
      .from(scormAttempts)
      .where(eq(scormAttempts.assignmentId, assignmentId))
      .orderBy(desc(scormAttempts.createdAt));
  }

  async getScormAttemptsByOrganisation(organisationId: string): Promise<ScormAttempt[]> {
    return await db
      .select()
      .from(scormAttempts)
      .where(eq(scormAttempts.organisationId, organisationId))
      .orderBy(desc(scormAttempts.createdAt));
  }

  async getActiveScormAttempt(userId: string, assignmentId: string): Promise<ScormAttempt | undefined> {
    const [attempt] = await db
      .select()
      .from(scormAttempts)
      .where(and(
        eq(scormAttempts.userId, userId),
        eq(scormAttempts.assignmentId, assignmentId),
        eq(scormAttempts.isActive, true)
      ))
      .orderBy(desc(scormAttempts.createdAt))
      .limit(1);
    return attempt;
  }

  // Plan operations
  async getPlan(id: string): Promise<Plan | undefined> {
    const [plan] = await db.select().from(plans).where(eq(plans.id, id));
    return plan;
  }

  async createPlan(planData: InsertPlan): Promise<Plan> {
    const [plan] = await db.insert(plans).values(planData).returning();
    return plan;
  }

  async updatePlan(id: string, planData: Partial<InsertPlan>): Promise<Plan> {
    const [plan] = await db
      .update(plans)
      .set({ ...planData, updatedAt: new Date() })
      .where(eq(plans.id, id))
      .returning();
    return plan;
  }

  async deletePlan(id: string): Promise<void> {
    await db.delete(plans).where(eq(plans.id, id));
  }

  async getAllPlans(): Promise<Plan[]> {
    return await db.select().from(plans).orderBy(desc(plans.createdAt));
  }

  async getPlanWithFeatures(id: string): Promise<Plan & { features: PlanFeature[] } | undefined> {
    const [plan] = await db.select().from(plans).where(eq(plans.id, id));
    if (!plan) return undefined;

    const features = await db
      .select({
        id: planFeatures.id,
        key: planFeatures.key,
        name: planFeatures.name,
        description: planFeatures.description,
        category: planFeatures.category,
        isDefault: planFeatures.isDefault,
        createdAt: planFeatures.createdAt,
        updatedAt: planFeatures.updatedAt,
      })
      .from(planFeatures)
      .innerJoin(planFeatureMappings, eq(planFeatureMappings.featureId, planFeatures.id))
      .where(and(
        eq(planFeatureMappings.planId, id),
        eq(planFeatureMappings.enabled, true)
      ));

    return { ...plan, features };
  }

  // Plan feature operations
  async getPlanFeature(id: string): Promise<PlanFeature | undefined> {
    const [feature] = await db.select().from(planFeatures).where(eq(planFeatures.id, id));
    return feature;
  }

  async createPlanFeature(featureData: InsertPlanFeature): Promise<PlanFeature> {
    const [feature] = await db.insert(planFeatures).values(featureData).returning();
    return feature;
  }

  async updatePlanFeature(id: string, featureData: Partial<InsertPlanFeature>): Promise<PlanFeature> {
    const [feature] = await db
      .update(planFeatures)
      .set({ ...featureData, updatedAt: new Date() })
      .where(eq(planFeatures.id, id))
      .returning();
    return feature;
  }

  async deletePlanFeature(id: string): Promise<void> {
    await db.delete(planFeatures).where(eq(planFeatures.id, id));
  }

  async getAllPlanFeatures(): Promise<PlanFeature[]> {
    return await db.select().from(planFeatures).orderBy(asc(planFeatures.category), asc(planFeatures.name));
  }

  // Plan feature mapping operations
  async getPlanFeatureMapping(id: string): Promise<PlanFeatureMapping | undefined> {
    const [mapping] = await db.select().from(planFeatureMappings).where(eq(planFeatureMappings.id, id));
    return mapping;
  }

  async createPlanFeatureMapping(mappingData: InsertPlanFeatureMapping): Promise<PlanFeatureMapping> {
    const [mapping] = await db.insert(planFeatureMappings).values(mappingData).returning();
    return mapping;
  }

  async deletePlanFeatureMapping(id: string): Promise<void> {
    await db.delete(planFeatureMappings).where(eq(planFeatureMappings.id, id));
  }

  async getPlanFeatureMappings(planId: string): Promise<PlanFeatureMapping[]> {
    return await db
      .select()
      .from(planFeatureMappings)
      .where(eq(planFeatureMappings.planId, planId));
  }

  async setPlanFeatures(planId: string, featureIds: string[]): Promise<void> {
    // First, delete existing mappings
    await db.delete(planFeatureMappings).where(eq(planFeatureMappings.planId, planId));
    
    // Then, create new mappings
    if (featureIds.length > 0) {
      const mappings = featureIds.map(featureId => ({
        planId,
        featureId,
        enabled: true,
      }));
      await db.insert(planFeatureMappings).values(mappings);
    }
  }

  // Audit log operations
  async createAuditLog(auditLogData: InsertAuditLog): Promise<AuditLog> {
    const [auditLog] = await db.insert(auditLogs).values(auditLogData).returning();
    return auditLog;
  }

  async getAuditLogs(organisationId: string, limit: number = 50, offset: number = 0): Promise<AuditLog[]> {
    return await db
      .select({
        id: auditLogs.id,
        organisationId: auditLogs.organisationId,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.organisationId, organisationId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getAuditLogsByUser(userId: string, limit: number = 50, offset: number = 0): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }
  // Email template operations
  async createEmailTemplate(templateData: InsertEmailTemplate): Promise<EmailTemplate> {
    const [template] = await db.insert(emailTemplates).values(templateData).returning();
    return template;
  }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    return template;
  }

  async getEmailTemplateByKey(key: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, key));
    return template;
  }

  async getAllEmailTemplates(): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates).orderBy(asc(emailTemplates.key));
  }

  async getEmailTemplatesByCategory(category: string): Promise<EmailTemplate[]> {
    return await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.category, category as any))
      .orderBy(asc(emailTemplates.key));
  }

  async updateEmailTemplate(key: string, templateData: Partial<InsertEmailTemplate>): Promise<EmailTemplate> {
    const [template] = await db
      .update(emailTemplates)
      .set({ ...templateData, updatedAt: new Date() })
      .where(eq(emailTemplates.key, key))
      .returning();
    return template;
  }

  async deleteEmailTemplate(key: string): Promise<void> {
    await db.delete(emailTemplates).where(eq(emailTemplates.key, key));
  }

  // Organization email template overrides operations
  async createOrgEmailTemplate(overrideData: InsertOrgEmailTemplate): Promise<OrgEmailTemplate> {
    const [override] = await db.insert(orgEmailTemplates).values(overrideData).returning();
    return override;
  }

  async getOrgEmailTemplate(id: string): Promise<OrgEmailTemplate | undefined> {
    const [template] = await db.select().from(orgEmailTemplates).where(eq(orgEmailTemplates.id, id));
    return template;
  }

  async getOrgEmailTemplateByKey(orgId: string, templateKey: string): Promise<OrgEmailTemplate | undefined> {
    const [override] = await db
      .select()
      .from(orgEmailTemplates)
      .where(
        and(
          eq(orgEmailTemplates.orgId, orgId),
          eq(orgEmailTemplates.templateKey, templateKey)
        )
      );
    return override;
  }

  async getOrgEmailTemplatesByOrg(orgId: string): Promise<OrgEmailTemplate[]> {
    return await db
      .select()
      .from(orgEmailTemplates)
      .where(eq(orgEmailTemplates.orgId, orgId))
      .orderBy(asc(orgEmailTemplates.templateKey));
  }

  async updateOrgEmailTemplate(id: string, overrideData: Partial<InsertOrgEmailTemplate>): Promise<OrgEmailTemplate> {
    const [override] = await db
      .update(orgEmailTemplates)
      .set({ ...overrideData, updatedAt: new Date() })
      .where(eq(orgEmailTemplates.id, id))
      .returning();
    return override;
  }

  async upsertOrgEmailTemplate(
    orgId: string, 
    templateKey: string, 
    overrideData: Partial<InsertOrgEmailTemplate>
  ): Promise<OrgEmailTemplate> {
    const existing = await this.getOrgEmailTemplateByKey(orgId, templateKey);
    
    if (existing) {
      // Update existing override
      return await this.updateOrgEmailTemplate(existing.id, {
        ...overrideData,
        isActive: true
      });
    } else {
      // Create new override
      return await this.createOrgEmailTemplate({
        orgId,
        templateKey,
        ...overrideData,
        isActive: true
      });
    }
  }

  async deleteOrgEmailTemplate(id: string): Promise<void> {
    await db.delete(orgEmailTemplates).where(eq(orgEmailTemplates.id, id));
  }

  async disableOrgEmailTemplate(orgId: string, templateKey: string): Promise<void> {
    await db
      .update(orgEmailTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(orgEmailTemplates.orgId, orgId),
          eq(orgEmailTemplates.templateKey, templateKey)
        )
      );
  }

  // Comprehensive email template resolution (platform + org overrides)
  async getEffectiveEmailTemplate(orgId: string, templateKey: string): Promise<{
    template: EmailTemplate;
    override: OrgEmailTemplate | null;
    effectiveSubject: string;
    effectiveHtml: string;
    effectiveMjml: string;
    effectiveText: string | null;
  } | undefined> {
    // Get the platform template
    const template = await this.getEmailTemplateByKey(templateKey);
    if (!template) {
      return undefined;
    }

    // Get the organization override if it exists
    const override = await this.getOrgEmailTemplateByKey(orgId, templateKey);

    // Return combined effective template
    return {
      template,
      override: override || null,
      effectiveSubject: override?.subjectOverride || template.subject,
      effectiveHtml: override?.htmlOverride || template.html,
      effectiveMjml: override?.mjmlOverride || template.mjml,
      effectiveText: override?.textOverride || template.text
    };
  }

  // System SMTP settings operations
  async getSystemEmailSettings(): Promise<SystemEmailSettings | undefined> {
    const [settings] = await db
      .select()
      .from(systemEmailSettings)
      .where(eq(systemEmailSettings.isActive, true))
      .orderBy(desc(systemEmailSettings.updatedAt));
    return settings;
  }

  async createSystemEmailSettings(settingsData: InsertSystemEmailSettings): Promise<SystemEmailSettings> {
    // Deactivate all existing settings first
    await db
      .update(systemEmailSettings)
      .set({ isActive: false, updatedAt: new Date() });

    const [settings] = await db
      .insert(systemEmailSettings)
      .values({ ...settingsData, isActive: true })
      .returning();
    return settings;
  }

  async updateSystemEmailSettings(settingsData: Partial<InsertSystemEmailSettings>): Promise<SystemEmailSettings> {
    const activeSettings = await this.getSystemEmailSettings();
    if (!activeSettings) {
      throw new Error('No active system email settings found');
    }

    const [settings] = await db
      .update(systemEmailSettings)
      .set({ ...settingsData, updatedAt: new Date() })
      .where(eq(systemEmailSettings.id, activeSettings.id))
      .returning();
    return settings;
  }

  // Email logs operations
  async createEmailLog(logData: InsertEmailLog): Promise<EmailLog> {
    const [log] = await db.insert(emailLogs).values(logData).returning();
    return log;
  }

  async getEmailLogs(filters: {
    organisationId?: string;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<EmailLog[]> {
    const {
      organisationId,
      status,
      fromDate,
      toDate,
      limit = 50,
      offset = 0
    } = filters;

    const conditions: any[] = [];
    if (organisationId) {
      conditions.push(eq(emailLogs.organisationId, organisationId));
    }
    if (status) {
      conditions.push(eq(emailLogs.status, status));
    }
    if (fromDate) {
      conditions.push(sql`${emailLogs.timestamp} >= ${fromDate}`);
    }
    if (toDate) {
      conditions.push(sql`${emailLogs.timestamp} <= ${toDate}`);
    }

    if (conditions.length > 0) {
      return await db.select().from(emailLogs)
        .where(and(...conditions))
        .orderBy(desc(emailLogs.timestamp))
        .limit(limit)
        .offset(offset);
    } else {
      return await db.select().from(emailLogs)
        .orderBy(desc(emailLogs.timestamp))
        .limit(limit)
        .offset(offset);
    }
  }

  async getEmailLogById(id: string): Promise<EmailLog | undefined> {
    const [log] = await db.select().from(emailLogs).where(eq(emailLogs.id, id));
    return log;
  }

  // Email orchestrator send operations
  async createEmailSend(emailSendData: InsertEmailSend): Promise<EmailSend> {
    const [emailSend] = await db.insert(emailSends).values(emailSendData).returning();
    return emailSend;
  }

  async getEmailSend(id: string): Promise<EmailSend | undefined> {
    const [emailSend] = await db.select().from(emailSends).where(eq(emailSends.id, id));
    return emailSend;
  }

  async getEmailSendByIdempotencyKey(idempotencyKey: string, windowStart?: Date): Promise<EmailSend | undefined> {
    const conditions: any[] = [eq(emailSends.idempotencyKey, idempotencyKey)];
    
    // If windowStart is provided, only check within the time window
    if (windowStart) {
      conditions.push(sql`${emailSends.createdAt} >= ${windowStart}`);
    }

    const [emailSend] = await db
      .select()
      .from(emailSends)
      .where(and(...conditions))
      .orderBy(desc(emailSends.createdAt));
      
    return emailSend;
  }

  async updateEmailSend(id: string, updates: Partial<InsertEmailSend>): Promise<EmailSend> {
    const [emailSend] = await db
      .update(emailSends)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailSends.id, id))
      .returning();
    return emailSend;
  }

  async getEmailSends(filters: {
    organisationId?: string;
    triggerEvent?: string;
    status?: string;
    templateKey?: string;
    toEmail?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<EmailSend[]> {
    const {
      organisationId,
      triggerEvent,
      status,
      templateKey,
      toEmail,
      fromDate,
      toDate,
      limit = 50,
      offset = 0
    } = filters;

    const conditions: any[] = [];
    if (organisationId) {
      conditions.push(eq(emailSends.organisationId, organisationId));
    }
    if (triggerEvent) {
      conditions.push(eq(emailSends.triggerEvent, triggerEvent as any));
    }
    if (status) {
      conditions.push(eq(emailSends.status, status as any));
    }
    if (templateKey) {
      conditions.push(eq(emailSends.templateKey, templateKey));
    }
    if (toEmail) {
      conditions.push(eq(emailSends.toEmail, toEmail));
    }
    if (fromDate) {
      conditions.push(sql`${emailSends.createdAt} >= ${fromDate}`);
    }
    if (toDate) {
      conditions.push(sql`${emailSends.createdAt} <= ${toDate}`);
    }

    if (conditions.length > 0) {
      return await db.select().from(emailSends)
        .where(and(...conditions))
        .orderBy(desc(emailSends.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      return await db.select().from(emailSends)
        .orderBy(desc(emailSends.createdAt))
        .limit(limit)
        .offset(offset);
    }
  }

  async getEmailSendsForRetry(maxRetries: number = 3): Promise<EmailSend[]> {
    return await db.select().from(emailSends)
      .where(and(
        eq(emailSends.status, 'retrying'),
        sql`${emailSends.retryCount} < ${maxRetries}`,
        sql`${emailSends.nextRetryAt} <= NOW()`
      ))
      .orderBy(asc(emailSends.nextRetryAt))
      .limit(100); // Process max 100 retries at once
  }

  // Email settings lock operations
  async createEmailSettingsLock(lockData: InsertEmailSettingsLock): Promise<EmailSettingsLock> {
    const [lock] = await db.insert(emailSettingsLock).values(lockData).returning();
    return lock;
  }

  async getEmailSettingsLock(lockType: string, resourceId: string): Promise<EmailSettingsLock | undefined> {
    const [lock] = await db
      .select()
      .from(emailSettingsLock)
      .where(and(
        eq(emailSettingsLock.lockType, lockType),
        eq(emailSettingsLock.resourceId, resourceId),
        sql`${emailSettingsLock.expiresAt} > NOW()`
      ));
    return lock;
  }

  async deleteEmailSettingsLock(id: string): Promise<void> {
    await db.delete(emailSettingsLock).where(eq(emailSettingsLock.id, id));
  }

  async cleanupExpiredEmailLocks(): Promise<number> {
    const result = await db
      .delete(emailSettingsLock)
      .where(sql`${emailSettingsLock.expiresAt} <= NOW()`);
    return result.rowCount || 0;
  }

  // Email provider config operations
  async createEmailProviderConfig(configData: InsertEmailProviderConfigs): Promise<EmailProviderConfigs> {
    const [config] = await db.insert(emailProviderConfigs).values(configData).returning();
    return config;
  }

  async getEmailProviderConfig(id: string): Promise<EmailProviderConfigs | undefined> {
    const [config] = await db.select().from(emailProviderConfigs).where(eq(emailProviderConfigs.id, id));
    return config;
  }

  async getEmailProviderConfigByOrg(orgId: string): Promise<EmailProviderConfigs | undefined> {
    const [config] = await db
      .select()
      .from(emailProviderConfigs)
      .where(and(
        eq(emailProviderConfigs.orgId, orgId),
        eq(emailProviderConfigs.isDefaultForOrg, true)
      ))
      .orderBy(desc(emailProviderConfigs.updatedAt));
    return config;
  }

  async updateEmailProviderConfig(id: string, configData: Partial<InsertEmailProviderConfigs>): Promise<EmailProviderConfigs> {
    const [config] = await db
      .update(emailProviderConfigs)
      .set({ ...configData, updatedAt: new Date() })
      .where(eq(emailProviderConfigs.id, id))
      .returning();
    return config;
  }

  async upsertEmailProviderConfig(orgId: string, configData: Partial<InsertEmailProviderConfigs>): Promise<EmailProviderConfigs> {
    // Validate required fields are present
    if (!configData.provider || !configData.configJson || !configData.updatedBy) {
      throw new Error('Missing required fields: provider, configJson, and updatedBy are required');
    }

    // First, set all existing configs for this org to not be default
    await db
      .update(emailProviderConfigs)
      .set({ isDefaultForOrg: false, updatedAt: new Date() })
      .where(eq(emailProviderConfigs.orgId, orgId));

    // Then create the new config as the default
    const [config] = await db
      .insert(emailProviderConfigs)
      .values({
        orgId,
        provider: configData.provider,
        configJson: configData.configJson,
        updatedBy: configData.updatedBy,
        isDefaultForOrg: true,
      })
      .returning();
    return config;
  }

  async deleteEmailProviderConfig(id: string): Promise<void> {
    await db.delete(emailProviderConfigs).where(eq(emailProviderConfigs.id, id));
  }

  // Billing distributed lock operations - enterprise-grade concurrency protection
  async acquireBillingLock(
    lockType: string, 
    resourceId: string, 
    lockedBy: string, 
    options: {
      lockReason?: string;
      timeoutMs?: number;
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{ success: boolean; lock?: BillingLock; waitTime?: number; queuePosition?: number }> {
    const {
      lockReason = 'billing_operation',
      timeoutMs = 300000, // 5 minutes default
      correlationId,
      metadata
    } = options;

    const expiresAt = new Date(Date.now() + timeoutMs);
    const maxWaitTime = Math.min(timeoutMs, 60000); // Max 1 minute wait
    const startTime = Date.now();
    const maxRetries = 10;
    let retryCount = 0;

    while (retryCount < maxRetries && (Date.now() - startTime) < maxWaitTime) {
      try {
        // First, cleanup any expired locks to prevent false blocking
        await this.cleanupExpiredBillingLocks();

        // Check if there's an existing active lock
        const existingLock = await this.getBillingLock(lockType, resourceId);
        if (existingLock) {
          // Calculate queue position by counting active locks ahead of us
          const queuePosition = await this.getBillingLockQueuePosition(lockType, resourceId);
          const waitTime = Date.now() - startTime;
          
          // If we've been waiting too long, return failure
          if (waitTime >= maxWaitTime) {
            return { 
              success: false, 
              waitTime, 
              queuePosition 
            };
          }

          // Wait before retrying (exponential backoff with jitter)
          const baseDelay = Math.min(1000 * Math.pow(1.5, retryCount), 5000);
          const jitter = Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
          retryCount++;
          continue;
        }

        // Try to acquire the lock atomically
        const lockData = {
          lockType,
          resourceId,
          lockedBy,
          lockReason,
          expiresAt,
          queuePosition: 0, // Primary lock holder
          correlationId: correlationId || `billing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          metadata: metadata ? JSON.stringify(metadata) : null
        };

        const [lock] = await db.insert(billingLocks).values(lockData).returning();
        
        const waitTime = Date.now() - startTime;
        return { 
          success: true, 
          lock, 
          waitTime,
          queuePosition: 0 
        };

      } catch (error: any) {
        // Handle unique constraint violation (concurrent lock attempt)
        if (error.code === '23505' || error.message?.includes('unique_billing_lock')) {
          retryCount++;
          
          // Exponential backoff with jitter
          const baseDelay = Math.min(500 * Math.pow(1.2, retryCount), 2000);
          const jitter = Math.random() * 500;
          await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
          continue;
        }
        
        // For other errors, rethrow
        throw error;
      }
    }

    // Failed to acquire lock within timeout
    const finalQueuePosition = await this.getBillingLockQueuePosition(lockType, resourceId);
    return { 
      success: false, 
      waitTime: Date.now() - startTime,
      queuePosition: finalQueuePosition 
    };
  }

  async renewBillingLock(lockId: string, additionalTimeMs: number = 300000): Promise<{ success: boolean; lock?: BillingLock }> {
    try {
      const newExpiresAt = new Date(Date.now() + additionalTimeMs);
      const renewedAt = new Date();
      
      const [lock] = await db
        .update(billingLocks)
        .set({ 
          expiresAt: newExpiresAt,
          renewedAt: renewedAt
        })
        .where(and(
          eq(billingLocks.id, lockId),
          sql`${billingLocks.expiresAt} > NOW()` // Only renew if still active
        ))
        .returning();

      if (!lock) {
        return { success: false };
      }

      return { success: true, lock };
    } catch (error) {
      console.error('Failed to renew billing lock:', error);
      return { success: false };
    }
  }

  async releaseBillingLock(lockId: string): Promise<void> {
    await db.delete(billingLocks).where(eq(billingLocks.id, lockId));
  }

  async getBillingLock(lockType: string, resourceId: string): Promise<BillingLock | undefined> {
    const [lock] = await db
      .select()
      .from(billingLocks)
      .where(and(
        eq(billingLocks.lockType, lockType),
        eq(billingLocks.resourceId, resourceId),
        sql`${billingLocks.expiresAt} > NOW()`
      ));
    return lock;
  }

  async getBillingLockById(lockId: string): Promise<BillingLock | undefined> {
    const [lock] = await db.select().from(billingLocks).where(eq(billingLocks.id, lockId));
    return lock;
  }

  async cleanupExpiredBillingLocks(): Promise<number> {
    const result = await db
      .delete(billingLocks)
      .where(sql`${billingLocks.expiresAt} <= NOW()`);
    return result.rowCount || 0;
  }

  async getBillingLockQueue(lockType: string, resourceId: string): Promise<BillingLock[]> {
    return await db
      .select()
      .from(billingLocks)
      .where(and(
        eq(billingLocks.lockType, lockType),
        eq(billingLocks.resourceId, resourceId),
        sql`${billingLocks.expiresAt} > NOW()`
      ))
      .orderBy(asc(billingLocks.queuePosition), asc(billingLocks.acquiredAt));
  }

  async getActiveBillingLocks(filters: { 
    lockType?: string; 
    resourceId?: string; 
    lockedBy?: string;
    correlationId?: string; 
  } = {}): Promise<BillingLock[]> {
    const conditions: any[] = [sql`${billingLocks.expiresAt} > NOW()`];
    
    if (filters.lockType) {
      conditions.push(eq(billingLocks.lockType, filters.lockType));
    }
    if (filters.resourceId) {
      conditions.push(eq(billingLocks.resourceId, filters.resourceId));
    }
    if (filters.lockedBy) {
      conditions.push(eq(billingLocks.lockedBy, filters.lockedBy));
    }
    if (filters.correlationId) {
      conditions.push(eq(billingLocks.correlationId, filters.correlationId));
    }

    return await db
      .select()
      .from(billingLocks)
      .where(and(...conditions))
      .orderBy(desc(billingLocks.acquiredAt));
  }

  // Helper method to get queue position for a potential lock acquisition
  private async getBillingLockQueuePosition(lockType: string, resourceId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(billingLocks)
      .where(and(
        eq(billingLocks.lockType, lockType),
        eq(billingLocks.resourceId, resourceId),
        sql`${billingLocks.expiresAt} > NOW()`
      ));
    
    return (result?.count || 0) + 1; // Position in queue (1-indexed)
  }

  // Support ticket operations
  async createSupportTicket(ticketData: InsertSupportTicket): Promise<SupportTicket> {
    const [ticket] = await db.insert(supportTickets).values(ticketData).returning();
    return ticket;
  }

  async getSupportTicket(id: string): Promise<SupportTicket | undefined> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return ticket;
  }

  async getSupportTickets(filters: {
    organisationId?: string;
    createdBy?: string;
    assignedTo?: string;
    status?: string;
    priority?: string;
    category?: string;
    search?: string; // Search by ticket number or title
    limit?: number;
    offset?: number;
  } = {}): Promise<SupportTicket[]> {
    const {
      organisationId,
      createdBy,
      assignedTo,
      status,
      priority,
      category,
      search,
      limit = 50,
      offset = 0
    } = filters;

    const conditions: any[] = [];
    if (organisationId) {
      conditions.push(eq(supportTickets.organisationId, organisationId));
    }
    if (createdBy) {
      conditions.push(eq(supportTickets.createdBy, createdBy));
    }
    if (assignedTo) {
      conditions.push(eq(supportTickets.assignedTo, assignedTo));
    }
    if (status) {
      conditions.push(eq(supportTickets.status, status as any));
    }
    if (priority) {
      conditions.push(eq(supportTickets.priority, priority as any));
    }
    if (category) {
      conditions.push(eq(supportTickets.category, category as any));
    }
    if (search) {
      conditions.push(
        or(
          ilike(supportTickets.ticketNumber, `%${search}%`),
          ilike(supportTickets.title, `%${search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      return await db.select().from(supportTickets)
        .where(and(...conditions))
        .orderBy(desc(supportTickets.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      return await db.select().from(supportTickets)
        .orderBy(desc(supportTickets.createdAt))
        .limit(limit)
        .offset(offset);
    }
  }

  async updateSupportTicket(id: string, ticketData: Partial<InsertSupportTicket>): Promise<SupportTicket> {
    const [ticket] = await db
      .update(supportTickets)
      .set({ ...ticketData, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return ticket;
  }

  async deleteSupportTicket(id: string): Promise<void> {
    await db.delete(supportTickets).where(eq(supportTickets.id, id));
  }

  async getUnreadTicketCount(filters: { organisationId?: string; assignedTo?: string; createdBy?: string } = {}): Promise<number> {
    const { organisationId, assignedTo, createdBy } = filters;

    let query = db.select({ count: count() }).from(supportTickets);

    const conditions: any[] = [eq(supportTickets.isRead, false)];
    if (organisationId) {
      conditions.push(eq(supportTickets.organisationId, organisationId));
    }
    if (assignedTo) {
      conditions.push(eq(supportTickets.assignedTo, assignedTo));
    }
    if (createdBy) {
      conditions.push(eq(supportTickets.createdBy, createdBy));
    }

    const [result] = await query.where(and(...conditions));
    return Number(result.count);
  }

  // Support ticket response operations
  async createSupportTicketResponse(responseData: InsertSupportTicketResponse): Promise<SupportTicketResponse> {
    const [response] = await db.insert(supportTicketResponses).values(responseData).returning();
    
    // Update the ticket's lastResponseAt timestamp
    await db
      .update(supportTickets)
      .set({ 
        lastResponseAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, responseData.ticketId));
    
    return response;
  }

  async getSupportTicketResponses(ticketId: string): Promise<SupportTicketResponse[]> {
    return await db
      .select()
      .from(supportTicketResponses)
      .where(eq(supportTicketResponses.ticketId, ticketId))
      .orderBy(asc(supportTicketResponses.createdAt));
  }

  async deleteSupportTicketResponse(id: string): Promise<void> {
    await db.delete(supportTicketResponses).where(eq(supportTicketResponses.id, id));
  }

  // Feature checking and admin validation helpers
  async hasFeature(organisationId: string, featureKey: string): Promise<boolean> {
    try {
      const organisation = await this.getOrganisation(organisationId);
      if (!organisation?.planId) {
        return false;
      }

      const planWithFeatures = await this.getPlanWithFeatures(organisation.planId);
      if (!planWithFeatures?.features) {
        return false;
      }

      return planWithFeatures.features.some(feature => feature.key === featureKey);
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  async countAdminsByOrg(organisationId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.organisationId, organisationId),
          eq(users.role, 'admin'),
          eq(users.status, 'active')
        )
      );
    
    return result?.count || 0;
  }

  async enforceAdminLimit(organisationId: string): Promise<{ allowed: boolean; error?: { code: string; featureKey: string; maxAllowed: number } }> {
    try {
      // Check if organization has unlimited admin accounts feature
      const hasUnlimitedAdmins = await this.hasFeature(organisationId, 'unlimited_admin_accounts');
      
      if (hasUnlimitedAdmins) {
        return { allowed: true };
      }
      
      // If feature not enabled, enforce limit of 1 admin
      const currentAdminCount = await this.countAdminsByOrg(organisationId);
      
      if (currentAdminCount >= 1) {
        return {
          allowed: false,
          error: {
            code: 'FEATURE_LOCKED',
            featureKey: 'unlimited_admin_accounts',
            maxAllowed: 1
          }
        };
      }
      
      return { allowed: true };
    } catch (error) {
      console.error('Error enforcing admin limit:', error);
      return {
        allowed: false,
        error: {
          code: 'FEATURE_LOCKED',
          featureKey: 'unlimited_admin_accounts',
          maxAllowed: 1
        }
      };
    }
  }

  // Webhook event operations for persistent deduplication
  async isWebhookEventProcessed(stripeEventId: string): Promise<boolean> {
    const [event] = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.stripeEventId, stripeEventId))
      .limit(1);
    return !!event;
  }

  async recordWebhookEvent(eventData: InsertWebhookEvent): Promise<WebhookEvent> {
    const [event] = await db
      .insert(webhookEvents)
      .values(eventData)
      .returning();
    return event;
  }

  async cleanupOldWebhookEvents(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await db
      .delete(webhookEvents)
      .where(sql`${webhookEvents.processedAt} < ${cutoffDate}`)
      .returning({ id: webhookEvents.id });
    
    return result.length;
  }

  // GDPR Consent Records operations
  async createConsentRecord(consentData: InsertConsentRecord): Promise<ConsentRecord> {
    const [record] = await db.insert(consentRecords).values(consentData).returning();
    return record;
  }

  async getConsentRecord(id: string): Promise<ConsentRecord | undefined> {
    const [record] = await db.select().from(consentRecords).where(eq(consentRecords.id, id));
    return record;
  }

  async getConsentRecordsByUser(userId: string): Promise<ConsentRecord[]> {
    return await db.select().from(consentRecords)
      .where(eq(consentRecords.userId, userId))
      .orderBy(desc(consentRecords.timestamp));
  }

  async getConsentRecordsByOrganisation(organisationId: string): Promise<ConsentRecord[]> {
    return await db.select().from(consentRecords)
      .where(eq(consentRecords.organisationId, organisationId))
      .orderBy(desc(consentRecords.timestamp));
  }

  async updateConsentRecord(id: string, consentData: Partial<InsertConsentRecord>): Promise<ConsentRecord> {
    const [record] = await db
      .update(consentRecords)
      .set({ ...consentData, updatedAt: new Date() })
      .where(eq(consentRecords.id, id))
      .returning();
    return record;
  }

  async deleteConsentRecord(id: string): Promise<void> {
    await db.delete(consentRecords).where(eq(consentRecords.id, id));
  }

  // Get current active consent for user (latest non-withdrawn record)
  async getCurrentUserConsent(userId: string, organisationId: string): Promise<ConsentRecord | undefined> {
    const [record] = await db.select().from(consentRecords)
      .where(and(
        eq(consentRecords.userId, userId),
        eq(consentRecords.organisationId, organisationId),
        isNull(consentRecords.withdrawnAt)
      ))
      .orderBy(desc(consentRecords.timestamp))
      .limit(1);
    return record;
  }

  // GDPR Privacy Settings operations
  async createPrivacySettings(settingsData: InsertPrivacySettings): Promise<PrivacySettings> {
    const [settings] = await db.insert(privacySettings).values(settingsData).returning();
    return settings;
  }

  async getPrivacySettings(id: string): Promise<PrivacySettings | undefined> {
    const [settings] = await db.select().from(privacySettings).where(eq(privacySettings.id, id));
    return settings;
  }

  async getPrivacySettingsByOrganisation(organisationId: string): Promise<PrivacySettings | undefined> {
    const [settings] = await db.select().from(privacySettings).where(eq(privacySettings.organisationId, organisationId));
    return settings;
  }

  async updatePrivacySettings(id: string, privacySettingsData: Partial<InsertPrivacySettings>): Promise<PrivacySettings> {
    const [settings] = await db
      .update(privacySettings)
      .set({ ...privacySettingsData, updatedAt: new Date() })
      .where(eq(privacySettings.id, id))
      .returning();
    return settings;
  }

  async upsertPrivacySettings(organisationId: string, privacySettingsData: Partial<InsertPrivacySettings>): Promise<PrivacySettings> {
    // Try to find existing settings
    const existing = await this.getPrivacySettingsByOrganisation(organisationId);
    
    if (existing) {
      // Update existing settings
      return await this.updatePrivacySettings(existing.id, privacySettingsData);
    } else {
      // Create new settings
      return await this.createPrivacySettings({
        organisationId,
        ...privacySettingsData,
      } as InsertPrivacySettings);
    }
  }

  async deletePrivacySettings(id: string): Promise<void> {
    await db.delete(privacySettings).where(eq(privacySettings.id, id));
  }

  // GDPR Cookie Inventory operations
  async createCookieInventory(cookieInventoryData: InsertCookieInventory): Promise<CookieInventory> {
    const [cookie] = await db.insert(cookieInventory).values(cookieInventoryData).returning();
    return cookie;
  }

  async getCookieInventory(id: string): Promise<CookieInventory | undefined> {
    const [cookie] = await db.select().from(cookieInventory).where(eq(cookieInventory.id, id));
    return cookie;
  }

  async getCookieInventoriesByOrganisation(organisationId: string): Promise<CookieInventory[]> {
    return await db.select().from(cookieInventory)
      .where(eq(cookieInventory.organisationId, organisationId))
      .orderBy(asc(cookieInventory.category), asc(cookieInventory.name));
  }

  async updateCookieInventory(id: string, cookieInventoryData: Partial<InsertCookieInventory>): Promise<CookieInventory> {
    const [cookie] = await db
      .update(cookieInventory)
      .set({ ...cookieInventoryData, updatedAt: new Date() })
      .where(eq(cookieInventory.id, id))
      .returning();
    return cookie;
  }

  async deleteCookieInventory(id: string): Promise<void> {
    await db.delete(cookieInventory).where(eq(cookieInventory.id, id));
  }

  async getCookieInventoriesByCategory(organisationId: string, category: string): Promise<CookieInventory[]> {
    return await db.select().from(cookieInventory)
      .where(and(
        eq(cookieInventory.organisationId, organisationId),
        eq(cookieInventory.category, category)
      ))
      .orderBy(asc(cookieInventory.name));
  }

  // GDPR User Rights Request operations
  async createUserRightRequest(userRightRequestData: InsertUserRightRequest): Promise<UserRightRequest> {
    const [request] = await db.insert(userRightRequests).values(userRightRequestData).returning();
    return request;
  }

  async getUserRightRequest(id: string): Promise<UserRightRequest | undefined> {
    const [request] = await db.select().from(userRightRequests).where(eq(userRightRequests.id, id));
    return request;
  }

  async getUserRightRequestsByUser(userId: string): Promise<UserRightRequest[]> {
    return await db.select().from(userRightRequests)
      .where(eq(userRightRequests.userId, userId))
      .orderBy(desc(userRightRequests.requestedAt));
  }

  async getUserRightRequestsByOrganisation(organisationId: string): Promise<UserRightRequest[]> {
    return await db.select().from(userRightRequests)
      .where(eq(userRightRequests.organisationId, organisationId))
      .orderBy(desc(userRightRequests.requestedAt));
  }

  async updateUserRightRequest(id: string, userRightRequestData: Partial<InsertUserRightRequest>): Promise<UserRightRequest> {
    const [request] = await db
      .update(userRightRequests)
      .set({ ...userRightRequestData, updatedAt: new Date() })
      .where(eq(userRightRequests.id, id))
      .returning();
    return request;
  }

  async deleteUserRightRequest(id: string): Promise<void> {
    await db.delete(userRightRequests).where(eq(userRightRequests.id, id));
  }

  // Get user rights requests with filtering and pagination for admin interface
  async getUserRightRequestsWithFilters(organisationId: string, filters?: {
    type?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<UserRightRequest[]> {
    let query = db.select().from(userRightRequests)
      .where(eq(userRightRequests.organisationId, organisationId));

    if (filters?.type) {
      query = query.where(eq(userRightRequests.type, filters.type as any));
    }

    if (filters?.status) {
      query = query.where(eq(userRightRequests.status, filters.status as any));
    }

    if (filters?.search) {
      query = query.where(
        or(
          ilike(userRightRequests.description, `%${filters.search}%`),
          ilike(userRightRequests.adminNotes, `%${filters.search}%`)
        )
      );
    }

    query = query.orderBy(desc(userRightRequests.requestedAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  // Check if user has pending request of specific type (prevent duplicates)
  async getUserRightRequestPending(userId: string, type: string): Promise<UserRightRequest | undefined> {
    const [request] = await db.select().from(userRightRequests)
      .where(and(
        eq(userRightRequests.userId, userId),
        eq(userRightRequests.type, type as any),
        inArray(userRightRequests.status, ['pending', 'in_progress'])
      ))
      .orderBy(desc(userRightRequests.requestedAt))
      .limit(1);
    return request;
  }

  // Mark request as verified (identity verification completed)
  async verifyUserRightRequest(id: string, adminId: string): Promise<UserRightRequest> {
    const [request] = await db
      .update(userRightRequests)
      .set({ 
        verifiedAt: new Date(),
        status: 'in_progress',
        updatedAt: new Date()
      })
      .where(eq(userRightRequests.id, id))
      .returning();
    return request;
  }

  // Complete request with outcome
  async completeUserRightRequest(id: string, outcome: {
    status: 'completed' | 'rejected';
    adminNotes?: string;
    rejectionReason?: string;
    attachments?: string[];
  }): Promise<UserRightRequest> {
    const [request] = await db
      .update(userRightRequests)
      .set({
        status: outcome.status,
        completedAt: new Date(),
        adminNotes: outcome.adminNotes || '',
        rejectionReason: outcome.rejectionReason,
        attachments: outcome.attachments || [],
        updatedAt: new Date()
      })
      .where(eq(userRightRequests.id, id))
      .returning();
    return request;
  }

  // ===== REGISTER OF PROCESSING ACTIVITIES (ROPA) - ARTICLE 30 COMPLIANCE =====

  async createProcessingActivity(processingActivity: InsertProcessingActivity): Promise<ProcessingActivity> {
    const [activity] = await db
      .insert(processingActivities)
      .values({
        ...processingActivity,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return activity;
  }

  async getProcessingActivity(id: string): Promise<ProcessingActivity | undefined> {
    const [activity] = await db
      .select()
      .from(processingActivities)
      .where(eq(processingActivities.id, id))
      .limit(1);
    return activity;
  }

  async getProcessingActivitiesByOrganisation(organisationId: string): Promise<ProcessingActivity[]> {
    return await db
      .select()
      .from(processingActivities)
      .where(eq(processingActivities.organisationId, organisationId))
      .orderBy(desc(processingActivities.updatedAt));
  }

  async updateProcessingActivity(id: string, processingActivity: Partial<InsertProcessingActivity>): Promise<ProcessingActivity> {
    const [updated] = await db
      .update(processingActivities)
      .set({
        ...processingActivity,
        updatedAt: new Date(),
      })
      .where(eq(processingActivities.id, id))
      .returning();
    return updated;
  }

  async deleteProcessingActivity(id: string): Promise<void> {
    await db
      .delete(processingActivities)
      .where(eq(processingActivities.id, id));
  }

  // Enhanced processing activities queries for compliance reporting
  async getProcessingActivitiesByLawfulBasis(organisationId: string, lawfulBasis: string): Promise<ProcessingActivity[]> {
    return await db
      .select()
      .from(processingActivities)
      .where(and(
        eq(processingActivities.organisationId, organisationId),
        eq(processingActivities.lawfulBasis, lawfulBasis as any)
      ))
      .orderBy(desc(processingActivities.updatedAt));
  }

  async getProcessingActivitiesWithInternationalTransfers(organisationId: string): Promise<ProcessingActivity[]> {
    return await db
      .select()
      .from(processingActivities)
      .where(and(
        eq(processingActivities.organisationId, organisationId),
        eq(processingActivities.internationalTransfers, true)
      ))
      .orderBy(desc(processingActivities.updatedAt));
  }

  async getProcessingActivitiesRequiringDPIA(organisationId: string): Promise<ProcessingActivity[]> {
    return await db
      .select()
      .from(processingActivities)
      .where(and(
        eq(processingActivities.organisationId, organisationId),
        sql`${processingActivities.dpia}->>'required' = 'true'`
      ))
      .orderBy(desc(processingActivities.updatedAt));
  }

  async searchProcessingActivities(organisationId: string, searchTerm: string): Promise<ProcessingActivity[]> {
    return await db
      .select()
      .from(processingActivities)
      .where(and(
        eq(processingActivities.organisationId, organisationId),
        or(
          ilike(processingActivities.name, `%${searchTerm}%`),
          ilike(processingActivities.purpose, `%${searchTerm}%`),
          ilike(processingActivities.description, `%${searchTerm}%`)
        )
      ))
      .orderBy(desc(processingActivities.updatedAt));
  }

  // ===== DATA BREACH MANAGEMENT - GDPR ARTICLES 33 & 34 COMPLIANCE =====

  async createDataBreach(dataBreach: InsertDataBreach): Promise<DataBreach> {
    const [breach] = await db
      .insert(dataBreaches)
      .values({
        ...dataBreach,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return breach;
  }

  async getDataBreach(id: string): Promise<DataBreach | undefined> {
    const [breach] = await db
      .select()
      .from(dataBreaches)
      .where(eq(dataBreaches.id, id))
      .limit(1);
    return breach;
  }

  async getDataBreachesByOrganisation(organisationId: string): Promise<DataBreach[]> {
    return await db
      .select()
      .from(dataBreaches)
      .where(eq(dataBreaches.organisationId, organisationId))
      .orderBy(desc(dataBreaches.detectedAt));
  }

  async updateDataBreach(id: string, dataBreach: Partial<InsertDataBreach>): Promise<DataBreach> {
    const [updated] = await db
      .update(dataBreaches)
      .set({
        ...dataBreach,
        updatedAt: new Date(),
      })
      .where(eq(dataBreaches.id, id))
      .returning();
    return updated;
  }

  async deleteDataBreach(id: string): Promise<void> {
    await db
      .delete(dataBreaches)
      .where(eq(dataBreaches.id, id));
  }

  async getDataBreachesByStatus(organisationId: string, status: string): Promise<DataBreach[]> {
    return await db
      .select()
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        eq(dataBreaches.status, status as any)
      ))
      .orderBy(desc(dataBreaches.detectedAt));
  }

  async getOverdueDataBreaches(organisationId: string): Promise<DataBreach[]> {
    const now = new Date();
    return await db
      .select()
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        sql`${dataBreaches.notificationDeadline} < ${now}`,
        inArray(dataBreaches.status, ['detected', 'assessed'])
      ))
      .orderBy(asc(dataBreaches.notificationDeadline));
  }

  // Advanced breach management queries for ICO compliance
  async getBreachesRequiringICONotification(organisationId: string): Promise<DataBreach[]> {
    return await db
      .select()
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        isNull(dataBreaches.icoNotifiedAt),
        inArray(dataBreaches.severity, ['medium', 'high', 'critical'])
      ))
      .orderBy(asc(dataBreaches.notificationDeadline));
  }

  async getBreachesRequiringSubjectNotification(organisationId: string): Promise<DataBreach[]> {
    return await db
      .select()
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        isNull(dataBreaches.subjectsNotifiedAt),
        inArray(dataBreaches.severity, ['high', 'critical'])
      ))
      .orderBy(asc(dataBreaches.detectedAt));
  }

  async searchDataBreaches(organisationId: string, searchTerm: string): Promise<DataBreach[]> {
    return await db
      .select()
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        or(
          ilike(dataBreaches.title, `%${searchTerm}%`),
          ilike(dataBreaches.description, `%${searchTerm}%`),
          ilike(dataBreaches.cause, `%${searchTerm}%`)
        )
      ))
      .orderBy(desc(dataBreaches.detectedAt));
  }

  async getBreachAnalytics(organisationId: string): Promise<{
    totalBreaches: number;
    criticalBreaches: number;
    overdueNotifications: number;
    averageTimeToNotify: number;
    breachesByMonth: Array<{ month: string; count: number }>;
    breachesBySeverity: Array<{ severity: string; count: number }>;
  }> {
    const [totalBreaches] = await db
      .select({ count: count() })
      .from(dataBreaches)
      .where(eq(dataBreaches.organisationId, organisationId));

    const [criticalBreaches] = await db
      .select({ count: count() })
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        eq(dataBreaches.severity, 'critical')
      ));

    const overdueBreaches = await this.getOverdueDataBreaches(organisationId);

    // Calculate average time to notify ICO (in hours)
    const notifiedBreaches = await db
      .select({
        detectedAt: dataBreaches.detectedAt,
        icoNotifiedAt: dataBreaches.icoNotifiedAt,
      })
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        isNull(dataBreaches.icoNotifiedAt).not()
      ));

    const avgTimeToNotify = notifiedBreaches.length > 0 
      ? notifiedBreaches.reduce((sum, breach) => {
          const timeDiff = new Date(breach.icoNotifiedAt!).getTime() - new Date(breach.detectedAt).getTime();
          return sum + (timeDiff / (1000 * 60 * 60)); // Convert to hours
        }, 0) / notifiedBreaches.length
      : 0;

    // Get breaches by month for the last 12 months
    const breachesByMonth = await db
      .select({
        month: sql<string>`to_char(${dataBreaches.detectedAt}, 'YYYY-MM')`,
        count: count()
      })
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        sql`${dataBreaches.detectedAt} >= ${sql`NOW() - INTERVAL '12 months'`}`
      ))
      .groupBy(sql`to_char(${dataBreaches.detectedAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${dataBreaches.detectedAt}, 'YYYY-MM')`);

    // Get breaches by severity
    const breachesBySeverity = await db
      .select({
        severity: dataBreaches.severity,
        count: count()
      })
      .from(dataBreaches)
      .where(eq(dataBreaches.organisationId, organisationId))
      .groupBy(dataBreaches.severity);

    return {
      totalBreaches: totalBreaches.count,
      criticalBreaches: criticalBreaches.count,
      overdueNotifications: overdueBreaches.length,
      averageTimeToNotify: Math.round(avgTimeToNotify * 100) / 100,
      breachesByMonth: breachesByMonth.map(row => ({ 
        month: row.month, 
        count: row.count 
      })),
      breachesBySeverity: breachesBySeverity.map(row => ({ 
        severity: row.severity, 
        count: row.count 
      })),
    };
  }

  // GDPR Audit Log operations
  async createGdprAuditLog(gdprAuditLog: InsertGdprAuditLog): Promise<GdprAuditLog> {
    const [log] = await db.insert(gdprAuditLogs).values({
      ...gdprAuditLog,
      timestamp: new Date()
    }).returning();
    return log;
  }

  async getGdprAuditLog(id: string): Promise<GdprAuditLog | undefined> {
    const [log] = await db.select().from(gdprAuditLogs).where(eq(gdprAuditLogs.id, id));
    return log;
  }

  async getGdprAuditLogsByOrganisation(
    organisationId: string, 
    filters?: {
      userId?: string;
      adminId?: string;
      action?: string;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<GdprAuditLog[]> {
    let query = db.select().from(gdprAuditLogs).where(eq(gdprAuditLogs.organisationId, organisationId));

    const conditions = [eq(gdprAuditLogs.organisationId, organisationId)];

    if (filters?.userId) {
      conditions.push(eq(gdprAuditLogs.userId, filters.userId));
    }

    if (filters?.adminId) {
      conditions.push(eq(gdprAuditLogs.adminId, filters.adminId));
    }

    if (filters?.action) {
      conditions.push(eq(gdprAuditLogs.action, filters.action));
    }

    if (filters?.resource) {
      conditions.push(eq(gdprAuditLogs.resource, filters.resource));
    }

    if (filters?.startDate) {
      conditions.push(sql`${gdprAuditLogs.timestamp} >= ${filters.startDate}`);
    }

    if (filters?.endDate) {
      conditions.push(sql`${gdprAuditLogs.timestamp} <= ${filters.endDate}`);
    }

    if (conditions.length > 1) {
      query = db.select().from(gdprAuditLogs).where(and(...conditions));
    }

    query = query.orderBy(desc(gdprAuditLogs.timestamp));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
  }

  async getGdprAuditLogsByResource(organisationId: string, resource: string, resourceId: string): Promise<GdprAuditLog[]> {
    return await db
      .select()
      .from(gdprAuditLogs)
      .where(and(
        eq(gdprAuditLogs.organisationId, organisationId),
        eq(gdprAuditLogs.resource, resource),
        eq(gdprAuditLogs.resourceId, resourceId)
      ))
      .orderBy(desc(gdprAuditLogs.timestamp));
  }

  // ===== INTERNATIONAL TRANSFERS OPERATIONS - GDPR CHAPTER V COMPLIANCE =====

  // International Transfers operations
  async createInternationalTransfer(transferData: InsertInternationalTransfer): Promise<InternationalTransfer> {
    const [transfer] = await db.insert(internationalTransfers).values({
      ...transferData,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return transfer;
  }

  async getInternationalTransfer(id: string): Promise<InternationalTransfer | undefined> {
    const [transfer] = await db.select().from(internationalTransfers).where(eq(internationalTransfers.id, id));
    return transfer;
  }

  async getInternationalTransfersByOrganisation(organisationId: string): Promise<InternationalTransfer[]> {
    return await db.select().from(internationalTransfers)
      .where(eq(internationalTransfers.organisationId, organisationId))
      .orderBy(desc(internationalTransfers.createdAt));
  }

  async getInternationalTransfersByDestinationCountry(organisationId: string, countryCode: string): Promise<InternationalTransfer[]> {
    return await db.select().from(internationalTransfers)
      .where(and(
        eq(internationalTransfers.organisationId, organisationId),
        eq(internationalTransfers.destinationCountry, countryCode)
      ))
      .orderBy(desc(internationalTransfers.createdAt));
  }

  async getInternationalTransfersByRiskLevel(organisationId: string, riskLevel: string): Promise<InternationalTransfer[]> {
    return await db.select().from(internationalTransfers)
      .where(and(
        eq(internationalTransfers.organisationId, organisationId),
        eq(internationalTransfers.riskLevel, riskLevel)
      ))
      .orderBy(desc(internationalTransfers.riskAssessmentDate));
  }

  async getInternationalTransfersByStatus(organisationId: string, status: string): Promise<InternationalTransfer[]> {
    return await db.select().from(internationalTransfers)
      .where(and(
        eq(internationalTransfers.organisationId, organisationId),
        eq(internationalTransfers.status, status)
      ))
      .orderBy(desc(internationalTransfers.updatedAt));
  }

  async updateInternationalTransfer(id: string, transferData: Partial<InsertInternationalTransfer>): Promise<InternationalTransfer> {
    const [transfer] = await db
      .update(internationalTransfers)
      .set({ ...transferData, updatedAt: new Date() })
      .where(eq(internationalTransfers.id, id))
      .returning();
    return transfer;
  }

  async deleteInternationalTransfer(id: string): Promise<void> {
    await db.delete(internationalTransfers).where(eq(internationalTransfers.id, id));
  }

  async getOverdueTransferReviews(organisationId: string): Promise<InternationalTransfer[]> {
    const now = new Date();
    return await db.select().from(internationalTransfers)
      .where(and(
        eq(internationalTransfers.organisationId, organisationId),
        sql`${internationalTransfers.reviewDue} < ${now}`,
        eq(internationalTransfers.status, 'active')
      ))
      .orderBy(asc(internationalTransfers.reviewDue));
  }

  async getTransfersByMechanism(organisationId: string, mechanism: string): Promise<InternationalTransfer[]> {
    return await db.select().from(internationalTransfers)
      .where(and(
        eq(internationalTransfers.organisationId, organisationId),
        eq(internationalTransfers.transferMechanism, mechanism)
      ))
      .orderBy(desc(internationalTransfers.createdAt));
  }

  // Transfer Impact Assessments (TIA) operations
  async createTransferImpactAssessment(tiaData: InsertTransferImpactAssessment): Promise<TransferImpactAssessment> {
    const [tia] = await db.insert(transferImpactAssessments).values({
      ...tiaData,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return tia;
  }

  async getTransferImpactAssessment(id: string): Promise<TransferImpactAssessment | undefined> {
    const [tia] = await db.select().from(transferImpactAssessments).where(eq(transferImpactAssessments.id, id));
    return tia;
  }

  async getTransferImpactAssessmentsByOrganisation(organisationId: string): Promise<TransferImpactAssessment[]> {
    return await db.select().from(transferImpactAssessments)
      .where(eq(transferImpactAssessments.organisationId, organisationId))
      .orderBy(desc(transferImpactAssessments.createdAt));
  }

  async getTransferImpactAssessmentsByStatus(organisationId: string, status: string): Promise<TransferImpactAssessment[]> {
    return await db.select().from(transferImpactAssessments)
      .where(and(
        eq(transferImpactAssessments.organisationId, organisationId),
        eq(transferImpactAssessments.status, status)
      ))
      .orderBy(desc(transferImpactAssessments.updatedAt));
  }

  async getTransferImpactAssessmentsByDestinationCountry(organisationId: string, countryCode: string): Promise<TransferImpactAssessment[]> {
    return await db.select().from(transferImpactAssessments)
      .where(and(
        eq(transferImpactAssessments.organisationId, organisationId),
        eq(transferImpactAssessments.destinationCountry, countryCode)
      ))
      .orderBy(desc(transferImpactAssessments.createdAt));
  }

  async updateTransferImpactAssessment(id: string, tiaData: Partial<InsertTransferImpactAssessment>): Promise<TransferImpactAssessment> {
    const [tia] = await db
      .update(transferImpactAssessments)
      .set({ ...tiaData, updatedAt: new Date() })
      .where(eq(transferImpactAssessments.id, id))
      .returning();
    return tia;
  }

  async deleteTransferImpactAssessment(id: string): Promise<void> {
    await db.delete(transferImpactAssessments).where(eq(transferImpactAssessments.id, id));
  }

  async getOverdueTiaReviews(organisationId: string): Promise<TransferImpactAssessment[]> {
    const now = new Date();
    return await db.select().from(transferImpactAssessments)
      .where(and(
        eq(transferImpactAssessments.organisationId, organisationId),
        sql`${transferImpactAssessments.nextReviewDate} < ${now}`,
        eq(transferImpactAssessments.status, 'approved')
      ))
      .orderBy(asc(transferImpactAssessments.nextReviewDate));
  }

  async getTiaByReference(organisationId: string, reference: string): Promise<TransferImpactAssessment | undefined> {
    const [tia] = await db.select().from(transferImpactAssessments)
      .where(and(
        eq(transferImpactAssessments.organisationId, organisationId),
        eq(transferImpactAssessments.tiaReference, reference)
      ));
    return tia;
  }

  // Transfer Mechanisms operations
  async createTransferMechanism(mechanismData: InsertTransferMechanism): Promise<TransferMechanism> {
    const [mechanism] = await db.insert(transferMechanisms).values({
      ...mechanismData,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return mechanism;
  }

  async getTransferMechanism(id: string): Promise<TransferMechanism | undefined> {
    const [mechanism] = await db.select().from(transferMechanisms).where(eq(transferMechanisms.id, id));
    return mechanism;
  }

  async getTransferMechanismsByOrganisation(organisationId: string): Promise<TransferMechanism[]> {
    return await db.select().from(transferMechanisms)
      .where(eq(transferMechanisms.organisationId, organisationId))
      .orderBy(desc(transferMechanisms.createdAt));
  }

  async getTransferMechanismsByType(organisationId: string, mechanismType: string): Promise<TransferMechanism[]> {
    return await db.select().from(transferMechanisms)
      .where(and(
        eq(transferMechanisms.organisationId, organisationId),
        eq(transferMechanisms.mechanismType, mechanismType)
      ))
      .orderBy(desc(transferMechanisms.createdAt));
  }

  async getActiveTransferMechanisms(organisationId: string): Promise<TransferMechanism[]> {
    return await db.select().from(transferMechanisms)
      .where(and(
        eq(transferMechanisms.organisationId, organisationId),
        eq(transferMechanisms.isActive, true),
        eq(transferMechanisms.isDeprecated, false)
      ))
      .orderBy(desc(transferMechanisms.createdAt));
  }

  async updateTransferMechanism(id: string, mechanismData: Partial<InsertTransferMechanism>): Promise<TransferMechanism> {
    const [mechanism] = await db
      .update(transferMechanisms)
      .set({ ...mechanismData, updatedAt: new Date() })
      .where(eq(transferMechanisms.id, id))
      .returning();
    return mechanism;
  }

  async deleteTransferMechanism(id: string): Promise<void> {
    await db.delete(transferMechanisms).where(eq(transferMechanisms.id, id));
  }

  async getExpiringTransferMechanisms(organisationId: string, daysAhead: number = 30): Promise<TransferMechanism[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return await db.select().from(transferMechanisms)
      .where(and(
        eq(transferMechanisms.organisationId, organisationId),
        eq(transferMechanisms.isActive, true),
        sql`${transferMechanisms.effectiveUntil} <= ${futureDate}`,
        sql`${transferMechanisms.effectiveUntil} > ${new Date()}`
      ))
      .orderBy(asc(transferMechanisms.effectiveUntil));
  }

  async getMechanismsByCountry(organisationId: string, countryCode: string): Promise<TransferMechanism[]> {
    return await db.select().from(transferMechanisms)
      .where(and(
        eq(transferMechanisms.organisationId, organisationId),
        eq(transferMechanisms.isActive, true),
        sql`${countryCode} = ANY(${transferMechanisms.applicableCountries})`
      ))
      .orderBy(desc(transferMechanisms.createdAt));
  }

  // Standard Contractual Clauses operations
  async createStandardContractualClauses(sccData: InsertStandardContractualClauses): Promise<StandardContractualClauses> {
    const [scc] = await db.insert(standardContractualClauses).values({
      ...sccData,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return scc;
  }

  async getStandardContractualClauses(id: string): Promise<StandardContractualClauses | undefined> {
    const [scc] = await db.select().from(standardContractualClauses).where(eq(standardContractualClauses.id, id));
    return scc;
  }

  async getStandardContractualClausesByOrganisation(organisationId: string): Promise<StandardContractualClauses[]> {
    return await db.select().from(standardContractualClauses)
      .where(eq(standardContractualClauses.organisationId, organisationId))
      .orderBy(desc(standardContractualClauses.createdAt));
  }

  async getStandardContractualClausesByTransferMechanism(mechanismId: string): Promise<StandardContractualClauses[]> {
    return await db.select().from(standardContractualClauses)
      .where(eq(standardContractualClauses.transferMechanismId, mechanismId))
      .orderBy(desc(standardContractualClauses.createdAt));
  }

  async getStandardContractualClausesByType(organisationId: string, sccType: string): Promise<StandardContractualClauses[]> {
    return await db.select().from(standardContractualClauses)
      .where(and(
        eq(standardContractualClauses.organisationId, organisationId),
        eq(standardContractualClauses.sccType, sccType)
      ))
      .orderBy(desc(standardContractualClauses.createdAt));
  }

  async getActiveStandardContractualClauses(organisationId: string): Promise<StandardContractualClauses[]> {
    return await db.select().from(standardContractualClauses)
      .where(and(
        eq(standardContractualClauses.organisationId, organisationId),
        eq(standardContractualClauses.isActive, true),
        isNull(standardContractualClauses.terminationDate)
      ))
      .orderBy(desc(standardContractualClauses.executionDate));
  }

  async updateStandardContractualClauses(id: string, sccData: Partial<InsertStandardContractualClauses>): Promise<StandardContractualClauses> {
    const [scc] = await db
      .update(standardContractualClauses)
      .set({ ...sccData, updatedAt: new Date() })
      .where(eq(standardContractualClauses.id, id))
      .returning();
    return scc;
  }

  async deleteStandardContractualClauses(id: string): Promise<void> {
    await db.delete(standardContractualClauses).where(eq(standardContractualClauses.id, id));
  }

  async getSccByDataImporter(organisationId: string, importerName: string): Promise<StandardContractualClauses[]> {
    return await db.select().from(standardContractualClauses)
      .where(and(
        eq(standardContractualClauses.organisationId, organisationId),
        sql`${standardContractualClauses.dataImporter}->>'name' = ${importerName}`
      ))
      .orderBy(desc(standardContractualClauses.createdAt));
  }

  async getOverdueSccReviews(organisationId: string): Promise<StandardContractualClauses[]> {
    const now = new Date();
    return await db.select().from(standardContractualClauses)
      .where(and(
        eq(standardContractualClauses.organisationId, organisationId),
        eq(standardContractualClauses.isActive, true),
        sql`${standardContractualClauses.nextReviewDate} < ${now}`
      ))
      .orderBy(asc(standardContractualClauses.nextReviewDate));
  }

  // Adequacy Decisions operations (cached from ICO/EU Commission)
  async getAdequacyDecision(id: string): Promise<AdequacyDecision | undefined> {
    const [decision] = await db.select().from(adequacyDecisions).where(eq(adequacyDecisions.id, id));
    return decision;
  }

  async getAdequacyDecisionByCountry(countryCode: string): Promise<AdequacyDecision | undefined> {
    const [decision] = await db.select().from(adequacyDecisions)
      .where(eq(adequacyDecisions.countryCode, countryCode.toUpperCase()));
    return decision;
  }

  async getAllAdequacyDecisions(): Promise<AdequacyDecision[]> {
    return await db.select().from(adequacyDecisions)
      .orderBy(asc(adequacyDecisions.countryName));
  }

  async getAdequateCountries(): Promise<AdequacyDecision[]> {
    return await db.select().from(adequacyDecisions)
      .where(eq(adequacyDecisions.status, 'adequate'))
      .orderBy(asc(adequacyDecisions.countryName));
  }

  async getInadequateCountries(): Promise<AdequacyDecision[]> {
    return await db.select().from(adequacyDecisions)
      .where(eq(adequacyDecisions.status, 'inadequate'))
      .orderBy(asc(adequacyDecisions.countryName));
  }

  async createAdequacyDecision(decisionData: InsertAdequacyDecision): Promise<AdequacyDecision> {
    const [decision] = await db.insert(adequacyDecisions).values({
      ...decisionData,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return decision;
  }

  async updateAdequacyDecision(id: string, decisionData: Partial<InsertAdequacyDecision>): Promise<AdequacyDecision> {
    const [decision] = await db
      .update(adequacyDecisions)
      .set({ ...decisionData, updatedAt: new Date() })
      .where(eq(adequacyDecisions.id, id))
      .returning();
    return decision;
  }

  async deleteAdequacyDecision(id: string): Promise<void> {
    await db.delete(adequacyDecisions).where(eq(adequacyDecisions.id, id));
  }

  async getAdequacyDecisionsByRiskLevel(riskLevel: string): Promise<AdequacyDecision[]> {
    return await db.select().from(adequacyDecisions)
      .where(eq(adequacyDecisions.riskLevel, riskLevel))
      .orderBy(asc(adequacyDecisions.countryName));
  }

  async syncAdequacyDecisions(): Promise<{ updated: number; errors: string[] }> {
    // This would normally sync with ICO/EU Commission APIs
    // For now, return empty result
    return { updated: 0, errors: [] };
  }

  // International transfers analytics and compliance
  async getTransferAnalytics(organisationId: string): Promise<{
    totalTransfers: number;
    transfersByCountry: { country: string; count: number }[];
    transfersByRiskLevel: { riskLevel: string; count: number }[];
    transfersByMechanism: { mechanism: string; count: number }[];
    pendingTias: number;
    overdueReviews: number;
    complianceScore: number;
  }> {
    // Get total transfers
    const [totalResult] = await db.select({ count: count() })
      .from(internationalTransfers)
      .where(eq(internationalTransfers.organisationId, organisationId));
    const totalTransfers = totalResult.count;

    // Get transfers by country
    const transfersByCountry = await db.select({
      country: internationalTransfers.destinationCountry,
      count: count()
    })
      .from(internationalTransfers)
      .where(eq(internationalTransfers.organisationId, organisationId))
      .groupBy(internationalTransfers.destinationCountry)
      .orderBy(desc(count()));

    // Get transfers by risk level
    const transfersByRiskLevel = await db.select({
      riskLevel: internationalTransfers.riskLevel,
      count: count()
    })
      .from(internationalTransfers)
      .where(eq(internationalTransfers.organisationId, organisationId))
      .groupBy(internationalTransfers.riskLevel)
      .orderBy(desc(count()));

    // Get transfers by mechanism
    const transfersByMechanism = await db.select({
      mechanism: internationalTransfers.transferMechanism,
      count: count()
    })
      .from(internationalTransfers)
      .where(eq(internationalTransfers.organisationId, organisationId))
      .groupBy(internationalTransfers.transferMechanism)
      .orderBy(desc(count()));

    // Get pending TIAs
    const [pendingTiasResult] = await db.select({ count: count() })
      .from(transferImpactAssessments)
      .where(and(
        eq(transferImpactAssessments.organisationId, organisationId),
        inArray(transferImpactAssessments.status, ['draft', 'under_review', 'requires_revision'])
      ));
    const pendingTias = pendingTiasResult.count;

    // Get overdue reviews
    const now = new Date();
    const [overdueReviewsResult] = await db.select({ count: count() })
      .from(internationalTransfers)
      .where(and(
        eq(internationalTransfers.organisationId, organisationId),
        sql`${internationalTransfers.reviewDue} < ${now}`,
        eq(internationalTransfers.status, 'active')
      ));
    const overdueReviews = overdueReviewsResult.count;

    // Calculate compliance score (simplified)
    const highRiskTransfers = transfersByRiskLevel.find(t => t.riskLevel === 'high')?.count || 0;
    const veryHighRiskTransfers = transfersByRiskLevel.find(t => t.riskLevel === 'very_high')?.count || 0;
    const complianceScore = totalTransfers > 0 
      ? Math.max(0, 100 - ((highRiskTransfers * 10) + (veryHighRiskTransfers * 20) + (overdueReviews * 15)))
      : 100;

    return {
      totalTransfers,
      transfersByCountry,
      transfersByRiskLevel,
      transfersByMechanism,
      pendingTias,
      overdueReviews,
      complianceScore
    };
  }

  async calculateTransferRisk(destinationCountry: string, dataCategories: string[], mechanism: string): Promise<{
    riskLevel: string;
    riskScore: number;
    riskFactors: string[];
    recommendations: string[];
  }> {
    let riskScore = 0;
    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    // Check adequacy decision
    const adequacyDecision = await this.getAdequacyDecisionByCountry(destinationCountry);
    if (!adequacyDecision || adequacyDecision.status !== 'adequate') {
      riskScore += 30;
      riskFactors.push('No adequacy decision in place');
      recommendations.push('Consider additional safeguards or alternative destinations');
    }

    // Check for special categories of data
    const specialCategoryIndicators = ['health', 'biometric', 'genetic', 'racial', 'religious', 'political'];
    const hasSpecialCategories = dataCategories.some(category => 
      specialCategoryIndicators.some(indicator => category.toLowerCase().includes(indicator))
    );
    if (hasSpecialCategories) {
      riskScore += 25;
      riskFactors.push('Special categories of personal data involved');
      recommendations.push('Implement additional technical and organizational measures');
    }

    // Check mechanism appropriateness
    if (mechanism === 'explicit_consent') {
      riskScore += 20;
      riskFactors.push('Relying on explicit consent for regular transfers');
      recommendations.push('Consider implementing appropriate safeguards instead');
    }

    // Determine risk level
    let riskLevel: string;
    if (riskScore >= 70) {
      riskLevel = 'very_high';
    } else if (riskScore >= 50) {
      riskLevel = 'high';
    } else if (riskScore >= 30) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return {
      riskLevel,
      riskScore,
      riskFactors,
      recommendations
    };
  }

  async validateTransferCompliance(transferId: string): Promise<{
    isCompliant: boolean;
    issues: string[];
    recommendations: string[];
    requiredActions: string[];
  }> {
    const transfer = await this.getInternationalTransfer(transferId);
    if (!transfer) {
      return {
        isCompliant: false,
        issues: ['Transfer not found'],
        recommendations: [],
        requiredActions: ['Verify transfer exists']
      };
    }

    const issues: string[] = [];
    const recommendations: string[] = [];
    const requiredActions: string[] = [];

    // Check if TIA is required and present
    if (transfer.riskLevel === 'high' || transfer.riskLevel === 'very_high') {
      if (!transfer.transferImpactAssessmentId) {
        issues.push('Transfer Impact Assessment required for high-risk transfer');
        requiredActions.push('Complete Transfer Impact Assessment');
      }
    }

    // Check if review is overdue
    if (transfer.reviewDue && new Date() > transfer.reviewDue) {
      issues.push('Transfer review is overdue');
      requiredActions.push('Conduct transfer review');
    }

    // Check adequacy decision status
    const adequacyDecision = await this.getAdequacyDecisionByCountry(transfer.destinationCountry);
    if (!adequacyDecision || adequacyDecision.status !== 'adequate') {
      if (transfer.legalBasis === 'adequacy_decision') {
        issues.push('No adequacy decision available for claimed legal basis');
        requiredActions.push('Update legal basis or implement appropriate safeguards');
      }
    }

    // Check if appropriate safeguards are in place
    if (transfer.legalBasis === 'appropriate_safeguards') {
      if (!transfer.mechanismReference) {
        issues.push('No mechanism reference provided for appropriate safeguards');
        requiredActions.push('Specify transfer mechanism and reference');
      }
    }

    const isCompliant = issues.length === 0;

    return {
      isCompliant,
      issues,
      recommendations,
      requiredActions
    };
  }

  // Enhanced Data Retention Policies operations - GDPR Article 5(e) compliance
  async createDataRetentionPolicy(policy: InsertDataRetentionPolicy): Promise<DataRetentionPolicy> {
    const [retentionPolicy] = await db.insert(dataRetentionPolicies).values({
      ...policy,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return retentionPolicy;
  }

  async getDataRetentionPolicy(id: string): Promise<DataRetentionPolicy | undefined> {
    const [policy] = await db.select().from(dataRetentionPolicies).where(eq(dataRetentionPolicies.id, id));
    return policy;
  }

  async getDataRetentionPoliciesByOrganisation(organisationId: string): Promise<DataRetentionPolicy[]> {
    return await db.select().from(dataRetentionPolicies)
      .where(eq(dataRetentionPolicies.organisationId, organisationId))
      .orderBy(desc(dataRetentionPolicies.createdAt));
  }

  async getDataRetentionPoliciesByDataType(organisationId: string, dataType: string): Promise<DataRetentionPolicy[]> {
    return await db.select().from(dataRetentionPolicies)
      .where(and(
        eq(dataRetentionPolicies.organisationId, organisationId),
        eq(dataRetentionPolicies.dataType, dataType)
      ))
      .orderBy(desc(dataRetentionPolicies.priority));
  }

  async updateDataRetentionPolicy(id: string, policy: Partial<InsertDataRetentionPolicy>): Promise<DataRetentionPolicy> {
    const [retentionPolicy] = await db
      .update(dataRetentionPolicies)
      .set({ ...policy, updatedAt: new Date() })
      .where(eq(dataRetentionPolicies.id, id))
      .returning();
    return retentionPolicy;
  }

  async deleteDataRetentionPolicy(id: string): Promise<void> {
    await db.delete(dataRetentionPolicies).where(eq(dataRetentionPolicies.id, id));
  }

  async getEnabledDataRetentionPolicies(organisationId: string): Promise<DataRetentionPolicy[]> {
    return await db.select().from(dataRetentionPolicies)
      .where(and(
        eq(dataRetentionPolicies.organisationId, organisationId),
        eq(dataRetentionPolicies.enabled, true)
      ))
      .orderBy(desc(dataRetentionPolicies.priority));
  }

  async getDataRetentionPolicyByPriority(organisationId: string, dataType: string): Promise<DataRetentionPolicy | undefined> {
    const [policy] = await db.select().from(dataRetentionPolicies)
      .where(and(
        eq(dataRetentionPolicies.organisationId, organisationId),
        eq(dataRetentionPolicies.dataType, dataType),
        eq(dataRetentionPolicies.enabled, true)
      ))
      .orderBy(desc(dataRetentionPolicies.priority))
      .limit(1);
    return policy;
  }

  // Data Lifecycle Records operations
  async createDataLifecycleRecord(record: InsertDataLifecycleRecord): Promise<DataLifecycleRecord> {
    const [lifecycleRecord] = await db.insert(dataLifecycleRecords).values({
      ...record,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return lifecycleRecord;
  }

  async getDataLifecycleRecord(id: string): Promise<DataLifecycleRecord | undefined> {
    const [record] = await db.select().from(dataLifecycleRecords).where(eq(dataLifecycleRecords.id, id));
    return record;
  }

  async getDataLifecycleRecordsByOrganisation(organisationId: string): Promise<DataLifecycleRecord[]> {
    return await db.select().from(dataLifecycleRecords)
      .where(eq(dataLifecycleRecords.organisationId, organisationId))
      .orderBy(desc(dataLifecycleRecords.createdAt));
  }

  async getDataLifecycleRecordsByStatus(organisationId: string, status: string): Promise<DataLifecycleRecord[]> {
    return await db.select().from(dataLifecycleRecords)
      .where(and(
        eq(dataLifecycleRecords.organisationId, organisationId),
        eq(dataLifecycleRecords.status, status)
      ))
      .orderBy(desc(dataLifecycleRecords.updatedAt));
  }

  async getDataLifecycleRecordsByResource(entityId: string, entityType: string): Promise<DataLifecycleRecord[]> {
    return await db.select().from(dataLifecycleRecords)
      .where(and(
        eq(dataLifecycleRecords.entityId, entityId),
        eq(dataLifecycleRecords.entityType, entityType)
      ))
      .orderBy(desc(dataLifecycleRecords.createdAt));
  }

  async updateDataLifecycleRecord(id: string, record: Partial<InsertDataLifecycleRecord>): Promise<DataLifecycleRecord> {
    const [lifecycleRecord] = await db
      .update(dataLifecycleRecords)
      .set({ ...record, updatedAt: new Date() })
      .where(eq(dataLifecycleRecords.id, id))
      .returning();
    return lifecycleRecord;
  }

  async deleteDataLifecycleRecord(id: string): Promise<void> {
    await db.delete(dataLifecycleRecords).where(eq(dataLifecycleRecords.id, id));
  }

  // Retention Compliance Audits operations
  async createRetentionComplianceAudit(audit: InsertRetentionComplianceAudit): Promise<RetentionComplianceAudit> {
    const [complianceAudit] = await db.insert(retentionComplianceAudits).values({
      ...audit,
      createdAt: new Date(),
    }).returning();
    return complianceAudit;
  }

  async getRetentionComplianceAudit(id: string): Promise<RetentionComplianceAudit | undefined> {
    const [audit] = await db.select().from(retentionComplianceAudits).where(eq(retentionComplianceAudits.id, id));
    return audit;
  }

  async getRetentionComplianceAuditsByOrganisation(organisationId: string, filters: {
    policyId?: string;
    operation?: string;
    complianceStatus?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<RetentionComplianceAudit[]> {
    const { policyId, operation, complianceStatus, fromDate, toDate, limit = 50, offset = 0 } = filters;

    const conditions: any[] = [eq(retentionComplianceAudits.organisationId, organisationId)];
    if (policyId) {
      conditions.push(eq(retentionComplianceAudits.policyId, policyId));
    }
    if (operation) {
      conditions.push(eq(retentionComplianceAudits.operation, operation));
    }
    if (complianceStatus) {
      conditions.push(eq(retentionComplianceAudits.complianceStatus, complianceStatus));
    }
    if (fromDate) {
      conditions.push(sql`${retentionComplianceAudits.auditTimestamp} >= ${fromDate.toISOString()}`);
    }
    if (toDate) {
      conditions.push(sql`${retentionComplianceAudits.auditTimestamp} <= ${toDate.toISOString()}`);
    }

    return await db.select().from(retentionComplianceAudits)
      .where(and(...conditions))
      .orderBy(desc(retentionComplianceAudits.auditTimestamp))
      .limit(limit)
      .offset(offset);
  }

  // Secure Deletion Certificates operations
  async createSecureDeletionCertificate(certificate: InsertSecureDeletionCertificate): Promise<SecureDeletionCertificate> {
    const [deletionCertificate] = await db.insert(secureDeletionCertificates).values({
      ...certificate,
      createdAt: new Date(),
    }).returning();
    return deletionCertificate;
  }

  async getSecureDeletionCertificate(id: string): Promise<SecureDeletionCertificate | undefined> {
    const [certificate] = await db.select().from(secureDeletionCertificates).where(eq(secureDeletionCertificates.id, id));
    return certificate;
  }

  async getSecureDeletionCertificatesByOrganisation(organisationId: string): Promise<SecureDeletionCertificate[]> {
    return await db.select().from(secureDeletionCertificates)
      .where(eq(secureDeletionCertificates.organisationId, organisationId))
      .orderBy(desc(secureDeletionCertificates.createdAt));
  }

  // Stub methods for data eligibility checks (to be implemented with actual business logic)
  async getDataEligibleForSoftDelete(organisationId: string): Promise<any[]> {
    // TODO: Implement actual logic to find data eligible for soft deletion
    // This would query specific data tables based on retention policies
    console.log(`[Storage] getDataEligibleForSoftDelete called for organization: ${organisationId}`);
    return [];
  }

  async getDataEligibleForSecureErase(organisationId: string): Promise<any[]> {
    // TODO: Implement actual logic to find data eligible for secure erasure
    // This would query lifecycle records for soft-deleted data past grace period
    console.log(`[Storage] getDataEligibleForSecureErase called for organization: ${organisationId}`);
    return [];
  }

  async getDataEligibleForRetention(organisationId: string): Promise<any[]> {
    // TODO: Implement actual logic to find data eligible for retention processing
    // This would identify overdue records that need retention processing
    console.log(`[Storage] getDataEligibleForRetention called for organization: ${organisationId}`);
    return [];
  }

  // ===== COMPLIANCE DOCUMENTS OPERATIONS =====
  // Auto-generated legal documents for GDPR regulatory compliance

  // Document management
  async createComplianceDocument(document: InsertComplianceDocument): Promise<ComplianceDocument> {
    const [complianceDocument] = await db.insert(complianceDocuments).values({
      ...document,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return complianceDocument;
  }

  async getComplianceDocument(id: string): Promise<ComplianceDocument | undefined> {
    const [document] = await db.select().from(complianceDocuments).where(eq(complianceDocuments.id, id));
    return document;
  }

  async getComplianceDocumentsByOrganisation(organisationId: string): Promise<ComplianceDocument[]> {
    return await db.select().from(complianceDocuments)
      .where(eq(complianceDocuments.organisationId, organisationId))
      .orderBy(desc(complianceDocuments.createdAt));
  }

  async getComplianceDocumentsByType(organisationId: string, documentType: string): Promise<ComplianceDocument[]> {
    return await db.select().from(complianceDocuments)
      .where(and(
        eq(complianceDocuments.organisationId, organisationId),
        eq(complianceDocuments.documentType, documentType)
      ))
      .orderBy(desc(complianceDocuments.version));
  }

  async getComplianceDocumentsByStatus(organisationId: string, status: string): Promise<ComplianceDocument[]> {
    return await db.select().from(complianceDocuments)
      .where(and(
        eq(complianceDocuments.organisationId, organisationId),
        eq(complianceDocuments.status, status)
      ))
      .orderBy(desc(complianceDocuments.updatedAt));
  }

  async getCurrentVersionComplianceDocument(organisationId: string, documentType: string): Promise<ComplianceDocument | undefined> {
    const [document] = await db.select().from(complianceDocuments)
      .where(and(
        eq(complianceDocuments.organisationId, organisationId),
        eq(complianceDocuments.documentType, documentType),
        eq(complianceDocuments.isCurrentVersion, true)
      ))
      .limit(1);
    return document;
  }

  async updateComplianceDocument(id: string, document: Partial<InsertComplianceDocument>): Promise<ComplianceDocument> {
    const [updatedDocument] = await db
      .update(complianceDocuments)
      .set({ ...document, updatedAt: new Date() })
      .where(eq(complianceDocuments.id, id))
      .returning();
    return updatedDocument;
  }

  async deleteComplianceDocument(id: string): Promise<void> {
    await db.delete(complianceDocuments).where(eq(complianceDocuments.id, id));
  }

  async archiveComplianceDocument(id: string): Promise<ComplianceDocument> {
    const [archivedDocument] = await db
      .update(complianceDocuments)
      .set({ 
        status: 'archived',
        isCurrentVersion: false,
        updatedAt: new Date()
      })
      .where(eq(complianceDocuments.id, id))
      .returning();
    return archivedDocument;
  }

  async publishComplianceDocument(id: string, publishedBy: string): Promise<ComplianceDocument> {
    const [publishedDocument] = await db
      .update(complianceDocuments)
      .set({ 
        status: 'published',
        publishedAt: new Date(),
        approvedBy: publishedBy,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(complianceDocuments.id, id))
      .returning();
    return publishedDocument;
  }

  async supersederComplianceDocument(oldDocumentId: string, newDocumentId: string): Promise<void> {
    // Mark old document as superseded
    await db
      .update(complianceDocuments)
      .set({ 
        status: 'superseded',
        isCurrentVersion: false,
        updatedAt: new Date()
      })
      .where(eq(complianceDocuments.id, oldDocumentId));

    // Mark new document as current
    await db
      .update(complianceDocuments)
      .set({ 
        isCurrentVersion: true,
        parentDocumentId: oldDocumentId,
        updatedAt: new Date()
      })
      .where(eq(complianceDocuments.id, newDocumentId));
  }

  async getDocumentsRequiringRegeneration(organisationId: string): Promise<ComplianceDocument[]> {
    return await db.select().from(complianceDocuments)
      .where(and(
        eq(complianceDocuments.organisationId, organisationId),
        eq(complianceDocuments.requiresRegeneration, true),
        eq(complianceDocuments.isCurrentVersion, true)
      ))
      .orderBy(desc(complianceDocuments.lastAutoGenerated));
  }

  async markDocumentForRegeneration(id: string): Promise<ComplianceDocument> {
    const [updatedDocument] = await db
      .update(complianceDocuments)
      .set({ 
        requiresRegeneration: true,
        updatedAt: new Date()
      })
      .where(eq(complianceDocuments.id, id))
      .returning();
    return updatedDocument;
  }

  // Document templates
  async createComplianceDocumentTemplate(template: InsertComplianceDocumentTemplate): Promise<ComplianceDocumentTemplate> {
    const [complianceTemplate] = await db.insert(complianceDocumentTemplates).values({
      ...template,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return complianceTemplate;
  }

  async getComplianceDocumentTemplate(id: string): Promise<ComplianceDocumentTemplate | undefined> {
    const [template] = await db.select().from(complianceDocumentTemplates).where(eq(complianceDocumentTemplates.id, id));
    return template;
  }

  async getComplianceDocumentTemplatesByType(documentType: string): Promise<ComplianceDocumentTemplate[]> {
    return await db.select().from(complianceDocumentTemplates)
      .where(and(
        eq(complianceDocumentTemplates.documentType, documentType),
        eq(complianceDocumentTemplates.isActive, true)
      ))
      .orderBy(desc(complianceDocumentTemplates.isDefault), desc(complianceDocumentTemplates.rating));
  }

  async getDefaultComplianceDocumentTemplate(documentType: string): Promise<ComplianceDocumentTemplate | undefined> {
    const [template] = await db.select().from(complianceDocumentTemplates)
      .where(and(
        eq(complianceDocumentTemplates.documentType, documentType),
        eq(complianceDocumentTemplates.isDefault, true),
        eq(complianceDocumentTemplates.isActive, true)
      ))
      .limit(1);
    return template;
  }

  async getActiveComplianceDocumentTemplates(): Promise<ComplianceDocumentTemplate[]> {
    return await db.select().from(complianceDocumentTemplates)
      .where(eq(complianceDocumentTemplates.isActive, true))
      .orderBy(asc(complianceDocumentTemplates.documentType), desc(complianceDocumentTemplates.isDefault));
  }

  async updateComplianceDocumentTemplate(id: string, template: Partial<InsertComplianceDocumentTemplate>): Promise<ComplianceDocumentTemplate> {
    const [updatedTemplate] = await db
      .update(complianceDocumentTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(complianceDocumentTemplates.id, id))
      .returning();
    return updatedTemplate;
  }

  async deleteComplianceDocumentTemplate(id: string): Promise<void> {
    await db.delete(complianceDocumentTemplates).where(eq(complianceDocumentTemplates.id, id));
  }

  async incrementTemplateUsage(id: string): Promise<void> {
    await db
      .update(complianceDocumentTemplates)
      .set({ 
        usageCount: sql`${complianceDocumentTemplates.usageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(complianceDocumentTemplates.id, id));
  }

  // Document audit trail
  async createComplianceDocumentAudit(audit: InsertComplianceDocumentAudit): Promise<ComplianceDocumentAudit> {
    const [auditRecord] = await db.insert(complianceDocumentAudit).values({
      ...audit,
      timestamp: new Date(),
    }).returning();
    return auditRecord;
  }

  async getComplianceDocumentAudit(id: string): Promise<ComplianceDocumentAudit | undefined> {
    const [audit] = await db.select().from(complianceDocumentAudit).where(eq(complianceDocumentAudit.id, id));
    return audit;
  }

  async getComplianceDocumentAuditsByDocument(documentId: string): Promise<ComplianceDocumentAudit[]> {
    return await db.select().from(complianceDocumentAudit)
      .where(eq(complianceDocumentAudit.documentId, documentId))
      .orderBy(desc(complianceDocumentAudit.timestamp));
  }

  async getComplianceDocumentAuditsByOrganisation(organisationId: string, filters: {
    documentId?: string;
    action?: string;
    actionBy?: string;
    legalReviewRequired?: boolean;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<ComplianceDocumentAudit[]> {
    const { documentId, action, actionBy, legalReviewRequired, fromDate, toDate, limit = 50, offset = 0 } = filters;

    const conditions: any[] = [eq(complianceDocumentAudit.organisationId, organisationId)];
    
    if (documentId) {
      conditions.push(eq(complianceDocumentAudit.documentId, documentId));
    }
    if (action) {
      conditions.push(eq(complianceDocumentAudit.action, action));
    }
    if (actionBy) {
      conditions.push(eq(complianceDocumentAudit.actionBy, actionBy));
    }
    if (legalReviewRequired !== undefined) {
      conditions.push(eq(complianceDocumentAudit.legalReviewRequired, legalReviewRequired));
    }
    if (fromDate) {
      conditions.push(sql`${complianceDocumentAudit.timestamp} >= ${fromDate}`);
    }
    if (toDate) {
      conditions.push(sql`${complianceDocumentAudit.timestamp} <= ${toDate}`);
    }

    return await db.select().from(complianceDocumentAudit)
      .where(and(...conditions))
      .orderBy(desc(complianceDocumentAudit.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async getComplianceDocumentAuditsRequiringLegalReview(organisationId: string): Promise<ComplianceDocumentAudit[]> {
    return await db.select().from(complianceDocumentAudit)
      .where(and(
        eq(complianceDocumentAudit.organisationId, organisationId),
        eq(complianceDocumentAudit.legalReviewRequired, true)
      ))
      .orderBy(desc(complianceDocumentAudit.timestamp));
  }

  // Document publications
  async createComplianceDocumentPublication(publication: InsertComplianceDocumentPublication): Promise<ComplianceDocumentPublication> {
    const [publicationRecord] = await db.insert(complianceDocumentPublications).values({
      ...publication,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return publicationRecord;
  }

  async getComplianceDocumentPublication(id: string): Promise<ComplianceDocumentPublication | undefined> {
    const [publication] = await db.select().from(complianceDocumentPublications).where(eq(complianceDocumentPublications.id, id));
    return publication;
  }

  async getComplianceDocumentPublicationByDocument(documentId: string): Promise<ComplianceDocumentPublication | undefined> {
    const [publication] = await db.select().from(complianceDocumentPublications)
      .where(eq(complianceDocumentPublications.documentId, documentId))
      .limit(1);
    return publication;
  }

  async getComplianceDocumentPublicationByUrl(publicUrl: string): Promise<ComplianceDocumentPublication | undefined> {
    const [publication] = await db.select().from(complianceDocumentPublications)
      .where(eq(complianceDocumentPublications.publicUrl, publicUrl))
      .limit(1);
    return publication;
  }

  async getPublishedComplianceDocumentsByOrganisation(organisationId: string): Promise<ComplianceDocumentPublication[]> {
    return await db.select().from(complianceDocumentPublications)
      .where(and(
        eq(complianceDocumentPublications.organisationId, organisationId),
        eq(complianceDocumentPublications.isActive, true)
      ))
      .orderBy(desc(complianceDocumentPublications.publishedAt));
  }

  async updateComplianceDocumentPublication(id: string, publication: Partial<InsertComplianceDocumentPublication>): Promise<ComplianceDocumentPublication> {
    const [updatedPublication] = await db
      .update(complianceDocumentPublications)
      .set({ ...publication, updatedAt: new Date() })
      .where(eq(complianceDocumentPublications.id, id))
      .returning();
    return updatedPublication;
  }

  async deleteComplianceDocumentPublication(id: string): Promise<void> {
    await db.delete(complianceDocumentPublications).where(eq(complianceDocumentPublications.id, id));
  }

  async incrementPublicationViews(id: string): Promise<void> {
    await db
      .update(complianceDocumentPublications)
      .set({ 
        viewCount: sql`${complianceDocumentPublications.viewCount} + 1`,
        lastAccessed: new Date(),
        updatedAt: new Date()
      })
      .where(eq(complianceDocumentPublications.id, id));
  }

  async incrementPublicationDownloads(id: string): Promise<void> {
    await db
      .update(complianceDocumentPublications)
      .set({ 
        downloadCount: sql`${complianceDocumentPublications.downloadCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(complianceDocumentPublications.id, id));
  }

  async getPublicComplianceDocument(publicUrl: string): Promise<{ document: ComplianceDocument; publication: ComplianceDocumentPublication } | undefined> {
    const result = await db
      .select({
        document: complianceDocuments,
        publication: complianceDocumentPublications,
      })
      .from(complianceDocumentPublications)
      .innerJoin(complianceDocuments, eq(complianceDocumentPublications.documentId, complianceDocuments.id))
      .where(and(
        eq(complianceDocumentPublications.publicUrl, publicUrl),
        eq(complianceDocumentPublications.isPublic, true),
        eq(complianceDocumentPublications.isActive, true),
        eq(complianceDocuments.status, 'published')
      ))
      .limit(1);

    return result[0] || undefined;
  }

  // ===== PECR MARKETING CONSENT OPERATIONS IMPLEMENTATION =====

  // Marketing consent operations
  async getMarketingConsent(id: string): Promise<MarketingConsent | undefined> {
    const [consent] = await db.select().from(marketingConsent).where(eq(marketingConsent.id, id));
    return consent;
  }

  async getMarketingConsentByUserAndType(userId: string, organisationId: string, consentType: string): Promise<MarketingConsent | undefined> {
    const [consent] = await db
      .select()
      .from(marketingConsent)
      .where(and(
        eq(marketingConsent.userId, userId),
        eq(marketingConsent.organisationId, organisationId),
        eq(marketingConsent.consentType, consentType)
      ))
      .orderBy(desc(marketingConsent.createdAt))
      .limit(1);
    return consent;
  }

  async getMarketingConsentsByUser(userId: string, organisationId?: string): Promise<MarketingConsent[]> {
    const conditions = [eq(marketingConsent.userId, userId)];
    if (organisationId) {
      conditions.push(eq(marketingConsent.organisationId, organisationId));
    }

    return await db
      .select()
      .from(marketingConsent)
      .where(and(...conditions))
      .orderBy(desc(marketingConsent.createdAt));
  }

  async getMarketingConsentsByOrganisation(organisationId: string): Promise<MarketingConsent[]> {
    return await db
      .select()
      .from(marketingConsent)
      .where(eq(marketingConsent.organisationId, organisationId))
      .orderBy(desc(marketingConsent.createdAt));
  }

  async createMarketingConsent(consentData: InsertMarketingConsent): Promise<MarketingConsent> {
    const [consent] = await db
      .insert(marketingConsent)
      .values(consentData)
      .returning();

    // Create consent history entry
    await this.createConsentHistoryEntry({
      userId: consent.userId,
      organisationId: consent.organisationId,
      marketingConsentId: consent.id,
      consentType: consent.consentType,
      action: 'granted',
      newStatus: consent.consentStatus,
      source: consent.consentSource,
      evidenceType: consent.evidenceType,
      evidenceData: consent.consentEvidence,
      processingLawfulBasis: consent.lawfulBasis,
      effectiveDate: consent.consentGivenAt,
      ipAddress: consent.ipAddress,
      userAgent: consent.userAgent,
    });

    return consent;
  }

  async updateMarketingConsent(id: string, consentData: Partial<InsertMarketingConsent>): Promise<MarketingConsent> {
    const [consent] = await db
      .update(marketingConsent)
      .set({ ...consentData, updatedAt: new Date() })
      .where(eq(marketingConsent.id, id))
      .returning();

    if (!consent) {
      throw new Error('Marketing consent not found');
    }

    // Create consent history entry for modification
    await this.createConsentHistoryEntry({
      userId: consent.userId,
      organisationId: consent.organisationId,
      marketingConsentId: consent.id,
      consentType: consent.consentType,
      action: 'modified',
      newStatus: consent.consentStatus,
      source: consent.consentSource,
      evidenceType: consent.evidenceType,
      effectiveDate: new Date().toISOString(),
    });

    return consent;
  }

  async withdrawMarketingConsent(id: string, withdrawalReason?: string): Promise<MarketingConsent> {
    const [consent] = await db
      .update(marketingConsent)
      .set({
        consentStatus: 'withdrawn',
        consentWithdrawnAt: new Date(),
        withdrawalReason,
        updatedAt: new Date(),
      })
      .where(eq(marketingConsent.id, id))
      .returning();

    if (!consent) {
      throw new Error('Marketing consent not found');
    }

    // Create consent history entry for withdrawal
    await this.createConsentHistoryEntry({
      userId: consent.userId,
      organisationId: consent.organisationId,
      marketingConsentId: consent.id,
      consentType: consent.consentType,
      action: 'withdrawn',
      previousStatus: 'granted',
      newStatus: 'withdrawn',
      source: 'user_request',
      evidenceType: 'withdrawal',
      changeReason: withdrawalReason,
      effectiveDate: consent.consentWithdrawnAt || new Date().toISOString(),
    });

    return consent;
  }

  async deleteMarketingConsent(id: string): Promise<void> {
    await db.delete(marketingConsent).where(eq(marketingConsent.id, id));
  }

  async verifyMarketingConsent(userId: string, organisationId: string, consentType: string): Promise<boolean> {
    const consent = await this.getMarketingConsentByUserAndType(userId, organisationId, consentType);
    
    if (!consent || consent.consentStatus !== 'granted') {
      return false;
    }

    // Check if consent has expired
    if (consent.expiryDate && new Date() > new Date(consent.expiryDate)) {
      return false;
    }

    return true;
  }

  async getMarketingConsentsRequiringRenewal(daysBeforeExpiry: number): Promise<MarketingConsent[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysBeforeExpiry);

    return await db
      .select()
      .from(marketingConsent)
      .where(and(
        eq(marketingConsent.consentStatus, 'granted'),
        lt(marketingConsent.expiryDate, cutoffDate.toISOString())
      ))
      .orderBy(asc(marketingConsent.expiryDate));
  }

  async bulkWithdrawMarketingConsent(userIds: string[], organisationId: string, consentType: string, reason?: string): Promise<number> {
    const result = await db
      .update(marketingConsent)
      .set({
        consentStatus: 'withdrawn',
        consentWithdrawnAt: new Date(),
        withdrawalReason: reason,
        updatedAt: new Date(),
      })
      .where(and(
        inArray(marketingConsent.userId, userIds),
        eq(marketingConsent.organisationId, organisationId),
        eq(marketingConsent.consentType, consentType),
        eq(marketingConsent.consentStatus, 'granted')
      ))
      .returning();

    // Create consent history entries for bulk withdrawal
    for (const consent of result) {
      await this.createConsentHistoryEntry({
        userId: consent.userId,
        organisationId: consent.organisationId,
        marketingConsentId: consent.id,
        consentType: consent.consentType,
        action: 'withdrawn',
        previousStatus: 'granted',
        newStatus: 'withdrawn',
        source: 'admin_action',
        evidenceType: 'withdrawal',
        changeReason: reason,
        effectiveDate: consent.consentWithdrawnAt || new Date().toISOString(),
        automatedAction: true,
      });
    }

    return result.length;
  }

  // Communication preferences operations
  async getCommunicationPreferences(id: string): Promise<CommunicationPreferences | undefined> {
    const [preferences] = await db.select().from(communicationPreferences).where(eq(communicationPreferences.id, id));
    return preferences;
  }

  async getCommunicationPreferencesByUser(userId: string, organisationId: string): Promise<CommunicationPreferences[]> {
    return await db
      .select()
      .from(communicationPreferences)
      .where(and(
        eq(communicationPreferences.userId, userId),
        eq(communicationPreferences.organisationId, organisationId)
      ))
      .orderBy(communicationPreferences.communicationType, communicationPreferences.channel);
  }

  async getCommunicationPreferencesByUserAndType(userId: string, organisationId: string, communicationType: string, channel: string): Promise<CommunicationPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(communicationPreferences)
      .where(and(
        eq(communicationPreferences.userId, userId),
        eq(communicationPreferences.organisationId, organisationId),
        eq(communicationPreferences.communicationType, communicationType),
        eq(communicationPreferences.channel, channel)
      ))
      .limit(1);
    return preferences;
  }

  async createCommunicationPreferences(preferencesData: InsertCommunicationPreferences): Promise<CommunicationPreferences> {
    const [preferences] = await db
      .insert(communicationPreferences)
      .values(preferencesData)
      .returning();
    return preferences;
  }

  async updateCommunicationPreferences(id: string, preferencesData: Partial<InsertCommunicationPreferences>): Promise<CommunicationPreferences> {
    const [preferences] = await db
      .update(communicationPreferences)
      .set({ ...preferencesData, updatedAt: new Date() })
      .where(eq(communicationPreferences.id, id))
      .returning();

    if (!preferences) {
      throw new Error('Communication preferences not found');
    }

    return preferences;
  }

  async deleteCommunicationPreferences(id: string): Promise<void> {
    await db.delete(communicationPreferences).where(eq(communicationPreferences.id, id));
  }

  async bulkUpdateCommunicationPreferences(userId: string, organisationId: string, preferencesUpdates: Partial<InsertCommunicationPreferences>[]): Promise<CommunicationPreferences[]> {
    const results: CommunicationPreferences[] = [];

    for (const update of preferencesUpdates) {
      if (update.communicationType && update.channel) {
        // Try to find existing preference
        const existing = await this.getCommunicationPreferencesByUserAndType(
          userId, 
          organisationId, 
          update.communicationType, 
          update.channel
        );

        if (existing) {
          const updated = await this.updateCommunicationPreferences(existing.id, update);
          results.push(updated);
        } else {
          const created = await this.createCommunicationPreferences({
            userId,
            organisationId,
            ...update,
          } as InsertCommunicationPreferences);
          results.push(created);
        }
      }
    }

    return results;
  }

  async checkCommunicationAllowed(userId: string, organisationId: string, communicationType: string, channel: string): Promise<boolean> {
    // Check for global opt-out
    const globalOptOut = await db
      .select()
      .from(communicationPreferences)
      .where(and(
        eq(communicationPreferences.userId, userId),
        eq(communicationPreferences.organisationId, organisationId),
        eq(communicationPreferences.globalOptOut, true)
      ))
      .limit(1);

    if (globalOptOut.length > 0) {
      return false;
    }

    // Check specific preference
    const preference = await this.getCommunicationPreferencesByUserAndType(userId, organisationId, communicationType, channel);
    
    if (!preference) {
      // Default behavior based on communication type
      return communicationType === 'service_essential';
    }

    return preference.isEnabled;
  }

  async getGlobalOptOuts(organisationId: string): Promise<CommunicationPreferences[]> {
    return await db
      .select()
      .from(communicationPreferences)
      .where(and(
        eq(communicationPreferences.organisationId, organisationId),
        eq(communicationPreferences.globalOptOut, true)
      ));
  }

  // Marketing campaigns operations
  async getMarketingCampaign(id: string): Promise<MarketingCampaigns | undefined> {
    const [campaign] = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, id));
    return campaign;
  }

  async getMarketingCampaignsByOrganisation(organisationId: string, status?: string): Promise<MarketingCampaigns[]> {
    const conditions = [eq(marketingCampaigns.organisationId, organisationId)];
    if (status) {
      conditions.push(eq(marketingCampaigns.status, status));
    }

    return await db
      .select()
      .from(marketingCampaigns)
      .where(and(...conditions))
      .orderBy(desc(marketingCampaigns.createdAt));
  }

  async createMarketingCampaign(campaignData: InsertMarketingCampaigns): Promise<MarketingCampaigns> {
    const [campaign] = await db
      .insert(marketingCampaigns)
      .values(campaignData)
      .returning();
    return campaign;
  }

  async updateMarketingCampaign(id: string, campaignData: Partial<InsertMarketingCampaigns>): Promise<MarketingCampaigns> {
    const [campaign] = await db
      .update(marketingCampaigns)
      .set({ ...campaignData, updatedAt: new Date() })
      .where(eq(marketingCampaigns.id, id))
      .returning();

    if (!campaign) {
      throw new Error('Marketing campaign not found');
    }

    return campaign;
  }

  async deleteMarketingCampaign(id: string): Promise<void> {
    await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, id));
  }

  async getScheduledCampaigns(cutoffDate: Date): Promise<MarketingCampaigns[]> {
    return await db
      .select()
      .from(marketingCampaigns)
      .where(and(
        eq(marketingCampaigns.status, 'scheduled'),
        lt(marketingCampaigns.scheduledAt, cutoffDate.toISOString())
      ))
      .orderBy(asc(marketingCampaigns.scheduledAt));
  }

  async getCampaignRecipients(campaignId: string): Promise<{ userId: string; email: string; consentStatus: string; }[]> {
    const campaign = await this.getMarketingCampaign(campaignId);
    if (!campaign) {
      return [];
    }

    // This would need to be customized based on campaign targeting criteria
    // For now, get all users in the organisation with marketing consent
    const recipients = await db
      .select({
        userId: users.id,
        email: users.email,
        consentStatus: marketingConsent.consentStatus,
      })
      .from(users)
      .leftJoin(marketingConsent, and(
        eq(marketingConsent.userId, users.id),
        eq(marketingConsent.organisationId, campaign.organisationId),
        inArray(marketingConsent.consentType, campaign.requiredConsentTypes)
      ))
      .where(eq(users.organisationId, campaign.organisationId));

    return recipients;
  }

  async validateCampaignCompliance(campaignId: string): Promise<{ isCompliant: boolean; issues: string[]; recipientCount: number; }> {
    const campaign = await this.getMarketingCampaign(campaignId);
    if (!campaign) {
      return { isCompliant: false, issues: ['Campaign not found'], recipientCount: 0 };
    }

    const recipients = await this.getCampaignRecipients(campaignId);
    const issues: string[] = [];

    // Check for required consents
    const validRecipients = recipients.filter(r => r.consentStatus === 'granted');
    const invalidRecipients = recipients.filter(r => r.consentStatus !== 'granted');

    if (invalidRecipients.length > 0) {
      issues.push(`${invalidRecipients.length} recipients without valid consent`);
    }

    if (campaign.requiredConsentTypes.length === 0) {
      issues.push('No required consent types specified');
    }

    if (!campaign.complianceChecked) {
      issues.push('Campaign compliance not verified');
    }

    return {
      isCompliant: issues.length === 0,
      issues,
      recipientCount: validRecipients.length,
    };
  }

  async updateCampaignStats(campaignId: string, stats: { sentCount?: number; deliveredCount?: number; openedCount?: number; clickedCount?: number; unsubscribedCount?: number; bounceCount?: number; }): Promise<MarketingCampaigns> {
    const [campaign] = await db
      .update(marketingCampaigns)
      .set({ ...stats, updatedAt: new Date() })
      .where(eq(marketingCampaigns.id, campaignId))
      .returning();

    if (!campaign) {
      throw new Error('Marketing campaign not found');
    }

    return campaign;
  }

  // Consent history operations
  async getConsentHistory(id: string): Promise<ConsentHistory | undefined> {
    const [history] = await db.select().from(consentHistory).where(eq(consentHistory.id, id));
    return history;
  }

  async getConsentHistoryByUser(userId: string, organisationId?: string): Promise<ConsentHistory[]> {
    const conditions = [eq(consentHistory.userId, userId)];
    if (organisationId) {
      conditions.push(eq(consentHistory.organisationId, organisationId));
    }

    return await db
      .select()
      .from(consentHistory)
      .where(and(...conditions))
      .orderBy(desc(consentHistory.recordedAt));
  }

  async getConsentHistoryByConsentId(marketingConsentId: string): Promise<ConsentHistory[]> {
    return await db
      .select()
      .from(consentHistory)
      .where(eq(consentHistory.marketingConsentId, marketingConsentId))
      .orderBy(desc(consentHistory.recordedAt));
  }

  async createConsentHistoryEntry(historyData: InsertConsentHistory): Promise<ConsentHistory> {
    const [history] = await db
      .insert(consentHistory)
      .values(historyData)
      .returning();
    return history;
  }

  async getConsentAuditTrail(userId: string, organisationId: string, consentType?: string): Promise<ConsentHistory[]> {
    const conditions = [
      eq(consentHistory.userId, userId),
      eq(consentHistory.organisationId, organisationId),
    ];
    
    if (consentType) {
      conditions.push(eq(consentHistory.consentType, consentType));
    }

    return await db
      .select()
      .from(consentHistory)
      .where(and(...conditions))
      .orderBy(desc(consentHistory.effectiveDate));
  }

  async getConsentHistoryReport(organisationId: string, startDate: Date, endDate: Date): Promise<{ 
    totalGrants: number; 
    totalWithdrawals: number; 
    totalModifications: number; 
    consentsByType: { [key: string]: number };
    dailyActivity: { date: string; grants: number; withdrawals: number; }[];
  }> {
    const historyRecords = await db
      .select()
      .from(consentHistory)
      .where(and(
        eq(consentHistory.organisationId, organisationId),
        gte(consentHistory.effectiveDate, startDate.toISOString()),
        lt(consentHistory.effectiveDate, endDate.toISOString())
      ));

    const totalGrants = historyRecords.filter(h => h.action === 'granted').length;
    const totalWithdrawals = historyRecords.filter(h => h.action === 'withdrawn').length;
    const totalModifications = historyRecords.filter(h => h.action === 'modified').length;

    // Group by consent type
    const consentsByType: { [key: string]: number } = {};
    historyRecords.forEach(h => {
      if (h.action === 'granted') {
        consentsByType[h.consentType] = (consentsByType[h.consentType] || 0) + 1;
      }
    });

    // Daily activity aggregation
    const dailyActivity: { date: string; grants: number; withdrawals: number; }[] = [];
    const dailyStats = new Map<string, { grants: number; withdrawals: number; }>();

    historyRecords.forEach(h => {
      const date = new Date(h.effectiveDate).toISOString().split('T')[0];
      if (!dailyStats.has(date)) {
        dailyStats.set(date, { grants: 0, withdrawals: 0 });
      }
      const stats = dailyStats.get(date)!;
      if (h.action === 'granted') stats.grants++;
      if (h.action === 'withdrawn') stats.withdrawals++;
    });

    for (const [date, stats] of dailyStats) {
      dailyActivity.push({ date, ...stats });
    }

    dailyActivity.sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalGrants,
      totalWithdrawals,
      totalModifications,
      consentsByType,
      dailyActivity,
    };
  }

  // Suppression list operations
  async getSuppressionListEntry(id: string): Promise<SuppressionList | undefined> {
    const [entry] = await db.select().from(suppressionList).where(eq(suppressionList.id, id));
    return entry;
  }

  async getSuppressionListByOrganisation(organisationId: string): Promise<SuppressionList[]> {
    return await db
      .select()
      .from(suppressionList)
      .where(and(
        eq(suppressionList.organisationId, organisationId),
        eq(suppressionList.isActive, true)
      ))
      .orderBy(desc(suppressionList.createdAt));
  }

  async getSuppressionListByEmail(email: string, organisationId?: string): Promise<SuppressionList[]> {
    const conditions = [
      eq(suppressionList.email, email),
      eq(suppressionList.isActive, true)
    ];
    
    if (organisationId) {
      conditions.push(eq(suppressionList.organisationId, organisationId));
    }

    return await db
      .select()
      .from(suppressionList)
      .where(and(...conditions));
  }

  async getSuppressionListByPhone(phone: string, organisationId?: string): Promise<SuppressionList[]> {
    const conditions = [
      eq(suppressionList.phone, phone),
      eq(suppressionList.isActive, true)
    ];
    
    if (organisationId) {
      conditions.push(eq(suppressionList.organisationId, organisationId));
    }

    return await db
      .select()
      .from(suppressionList)
      .where(and(...conditions));
  }

  async createSuppressionListEntry(entryData: InsertSuppressionList): Promise<SuppressionList> {
    const [entry] = await db
      .insert(suppressionList)
      .values(entryData)
      .returning();
    return entry;
  }

  async updateSuppressionListEntry(id: string, entryData: Partial<InsertSuppressionList>): Promise<SuppressionList> {
    const [entry] = await db
      .update(suppressionList)
      .set({ ...entryData, updatedAt: new Date() })
      .where(eq(suppressionList.id, id))
      .returning();

    if (!entry) {
      throw new Error('Suppression list entry not found');
    }

    return entry;
  }

  async deleteSuppressionListEntry(id: string): Promise<void> {
    await db.delete(suppressionList).where(eq(suppressionList.id, id));
  }

  async isEmailSuppressed(email: string, organisationId: string, channel: string): Promise<boolean> {
    const suppressions = await db
      .select()
      .from(suppressionList)
      .where(and(
        eq(suppressionList.email, email),
        eq(suppressionList.organisationId, organisationId),
        sql`${channel} = ANY(${suppressionList.channels})`,
        eq(suppressionList.isActive, true),
        or(
          eq(suppressionList.isPermanent, true),
          gte(suppressionList.suppressUntil, new Date().toISOString())
        )
      ))
      .limit(1);

    return suppressions.length > 0;
  }

  async isPhoneSuppressed(phone: string, organisationId: string, channel: string): Promise<boolean> {
    const suppressions = await db
      .select()
      .from(suppressionList)
      .where(and(
        eq(suppressionList.phone, phone),
        eq(suppressionList.organisationId, organisationId),
        sql`${channel} = ANY(${suppressionList.channels})`,
        eq(suppressionList.isActive, true),
        or(
          eq(suppressionList.isPermanent, true),
          gte(suppressionList.suppressUntil, new Date().toISOString())
        )
      ))
      .limit(1);

    return suppressions.length > 0;
  }

  async addToSuppressionList(contact: { email?: string; phone?: string; }, organisationId: string, reason: string, channels: string[]): Promise<SuppressionList> {
    return await this.createSuppressionListEntry({
      organisationId,
      email: contact.email,
      phone: contact.phone,
      suppressionType: 'marketing',
      channels,
      reason,
      source: 'user_request',
      isPermanent: true,
      isActive: true,
    });
  }

  async bulkAddToSuppressionList(contacts: { email?: string; phone?: string; }[], organisationId: string, reason: string, channels: string[]): Promise<number> {
    const entries = contacts.map(contact => ({
      organisationId,
      email: contact.email,
      phone: contact.phone,
      suppressionType: 'marketing',
      channels,
      reason,
      source: 'bulk_import',
      isPermanent: true,
      isActive: true,
    }));

    const result = await db
      .insert(suppressionList)
      .values(entries)
      .returning();

    return result.length;
  }

  async getGlobalSuppressions(): Promise<SuppressionList[]> {
    return await db
      .select()
      .from(suppressionList)
      .where(and(
        eq(suppressionList.isGlobal, true),
        eq(suppressionList.isActive, true)
      ))
      .orderBy(desc(suppressionList.createdAt));
  }

  // ===== GDPR Dashboard Implementation =====

  // Dashboard configuration operations
  async getGdprDashboardConfig(organisationId: string): Promise<GdprDashboardConfig | undefined> {
    const [config] = await db
      .select()
      .from(gdprDashboardConfig)
      .where(eq(gdprDashboardConfig.organisationId, organisationId));
    return config;
  }

  async createGdprDashboardConfig(config: InsertGdprDashboardConfig): Promise<GdprDashboardConfig> {
    const [result] = await db.insert(gdprDashboardConfig).values(config).returning();
    return result;
  }

  async updateGdprDashboardConfig(organisationId: string, config: Partial<InsertGdprDashboardConfig>): Promise<GdprDashboardConfig> {
    const [result] = await db
      .update(gdprDashboardConfig)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(gdprDashboardConfig.organisationId, organisationId))
      .returning();
    return result;
  }

  // Dashboard metrics aggregation (comprehensive compliance health check)
  async getDashboardComplianceMetrics(organisationId: string, dateRange?: { start: Date; end: Date }) {
    const endDate = dateRange?.end || new Date();
    const startDate = dateRange?.start || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Parallel execution for performance
    const [
      consentStats,
      userRightsStats,
      breachStats,
      retentionStats,
      transferStats
    ] = await Promise.all([
      // Consent metrics
      this.getConsentMetricsForDashboard(organisationId, startDate, endDate),
      // User rights metrics
      this.getUserRightsMetricsForDashboard(organisationId, startDate, endDate),
      // Breach metrics
      this.getBreachMetricsForDashboard(organisationId, startDate, endDate),
      // Data retention metrics
      this.getRetentionMetricsForDashboard(organisationId, startDate, endDate),
      // International transfer metrics (if available)
      this.getTransferMetricsForDashboard(organisationId, startDate, endDate)
    ]);

    // Calculate overall compliance score
    const overallComplianceScore = this.calculateComplianceScore(
      consentStats, userRightsStats, breachStats, retentionStats, transferStats
    );

    // Generate critical alerts
    const criticalAlerts = this.generateCriticalAlerts(
      consentStats, userRightsStats, breachStats, retentionStats, transferStats
    );

    // Determine compliance status
    const complianceStatus = this.determineComplianceStatus(overallComplianceScore, criticalAlerts);

    return {
      consentMetrics: consentStats,
      userRightsMetrics: userRightsStats,
      dataRetentionMetrics: retentionStats,
      breachMetrics: breachStats,
      transferMetrics: transferStats,
      overallComplianceScore,
      complianceStatus,
      criticalAlerts
    };
  }

  // Helper methods for dashboard metrics
  private async getConsentMetricsForDashboard(organisationId: string, startDate: Date, endDate: Date) {
    // Get consent statistics
    const totalConsents = await db
      .select({ count: count() })
      .from(consentRecords)
      .where(and(
        eq(consentRecords.organisationId, organisationId),
        sql`${consentRecords.timestamp} >= ${startDate}`,
        sql`${consentRecords.timestamp} <= ${endDate}`
      ));

    const grantedConsents = await db
      .select({ count: count() })
      .from(consentRecords)
      .where(and(
        eq(consentRecords.organisationId, organisationId),
        eq(consentRecords.status, 'granted'),
        sql`${consentRecords.timestamp} >= ${startDate}`,
        sql`${consentRecords.timestamp} <= ${endDate}`
      ));

    const withdrawnConsents = await db
      .select({ count: count() })
      .from(consentRecords)
      .where(and(
        eq(consentRecords.organisationId, organisationId),
        eq(consentRecords.status, 'withdrawn'),
        sql`${consentRecords.timestamp} >= ${startDate}`,
        sql`${consentRecords.timestamp} <= ${endDate}`
      ));

    // Get consent activity by day for trends
    const dailyActivity = await db
      .select({
        date: sql<string>`DATE(${consentRecords.timestamp})`,
        grants: sql<number>`SUM(CASE WHEN ${consentRecords.status} = 'granted' THEN 1 ELSE 0 END)`,
        withdrawals: sql<number>`SUM(CASE WHEN ${consentRecords.status} = 'withdrawn' THEN 1 ELSE 0 END)`
      })
      .from(consentRecords)
      .where(and(
        eq(consentRecords.organisationId, organisationId),
        sql`${consentRecords.timestamp} >= ${startDate}`,
        sql`${consentRecords.timestamp} <= ${endDate}`
      ))
      .groupBy(sql`DATE(${consentRecords.timestamp})`)
      .orderBy(sql`DATE(${consentRecords.timestamp})`);

    // Get consents by type
    const consentsByType = await db
      .select({
        type: consentRecords.consentType,
        count: count()
      })
      .from(consentRecords)
      .where(and(
        eq(consentRecords.organisationId, organisationId),
        eq(consentRecords.status, 'granted'),
        sql`${consentRecords.timestamp} >= ${startDate}`,
        sql`${consentRecords.timestamp} <= ${endDate}`
      ))
      .groupBy(consentRecords.consentType);

    const total = totalConsents[0].count;
    const granted = grantedConsents[0].count;
    const withdrawn = withdrawnConsents[0].count;
    
    return {
      totalConsents: total,
      consentRate: total > 0 ? (granted / total) * 100 : 0,
      withdrawalRate: total > 0 ? (withdrawn / total) * 100 : 0,
      consentsByType: Object.fromEntries(consentsByType.map(c => [c.type, c.count])),
      recentActivity: dailyActivity
    };
  }

  private async getUserRightsMetricsForDashboard(organisationId: string, startDate: Date, endDate: Date) {
    // Get user rights request statistics
    const totalRequests = await db
      .select({ count: count() })
      .from(userRightRequests)
      .where(and(
        eq(userRightRequests.organisationId, organisationId),
        sql`${userRightRequests.requestedAt} >= ${startDate}`,
        sql`${userRightRequests.requestedAt} <= ${endDate}`
      ));

    const pendingRequests = await db
      .select({ count: count() })
      .from(userRightRequests)
      .where(and(
        eq(userRightRequests.organisationId, organisationId),
        eq(userRightRequests.status, 'pending')
      ));

    // Calculate overdue requests (30 days SLA)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const overdueRequests = await db
      .select({ count: count() })
      .from(userRightRequests)
      .where(and(
        eq(userRightRequests.organisationId, organisationId),
        sql`${userRightRequests.status} IN ('pending', 'in_progress')`,
        sql`${userRightRequests.requestedAt} < ${thirtyDaysAgo}`
      ));

    // Calculate average response time
    const completedRequests = await db
      .select({
        responseTime: sql<number>`EXTRACT(EPOCH FROM (${userRightRequests.completedAt} - ${userRightRequests.requestedAt})) / 86400` // days
      })
      .from(userRightRequests)
      .where(and(
        eq(userRightRequests.organisationId, organisationId),
        eq(userRightRequests.status, 'completed'),
        sql`${userRightRequests.completedAt} IS NOT NULL`
      ));

    // Get requests by type
    const requestsByType = await db
      .select({
        type: userRightRequests.type,
        count: count()
      })
      .from(userRightRequests)
      .where(and(
        eq(userRightRequests.organisationId, organisationId),
        sql`${userRightRequests.requestedAt} >= ${startDate}`,
        sql`${userRightRequests.requestedAt} <= ${endDate}`
      ))
      .groupBy(userRightRequests.type);

    const total = totalRequests[0].count;
    const avgResponseTime = completedRequests.length > 0 
      ? completedRequests.reduce((sum, r) => sum + (r.responseTime || 0), 0) / completedRequests.length 
      : 0;

    return {
      totalRequests: total,
      pendingRequests: pendingRequests[0].count,
      overdueRequests: overdueRequests[0].count,
      avgResponseTime,
      requestsByType: Object.fromEntries(requestsByType.map(r => [r.type, r.count])),
      complianceRate: total > 0 ? Math.max(0, 100 - (overdueRequests[0].count / total) * 100) : 100
    };
  }

  private async getBreachMetricsForDashboard(organisationId: string, startDate: Date, endDate: Date) {
    const totalBreaches = await db
      .select({ count: count() })
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        sql`${dataBreaches.detectedAt} >= ${startDate}`,
        sql`${dataBreaches.detectedAt} <= ${endDate}`
      ));

    const activeBreaches = await db
      .select({ count: count() })
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        sql`${dataBreaches.status} NOT IN ('resolved')`
      ));

    // Overdue notifications (72 hour rule)
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const overdueNotifications = await db
      .select({ count: count() })
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        sql`${dataBreaches.icoNotifiedAt} IS NULL`,
        sql`${dataBreaches.detectedAt} < ${seventyTwoHoursAgo}`
      ));

    // Breaches by severity
    const breachesBySeverity = await db
      .select({
        severity: dataBreaches.severity,
        count: count()
      })
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        sql`${dataBreaches.detectedAt} >= ${startDate}`,
        sql`${dataBreaches.detectedAt} <= ${endDate}`
      ))
      .groupBy(dataBreaches.severity);

    // Calculate average response time for completed notifications
    const notificationTimes = await db
      .select({
        responseTime: sql<number>`EXTRACT(EPOCH FROM (${dataBreaches.icoNotifiedAt} - ${dataBreaches.detectedAt})) / 3600` // hours
      })
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        sql`${dataBreaches.icoNotifiedAt} IS NOT NULL`
      ));

    const avgResponseTime = notificationTimes.length > 0 
      ? notificationTimes.reduce((sum, n) => sum + (n.responseTime || 0), 0) / notificationTimes.length 
      : 0;

    return {
      totalBreaches: totalBreaches[0].count,
      activeBreaches: activeBreaches[0].count,
      overdueNotifications: overdueNotifications[0].count,
      avgResponseTime,
      breachesBySeverity: Object.fromEntries(breachesBySeverity.map(b => [b.severity, b.count]))
    };
  }

  private async getRetentionMetricsForDashboard(organisationId: string, startDate: Date, endDate: Date) {
    // Basic retention statistics
    const totalPolicies = await db
      .select({ count: count() })
      .from(retentionRules)
      .where(and(
        eq(retentionRules.organisationId, organisationId),
        eq(retentionRules.enabled, true)
      ));

    const recordsProcessed = await db
      .select({ count: count() })
      .from(retentionSchedules)
      .where(and(
        eq(retentionSchedules.organisationId, organisationId),
        eq(retentionSchedules.status, 'completed'),
        sql`${retentionSchedules.processedAt} >= ${startDate}`,
        sql`${retentionSchedules.processedAt} <= ${endDate}`
      ));

    const recordsPendingDeletion = await db
      .select({ count: count() })
      .from(retentionSchedules)
      .where(and(
        eq(retentionSchedules.organisationId, organisationId),
        eq(retentionSchedules.status, 'scheduled'),
        sql`${retentionSchedules.scheduledDeletion} <= ${new Date()}`
      ));

    // Upcoming deletions (next 7 days)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const upcomingDeletions = await db
      .select({ count: count() })
      .from(retentionSchedules)
      .where(and(
        eq(retentionSchedules.organisationId, organisationId),
        eq(retentionSchedules.status, 'scheduled'),
        sql`${retentionSchedules.scheduledDeletion} BETWEEN ${new Date()} AND ${nextWeek}`
      ));

    const processed = recordsProcessed[0].count;
    const pending = recordsPendingDeletion[0].count;
    const retentionCompliance = (processed + pending) > 0 ? (processed / (processed + pending)) * 100 : 100;

    return {
      totalPolicies: totalPolicies[0].count,
      recordsProcessed: processed,
      recordsPendingDeletion: pending,
      retentionCompliance,
      upcomingDeletions: upcomingDeletions[0].count
    };
  }

  private async getTransferMetricsForDashboard(organisationId: string, startDate: Date, endDate: Date) {
    // Placeholder implementation - would be expanded if international transfers are implemented
    return {
      totalTransfers: 0,
      activeTransfers: 0,
      overdueReviews: 0,
      transfersByRisk: {},
      complianceRate: 100
    };
  }

  private calculateComplianceScore(consentStats: any, userRightsStats: any, breachStats: any, retentionStats: any, transferStats: any): number {
    // Weighted compliance scoring
    const consentScore = Math.min(100, consentStats.consentRate);
    const userRightsScore = userRightsStats.complianceRate;
    const breachScore = breachStats.overdueNotifications === 0 ? 100 : Math.max(0, 100 - breachStats.overdueNotifications * 10);
    const retentionScore = retentionStats.retentionCompliance;

    // Weighted average (adjust weights as needed)
    const totalScore = (
      consentScore * 0.3 +
      userRightsScore * 0.3 +
      breachScore * 0.25 +
      retentionScore * 0.15
    );

    return Math.round(totalScore);
  }

  private generateCriticalAlerts(consentStats: any, userRightsStats: any, breachStats: any, retentionStats: any, transferStats: any) {
    const alerts = [];

    // User rights overdue alerts
    if (userRightsStats.overdueRequests > 0) {
      alerts.push({
        type: 'user_rights_overdue',
        message: `${userRightsStats.overdueRequests} user rights requests are overdue (>30 days)`,
        severity: 'critical' as const,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      });
    }

    // Breach notification overdue
    if (breachStats.overdueNotifications > 0) {
      alerts.push({
        type: 'breach_notification_overdue',
        message: `${breachStats.overdueNotifications} data breach notifications are overdue (>72 hours)`,
        severity: 'critical' as const,
        dueDate: new Date() // Immediate
      });
    }

    // Low consent rate warning
    if (consentStats.consentRate < 50) {
      alerts.push({
        type: 'low_consent_rate',
        message: `Consent rate is below 50% (${consentStats.consentRate.toFixed(1)}%)`,
        severity: 'high' as const
      });
    }

    // Data retention pending
    if (retentionStats.recordsPendingDeletion > 100) {
      alerts.push({
        type: 'retention_backlog',
        message: `${retentionStats.recordsPendingDeletion} records pending deletion`,
        severity: 'medium' as const
      });
    }

    return alerts;
  }

  private determineComplianceStatus(score: number, alerts: any[]): 'compliant' | 'attention_required' | 'non_compliant' | 'unknown' {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    
    if (criticalAlerts > 0) return 'non_compliant';
    if (score >= 85) return 'compliant';
    if (score >= 70) return 'attention_required';
    return 'non_compliant';
  }

  // Compliance reports operations
  async createComplianceReport(report: InsertComplianceReports): Promise<ComplianceReports> {
    const [result] = await db.insert(complianceReports).values(report).returning();
    return result;
  }

  async getComplianceReport(id: string): Promise<ComplianceReports | undefined> {
    const [report] = await db
      .select()
      .from(complianceReports)
      .where(eq(complianceReports.id, id));
    return report;
  }

  async getComplianceReportsByOrganisation(organisationId: string, limit = 50): Promise<ComplianceReports[]> {
    return await db
      .select()
      .from(complianceReports)
      .where(eq(complianceReports.organisationId, organisationId))
      .orderBy(desc(complianceReports.generatedAt))
      .limit(limit);
  }

  async updateComplianceReport(id: string, report: Partial<InsertComplianceReports>): Promise<ComplianceReports> {
    const [result] = await db
      .update(complianceReports)
      .set({ ...report, updatedAt: new Date() })
      .where(eq(complianceReports.id, id))
      .returning();
    return result;
  }

  async deleteComplianceReport(id: string): Promise<void> {
    await db.delete(complianceReports).where(eq(complianceReports.id, id));
  }

  // Export jobs operations
  async createExportJob(job: InsertExportJobs): Promise<ExportJobs> {
    const [result] = await db.insert(exportJobs).values(job).returning();
    return result;
  }

  async getExportJob(id: string): Promise<ExportJobs | undefined> {
    const [job] = await db
      .select()
      .from(exportJobs)
      .where(eq(exportJobs.id, id));
    return job;
  }

  async getExportJobsByOrganisation(organisationId: string, status?: string): Promise<ExportJobs[]> {
    const conditions = [eq(exportJobs.organisationId, organisationId)];
    
    if (status) {
      conditions.push(eq(exportJobs.status, status as any));
    }

    return await db
      .select()
      .from(exportJobs)
      .where(and(...conditions))
      .orderBy(desc(exportJobs.requestedAt));
  }

  async updateExportJob(id: string, job: Partial<InsertExportJobs>): Promise<ExportJobs> {
    const [result] = await db
      .update(exportJobs)
      .set({ ...job, updatedAt: new Date() })
      .where(eq(exportJobs.id, id))
      .returning();
    return result;
  }

  async deleteExportJob(id: string): Promise<void> {
    await db.delete(exportJobs).where(eq(exportJobs.id, id));
  }

  async getActiveExportJobs(): Promise<ExportJobs[]> {
    return await db
      .select()
      .from(exportJobs)
      .where(sql`${exportJobs.status} IN ('pending', 'processing')`)
      .orderBy(asc(exportJobs.priority), asc(exportJobs.requestedAt));
  }

  // Compliance analytics for dashboard trends
  async getConsentTrends(organisationId: string, days = 30) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const trends = await db
      .select({
        date: sql<string>`DATE(${consentRecords.timestamp})`,
        totalConsents: count(),
        grantedConsents: sql<number>`SUM(CASE WHEN ${consentRecords.status} = 'granted' THEN 1 ELSE 0 END)`,
        withdrawnConsents: sql<number>`SUM(CASE WHEN ${consentRecords.status} = 'withdrawn' THEN 1 ELSE 0 END)`
      })
      .from(consentRecords)
      .where(and(
        eq(consentRecords.organisationId, organisationId),
        sql`${consentRecords.timestamp} >= ${startDate}`,
        sql`${consentRecords.timestamp} <= ${endDate}`
      ))
      .groupBy(sql`DATE(${consentRecords.timestamp})`)
      .orderBy(sql`DATE(${consentRecords.timestamp})`);

    return trends.map(t => ({
      date: t.date,
      totalConsents: t.totalConsents,
      grantedConsents: t.grantedConsents,
      withdrawnConsents: t.withdrawnConsents,
      consentRate: t.totalConsents > 0 ? (t.grantedConsents / t.totalConsents) * 100 : 0
    }));
  }

  async getUserRightsTrends(organisationId: string, days = 30) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const trends = await db
      .select({
        date: sql<string>`DATE(${userRightRequests.requestedAt})`,
        totalRequests: count(),
        completedRequests: sql<number>`SUM(CASE WHEN ${userRightRequests.status} = 'completed' THEN 1 ELSE 0 END)`,
        avgResponseTime: sql<number>`AVG(CASE WHEN ${userRightRequests.completedAt} IS NOT NULL THEN EXTRACT(EPOCH FROM (${userRightRequests.completedAt} - ${userRightRequests.requestedAt})) / 86400 END)`
      })
      .from(userRightRequests)
      .where(and(
        eq(userRightRequests.organisationId, organisationId),
        sql`${userRightRequests.requestedAt} >= ${startDate}`,
        sql`${userRightRequests.requestedAt} <= ${endDate}`
      ))
      .groupBy(sql`DATE(${userRightRequests.requestedAt})`)
      .orderBy(sql`DATE(${userRightRequests.requestedAt})`);

    return trends.map(t => ({
      date: t.date,
      totalRequests: t.totalRequests,
      completedRequests: t.completedRequests,
      responseTime: t.avgResponseTime || 0
    }));
  }

  async getBreachResponseMetrics(organisationId: string) {
    const totalBreaches = await db
      .select({ count: count() })
      .from(dataBreaches)
      .where(eq(dataBreaches.organisationId, organisationId));

    const notificationTimes = await db
      .select({
        notificationTime: sql<number>`EXTRACT(EPOCH FROM (${dataBreaches.icoNotifiedAt} - ${dataBreaches.detectedAt})) / 3600`
      })
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        sql`${dataBreaches.icoNotifiedAt} IS NOT NULL`
      ));

    const subjectNotifications = await db
      .select({ count: count() })
      .from(dataBreaches)
      .where(and(
        eq(dataBreaches.organisationId, organisationId),
        sql`${dataBreaches.subjectsNotifiedAt} IS NOT NULL`
      ));

    const avgNotificationTime = notificationTimes.length > 0
      ? notificationTimes.reduce((sum, n) => sum + (n.notificationTime || 0), 0) / notificationTimes.length
      : 0;

    const total = totalBreaches[0].count;
    const icoCompliance = total > 0 ? (notificationTimes.length / total) * 100 : 100;
    const subjectNotificationCompliance = total > 0 ? (subjectNotifications[0].count / total) * 100 : 100;

    return {
      totalBreaches: total,
      avgNotificationTime,
      icoCompliance,
      subjectNotificationCompliance
    };
  }

  // ===== AGE VERIFICATION OPERATIONS (UK GDPR Article 8) =====

  async createAgeVerification(ageVerification: InsertAgeVerification): Promise<AgeVerification> {
    const [result] = await db.insert(ageVerifications).values(ageVerification).returning();
    return result;
  }

  async getAgeVerification(id: string): Promise<AgeVerification | undefined> {
    const [verification] = await db
      .select()
      .from(ageVerifications)
      .where(eq(ageVerifications.id, id));
    return verification;
  }

  async getAgeVerificationByUser(userId: string): Promise<AgeVerification | undefined> {
    const [verification] = await db
      .select()
      .from(ageVerifications)
      .where(eq(ageVerifications.userId, userId));
    return verification;
  }

  async getAgeVerificationsByOrganisation(organisationId: string): Promise<AgeVerification[]> {
    return await db
      .select()
      .from(ageVerifications)
      .where(eq(ageVerifications.organisationId, organisationId))
      .orderBy(desc(ageVerifications.createdAt));
  }

  async updateAgeVerification(id: string, ageVerification: Partial<InsertAgeVerification>): Promise<AgeVerification> {
    const [result] = await db
      .update(ageVerifications)
      .set({ ...ageVerification, updatedAt: new Date() })
      .where(eq(ageVerifications.id, id))
      .returning();

    if (!result) {
      throw new Error('Age verification not found');
    }

    return result;
  }

  async upsertAgeVerification(userId: string, ageVerification: Partial<InsertAgeVerification>): Promise<AgeVerification> {
    const existing = await this.getAgeVerificationByUser(userId);
    
    if (existing) {
      return await this.updateAgeVerification(existing.id, ageVerification);
    } else {
      return await this.createAgeVerification({ ...ageVerification, userId } as InsertAgeVerification);
    }
  }

  async deleteAgeVerification(id: string): Promise<void> {
    await db.delete(ageVerifications).where(eq(ageVerifications.id, id));
  }

  // ===== PARENTAL CONSENT RECORDS OPERATIONS (UK GDPR Article 8) =====

  async createParentalConsentRecord(record: InsertParentalConsentRecord): Promise<ParentalConsentRecord> {
    const [result] = await db.insert(parentalConsentRecords).values(record).returning();
    return result;
  }

  async getParentalConsentRecord(id: string): Promise<ParentalConsentRecord | undefined> {
    const [record] = await db
      .select()
      .from(parentalConsentRecords)
      .where(eq(parentalConsentRecords.id, id));
    return record;
  }

  async getParentalConsentRecordByChild(childUserId: string): Promise<ParentalConsentRecord | undefined> {
    const [record] = await db
      .select()
      .from(parentalConsentRecords)
      .where(eq(parentalConsentRecords.childUserId, childUserId))
      .orderBy(desc(parentalConsentRecords.createdAt))
      .limit(1);
    return record;
  }

  async getParentalConsentRecordsByParent(parentEmail: string): Promise<ParentalConsentRecord[]> {
    return await db
      .select()
      .from(parentalConsentRecords)
      .where(eq(parentalConsentRecords.parentEmail, parentEmail))
      .orderBy(desc(parentalConsentRecords.createdAt));
  }

  async getParentalConsentRecordsByOrganisation(organisationId: string): Promise<ParentalConsentRecord[]> {
    return await db
      .select()
      .from(parentalConsentRecords)
      .where(eq(parentalConsentRecords.organisationId, organisationId))
      .orderBy(desc(parentalConsentRecords.createdAt));
  }

  async updateParentalConsentRecord(id: string, record: Partial<InsertParentalConsentRecord>): Promise<ParentalConsentRecord> {
    const [result] = await db
      .update(parentalConsentRecords)
      .set({ ...record, updatedAt: new Date() })
      .where(eq(parentalConsentRecords.id, id))
      .returning();

    if (!result) {
      throw new Error('Parental consent record not found');
    }

    return result;
  }

  async deleteParentalConsentRecord(id: string): Promise<void> {
    await db.delete(parentalConsentRecords).where(eq(parentalConsentRecords.id, id));
  }

  async getParentalConsentRecordsByStatus(organisationId: string, status: string): Promise<ParentalConsentRecord[]> {
    return await db
      .select()
      .from(parentalConsentRecords)
      .where(and(
        eq(parentalConsentRecords.organisationId, organisationId),
        eq(parentalConsentRecords.consentStatus, status)
      ))
      .orderBy(desc(parentalConsentRecords.createdAt));
  }

  async getExpiringParentalConsents(organisationId: string, daysFromNow: number): Promise<ParentalConsentRecord[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysFromNow);

    return await db
      .select()
      .from(parentalConsentRecords)
      .where(and(
        eq(parentalConsentRecords.organisationId, organisationId),
        eq(parentalConsentRecords.consentStatus, 'granted'),
        sql`${parentalConsentRecords.consentExpiryDate} <= ${futureDate.toISOString()}`
      ))
      .orderBy(asc(parentalConsentRecords.consentExpiryDate));
  }

  async updateConsentStatus(id: string, status: string, adminId?: string): Promise<ParentalConsentRecord> {
    const updateData: any = {
      consentStatus: status,
      updatedAt: new Date()
    };

    if (status === 'granted') {
      updateData.consentGrantedAt = new Date();
      updateData.grantedBy = adminId;
    } else if (status === 'withdrawn') {
      updateData.consentWithdrawnAt = new Date();
      updateData.withdrawnBy = adminId;
    }

    const [result] = await db
      .update(parentalConsentRecords)
      .set(updateData)
      .where(eq(parentalConsentRecords.id, id))
      .returning();

    if (!result) {
      throw new Error('Parental consent record not found');
    }

    return result;
  }

  // ===== FAMILY ACCOUNTS OPERATIONS (UK GDPR Article 8) =====

  async createFamilyAccount(account: InsertFamilyAccount): Promise<FamilyAccount> {
    const [result] = await db.insert(familyAccounts).values(account).returning();
    return result;
  }

  async getFamilyAccount(id: string): Promise<FamilyAccount | undefined> {
    const [account] = await db
      .select()
      .from(familyAccounts)
      .where(eq(familyAccounts.id, id));
    return account;
  }

  async getFamilyAccountByParent(parentUserId: string): Promise<FamilyAccount | undefined> {
    const [account] = await db
      .select()
      .from(familyAccounts)
      .where(or(
        eq(familyAccounts.primaryParentUserId, parentUserId),
        eq(familyAccounts.secondaryParentUserId, parentUserId)
      ))
      .limit(1);
    return account;
  }

  async getFamilyAccountByEmail(email: string): Promise<FamilyAccount | undefined> {
    const [account] = await db
      .select()
      .from(familyAccounts)
      .where(or(
        eq(familyAccounts.primaryContactEmail, email),
        eq(familyAccounts.alternateContactEmail, email)
      ))
      .limit(1);
    return account;
  }

  async getFamilyAccountsByOrganisation(organisationId: string): Promise<FamilyAccount[]> {
    return await db
      .select()
      .from(familyAccounts)
      .where(eq(familyAccounts.organisationId, organisationId))
      .orderBy(desc(familyAccounts.createdAt));
  }

  async updateFamilyAccount(id: string, account: Partial<InsertFamilyAccount>): Promise<FamilyAccount> {
    const [result] = await db
      .update(familyAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(familyAccounts.id, id))
      .returning();

    if (!result) {
      throw new Error('Family account not found');
    }

    return result;
  }

  async deleteFamilyAccount(id: string): Promise<void> {
    await db.delete(familyAccounts).where(eq(familyAccounts.id, id));
  }

  async getFamilyAccountsByStatus(organisationId: string, status: string): Promise<FamilyAccount[]> {
    return await db
      .select()
      .from(familyAccounts)
      .where(and(
        eq(familyAccounts.organisationId, organisationId),
        eq(familyAccounts.accountStatus, status)
      ))
      .orderBy(desc(familyAccounts.createdAt));
  }

  async activateFamilyAccount(id: string, activatedBy: string): Promise<FamilyAccount> {
    const [result] = await db
      .update(familyAccounts)
      .set({
        accountStatus: 'active',
        activatedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(familyAccounts.id, id))
      .returning();

    if (!result) {
      throw new Error('Family account not found');
    }

    return result;
  }

  async suspendFamilyAccount(id: string, reason: string, suspendedBy: string): Promise<FamilyAccount> {
    const [result] = await db
      .update(familyAccounts)
      .set({
        accountStatus: 'suspended',
        suspendedAt: new Date(),
        suspensionReason: reason,
        updatedAt: new Date()
      })
      .where(eq(familyAccounts.id, id))
      .returning();

    if (!result) {
      throw new Error('Family account not found');
    }

    return result;
  }

  // ===== CHILD ACCOUNT LINKS OPERATIONS (UK GDPR Article 8) =====

  async createChildAccountLink(link: InsertChildAccountLink): Promise<ChildAccountLink> {
    const [result] = await db.insert(childAccountLinks).values(link).returning();
    return result;
  }

  async getChildAccountLink(id: string): Promise<ChildAccountLink | undefined> {
    const [link] = await db
      .select()
      .from(childAccountLinks)
      .where(eq(childAccountLinks.id, id));
    return link;
  }

  async getChildAccountLinkByChild(childUserId: string): Promise<ChildAccountLink | undefined> {
    const [link] = await db
      .select()
      .from(childAccountLinks)
      .where(eq(childAccountLinks.childUserId, childUserId))
      .limit(1);
    return link;
  }

  async getChildAccountLinksByFamily(familyAccountId: string): Promise<ChildAccountLink[]> {
    return await db
      .select()
      .from(childAccountLinks)
      .where(eq(childAccountLinks.familyAccountId, familyAccountId))
      .orderBy(desc(childAccountLinks.createdAt));
  }

  async getChildAccountLinksByOrganisation(organisationId: string): Promise<ChildAccountLink[]> {
    return await db
      .select()
      .from(childAccountLinks)
      .where(eq(childAccountLinks.organisationId, organisationId))
      .orderBy(desc(childAccountLinks.createdAt));
  }

  async updateChildAccountLink(id: string, link: Partial<InsertChildAccountLink>): Promise<ChildAccountLink> {
    const [result] = await db
      .update(childAccountLinks)
      .set({ ...link, updatedAt: new Date() })
      .where(eq(childAccountLinks.id, id))
      .returning();

    if (!result) {
      throw new Error('Child account link not found');
    }

    return result;
  }

  async deleteChildAccountLink(id: string): Promise<void> {
    await db.delete(childAccountLinks).where(eq(childAccountLinks.id, id));
  }

  async getChildAccountLinksByStatus(organisationId: string, status: string): Promise<ChildAccountLink[]> {
    return await db
      .select()
      .from(childAccountLinks)
      .where(and(
        eq(childAccountLinks.organisationId, organisationId),
        eq(childAccountLinks.linkStatus, status)
      ))
      .orderBy(desc(childAccountLinks.createdAt));
  }

  async getChildrenTransitioningToAdult(organisationId: string, daysFromNow: number): Promise<ChildAccountLink[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysFromNow);

    return await db
      .select()
      .from(childAccountLinks)
      .where(and(
        eq(childAccountLinks.organisationId, organisationId),
        eq(childAccountLinks.linkStatus, 'active'),
        sql`${childAccountLinks.transitionDate} <= ${futureDate.toISOString()}`
      ))
      .orderBy(asc(childAccountLinks.transitionDate));
  }

  async transitionChildToAdult(childUserId: string, transitionedBy: string): Promise<void> {
    await db
      .update(childAccountLinks)
      .set({
        linkStatus: 'dissolved',
        dissolvedAt: new Date(),
        dissolutionReason: 'age_transition_to_adult',
        lastModifiedBy: transitionedBy,
        updatedAt: new Date()
      })
      .where(eq(childAccountLinks.childUserId, childUserId));
  }

  // ===== CHILD PROTECTION SETTINGS OPERATIONS (UK GDPR Article 8) =====

  async createChildProtectionSettings(settings: InsertChildProtectionSettings): Promise<ChildProtectionSettings> {
    const [result] = await db.insert(childProtectionSettings).values(settings).returning();
    return result;
  }

  async getChildProtectionSettings(id: string): Promise<ChildProtectionSettings | undefined> {
    const [settings] = await db
      .select()
      .from(childProtectionSettings)
      .where(eq(childProtectionSettings.id, id));
    return settings;
  }

  async getChildProtectionSettingsByOrganisation(organisationId: string): Promise<ChildProtectionSettings | undefined> {
    const [settings] = await db
      .select()
      .from(childProtectionSettings)
      .where(eq(childProtectionSettings.organisationId, organisationId))
      .limit(1);
    return settings;
  }

  async updateChildProtectionSettings(id: string, settings: Partial<InsertChildProtectionSettings>): Promise<ChildProtectionSettings> {
    const [result] = await db
      .update(childProtectionSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(childProtectionSettings.id, id))
      .returning();

    if (!result) {
      throw new Error('Child protection settings not found');
    }

    return result;
  }

  async deleteChildProtectionSettings(id: string): Promise<void> {
    await db.delete(childProtectionSettings).where(eq(childProtectionSettings.id, id));
  }

  async upsertChildProtectionSettings(organisationId: string, settings: Partial<InsertChildProtectionSettings>): Promise<ChildProtectionSettings> {
    const existing = await this.getChildProtectionSettingsByOrganisation(organisationId);
    
    if (existing) {
      return await this.updateChildProtectionSettings(existing.id, settings);
    } else {
      return await this.createChildProtectionSettings({ ...settings, organisationId } as InsertChildProtectionSettings);
    }
  }
}

export const storage = new DatabaseStorage();
