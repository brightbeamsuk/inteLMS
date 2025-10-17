import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User role enum
export const userRoleEnum = pgEnum('user_role', ['superadmin', 'admin', 'user']);

// User status enum
export const userStatusEnum = pgEnum('user_status', ['active', 'inactive']);

// Organisation status enum
export const organisationStatusEnum = pgEnum('organisation_status', ['active', 'archived', 'deleted']);

// Course status enum
export const courseStatusEnum = pgEnum('course_status', ['draft', 'published', 'archived']);

// Assignment status enum
export const assignmentStatusEnum = pgEnum('assignment_status', ['not_started', 'in_progress', 'completed', 'overdue']);

// Completion status enum
export const completionStatusEnum = pgEnum('completion_status', ['pass', 'fail']);

// SCORM standard enum
export const scormStandardEnum = pgEnum('scorm_standard', ['1.2', '2004']);

// SCORM attempt status enum
export const scormAttemptStatusEnum = pgEnum('scorm_attempt_status', ['not_started', 'in_progress', 'completed', 'abandoned']);

// Plan status enum
export const planStatusEnum = pgEnum('plan_status', ['active', 'inactive', 'archived']);

// Billing model enum for plans
export const billingModelEnum = pgEnum('billing_model', ['metered_per_active_user', 'per_seat', 'flat_subscription']);

// Billing cadence enum
export const billingCadenceEnum = pgEnum('billing_cadence', ['monthly', 'annual']);

// Tax behavior enum
export const taxBehaviorEnum = pgEnum('tax_behavior', ['inclusive', 'exclusive']);

// Price change policy enum
export const priceChangePolicyEnum = pgEnum('price_change_policy', ['prorate_immediately', 'at_period_end', 'manual']);

// Billing status enum for organizations
export const billingStatusEnum = pgEnum('billing_status', ['active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'trialing', 'paused']);

// Support ticket status enum
export const ticketStatusEnum = pgEnum('ticket_status', ['open', 'in_progress', 'resolved', 'closed']);

// Support ticket priority enum
export const ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'medium', 'high', 'urgent']);

// Support ticket category enum
export const ticketCategoryEnum = pgEnum('ticket_category', ['technical', 'billing', 'account', 'training', 'feature_request', 'bug_report', 'general']);

// Email provider enum
export const emailProviderEnum = pgEnum('email_provider', [
  'smtp_generic',
  'sendgrid_api',
  'brevo_api', 
  'mailgun_api',
  'postmark_api',
  'mailjet_api',
  'sparkpost_api'
]);

// Email template type enum
export const emailTemplateTypeEnum = pgEnum('email_template_type', [
  'welcome_account_created',
  'course_assigned', 
  'course_reminder',
  'course_overdue',
  'training_expiring_soon',
  'training_expired',
  'course_completion_certificate',
  'failed_attempt',
  'password_reset',
  'new_user_registered',
  'user_completed_course',
  'user_failed_course',
  'staff_training_expiring',
  'staff_training_expired',
  'weekly_training_summary',
  'smtp_test',
  'system_test',
  // EmailOrchestrator template keys
  'new_user_welcome',
  'admin.new_user_added',
  'admin.new_admin_added',
  'new_org_welcome',
  'course_assigned_notification',
  'course_completion_notification',
  'course_failure_notification',
  'plan_updated_notification'
]);

// Email routing source enum for tracking which route was used
export const emailRoutingSourceEnum = pgEnum('email_routing_source', [
  'org_primary',     // Organization settings used successfully on first attempt
  'org_fallback',    // Organization settings failed, used system settings as fallback  
  'system_default',  // Only system settings available/used
  'mixed_config'     // Mixed org + system settings (legacy behavior)
]);

// Email template category enum
export const emailTemplateCategoryEnum = pgEnum('email_template_category', ['admin', 'learner']);

// Email orchestrator trigger events enum
export const emailTriggerEventEnum = pgEnum('email_trigger_event', [
  'ORG_FAST_ADD',
  'USER_FAST_ADD', 
  'COURSE_ASSIGNED',
  'COURSE_COMPLETED',
  'COURSE_FAILED',
  'PLAN_UPDATED'
]);

// Email send status enum for orchestrator
export const emailSendStatusEnum = pgEnum('email_send_status', [
  'pending',     // Pending for sending
  'sent',        // Successfully sent
  'failed',      // Permanently failed after retries
  'retrying'     // Temporarily failed, will retry
]);

// GDPR enums (UK GDPR and Data Protection Act 2018 compliance)
export const consentStatusEnum = pgEnum('consent_status', ['granted', 'denied', 'withdrawn', 'pending']);

// Enhanced GDPR audit logging enums for comprehensive accountability
export const auditActionEnum = pgEnum('audit_action', [
  // Data processing actions
  'data_collected', 'data_processed', 'data_shared', 'data_retained', 'data_deleted',
  'data_exported', 'data_imported', 'data_transferred', 'data_anonymized', 'data_pseudonymized',
  // User rights actions
  'rights_request_submitted', 'rights_request_verified', 'rights_request_processed', 'rights_request_completed',
  'rights_request_rejected', 'rights_request_appealed', 'access_request_fulfilled', 'erasure_completed',
  'rectification_completed', 'restriction_applied', 'portability_provided', 'objection_processed',
  // Consent management actions
  'consent_collected', 'consent_granted', 'consent_denied', 'consent_withdrawn', 'consent_modified',
  'consent_verified', 'consent_evidence_stored', 'marketing_consent_updated', 'cookie_consent_changed',
  // Breach management actions
  'breach_detected', 'breach_assessed', 'breach_contained', 'breach_investigated', 'breach_reported_ico',
  'breach_subjects_notified', 'breach_remediated', 'breach_closed', 'breach_followup_completed',
  // System access actions
  'admin_login', 'admin_logout', 'admin_action_performed', 'privileged_operation', 'access_denied',
  'failed_authentication', 'password_reset', 'role_changed', 'permissions_modified',
  // Compliance actions
  'compliance_check_performed', 'compliance_report_generated', 'audit_initiated', 'audit_completed',
  'policy_updated', 'procedure_modified', 'training_completed', 'certification_obtained'
]);

export const auditResourceEnum = pgEnum('audit_resource', [
  'user_data', 'personal_data', 'special_category_data', 'user_rights_request', 'consent_record',
  'marketing_consent', 'cookie_consent', 'data_breach', 'processing_activity', 'retention_policy',
  'user_account', 'admin_account', 'system_settings', 'compliance_document', 'audit_log',
  'export_job', 'data_transfer', 'third_party_integration', 'security_incident'
]);

export const auditCategoryEnum = pgEnum('audit_category', [
  'data_processing', 'user_rights', 'consent_management', 'breach_response', 'system_access',
  'compliance_monitoring', 'security_event', 'administrative_action', 'automated_process'
]);

export const auditSeverityEnum = pgEnum('audit_severity', [
  'info', 'low', 'medium', 'high', 'critical'
]);

export const auditOutcomeEnum = pgEnum('audit_outcome', [
  'success', 'failure', 'partial', 'pending', 'cancelled', 'error'
]);
export const processingLawfulBasisEnum = pgEnum('processing_lawful_basis', ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests']);
export const dataCategoryEnum = pgEnum('data_category', ['identity', 'contact', 'financial', 'demographic', 'education', 'technical', 'usage', 'special']);
export const userRightTypeEnum = pgEnum('user_right_type', ['access', 'rectification', 'erasure', 'restriction', 'objection', 'portability']);
export const userRightStatusEnum = pgEnum('user_right_status', ['pending', 'in_progress', 'completed', 'rejected', 'expired']);
export const breachSeverityEnum = pgEnum('breach_severity', ['low', 'medium', 'high', 'critical']);
export const breachStatusEnum = pgEnum('breach_status', ['detected', 'assessed', 'notified_ico', 'notified_subjects', 'resolved']);
export const cookieCategoryEnum = pgEnum('cookie_category', ['strictly_necessary', 'functional', 'analytics', 'advertising']);
export const marketingConsentTypeEnum = pgEnum('marketing_consent_type', ['email', 'sms', 'phone', 'post', 'push_notifications']);

// UK GDPR Article 8 - Age Verification and Parental Consent enums
export const ageGroupEnum = pgEnum('age_group', [
  'under_13',        // Children under 13 (parental consent required)
  'teen_13_16',      // Teens 13-16 (parental consent may be required based on jurisdiction)
  'young_adult_16_18', // Young adults 16-18 (transitional protections)
  'adult_18_plus'    // Adults 18+ (full capacity)
]);

export const ageVerificationMethodEnum = pgEnum('age_verification_method', [
  'self_declaration',    // User self-declares age (least reliable)
  'date_of_birth',      // Date of birth verification
  'government_id',      // Government ID verification
  'credit_card',        // Credit card verification (age estimation)
  'third_party_service', // Third-party age verification service
  'parental_declaration', // Parent declares child's age
  'school_enrollment',   // School enrollment verification
  'guardian_attestation' // Legal guardian formal attestation
]);

export const parentalConsentStatusEnum = pgEnum('parental_consent_status', [
  'required',           // Parental consent is required but not yet obtained
  'pending',           // Consent request sent to parent, awaiting response
  'granted',           // Parent has granted consent with valid evidence
  'denied',            // Parent has explicitly denied consent
  'withdrawn',         // Previously granted consent has been withdrawn
  'expired',           // Consent has expired and needs renewal
  'invalid',           // Consent found to be invalid or fraudulent
  'disputed'           // Consent is under dispute or challenge
]);

export const parentalRelationshipEnum = pgEnum('parental_relationship', [
  'mother',            // Biological or adoptive mother
  'father',            // Biological or adoptive father
  'legal_guardian',    // Court-appointed legal guardian
  'step_parent',       // Step-parent with parental responsibility
  'grandparent',       // Grandparent with custody
  'foster_parent',     // Foster parent with responsibility
  'other_relative',    // Other family member with custody
  'care_provider',     // Professional care provider
  'education_authority' // Educational institution authority
]);

export const consentVerificationMethodEnum = pgEnum('consent_verification_method', [
  'email_verification',     // Email-based verification (basic)
  'sms_verification',       // SMS-based verification
  'phone_call_verification', // Phone call verification
  'video_call_verification', // Video call with parent
  'government_id_verification', // Government ID document verification
  'utility_bill_verification', // Utility bill address verification
  'bank_verification',      // Bank account verification
  'digital_signature',     // Cryptographic digital signature
  'in_person_verification', // In-person verification
  'notarized_consent'      // Notarized consent document
]);

export const childProtectionLevelEnum = pgEnum('child_protection_level', [
  'minimal',           // Basic UK GDPR protections
  'standard',          // Standard child protection measures
  'enhanced',          // Enhanced protections for vulnerable children
  'maximum'           // Maximum protection (restricted processing)
]);

export const familyAccountStatusEnum = pgEnum('family_account_status', [
  'active',           // Family account is active and linked
  'pending_verification', // Awaiting parental verification
  'suspended',        // Temporarily suspended due to issues
  'disputed',         // Under dispute or investigation
  'dissolved',        // Family link dissolved (child reached majority)
  'archived'          // Archived for historical purposes
]);

// PECR Marketing Communications enums
export const communicationTypeEnum = pgEnum('communication_type', [
  'service_essential',     // Essential service communications (PECR exempt)
  'service_optional',      // Optional service communications
  'marketing_promotional', // Marketing and promotional content (PECR opt-in required)
  'marketing_newsletter',  // Newsletters and updates
  'marketing_offers',      // Special offers and discounts
  'marketing_surveys',     // Market research and surveys
  'training_reminders',    // Training-related reminders
  'system_notifications'   // System and technical notifications
]);

export const consentSourceEnum = pgEnum('consent_source', [
  'registration_form',     // During user registration
  'preference_center',     // User preference center
  'marketing_signup',      // Marketing-specific signup
  'admin_portal',          // Admin-initiated consent
  'api_import',           // Bulk import via API
  'third_party_sync',     // Third-party system sync
  'manual_entry'          // Manual admin entry
]);

export const communicationFrequencyEnum = pgEnum('communication_frequency', [
  'immediate',            // Immediate communications
  'daily',               // Daily digest
  'weekly',              // Weekly summary
  'monthly',             // Monthly newsletter
  'quarterly',           // Quarterly updates
  'as_needed',           // As needed basis
  'never'               // No communications
]);

export const marketingCampaignStatusEnum = pgEnum('marketing_campaign_status', [
  'draft',               // Campaign is being created
  'scheduled',           // Campaign is scheduled
  'active',              // Campaign is currently running
  'paused',              // Campaign is temporarily paused
  'completed',           // Campaign has finished
  'cancelled'            // Campaign was cancelled
]);

export const consentEvidenceTypeEnum = pgEnum('consent_evidence_type', [
  'checkbox_tick',       // User ticked consent checkbox
  'form_submission',     // Form submission with consent
  'email_confirmation',  // Email confirmation of consent
  'double_opt_in',       // Double opt-in confirmation
  'api_consent',         // API-based consent
  'admin_granted',       // Admin-granted consent
  'imported_consent',    // Imported from external system
  'withdrawal',          // Consent withdrawal evidence
  'modification'         // Consent modification evidence
]);

export const retentionDeletionMethodEnum = pgEnum('retention_deletion_method', ['soft', 'hard']);
export const retentionScheduleStatusEnum = pgEnum('retention_schedule_status', ['scheduled', 'completed', 'cancelled']);

// Enhanced data retention enums for comprehensive lifecycle management
export const retentionDataTypeEnum = pgEnum('retention_data_type', [
  'user_profile',           // User personal data (PII)
  'user_authentication',    // Password hashes, sessions, tokens
  'course_progress',        // Learning progress, completions, attempts
  'certificates',           // Generated certificates and records
  'communications',         // Email logs, notifications
  'audit_logs',            // System audit trails
  'support_tickets',       // Customer support data
  'billing_records',       // Payment and subscription data
  'consent_records',       // GDPR consent preferences
  'analytics_data',        // Usage analytics and tracking
  'uploaded_files',        // User-generated content and uploads
  'system_logs',           // Technical system logs
  'backup_data'            // System backups and archives
]);

export const dataLifecycleStatusEnum = pgEnum('data_lifecycle_status', [
  'active',                // Data is actively used
  'retention_pending',     // Approaching retention limit
  'deletion_scheduled',    // Marked for soft deletion
  'soft_deleted',         // Soft deleted, in grace period
  'deletion_pending',     // Ready for secure erase
  'securely_erased',      // Permanently deleted
  'archived',             // Long-term archived
  'frozen'                // Litigation hold or dispute freeze
]);

export const retentionPolicyTriggerEnum = pgEnum('retention_policy_trigger', [
  'time_based',           // Triggered by time elapsed
  'event_based',          // Triggered by specific events
  'consent_withdrawal',   // Triggered by consent withdrawal
  'account_deletion',     // Triggered by account deletion
  'contract_termination', // Triggered by contract end
  'manual_request',       // Manually triggered by admin
  'legal_obligation'      // Required by legal obligation
]);

export const secureEraseMethodEnum = pgEnum('secure_erase_method', [
  'simple_delete',        // Standard database delete
  'overwrite_once',       // Single pass overwrite
  'overwrite_multiple',   // Multi-pass secure overwrite
  'cryptographic_erase',  // Key destruction for encrypted data
  'physical_destruction'  // Physical destruction of storage media
]);

// Users table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  passwordHash: varchar("password_hash"), // Store hashed password for authentication
  role: userRoleEnum("role").notNull().default('user'),
  status: userStatusEnum("status").notNull().default('active'),
  organisationId: varchar("organisation_id"),
  jobTitle: varchar("job_title"),
  department: varchar("department"),
  phone: varchar("phone"),
  bio: text("bio"),
  allowCertificateDownload: boolean("allow_certificate_download").default(false),
  requiresPasswordChange: boolean("requires_password_change").default(false), // Flag to force password change on next login
  lastActive: timestamp("last_active"),
  // Stripe fields for individual billing (PAYG or per-user mapping)
  stripeCustomerId: varchar("stripe_customer_id"), // Individual Stripe Customer ID for PAYG users
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Organisations table
export const organisations = pgTable("organisations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  displayName: varchar("display_name").notNull(),
  subdomain: varchar("subdomain").notNull().unique(),
  logoUrl: varchar("logo_url"),
  theme: varchar("theme").default('light'),
  accentColor: varchar("accent_color").default('#3b82f6'), // Default blue color
  primaryColor: varchar("primary_color").default('#3b82f6'), // Primary brand color
  useCustomColors: boolean("use_custom_colors").default(false), // Whether to use custom color palette
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  address: text("address"),
  status: organisationStatusEnum("status").notNull().default('active'),
  
  // Plan and billing fields
  planId: varchar("plan_id"), // Reference to the plan this organisation is subscribed to
  stripeCustomerId: varchar("stripe_customer_id"), // Stripe Customer ID
  stripeSubscriptionId: varchar("stripe_subscription_id"), // Current Stripe Subscription ID
  stripeSubscriptionItemId: varchar("stripe_subscription_item_id"), // Stripe Subscription Item ID for the plan line
  billingStatus: billingStatusEnum("billing_status"), // Current billing status
  activeUserCount: integer("active_user_count").default(0), // For tracking usage (licensed_seats)
  currentPeriodEnd: timestamp("current_period_end"), // Subscription current period end date
  lastBillingSync: timestamp("last_billing_sync"), // Last time usage was synced to Stripe
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Additional indexes for performance on billing queries
  index("idx_organisation_billing_status").on(table.billingStatus),
  index("idx_organisation_stripe_customer").on(table.stripeCustomerId),
  index("idx_organisation_subscription").on(table.stripeSubscriptionId),
]);

// Course folders table
export const courseFolders = pgTable("course_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // e.g., "Childcare", "Elderly Care", "Construction"
  description: text("description"),
  color: varchar("color").default('#3b82f6'), // folder color for UI
  icon: varchar("icon").default('fas fa-folder'), // FontAwesome icon class
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Courses table
export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  folderId: varchar("folder_id"), // Reference to course folder
  scormPackageUrl: varchar("scorm_package_url"),
  coverImageUrl: varchar("cover_image_url"),
  estimatedDuration: integer("estimated_duration"), // in minutes
  passmark: integer("passmark").default(80), // percentage
  category: varchar("category"),
  tags: text("tags"), // comma-separated
  certificateExpiryPeriod: integer("certificate_expiry_period"), // in months, null = never expires
  // Enhanced SCORM fields
  launchUrlOverride: varchar("launch_url_override", { length: 500 }),
  scormVersion: varchar("scorm_version", { length: 10 }),
  scormOrganizations: jsonb("scorm_organizations"), // Store organizations and items for multi-SCO support
  defaultOrganization: varchar("default_organization", { length: 191 }),
  status: courseStatusEnum("status").notNull().default('draft'),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Organisation course folder access table
export const organisationCourseFolders = pgTable("organisation_course_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  folderId: varchar("folder_id").notNull(),
  grantedBy: varchar("granted_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Course assignments table
export const assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  userId: varchar("user_id").notNull(),
  organisationId: varchar("organisation_id").notNull(),
  dueDate: timestamp("due_date"),
  status: assignmentStatusEnum("status").notNull().default('not_started'),
  assignedBy: varchar("assigned_by").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  notificationsEnabled: boolean("notifications_enabled").default(true),
}, (table) => ({
  // UNIQUE CONSTRAINT: Prevent duplicate assignments for same user+course combination
  uniqueUserCourse: unique("assignments_user_course_unique").on(table.userId, table.courseId),
}));

// Course completions table
export const completions = pgTable("completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull(),
  userId: varchar("user_id").notNull(),
  courseId: varchar("course_id").notNull(),
  organisationId: varchar("organisation_id").notNull(),
  score: decimal("score", { precision: 5, scale: 2 }), // percentage with 2 decimal places
  status: completionStatusEnum("status").notNull(),
  attemptNumber: integer("attempt_number").default(1),
  timeSpent: integer("time_spent"), // in minutes
  scormData: jsonb("scorm_data"), // SCORM completion data
  completedAt: timestamp("completed_at").defaultNow(),
});

// Certificates table
export const certificates = pgTable("certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  completionId: varchar("completion_id").notNull(),
  userId: varchar("user_id").notNull(),
  courseId: varchar("course_id").notNull(),
  organisationId: varchar("organisation_id").notNull(),
  certificateUrl: varchar("certificate_url"),
  expiryDate: timestamp("expiry_date"),
  issuedAt: timestamp("issued_at").defaultNow(),
});

// Certificate templates table
export const certificateTemplates = pgTable("certificate_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  template: text("template"), // HTML template with placeholders
  templateFormat: varchar("template_format", { enum: ["html", "visual", "pdf"] }).default("html"), // 'html', 'visual', or 'pdf'
  templateData: jsonb("template_data"), // JSON data for visual templates
  pdfTemplateUrl: varchar("pdf_template_url"), // URL/path to uploaded PDF template
  isDefault: boolean("is_default").default(false),
  organisationId: varchar("organisation_id"), // null for global templates
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SCORM attempts table for comprehensive tracking
export const scormAttempts = pgTable("scorm_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attemptId: varchar("attempt_id").notNull().unique(), // client-generated unique ID
  assignmentId: varchar("assignment_id").notNull(),
  userId: varchar("user_id").notNull(),
  courseId: varchar("course_id").notNull(),
  organisationId: varchar("organisation_id").notNull(),
  itemId: varchar("item_id"), // SCO identifier for multi-SCO support
  scormVersion: varchar("scorm_version", { length: 10 }).notNull(), // "1.2" or "2004"
  status: scormAttemptStatusEnum("status").default('not_started'),
  
  // Raw SCORM 1.2 values
  lessonStatus: varchar("lesson_status"), // passed, completed, failed, incomplete, etc.
  lessonLocation: text("lesson_location"), // bookmark location for SCORM 1.2
  
  // Raw SCORM 2004 values  
  completionStatus: varchar("completion_status"), // completed, incomplete, not_attempted, unknown
  successStatus: varchar("success_status"), // passed, failed, unknown
  location: text("location"), // bookmark location for SCORM 2004
  progressMeasure: decimal("progress_measure", { precision: 5, scale: 4 }), // 0-1 scale
  
  // Score information (both versions)
  scoreRaw: decimal("score_raw", { precision: 7, scale: 2 }),
  scoreScaled: decimal("score_scaled", { precision: 5, scale: 4 }), // 0-1 scale for SCORM 2004
  scoreMin: decimal("score_min", { precision: 7, scale: 2 }),
  scoreMax: decimal("score_max", { precision: 7, scale: 2 }),
  
  // Session and tracking data
  sessionTime: varchar("session_time"), // SCORM format session time
  suspendData: text("suspend_data"), // Critical for resume functionality
  
  // Computed derived fields
  progressPercent: integer("progress_percent").default(0), // 0-100%
  passed: boolean("passed").default(false), // computed pass/fail
  completed: boolean("completed").default(false), // computed completion status
  
  // Course configuration at attempt time
  passmark: integer("passmark"), // course passmark when attempt was made
  
  // Attempt lifecycle
  isActive: boolean("is_active").default(true), // false when terminated/finished
  lastCommitAt: timestamp("last_commit_at"),
  finishedAt: timestamp("finished_at"),
  
  // Certificate generation
  certificateUrl: varchar("certificate_url"), // generated certificate download link
  certificateGeneratedAt: timestamp("certificate_generated_at"),
  
  // Raw SCORM data for debugging
  rawScormData: jsonb("raw_scorm_data"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Organisation settings table
export const organisationSettings = pgTable("organisation_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().unique(),
  signatureImageUrl: varchar("signature_image_url"),
  signerName: varchar("signer_name"),
  signerTitle: varchar("signer_title"),
  certificateText: text("certificate_text").default("has successfully completed"),
  assignmentEmailsEnabled: boolean("assignment_emails_enabled").default(true),
  reminderEmailsEnabled: boolean("reminder_emails_enabled").default(true),
  completionEmailsEnabled: boolean("completion_emails_enabled").default(true),
  reminderDays: integer("reminder_days").default(7), // days before due date
  defaultCertificateDownload: boolean("default_certificate_download").default(false),
  // Provider-agnostic email configuration
  emailProvider: emailProviderEnum("email_provider"),
  
  // Common fields (all providers)
  fromName: varchar("from_name"),
  fromEmail: varchar("from_email"),
  replyTo: varchar("reply_to"),
  
  // SMTP fields (for smtp_generic provider)
  smtpHost: varchar("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUsername: varchar("smtp_username"),
  smtpPassword: varchar("smtp_password"),
  smtpSecure: boolean("smtp_secure"),
  
  // API fields (provider-specific APIs)
  apiKey: varchar("api_key"),
  apiSecret: varchar("api_secret"), // For Mailjet which needs key+secret
  apiBaseUrl: varchar("api_base_url"),
  
  // Provider-specific optional fields
  apiDomain: varchar("api_domain"), // For Mailgun
  apiRegion: varchar("api_region"), // For SES
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Platform settings table
export const platformSettings = pgTable("platform_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Todo items table (for SuperAdmin)
export const todoItems = pgTable("todo_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  task: text("task").notNull(),
  completed: boolean("completed").default(false),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Plans table
export const plans = pgTable("plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // e.g., "Enterprise", "Premium", "Basic"
  description: text("description"),
  
  // Billing settings
  billingModel: billingModelEnum("billing_model").notNull(), // metered_per_active_user | per_seat | flat_subscription
  cadence: billingCadenceEnum("cadence").notNull().default('monthly'), // monthly | annual
  currency: varchar("currency", { length: 3 }).notNull().default('GBP'), // ISO currency code
  unitAmount: integer("unit_amount").notNull(), // Price in minor units (e.g. 2000 = £20.00)
  taxBehavior: taxBehaviorEnum("tax_behavior").notNull().default('exclusive'), // inclusive | exclusive
  trialDays: integer("trial_days"), // Optional trial period in days
  minSeats: integer("min_seats"), // Minimum seats for per_seat billing
  
  // Stripe integration
  stripeProductId: varchar("stripe_product_id"), // Stripe Product ID
  stripePriceId: varchar("stripe_price_id"), // Current active Stripe Price ID
  
  // Flags and settings
  isActive: boolean("is_active").notNull().default(true),
  priceChangePolicy: priceChangePolicyEnum("price_change_policy").notNull().default('prorate_immediately'),
  
  // Legacy field for backward compatibility - remove when migration is complete
  pricePerUser: decimal("price_per_user", { precision: 10, scale: 2 }),
  status: planStatusEnum("status").notNull().default('active'), // Keep for compatibility
  
  // Metadata
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Plan features table - defines available features that can be enabled/disabled
export const planFeatures = pgTable("plan_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(), // e.g., "custom_branding", "remove_branding", "custom_slug"
  name: varchar("name").notNull(), // Human-readable name
  description: text("description"),
  category: varchar("category"), // e.g., "branding", "customization", "functionality"
  isDefault: boolean("is_default").default(false), // Whether this feature is included by default
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Plan feature mappings table - maps which features are enabled for each plan
export const planFeatureMappings = pgTable("plan_feature_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull(),
  featureId: varchar("feature_id").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit log table - tracks user activities and system events
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  userId: varchar("user_id"), // null for system events
  action: varchar("action").notNull(), // e.g., "login", "course_completed", "user_created"
  resource: varchar("resource"), // e.g., "user", "course", "assignment"
  resourceId: varchar("resource_id"), // ID of the affected resource
  details: jsonb("details"), // Additional event data
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// REMOVED: Email template tables (replaced with hardcoded automated email templates)
// The automated email system now uses hardcoded templates in AutomatedEmailTemplates.ts
// and routes through EmailOrchestrator for idempotency

// // EmailTemplate table - platform-level default email templates with MJML support
// export const emailTemplates = pgTable("email_templates", {
//   id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
//   key: varchar("key").notNull().unique(), // e.g., 'welcome', 'course_assigned', 'training_expiring'
//   name: varchar("name").notNull(), // Human-readable title
//   subject: text("subject").notNull(), // Handlebars-enabled subject template
//   html: text("html").notNull(), // Compiled HTML from MJML
//   mjml: text("mjml").notNull(), // Source MJML template
//   text: text("text"), // Optional plain text version
//   variablesSchema: jsonb("variables_schema"), // JSON schema defining required/optional variables
//   category: emailTemplateCategoryEnum("category").notNull(), // learner | admin
//   version: integer("version").notNull().default(1), // Version control for templates
//   isActive: boolean("is_active").notNull().default(true),
//   createdAt: timestamp("created_at").defaultNow(),
//   updatedAt: timestamp("updated_at").defaultNow(),
// }, (table) => [
//   index("idx_email_template_key").on(table.key),
//   index("idx_email_template_category").on(table.category),
//   index("idx_email_template_active").on(table.isActive),
// ]);

// // OrgEmailTemplate table - organization-specific overrides for email templates
// export const orgEmailTemplates = pgTable("org_email_templates", {
//   id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
//   orgId: varchar("org_id").notNull(), // FK to organisations
//   templateKey: varchar("template_key").notNull(), // FK to EmailTemplate.key
//   subjectOverride: text("subject_override"), // Override subject template
//   htmlOverride: text("html_override"), // Override compiled HTML
//   mjmlOverride: text("mjml_override"), // Override MJML source
//   textOverride: text("text_override"), // Override plain text version
//   version: integer("version").notNull().default(1), // Track override version
//   isActive: boolean("is_active").notNull().default(true),
//   createdAt: timestamp("created_at").defaultNow(),
//   updatedAt: timestamp("updated_at").defaultNow(),
// }, (table) => [
//   index("idx_org_email_template_org").on(table.orgId),
//   index("idx_org_email_template_key").on(table.templateKey),
//   index("idx_org_email_template_org_key").on(table.orgId, table.templateKey),
//   // Unique constraint to prevent duplicate overrides for same org+template
//   unique("unique_org_email_template").on(table.orgId, table.templateKey),
// ]);

// System-wide email settings table (SuperAdmin level - platform defaults)
export const systemEmailSettings = pgTable("system_email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Provider and common settings
  emailProvider: emailProviderEnum("email_provider").notNull(),
  fromName: varchar("from_name").notNull(),
  fromEmail: varchar("from_email").notNull(),
  replyTo: varchar("reply_to"),
  
  // SMTP fields (for smtp_generic provider)  
  smtpHost: varchar("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUsername: varchar("smtp_username"),
  smtpPassword: varchar("smtp_password"),
  smtpSecure: boolean("smtp_secure"),
  
  // API fields (provider-specific APIs)
  apiKey: varchar("api_key"),
  apiSecret: varchar("api_secret"), // For Mailjet
  apiBaseUrl: varchar("api_base_url"),
  
  // Provider-specific optional fields
  apiDomain: varchar("api_domain"), // For Mailgun
  apiRegion: varchar("api_region"), // For SES
  
  // System settings
  isActive: boolean("is_active").default(true),
  description: text("description"), // e.g., "Production SendGrid", "Testing SMTP"
  updatedBy: varchar("updated_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email delivery logs table (keeping existing table name for compatibility)
export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id"), // null for system emails
  
  // Email details
  provider: emailProviderEnum("provider").notNull(),
  fromEmail: varchar("from_email").notNull(),
  toEmail: varchar("to_email").notNull(),
  subject: varchar("subject").notNull(),
  templateType: emailTemplateTypeEnum("template_type"),
  
  // Delivery details
  httpStatus: integer("http_status"), // HTTP status for API providers
  smtpStatus: varchar("smtp_status"), // SMTP status code
  endpoint: varchar("endpoint"), // API endpoint used
  messageId: varchar("message_id"), // Provider message ID
  
  // Status and errors
  status: varchar("status").notNull(), // "sent", "failed"
  errorShort: varchar("error_short"), // Human-friendly error message  
  errorRaw: text("error_raw"), // Raw error (first 200 chars)
  
  // Metadata
  keyPreview: varchar("key_preview"), // Masked API key (first4…last4)
  keyLength: integer("key_length"), // API key length
  effectiveFieldSources: jsonb("effective_field_sources"), // Which fields came from org vs platform
  routingSource: emailRoutingSourceEnum("routing_source"), // Track which routing path was used
  timestamp: timestamp("timestamp").defaultNow(),
  
  // Legacy fields for compatibility
  smtpHost: varchar("smtp_host"),
  smtpPort: integer("smtp_port"), 
  tlsUsed: boolean("tls_used"),
  usedOrgSettings: boolean("used_org_settings").default(false),
  fallbackUsed: boolean("fallback_used").default(false),
});

// EMAIL ORCHESTRATOR TABLES - New centralized email system

// Email sends table - primary orchestrator tracking table  
export const emailSends = pgTable("email_sends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Idempotency and trigger context
  idempotencyKey: varchar("idempotency_key").notNull().unique(), // Format: TRIGGER:recipient:resource_id
  triggerEvent: emailTriggerEventEnum("trigger_event").notNull(), // Which event triggered this
  
  // Email metadata
  organisationId: varchar("organisation_id"), // null for system emails
  templateKey: varchar("template_key").notNull(), // Which template was used
  toEmail: varchar("to_email").notNull(),
  subject: varchar("subject").notNull(),
  
  // Content (rendered)
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  
  // Template context used for rendering
  templateVariables: jsonb("template_variables"), // Variables passed to template engine
  
  // Send status and retry logic
  status: emailSendStatusEnum("status").notNull().default('pending'),
  provider: emailProviderEnum("provider"),
  providerMessageId: varchar("provider_message_id"),
  
  // Error tracking and retry logic
  errorMessage: text("error_message"),
  errorCode: varchar("error_code"),
  retryCount: integer("retry_count").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at"),
  lastAttemptAt: timestamp("last_attempt_at"),
  
  // Success tracking
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"), // If provider supports delivery confirmations
  
  // Metadata
  fromEmail: varchar("from_email"),
  fromName: varchar("from_name"),
  replyTo: varchar("reply_to"),
  routingSource: emailRoutingSourceEnum("routing_source"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_email_sends_status").on(table.status),
  index("idx_email_sends_trigger").on(table.triggerEvent),
  index("idx_email_sends_org").on(table.organisationId),
  index("idx_email_sends_retry").on(table.status, table.nextRetryAt),
  index("idx_email_sends_created").on(table.createdAt),
  unique("unique_email_send_idempotency").on(table.idempotencyKey),
]);

// Email settings lock table - prevents concurrent template modifications
export const emailSettingsLock = pgTable("email_settings_lock", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lockType: varchar("lock_type").notNull(), // 'template_edit', 'system_settings', 'org_settings'
  resourceId: varchar("resource_id").notNull(), // template key, org id, or 'system'
  lockedBy: varchar("locked_by").notNull(), // user id
  lockReason: varchar("lock_reason"), // e.g., 'editing_template', 'testing_send'
  expiresAt: timestamp("expires_at").notNull(), // auto-expire locks after 30 minutes
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_email_lock_resource").on(table.lockType, table.resourceId),
  index("idx_email_lock_expires").on(table.expiresAt),
  unique("unique_email_lock").on(table.lockType, table.resourceId),
]);

// Billing/subscription distributed lock table - prevents concurrent billing operations
export const billingLocks = pgTable("billing_locks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lockType: varchar("lock_type").notNull(), // 'subscription_modify', 'checkout_complete', 'plan_change', 'usage_sync'
  resourceId: varchar("resource_id").notNull(), // organisation id, subscription id, or customer id
  lockedBy: varchar("locked_by").notNull(), // process/server id + operation id
  lockReason: varchar("lock_reason"), // e.g., 'subscription_update', 'proration_calculation', 'plan_change'
  expiresAt: timestamp("expires_at").notNull(), // auto-expire locks after configurable timeout (default 5 minutes)
  acquiredAt: timestamp("acquired_at").defaultNow(),
  renewedAt: timestamp("renewed_at"), // for lock renewals during long operations
  queuePosition: integer("queue_position"), // for ordered operation processing
  correlationId: varchar("correlation_id"), // for tracing and debugging
  metadata: jsonb("metadata"), // additional context for lock (operation details, retry count)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_billing_lock_resource").on(table.lockType, table.resourceId),
  index("idx_billing_lock_expires").on(table.expiresAt),
  index("idx_billing_lock_queue").on(table.lockType, table.resourceId, table.queuePosition),
  index("idx_billing_lock_correlation").on(table.correlationId),
  unique("unique_billing_lock").on(table.lockType, table.resourceId),
]);

// DEPRECATED - OLD EMAIL TEMPLATE DEFAULTS TABLE (REPLACED BY NEW ROBUST SCHEMA)
// This table has been replaced by the new 'emailTemplates' table with MJML support
// TODO: Remove this table after data migration
/*
export const emailTemplateDefaults = pgTable("email_template_defaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(), // e.g., 'admin.new_admin_added', 'learner.course_assigned'
  category: emailTemplateCategoryEnum("category").notNull(), // 'admin' | 'learner'
  subject: varchar("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  variablesSchema: jsonb("variables_schema"), // Array of allowed variables for this template
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").notNull(),
});
*/

// DEPRECATED - OLD EMAIL TEMPLATE OVERRIDES TABLE (REPLACED BY NEW ROBUST SCHEMA)
// This table has been replaced by the new 'orgEmailTemplates' table with MJML support
// TODO: Remove this table after data migration
/*
export const emailTemplateOverrides = pgTable("email_template_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  templateKey: varchar("template_key").notNull(), // FK to EmailTemplateDefaults.key
  subjectOverride: varchar("subject_override"),
  htmlOverride: text("html_override"),
  textOverride: text("text_override"),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").notNull(),
}, (table) => [
  index("idx_email_override_org_template").on(table.orgId, table.templateKey),
  // Unique constraint to prevent duplicate overrides for same org+template
  unique("unique_email_override_org_template").on(table.orgId, table.templateKey),
]);
*/

// Organisation notification settings table - controls who receives notifications
export const orgNotificationSettings = pgTable("org_notification_settings", {
  orgId: varchar("org_id").primaryKey(), // FK to Organisation
  sendToAdmins: boolean("send_to_admins").default(true),
  extraRecipients: jsonb("extra_recipients"), // Array of additional email addresses
  emailProviderConfigId: varchar("email_provider_config_id"), // nullable FK to EmailProviderConfigs
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").notNull(),
});

// Email provider configurations table - stores provider-specific settings
export const emailProviderConfigs = pgTable("email_provider_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"), // nullable FK to Organisation; null = platform default
  provider: emailProviderEnum("provider").notNull(), // Use enum for type safety and consistency
  configJson: jsonb("config_json").notNull(), // Provider-specific configuration object
  isDefaultForOrg: boolean("is_default_for_org").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").notNull(),
}, (table) => [
  index("idx_email_provider_org").on(table.orgId),
  index("idx_email_provider_default").on(table.isDefaultForOrg),
]);

// Support tickets table
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: varchar("ticket_number", { length: 20 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").default('open').notNull(),
  priority: ticketPriorityEnum("priority").default('medium').notNull(),
  category: ticketCategoryEnum("category").default('general').notNull(),
  
  // User relationships
  createdBy: varchar("created_by").notNull(), // User ID who created
  assignedTo: varchar("assigned_to"), // SuperAdmin user ID who is handling
  organisationId: varchar("organisation_id"), // null for SuperAdmin tickets
  
  // Tracking
  isRead: boolean("is_read").default(false), // Has assigned agent read it?
  lastResponseAt: timestamp("last_response_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Support ticket responses table (conversation)
export const supportTicketResponses = pgTable("support_ticket_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull(),
  createdBy: varchar("created_by").notNull(), // Who wrote this response (legacy field)
  userId: varchar("user_id").notNull(), // Who wrote this response  
  message: text("message").notNull(),
  isInternal: boolean("is_internal").default(false), // Internal agent notes
  attachments: jsonb("attachments"), // Array of file attachments
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id],
  }),
  assignments: many(assignments),
  completions: many(completions),
  certificates: many(certificates),
  todoItems: many(todoItems),
}));

export const organisationsRelations = relations(organisations, ({ many, one }) => ({
  users: many(users),
  assignments: many(assignments),
  completions: many(completions),
  certificates: many(certificates),
  settings: one(organisationSettings),
  certificateTemplates: many(certificateTemplates),
  courseFolderAccess: many(organisationCourseFolders),
  plan: one(plans, {
    fields: [organisations.planId],
    references: [plans.id],
  }),
}));

export const courseFoldersRelations = relations(courseFolders, ({ one, many }) => ({
  courses: many(courses),
  createdByUser: one(users, {
    fields: [courseFolders.createdBy],
    references: [users.id],
  }),
  organisationAccess: many(organisationCourseFolders),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  assignments: many(assignments),
  completions: many(completions),
  certificates: many(certificates),
  folder: one(courseFolders, {
    fields: [courses.folderId],
    references: [courseFolders.id],
  }),
  createdByUser: one(users, {
    fields: [courses.createdBy],
    references: [users.id],
  }),
}));

export const organisationCourseFoldersRelations = relations(organisationCourseFolders, ({ one }) => ({
  organisation: one(organisations, {
    fields: [organisationCourseFolders.organisationId],
    references: [organisations.id],
  }),
  folder: one(courseFolders, {
    fields: [organisationCourseFolders.folderId],
    references: [courseFolders.id],
  }),
  grantedByUser: one(users, {
    fields: [organisationCourseFolders.grantedBy],
    references: [users.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  course: one(courses, {
    fields: [assignments.courseId],
    references: [courses.id],
  }),
  user: one(users, {
    fields: [assignments.userId],
    references: [users.id],
  }),
  organisation: one(organisations, {
    fields: [assignments.organisationId],
    references: [organisations.id],
  }),
  assignedByUser: one(users, {
    fields: [assignments.assignedBy],
    references: [users.id],
  }),
  completions: many(completions),
}));

export const completionsRelations = relations(completions, ({ one }) => ({
  assignment: one(assignments, {
    fields: [completions.assignmentId],
    references: [assignments.id],
  }),
  user: one(users, {
    fields: [completions.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [completions.courseId],
    references: [courses.id],
  }),
  organisation: one(organisations, {
    fields: [completions.organisationId],
    references: [organisations.id],
  }),
  certificate: one(certificates, {
    fields: [completions.id],
    references: [certificates.completionId],
  }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  completion: one(completions, {
    fields: [certificates.completionId],
    references: [completions.id],
  }),
  user: one(users, {
    fields: [certificates.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [certificates.courseId],
    references: [courses.id],
  }),
  organisation: one(organisations, {
    fields: [certificates.organisationId],
    references: [organisations.id],
  }),
}));

export const certificateTemplatesRelations = relations(certificateTemplates, ({ one }) => ({
  organisation: one(organisations, {
    fields: [certificateTemplates.organisationId],
    references: [organisations.id],
  }),
}));

export const organisationSettingsRelations = relations(organisationSettings, ({ one }) => ({
  organisation: one(organisations, {
    fields: [organisationSettings.organisationId],
    references: [organisations.id],
  }),
}));

export const todoItemsRelations = relations(todoItems, ({ one }) => ({
  user: one(users, {
    fields: [todoItems.userId],
    references: [users.id],
  }),
}));

// Plan relations
export const plansRelations = relations(plans, ({ many, one }) => ({
  organisations: many(organisations),
  createdByUser: one(users, {
    fields: [plans.createdBy],
    references: [users.id],
  }),
  featureMappings: many(planFeatureMappings),
}));

export const planFeaturesRelations = relations(planFeatures, ({ many }) => ({
  planMappings: many(planFeatureMappings),
}));

export const planFeatureMappingsRelations = relations(planFeatureMappings, ({ one }) => ({
  plan: one(plans, {
    fields: [planFeatureMappings.planId],
    references: [plans.id],
  }),
  feature: one(planFeatures, {
    fields: [planFeatureMappings.featureId],
    references: [planFeatures.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organisation: one(organisations, {
    fields: [auditLogs.organisationId],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// REMOVED: Email template relations (replaced with hardcoded automated email templates)

// // EmailTemplate relations (platform defaults - no org relationship)
// export const emailTemplatesRelations = relations(emailTemplates, ({ many }) => ({
//   orgOverrides: many(orgEmailTemplates), // One template can have many org overrides
// }));

// // OrgEmailTemplate relations (tenant overrides)
// export const orgEmailTemplatesRelations = relations(orgEmailTemplates, ({ one }) => ({
//   organisation: one(organisations, {
//     fields: [orgEmailTemplates.orgId],
//     references: [organisations.id],
//   }),
//   template: one(emailTemplates, {
//     fields: [orgEmailTemplates.templateKey],
//     references: [emailTemplates.key],
//   }),
// }));

export const systemEmailSettingsRelations = relations(systemEmailSettings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [systemEmailSettings.updatedBy],
    references: [users.id],
  }),
}));

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  organisation: one(organisations, {
    fields: [emailLogs.organisationId],
    references: [organisations.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [supportTickets.createdBy],
    references: [users.id],
  }),
  assignedToUser: one(users, {
    fields: [supportTickets.assignedTo],
    references: [users.id],
  }),
  organisation: one(organisations, {
    fields: [supportTickets.organisationId],
    references: [organisations.id],
  }),
  responses: many(supportTicketResponses),
}));

export const supportTicketResponsesRelations = relations(supportTicketResponses, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [supportTicketResponses.ticketId],
    references: [supportTickets.id],
  }),
  user: one(users, {
    fields: [supportTicketResponses.userId],
    references: [users.id],
  }),
}));

// Email template defaults relations
// DEPRECATED - OLD EMAIL TEMPLATE RELATIONS (TO BE REMOVED)
// export const emailTemplateDefaultsRelations = relations(emailTemplateDefaults, ({ one, many }) => ({
//   updatedByUser: one(users, {
//     fields: [emailTemplateDefaults.updatedBy],
//     references: [users.id],
//   }),
//   overrides: many(emailTemplateOverrides),
// }));

// export const emailTemplateOverridesRelations = relations(emailTemplateOverrides, ({ one }) => ({
//   organisation: one(organisations, {
//     fields: [emailTemplateOverrides.orgId],
//     references: [organisations.id],
//   }),
//   templateDefault: one(emailTemplateDefaults, {
//     fields: [emailTemplateOverrides.templateKey],
//     references: [emailTemplateDefaults.key],
//   }),
//   updatedByUser: one(users, {
//     fields: [emailTemplateOverrides.updatedBy],
//     references: [users.id],
//   }),
// }));

// Organisation notification settings relations
export const orgNotificationSettingsRelations = relations(orgNotificationSettings, ({ one }) => ({
  organisation: one(organisations, {
    fields: [orgNotificationSettings.orgId],
    references: [organisations.id],
  }),
  emailProviderConfig: one(emailProviderConfigs, {
    fields: [orgNotificationSettings.emailProviderConfigId],
    references: [emailProviderConfigs.id],
  }),
  updatedByUser: one(users, {
    fields: [orgNotificationSettings.updatedBy],
    references: [users.id],
  }),
}));

// Email provider configs relations
export const emailProviderConfigsRelations = relations(emailProviderConfigs, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [emailProviderConfigs.orgId],
    references: [organisations.id],
  }),
  updatedByUser: one(users, {
    fields: [emailProviderConfigs.updatedBy],
    references: [users.id],
  }),
  notificationSettings: many(orgNotificationSettings),
}));

// Webhook events table for persistent deduplication
export const webhookEvents = pgTable("webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stripeEventId: varchar("stripe_event_id").notNull().unique(), // Stripe event ID for deduplication
  eventType: varchar("event_type").notNull(), // e.g., 'customer.subscription.created'
  processedAt: timestamp("processed_at").defaultNow(),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"), // Store error if processing failed
  correlationId: varchar("correlation_id"), // For debugging and tracing
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_webhook_events_stripe_event_id").on(table.stripeEventId),
  index("idx_webhook_events_processed_at").on(table.processedAt),
  index("idx_webhook_events_event_type").on(table.eventType),
]);

// GDPR tables (UK GDPR and Data Protection Act 2018 compliance)
export const consentRecords = pgTable("consent_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  organisationId: varchar("organisation_id").notNull(),
  consentType: varchar("consent_type").notNull(),
  status: consentStatusEnum("status").notNull(),
  lawfulBasis: processingLawfulBasisEnum("lawful_basis").notNull(),
  purpose: text("purpose").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  ipAddress: varchar("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  policyVersion: varchar("policy_version").notNull(),
  withdrawnAt: timestamp("withdrawn_at"),
  expiresAt: timestamp("expires_at"),
  marketingConsents: jsonb("marketing_consents").notNull().default('{}'),
  cookieConsents: jsonb("cookie_consents").notNull().default('{}'),
  metadata: jsonb("metadata").notNull().default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_consent_records_user_id").on(table.userId),
  index("idx_consent_records_organisation_id").on(table.organisationId),
  index("idx_consent_records_status").on(table.status),
  index("idx_consent_records_timestamp").on(table.timestamp),
]);

export const privacySettings = pgTable("privacy_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().unique(),
  dataRetentionPeriod: integer("data_retention_period").notNull().default(2555), // 7 years in days
  cookieSettings: jsonb("cookie_settings").$type<{
    strictlyNecessary?: boolean;
    functional?: boolean;
    analytics?: boolean;
    advertising?: boolean;
  }>().notNull().default('{}'),
  privacyContacts: jsonb("privacy_contacts").$type<{
    dpoEmail?: string;
    privacyEmail?: string;
    complaintsProcedure?: string;
  }>().notNull().default('{}'),
  internationalTransfers: jsonb("international_transfers").$type<{
    enabled?: boolean;
    countries?: string[];
    safeguards?: string;
  }>().notNull().default('{}'),
  settings: jsonb("settings").$type<Record<string, any>>().notNull().default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_privacy_settings_organisation_id").on(table.organisationId),
]);

export const userRightRequests = pgTable("user_right_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  organisationId: varchar("organisation_id").notNull(),
  type: userRightTypeEnum("type").notNull(),
  status: userRightStatusEnum("status").notNull().default('pending'),
  description: text("description").notNull(),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
  processedAt: timestamp("processed_at"),
  completedAt: timestamp("completed_at"),
  rejectionReason: text("rejection_reason"),
  adminNotes: text("admin_notes").notNull().default(''),
  attachments: text("attachments").array().notNull().default(sql`ARRAY[]::text[]`),
  metadata: jsonb("metadata").notNull().default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_right_requests_user_id").on(table.userId),
  index("idx_user_right_requests_organisation_id").on(table.organisationId),
  index("idx_user_right_requests_status").on(table.status),
  index("idx_user_right_requests_type").on(table.type),
  index("idx_user_right_requests_requested_at").on(table.requestedAt),
]);

export const processingActivities = pgTable("processing_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  name: varchar("name").notNull(),
  purpose: text("purpose").notNull(),
  description: text("description").notNull(),
  lawfulBasis: processingLawfulBasisEnum("lawful_basis").notNull(),
  dataCategories: text("data_categories").array().notNull().default(sql`ARRAY[]::text[]`),
  dataSubjects: text("data_subjects").array().notNull().default(sql`ARRAY[]::text[]`),
  recipients: text("recipients").array().notNull().default(sql`ARRAY[]::text[]`),
  internationalTransfers: boolean("international_transfers").notNull().default(false),
  transferCountries: text("transfer_countries").array().notNull().default(sql`ARRAY[]::text[]`),
  retentionPeriod: varchar("retention_period").notNull(),
  securityMeasures: text("security_measures").array().notNull().default(sql`ARRAY[]::text[]`),
  dpia: jsonb("dpia").notNull().default('{"required": false, "completed": false}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_processing_activities_organisation_id").on(table.organisationId),
  index("idx_processing_activities_lawful_basis").on(table.lawfulBasis),
]);

export const dataBreaches = pgTable("data_breaches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  severity: breachSeverityEnum("severity").notNull(),
  status: breachStatusEnum("status").notNull().default('detected'),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  reportedAt: timestamp("reported_at"),
  icoNotifiedAt: timestamp("ico_notified_at"),
  subjectsNotifiedAt: timestamp("subjects_notified_at"),
  affectedSubjects: integer("affected_subjects").notNull().default(0),
  dataCategories: text("data_categories").array().notNull().default(sql`ARRAY[]::text[]`),
  cause: text("cause").notNull(),
  impact: text("impact").notNull(),
  containmentMeasures: text("containment_measures").notNull(),
  preventiveMeasures: text("preventive_measures").notNull(),
  notificationDeadline: timestamp("notification_deadline").notNull(),
  responsible: varchar("responsible").notNull(),
  attachments: text("attachments").array().notNull().default(sql`ARRAY[]::text[]`),
  metadata: jsonb("metadata").notNull().default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_data_breaches_organisation_id").on(table.organisationId),
  index("idx_data_breaches_severity").on(table.severity),
  index("idx_data_breaches_status").on(table.status),
  index("idx_data_breaches_detected_at").on(table.detectedAt),
  index("idx_data_breaches_notification_deadline").on(table.notificationDeadline),
]);

export const retentionRules = pgTable("retention_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  name: varchar("name").notNull(),
  description: text("description").notNull(),
  dataType: varchar("data_type").notNull(),
  retentionPeriod: integer("retention_period").notNull(), // days
  deletionMethod: retentionDeletionMethodEnum("deletion_method").notNull().default('soft'),
  legalBasis: text("legal_basis").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_retention_rules_organisation_id").on(table.organisationId),
  index("idx_retention_rules_data_type").on(table.dataType),
  index("idx_retention_rules_enabled").on(table.enabled),
]);

export const retentionSchedules = pgTable("retention_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  userId: varchar("user_id").notNull(),
  dataType: varchar("data_type").notNull(),
  scheduledDeletion: timestamp("scheduled_deletion").notNull(),
  status: retentionScheduleStatusEnum("status").notNull().default('scheduled'),
  retentionRuleId: varchar("retention_rule_id").notNull(),
  processedAt: timestamp("processed_at"),
  metadata: jsonb("metadata").notNull().default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_retention_schedules_organisation_id").on(table.organisationId),
  index("idx_retention_schedules_user_id").on(table.userId),
  index("idx_retention_schedules_scheduled_deletion").on(table.scheduledDeletion),
  index("idx_retention_schedules_status").on(table.status),
  index("idx_retention_schedules_retention_rule_id").on(table.retentionRuleId),
]);

export const gdprAuditLogs = pgTable("gdpr_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  userId: varchar("user_id"),
  adminId: varchar("admin_id"),
  action: auditActionEnum("action").notNull(),
  resource: auditResourceEnum("resource").notNull(),
  resourceId: varchar("resource_id").notNull(),
  details: jsonb("details").notNull().default('{}'),
  ipAddress: varchar("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  
  // Enhanced accountability fields
  category: auditCategoryEnum("category").notNull(),
  severity: auditSeverityEnum("severity").notNull().default('info'),
  outcome: auditOutcomeEnum("outcome").notNull().default('success'),
  
  // Correlation and traceability
  correlationId: varchar("correlation_id"), // Link related audit events
  parentAuditId: varchar("parent_audit_id"), // Link to parent audit event
  transactionId: varchar("transaction_id"), // Database transaction ID
  sessionId: varchar("session_id"), // User session ID
  requestId: varchar("request_id"), // HTTP request ID
  
  // Context and evidence
  businessContext: text("business_context"), // Business justification
  legalBasis: processingLawfulBasisEnum("legal_basis"), // GDPR legal basis
  retentionPeriod: integer("retention_period_days"), // How long to retain this audit log
  evidenceHash: varchar("evidence_hash"), // Hash of supporting evidence
  witnessedBy: varchar("witnessed_by"), // Staff member who witnessed action
  
  // Compliance metadata
  complianceFramework: varchar("compliance_framework").default('UK_GDPR'), // UK_GDPR, EU_GDPR, etc.
  regulatoryRef: varchar("regulatory_ref"), // Reference to regulation/article
  riskAssessment: jsonb("risk_assessment").default('{}'), // Risk evaluation data
  
  // Error and exception handling
  errorCode: varchar("error_code"), // System error code if applicable
  errorMessage: text("error_message"), // Error description
  stackTrace: text("stack_trace"), // Technical error details
  
  // Timing and performance
  duration: integer("duration_ms"), // Action duration in milliseconds
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  completedAt: timestamp("completed_at"), // When action completed
  
  // Integrity and verification (separated from mutable verification metadata)
  checksumHash: varchar("checksum_hash"), // Audit log integrity hash
  previousLogHash: varchar("previous_log_hash"), // Chain integrity hash
  canonicalPayload: jsonb("canonical_payload"), // Exact payload that was hashed for verification
  // NOTE: isVerified moved to separate chain head table to avoid mutating audit records
  
  // Archival and retention
  isArchived: boolean("is_archived").default(false),
  archiveDate: timestamp("archive_date"),
  retentionUntil: timestamp("retention_until"),
  
}, (table) => [
  index("idx_gdpr_audit_logs_organisation_id").on(table.organisationId),
  index("idx_gdpr_audit_logs_user_id").on(table.userId),
  index("idx_gdpr_audit_logs_admin_id").on(table.adminId),
  index("idx_gdpr_audit_logs_action").on(table.action),
  index("idx_gdpr_audit_logs_resource").on(table.resource),
  index("idx_gdpr_audit_logs_timestamp").on(table.timestamp),
  index("idx_gdpr_audit_logs_category").on(table.category),
  index("idx_gdpr_audit_logs_severity").on(table.severity),
  index("idx_gdpr_audit_logs_outcome").on(table.outcome),
  index("idx_gdpr_audit_logs_correlation_id").on(table.correlationId),
  index("idx_gdpr_audit_logs_session_id").on(table.sessionId),
  index("idx_gdpr_audit_logs_completed_at").on(table.completedAt),
  index("idx_gdpr_audit_logs_retention_until").on(table.retentionUntil),
  index("idx_gdpr_audit_logs_legal_basis").on(table.legalBasis),
]);

// GDPR Audit Chain Head Tracking Table
// This table maintains the head of audit chains for each organization
// with proper concurrency control to prevent race conditions
export const gdprAuditChainHeads = pgTable("gdpr_audit_chain_heads", {
  organisationId: varchar("organisation_id").primaryKey(),
  lastAuditLogId: varchar("last_audit_log_id").notNull(), // Reference to latest audit log
  lastChainHash: varchar("last_chain_hash").notNull(), // Hash of the last audit log in chain
  chainLength: integer("chain_length").notNull().default(1), // Total number of logs in chain
  version: integer("version").notNull().default(1), // For optimistic locking
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  // Verification metadata (separate from immutable chain data)
  lastVerified: timestamp("last_verified"), // When chain was last verified
  verificationStatus: varchar("verification_status").default('pending'), // pending, valid, broken
  brokenAtLogId: varchar("broken_at_log_id"), // If chain is broken, which log broke it
}, (table) => [
  index("idx_chain_heads_last_updated").on(table.lastUpdated),
  index("idx_chain_heads_verification_status").on(table.verificationStatus),
  index("idx_chain_heads_last_verified").on(table.lastVerified),
]);

// Comprehensive Data Processing Activity Audit Table
export const dataProcessingAuditLogs = pgTable("data_processing_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Processing activity identification
  processingActivityId: varchar("processing_activity_id"),
  processingPurpose: text("processing_purpose").notNull(),
  dataCategory: dataCategoryEnum("data_category").notNull(),
  
  // Processing details
  operation: varchar("operation").notNull(), // collect, process, share, retain, delete
  dataSubjects: text("data_subjects").array().notNull(), // Types of data subjects affected
  personalDataTypes: text("personal_data_types").array().notNull(),
  specialCategoryData: text("special_category_data").array(),
  
  // Legal compliance
  legalBasis: processingLawfulBasisEnum("legal_basis").notNull(),
  legitimateInterest: text("legitimate_interest"), // If legal basis is legitimate interest
  consentRequired: boolean("consent_required").default(false),
  consentObtained: boolean("consent_obtained").default(false),
  
  // Data flow tracking
  dataSource: varchar("data_source").notNull(), // Where data came from
  dataDestination: varchar("data_destination"), // Where data is going
  thirdPartyRecipients: text("third_party_recipients").array(),
  internationalTransfers: boolean("international_transfers").default(false),
  transferSafeguards: text("transfer_safeguards"),
  
  // Retention and disposal
  retentionPeriod: varchar("retention_period"),
  retentionJustification: text("retention_justification"),
  disposalMethod: varchar("disposal_method"),
  
  // User and context
  triggeredBy: varchar("triggered_by"), // User or system that triggered processing
  automaticProcessing: boolean("automatic_processing").default(false),
  humanReviewRequired: boolean("human_review_required").default(false),
  
  // Risk and compliance
  riskLevel: varchar("risk_level").default('low'), // low, medium, high
  dpiaRequired: boolean("dpia_required").default(false),
  dpiaReference: varchar("dpia_reference"),
  
  // Audit metadata
  correlationId: varchar("correlation_id"),
  processingStarted: timestamp("processing_started").notNull(),
  processingCompleted: timestamp("processing_completed"),
  recordCount: integer("record_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_data_processing_audit_organisation_id").on(table.organisationId),
  index("idx_data_processing_audit_activity_id").on(table.processingActivityId),
  index("idx_data_processing_audit_operation").on(table.operation),
  index("idx_data_processing_audit_data_category").on(table.dataCategory),
  index("idx_data_processing_audit_legal_basis").on(table.legalBasis),
  index("idx_data_processing_audit_started").on(table.processingStarted),
  index("idx_data_processing_audit_correlation_id").on(table.correlationId),
  index("idx_data_processing_audit_risk_level").on(table.riskLevel),
]);

// User Rights Request Audit Trail Table
export const userRightsAuditLogs = pgTable("user_rights_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Request identification
  userRightRequestId: varchar("user_right_request_id").notNull(),
  requestType: userRightTypeEnum("request_type").notNull(),
  requestReference: varchar("request_reference").notNull(),
  
  // Staff and user tracking
  dataSubjectId: varchar("data_subject_id"),
  processedBy: varchar("processed_by"), // Staff member processing
  reviewedBy: varchar("reviewed_by"), // Senior staff reviewer
  approvedBy: varchar("approved_by"), // Final approver
  
  // Action tracking
  actionTaken: varchar("action_taken").notNull(),
  actionDescription: text("action_description").notNull(),
  evidenceCollected: text("evidence_collected").array(),
  documentsGenerated: text("documents_generated").array(),
  
  // Compliance tracking
  slaStatus: varchar("sla_status").notNull(), // on_track, at_risk, overdue
  daysSinceSubmission: integer("days_since_submission"),
  daysUntilDeadline: integer("days_until_deadline"),
  deadlineExtensionReason: text("deadline_extension_reason"),
  
  // Quality assurance
  qualityCheckPerformed: boolean("quality_check_performed").default(false),
  qualityCheckBy: varchar("quality_check_by"),
  qualityIssues: text("quality_issues").array(),
  correctionsMade: text("corrections_made").array(),
  
  // Outcome tracking
  outcome: varchar("outcome"), // fulfilled, rejected, partially_fulfilled
  rejectionReason: text("rejection_reason"),
  dataSubjectNotified: boolean("data_subject_notified").default(false),
  notificationMethod: varchar("notification_method"),
  
  // Audit metadata
  correlationId: varchar("correlation_id"),
  stepInProcess: varchar("step_in_process").notNull(),
  duration: integer("duration_minutes"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_rights_audit_organisation_id").on(table.organisationId),
  index("idx_user_rights_audit_request_id").on(table.userRightRequestId),
  index("idx_user_rights_audit_request_type").on(table.requestType),
  index("idx_user_rights_audit_processed_by").on(table.processedBy),
  index("idx_user_rights_audit_sla_status").on(table.slaStatus),
  index("idx_user_rights_audit_outcome").on(table.outcome),
  index("idx_user_rights_audit_correlation_id").on(table.correlationId),
  index("idx_user_rights_audit_created_at").on(table.createdAt),
]);

// Consent Management Audit Trail Table
export const consentAuditLogs = pgTable("consent_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Consent identification
  consentRecordId: varchar("consent_record_id"),
  marketingConsentId: varchar("marketing_consent_id"),
  userId: varchar("user_id"),
  
  // Consent details
  consentType: marketingConsentTypeEnum("consent_type"),
  consentAction: varchar("consent_action").notNull(), // granted, denied, withdrawn, modified
  previousStatus: consentStatusEnum("previous_status"),
  newStatus: consentStatusEnum("new_status").notNull(),
  
  // Context and evidence
  consentMethod: varchar("consent_method").notNull(), // web_form, email, phone, in_person
  consentSource: consentSourceEnum("consent_source").notNull(),
  evidenceData: jsonb("evidence_data").notNull().default('{}'),
  doubleOptIn: boolean("double_opt_in").default(false),
  
  // Technical details
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  browserFingerprint: varchar("browser_fingerprint"),
  sessionId: varchar("session_id"),
  
  // Legal basis and compliance
  legalBasis: processingLawfulBasisEnum("legal_basis").default('consent'),
  pecrCompliance: boolean("pecr_compliance").default(false),
  childConsent: boolean("child_consent").default(false),
  parentalConsentId: varchar("parental_consent_id"),
  
  // Audit trail
  processedBy: varchar("processed_by"), // If processed by admin
  witnessedBy: varchar("witnessed_by"), // If witnessed by staff
  correlationId: varchar("correlation_id"),
  
  // Evidence preservation
  evidenceHash: varchar("evidence_hash"),
  digitalSignature: text("digital_signature"),
  timestampService: varchar("timestamp_service"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_consent_audit_organisation_id").on(table.organisationId),
  index("idx_consent_audit_consent_record_id").on(table.consentRecordId),
  index("idx_consent_audit_marketing_consent_id").on(table.marketingConsentId),
  index("idx_consent_audit_user_id").on(table.userId),
  index("idx_consent_audit_consent_action").on(table.consentAction),
  index("idx_consent_audit_new_status").on(table.newStatus),
  index("idx_consent_audit_consent_source").on(table.consentSource),
  index("idx_consent_audit_correlation_id").on(table.correlationId),
  index("idx_consent_audit_created_at").on(table.createdAt),
]);

// System Access and Security Audit Table
export const systemAccessAuditLogs = pgTable("system_access_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // User identification
  userId: varchar("user_id"),
  userEmail: varchar("user_email"),
  userRole: userRoleEnum("user_role"),
  impersonatedUserId: varchar("impersonated_user_id"), // If user is being impersonated
  
  // Access details
  accessType: varchar("access_type").notNull(), // login, logout, action, admin_access, privileged_operation
  accessMethod: varchar("access_method").notNull(), // web, api, mobile, admin_panel
  authenticationMethod: varchar("authentication_method"), // password, sso, 2fa
  
  // Session tracking
  sessionId: varchar("session_id"),
  sessionDuration: integer("session_duration_minutes"),
  concurrentSessions: integer("concurrent_sessions"),
  
  // Technical details
  ipAddress: varchar("ip_address").notNull(),
  userAgent: text("user_agent"),
  geolocation: jsonb("geolocation").default('{}'),
  deviceFingerprint: varchar("device_fingerprint"),
  
  // Security context
  riskScore: integer("risk_score"), // 0-100 security risk assessment
  anomalyDetected: boolean("anomaly_detected").default(false),
  securityFlags: text("security_flags").array(),
  
  // Actions and resources
  resourceAccessed: varchar("resource_accessed"),
  actionPerformed: varchar("action_performed"),
  privilegedOperation: boolean("privileged_operation").default(false),
  dataAccessAttempt: boolean("data_access_attempt").default(false),
  
  // Outcome and errors
  outcome: varchar("outcome").notNull(), // success, failure, blocked, suspicious
  failureReason: varchar("failure_reason"),
  securityResponse: varchar("security_response"), // none, alert, block, investigate
  
  // Compliance context
  gdprRelevant: boolean("gdpr_relevant").default(false),
  personalDataAccessed: boolean("personal_data_accessed").default(false),
  specialCategoryAccessed: boolean("special_category_accessed").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_system_access_audit_organisation_id").on(table.organisationId),
  index("idx_system_access_audit_user_id").on(table.userId),
  index("idx_system_access_audit_access_type").on(table.accessType),
  index("idx_system_access_audit_outcome").on(table.outcome),
  index("idx_system_access_audit_privileged_operation").on(table.privilegedOperation),
  index("idx_system_access_audit_anomaly_detected").on(table.anomalyDetected),
  index("idx_system_access_audit_ip_address").on(table.ipAddress),
  index("idx_system_access_audit_created_at").on(table.createdAt),
]);

// Enhanced Age Verification table (UK GDPR Article 8 compliance)
export const ageVerifications = pgTable("age_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  organisationId: varchar("organisation_id").notNull(),
  
  // Age verification details
  dateOfBirth: timestamp("date_of_birth"),
  ageGroup: ageGroupEnum("age_group"),
  estimatedAge: integer("estimated_age"), // For cases where exact age is estimated
  ageVerified: boolean("age_verified").notNull().default(false),
  verificationMethod: ageVerificationMethodEnum("verification_method").notNull().default('self_declaration'),
  verificationScore: integer("verification_score").default(0), // Confidence score 0-100
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by"), // Admin or system that verified
  
  // Parental consent tracking (legacy fields for compatibility)
  parentalConsentRequired: boolean("parental_consent_required").notNull().default(false),
  parentalConsentGiven: boolean("parental_consent_given").notNull().default(false),
  parentEmail: varchar("parent_email"),
  parentName: varchar("parent_name"),
  
  // Enhanced child protection
  protectionLevel: childProtectionLevelEnum("protection_level").notNull().default('standard'),
  restrictedProcessing: boolean("restricted_processing").notNull().default(false),
  marketingRestricted: boolean("marketing_restricted").notNull().default(true),
  profilingRestricted: boolean("profiling_restricted").notNull().default(true),
  
  // Documentation and evidence
  verificationDocuments: text("verification_documents").array().default(sql`ARRAY[]::text[]`),
  evidenceStorageId: varchar("evidence_storage_id"), // Reference to object storage
  parentalConsentDocumentId: varchar("parental_consent_document_id"),
  
  // Compliance and audit
  legalBasis: processingLawfulBasisEnum("legal_basis").array().default(sql`ARRAY[]::processing_lawful_basis[]`),
  specialCategoryJustification: text("special_category_justification"),
  dataMinimizationApplied: boolean("data_minimization_applied").notNull().default(true),
  
  // Lifecycle management
  consentExpiryDate: timestamp("consent_expiry_date"),
  nextVerificationDue: timestamp("next_verification_due"),
  lastReviewedAt: timestamp("last_reviewed_at"),
  reviewedBy: varchar("reviewed_by"),
  
  // Status and flags
  isActive: boolean("is_active").notNull().default(true),
  flags: text("flags").array().default(sql`ARRAY[]::text[]`), // For special considerations
  notes: text("notes"),
  metadata: jsonb("metadata").notNull().default('{}'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_age_verifications_user_id").on(table.userId),
  index("idx_age_verifications_organisation_id").on(table.organisationId),
  index("idx_age_verifications_age_verified").on(table.ageVerified),
  index("idx_age_verifications_age_group").on(table.ageGroup),
  index("idx_age_verifications_parental_consent_required").on(table.parentalConsentRequired),
  index("idx_age_verifications_protection_level").on(table.protectionLevel),
  index("idx_age_verifications_consent_expiry").on(table.consentExpiryDate),
  index("idx_age_verifications_verification_method").on(table.verificationMethod),
]);

// Parental Consent Records table (UK GDPR Article 8 compliance)
export const parentalConsentRecords = pgTable("parental_consent_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  childUserId: varchar("child_user_id").notNull(),
  parentUserId: varchar("parent_user_id"), // If parent has an account
  
  // Parental information
  parentName: varchar("parent_name").notNull(),
  parentEmail: varchar("parent_email").notNull(),
  parentPhone: varchar("parent_phone"),
  relationship: parentalRelationshipEnum("relationship").notNull(),
  
  // Consent details
  consentStatus: parentalConsentStatusEnum("consent_status").notNull().default('required'),
  consentGrantedAt: timestamp("consent_granted_at"),
  consentWithdrawnAt: timestamp("consent_withdrawn_at"),
  consentExpiryDate: timestamp("consent_expiry_date"),
  
  // Verification and evidence
  verificationMethod: consentVerificationMethodEnum("verification_method").notNull().default('email_verification'),
  verificationToken: varchar("verification_token"), // For email/SMS verification
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  verificationAttempts: integer("verification_attempts").default(0),
  verificationCompletedAt: timestamp("verification_completed_at"),
  
  // Evidence collection
  consentEvidence: jsonb("consent_evidence").notNull().default('{}'),
  evidenceDocuments: text("evidence_documents").array().default(sql`ARRAY[]::text[]`),
  digitalSignature: text("digital_signature"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  geolocation: jsonb("geolocation"),
  
  // Processing details
  purposesConsented: text("purposes_consented").array().notNull().default(sql`ARRAY[]::text[]`),
  dataTypesAuthorized: dataCategoryEnum("data_types_authorized").array().default(sql`ARRAY[]::data_category[]`),
  processingLimitations: text("processing_limitations").array().default(sql`ARRAY[]::text[]`),
  retentionPeriodMonths: integer("retention_period_months").default(12),
  
  // Contact and communication preferences
  preferredContactMethod: communicationTypeEnum("preferred_contact_method").default('service_essential'),
  communicationLanguage: varchar("communication_language").default('en-GB'),
  notificationFrequency: communicationFrequencyEnum("notification_frequency").default('as_needed'),
  
  // Audit and compliance
  consentSourceDetails: jsonb("consent_source_details").notNull().default('{}'),
  legalBasisJustification: text("legal_basis_justification"),
  specialCategoryConsent: boolean("special_category_consent").default(false),
  internationalTransferConsent: boolean("international_transfer_consent").default(false),
  
  // Review and renewal
  lastReviewedAt: timestamp("last_reviewed_at"),
  nextReviewDue: timestamp("next_review_due"),
  renewalNotificationSent: boolean("renewal_notification_sent").default(false),
  
  // Administrative
  grantedBy: varchar("granted_by"), // Admin who processed the consent
  withdrawnBy: varchar("withdrawn_by"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  internalReference: varchar("internal_reference"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_parental_consent_organisation_id").on(table.organisationId),
  index("idx_parental_consent_child_user_id").on(table.childUserId),
  index("idx_parental_consent_parent_user_id").on(table.parentUserId),
  index("idx_parental_consent_parent_email").on(table.parentEmail),
  index("idx_parental_consent_status").on(table.consentStatus),
  index("idx_parental_consent_granted_at").on(table.consentGrantedAt),
  index("idx_parental_consent_expiry_date").on(table.consentExpiryDate),
  index("idx_parental_consent_verification_method").on(table.verificationMethod),
  index("idx_parental_consent_next_review_due").on(table.nextReviewDue),
]);

// Family Account Linking table (UK GDPR Article 8 compliance)
export const familyAccounts = pgTable("family_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Family identification
  familyName: varchar("family_name").notNull(),
  primaryParentUserId: varchar("primary_parent_user_id").notNull(),
  secondaryParentUserId: varchar("secondary_parent_user_id"), // Optional second parent/guardian
  
  // Account management
  accountStatus: familyAccountStatusEnum("account_status").notNull().default('pending_verification'),
  accountType: varchar("account_type").notNull().default('family'), // family, guardian, institution
  
  // Verification details
  primaryParentVerified: boolean("primary_parent_verified").notNull().default(false),
  secondaryParentVerified: boolean("secondary_parent_verified").default(false),
  verificationLevel: consentVerificationMethodEnum("verification_level").notNull().default('email_verification'),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by"),
  
  // Family settings and preferences
  childProtectionLevel: childProtectionLevelEnum("child_protection_level").notNull().default('standard'),
  communicationPreferences: jsonb("communication_preferences").notNull().default('{}'),
  notificationSettings: jsonb("notification_settings").notNull().default('{}'),
  
  // Data processing settings
  sharedDataPolicy: jsonb("shared_data_policy").notNull().default('{}'),
  consentSharingAllowed: boolean("consent_sharing_allowed").default(false),
  crossChildDataSharing: boolean("cross_child_data_sharing").default(false),
  
  // Contact information
  primaryContactEmail: varchar("primary_contact_email").notNull(),
  alternateContactEmail: varchar("alternate_contact_email"),
  contactPhone: varchar("contact_phone"),
  emergencyContact: jsonb("emergency_contact"),
  
  // Address and location
  homeAddress: jsonb("home_address"),
  jurisdiction: varchar("jurisdiction").default('GB'), // Legal jurisdiction
  
  // Lifecycle management
  activatedAt: timestamp("activated_at"),
  suspendedAt: timestamp("suspended_at"),
  suspensionReason: text("suspension_reason"),
  dissolvedAt: timestamp("dissolved_at"),
  dissolutionReason: text("dissolution_reason"),
  
  // Administrative
  isActive: boolean("is_active").notNull().default(true),
  flags: text("flags").array().default(sql`ARRAY[]::text[]`),
  notes: text("notes"),
  internalReference: varchar("internal_reference"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_family_accounts_organisation_id").on(table.organisationId),
  index("idx_family_accounts_primary_parent").on(table.primaryParentUserId),
  index("idx_family_accounts_secondary_parent").on(table.secondaryParentUserId),
  index("idx_family_accounts_status").on(table.accountStatus),
  index("idx_family_accounts_primary_contact_email").on(table.primaryContactEmail),
  index("idx_family_accounts_protection_level").on(table.childProtectionLevel),
  index("idx_family_accounts_activated_at").on(table.activatedAt),
]);

// Child Account Links table (many-to-many relationship between family accounts and child users)
export const childAccountLinks = pgTable("child_account_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  familyAccountId: varchar("family_account_id").notNull(),
  childUserId: varchar("child_user_id").notNull(),
  
  // Link details
  linkType: varchar("link_type").notNull().default('child'), // child, ward, student
  relationship: parentalRelationshipEnum("relationship").notNull(),
  custodyType: varchar("custody_type"), // full, shared, limited, temporary
  parentalResponsibility: boolean("parental_responsibility").notNull().default(true),
  
  // Consent specific to this child
  parentalConsentRecordId: varchar("parental_consent_record_id"),
  consentStatus: parentalConsentStatusEnum("consent_status").notNull().default('required'),
  consentGrantedAt: timestamp("consent_granted_at"),
  consentExpiryDate: timestamp("consent_expiry_date"),
  
  // Child-specific settings
  protectionLevel: childProtectionLevelEnum("protection_level").notNull().default('standard'),
  dataProcessingRestrictions: text("data_processing_restrictions").array().default(sql`ARRAY[]::text[]`),
  allowedActivities: text("allowed_activities").array().default(sql`ARRAY[]::text[]`),
  prohibitedActivities: text("prohibited_activities").array().default(sql`ARRAY[]::text[]`),
  
  // Age transition planning
  ageTransitionPlanned: boolean("age_transition_planned").default(false),
  transitionDate: timestamp("transition_date"), // When child will reach age of consent
  transitionNotificationSent: boolean("transition_notification_sent").default(false),
  
  // Supervision and monitoring
  supervisionLevel: varchar("supervision_level").default('standard'), // standard, enhanced, minimal
  monitoringEnabled: boolean("monitoring_enabled").default(false),
  lastSupervisionCheck: timestamp("last_supervision_check"),
  
  // Link status and lifecycle
  linkStatus: varchar("link_status").notNull().default('active'), // active, suspended, dissolved, transferred
  linkedAt: timestamp("linked_at").defaultNow(),
  suspendedAt: timestamp("suspended_at"),
  suspensionReason: text("suspension_reason"),
  dissolvedAt: timestamp("dissolved_at"),
  dissolutionReason: text("dissolution_reason"),
  
  // Administrative
  linkedBy: varchar("linked_by"), // Admin who created the link
  lastModifiedBy: varchar("last_modified_by"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_child_account_links_organisation_id").on(table.organisationId),
  index("idx_child_account_links_family_account_id").on(table.familyAccountId),
  index("idx_child_account_links_child_user_id").on(table.childUserId),
  index("idx_child_account_links_consent_status").on(table.consentStatus),
  index("idx_child_account_links_consent_expiry").on(table.consentExpiryDate),
  index("idx_child_account_links_protection_level").on(table.protectionLevel),
  index("idx_child_account_links_transition_date").on(table.transitionDate),
  index("idx_child_account_links_link_status").on(table.linkStatus),
  unique("unique_family_child_link").on(table.familyAccountId, table.childUserId),
]);

// Child Protection Settings table (organization-level child protection policies)
export const childProtectionSettings = pgTable("child_protection_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().unique(),
  
  // Age verification policies
  ageVerificationRequired: boolean("age_verification_required").notNull().default(true),
  minimumVerificationMethod: ageVerificationMethodEnum("minimum_verification_method").notNull().default('date_of_birth'),
  requiredVerificationScore: integer("required_verification_score").default(70),
  
  // Parental consent policies
  parentalConsentRequired: boolean("parental_consent_required").notNull().default(true),
  minimumConsentMethod: consentVerificationMethodEnum("minimum_consent_method").notNull().default('email_verification'),
  consentExpiryMonths: integer("consent_expiry_months").default(12),
  consentRenewalReminder: boolean("consent_renewal_reminder").default(true),
  reminderDaysBefore: integer("reminder_days_before").default(30),
  
  // Data processing restrictions for children
  childDataMinimization: boolean("child_data_minimization").notNull().default(true),
  prohibitProfiling: boolean("prohibit_profiling").notNull().default(true),
  prohibitMarketing: boolean("prohibit_marketing").notNull().default(true),
  prohibitDataSharing: boolean("prohibit_data_sharing").notNull().default(true),
  restrictInternationalTransfers: boolean("restrict_international_transfers").notNull().default(true),
  
  // Retention and deletion policies for child data
  childDataRetentionMonths: integer("child_data_retention_months").default(12),
  automaticDeletionEnabled: boolean("automatic_deletion_enabled").default(true),
  parentsCanRequestDeletion: boolean("parents_can_request_deletion").default(true),
  transitionToAdultConsent: boolean("transition_to_adult_consent").default(true),
  
  // Communication and notification settings
  parentalNotificationsEnabled: boolean("parental_notifications_enabled").default(true),
  notifyOnDataCollection: boolean("notify_on_data_collection").default(true),
  notifyOnProcessingChanges: boolean("notify_on_processing_changes").default(true),
  notifyOnBreaches: boolean("notify_on_breaches").default(true),
  
  // Special category data handling
  specialCategoryDataAllowed: boolean("special_category_data_allowed").default(false),
  healthDataRestrictions: jsonb("health_data_restrictions").default('{}'),
  educationalRecordsPolicy: jsonb("educational_records_policy").default('{}'),
  
  // Platform features and restrictions
  chatFeaturesRestricted: boolean("chat_features_restricted").default(true),
  socialFeaturesRestricted: boolean("social_features_restricted").default(true),
  publicProfileProhibited: boolean("public_profile_prohibited").default(true),
  contactInformationHidden: boolean("contact_information_hidden").default(true),
  
  // Compliance and reporting
  reportingRequired: boolean("reporting_required").default(true),
  auditFrequencyMonths: integer("audit_frequency_months").default(6),
  complianceOfficerRequired: boolean("compliance_officer_required").default(false),
  designatedContactRequired: boolean("designated_contact_required").default(true),
  
  // Administrative
  isActive: boolean("is_active").notNull().default(true),
  lastReviewedAt: timestamp("last_reviewed_at"),
  lastReviewedBy: varchar("last_reviewed_by"),
  nextReviewDue: timestamp("next_review_due"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_child_protection_settings_organisation_id").on(table.organisationId),
  index("idx_child_protection_settings_last_reviewed").on(table.lastReviewedAt),
  index("idx_child_protection_settings_next_review_due").on(table.nextReviewDue),
]);

export const cookieInventory = pgTable("cookie_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  name: varchar("name").notNull(),
  purpose: text("purpose").notNull(),
  category: cookieCategoryEnum("category").notNull(),
  duration: varchar("duration").notNull(),
  provider: varchar("provider").notNull(),
  domain: varchar("domain").notNull(),
  essential: boolean("essential").notNull().default(false),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_cookie_inventory_organisation_id").on(table.organisationId),
  index("idx_cookie_inventory_category").on(table.category),
  index("idx_cookie_inventory_essential").on(table.essential),
]);

// Enhanced Data Retention and Lifecycle Management Tables
// (GDPR Article 5(e) storage limitation compliance)

// Data retention policies - enhanced version of retention rules with comprehensive lifecycle management
export const dataRetentionPolicies = pgTable("data_retention_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  dataType: retentionDataTypeEnum("data_type").notNull(),
  retentionPeriodDays: integer("retention_period_days").notNull(),
  triggerType: retentionPolicyTriggerEnum("trigger_type").notNull().default('time_based'),
  triggerConditions: jsonb("trigger_conditions").notNull().default('{}'),
  description: text("description"),
  legalBasis: processingLawfulBasisEnum("legal_basis").array(),
  deletionMethod: retentionDeletionMethodEnum("deletion_method").notNull().default('soft'),
  secureEraseMethod: secureEraseMethodEnum("secure_erase_method").notNull().default('overwrite_multiple'),
  gracePeriodDays: integer("grace_period_days").notNull().default(30),
  notifyBeforeDays: integer("notify_before_days").notNull().default(7),
  priority: integer("priority").notNull().default(100),
  enabled: boolean("enabled").notNull().default(true),
  automaticDeletion: boolean("automatic_deletion").notNull().default(true),
  requiresManualReview: boolean("requires_manual_review").notNull().default(false),
  exceptions: text("exceptions").array(),
  metadata: jsonb("metadata").notNull().default('{}'),
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_data_retention_policies_organisation_id").on(table.organisationId),
  index("idx_data_retention_policies_data_type").on(table.dataType),
  index("idx_data_retention_policies_enabled").on(table.enabled),
  index("idx_data_retention_policies_trigger_type").on(table.triggerType),
  index("idx_data_retention_policies_priority").on(table.priority),
  index("idx_data_retention_policies_automatic_deletion").on(table.automaticDeletion),
]);

// Data lifecycle tracking - tracks the deletion lifecycle of individual data records
export const dataLifecycleRecords = pgTable("data_lifecycle_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  userId: varchar("user_id").notNull(),
  dataType: retentionDataTypeEnum("data_type").notNull(),
  resourceId: varchar("resource_id").notNull(), // ID of the actual data record
  resourceTable: varchar("resource_table").notNull(), // Table name containing the data
  status: dataLifecycleStatusEnum("status").notNull().default('active'),
  policyId: varchar("policy_id").notNull(), // Reference to data retention policy
  
  // Lifecycle timestamps
  dataCreatedAt: timestamp("data_created_at").notNull(), // When the original data was created
  retentionEligibleAt: timestamp("retention_eligible_at").notNull(), // When eligible for deletion
  softDeleteScheduledAt: timestamp("soft_delete_scheduled_at"), // When soft deletion is scheduled
  softDeletedAt: timestamp("soft_deleted_at"), // When soft deleted
  secureEraseScheduledAt: timestamp("secure_erase_scheduled_at"), // When secure erase is scheduled
  secureErasedAt: timestamp("secure_erased_at"), // When securely erased
  archivedAt: timestamp("archived_at"), // If archived instead of deleted
  frozenAt: timestamp("frozen_at"), // If frozen due to legal hold
  
  // Deletion details
  deletionReason: text("deletion_reason"), // Human-readable reason for deletion
  deletionMethod: retentionDeletionMethodEnum("deletion_method"),
  secureEraseMethod: secureEraseMethodEnum("secure_erase_method"),
  deletionConfirmation: varchar("deletion_confirmation"), // Confirmation hash/signature
  complianceCertificate: varchar("compliance_certificate"), // Generated certificate reference
  
  // Processing details
  lastProcessedAt: timestamp("last_processed_at"),
  processingErrors: jsonb("processing_errors").notNull().default('[]'),
  retryCount: integer("retry_count").notNull().default(0),
  metadata: jsonb("metadata").notNull().default('{}'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_data_lifecycle_records_organisation_id").on(table.organisationId),
  index("idx_data_lifecycle_records_user_id").on(table.userId),
  index("idx_data_lifecycle_records_data_type").on(table.dataType),
  index("idx_data_lifecycle_records_status").on(table.status),
  index("idx_data_lifecycle_records_policy_id").on(table.policyId),
  index("idx_data_lifecycle_records_resource").on(table.resourceTable, table.resourceId),
  index("idx_data_lifecycle_records_retention_eligible").on(table.retentionEligibleAt),
  index("idx_data_lifecycle_records_soft_delete_scheduled").on(table.softDeleteScheduledAt),
  index("idx_data_lifecycle_records_secure_erase_scheduled").on(table.secureEraseScheduledAt),
  // Compound index for lifecycle processing
  index("idx_data_lifecycle_processing").on(table.status, table.lastProcessedAt),
]);

// Retention compliance auditing - tracks adherence to retention policies
export const retentionComplianceAudits = pgTable("retention_compliance_audits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  auditDate: timestamp("audit_date").defaultNow().notNull(),
  policyId: varchar("policy_id").notNull(),
  dataType: retentionDataTypeEnum("data_type").notNull(),
  
  // Compliance metrics
  totalRecords: integer("total_records").notNull().default(0),
  compliantRecords: integer("compliant_records").notNull().default(0),
  overdueRecords: integer("overdue_records").notNull().default(0),
  errorRecords: integer("error_records").notNull().default(0),
  processedRecords: integer("processed_records").notNull().default(0),
  
  // Timing metrics
  averageRetentionPeriod: integer("average_retention_period"), // days
  longestRetentionPeriod: integer("longest_retention_period"), // days
  oldestRecord: timestamp("oldest_record"),
  
  // Compliance status
  complianceRate: decimal("compliance_rate", { precision: 5, scale: 2 }), // percentage
  isCompliant: boolean("is_compliant").notNull().default(true),
  riskLevel: varchar("risk_level").notNull().default('low'), // low, medium, high, critical
  
  // Issues and recommendations
  issues: jsonb("issues").notNull().default('[]'),
  recommendations: jsonb("recommendations").notNull().default('[]'),
  auditNotes: text("audit_notes"),
  
  // Audit metadata
  auditPerformedBy: varchar("audit_performed_by"),
  auditDuration: integer("audit_duration"), // seconds
  nextAuditDue: timestamp("next_audit_due"),
  metadata: jsonb("metadata").notNull().default('{}'),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_retention_compliance_audits_organisation_id").on(table.organisationId),
  index("idx_retention_compliance_audits_policy_id").on(table.policyId),
  index("idx_retention_compliance_audits_data_type").on(table.dataType),
  index("idx_retention_compliance_audits_audit_date").on(table.auditDate),
  index("idx_retention_compliance_audits_compliance").on(table.isCompliant, table.complianceRate),
  index("idx_retention_compliance_audits_risk_level").on(table.riskLevel),
  index("idx_retention_compliance_audits_next_due").on(table.nextAuditDue),
]);

// Secure deletion certificates - provides proof of secure data deletion for compliance
export const secureDeletionCertificates = pgTable("secure_deletion_certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  certificateNumber: varchar("certificate_number").notNull().unique(),
  
  // Deletion details
  userId: varchar("user_id"),
  dataTypes: text("data_types").array().notNull(), // Array of data types deleted
  recordCount: integer("record_count").notNull(),
  deletionMethod: secureEraseMethodEnum("deletion_method").notNull(),
  deletionStarted: timestamp("deletion_started").notNull(),
  deletionCompleted: timestamp("deletion_completed").notNull(),
  
  // Verification details
  verificationHash: varchar("verification_hash").notNull(), // Cryptographic proof
  witnessedBy: varchar("witnessed_by"), // Admin who witnessed the deletion
  verificationMethod: varchar("verification_method").notNull(),
  
  // Legal and compliance context
  legalBasis: processingLawfulBasisEnum("legal_basis").notNull(),
  regulatoryRequirement: text("regulatory_requirement"),
  requestOrigin: varchar("request_origin").notNull(), // 'retention_policy', 'user_request', 'admin_action'
  requestReference: varchar("request_reference"), // Reference to original request
  
  // Certificate metadata
  certificateTemplate: varchar("certificate_template").default('standard'),
  certificateUrl: varchar("certificate_url"), // Generated PDF certificate
  digitalSignature: text("digital_signature"), // Digital signature of certificate
  validUntil: timestamp("valid_until"), // Certificate validity period
  
  // Additional context
  deletionReason: text("deletion_reason").notNull(),
  complianceNotes: text("compliance_notes"),
  metadata: jsonb("metadata").notNull().default('{}'),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_secure_deletion_certificates_organisation_id").on(table.organisationId),
  index("idx_secure_deletion_certificates_certificate_number").on(table.certificateNumber),
  index("idx_secure_deletion_certificates_user_id").on(table.userId),
  index("idx_secure_deletion_certificates_deletion_completed").on(table.deletionCompleted),
  index("idx_secure_deletion_certificates_request_origin").on(table.requestOrigin),
  index("idx_secure_deletion_certificates_legal_basis").on(table.legalBasis),
]);

// International Transfer enums (GDPR Chapter V Articles 44-49)
export const transferTypeEnum = pgEnum('transfer_type', [
  'customer_data',           // Customer personal data
  'employee_data',          // HR and employee records
  'supplier_data',          // Vendor/supplier information
  'marketing_data',         // Marketing and communications
  'technical_data',         // System logs and technical data
  'financial_data',         // Payment and billing data
  'health_data',            // Special category health data
  'biometric_data',         // Biometric identifiers
  'other_special_category'  // Other Article 9 special categories
]);

export const transferLegalBasisEnum = pgEnum('transfer_legal_basis', [
  'adequacy_decision',      // Article 45 - Adequacy decisions
  'appropriate_safeguards', // Article 46 - Appropriate safeguards (SCCs, BCRs, etc.)
  'binding_corporate_rules', // Article 47 - BCRs
  'approved_code_conduct',  // Article 40 - Approved codes of conduct
  'approved_certification', // Article 42 - Approved certification
  'specific_situation',     // Article 49 - Derogations for specific situations
  'explicit_consent',       // Article 49(1)(a) - Explicit consent
  'contract_performance',   // Article 49(1)(b) - Contract performance
  'public_interest',        // Article 49(1)(d) - Important public interest
  'legal_claims',           // Article 49(1)(e) - Legal claims
  'vital_interests',        // Article 49(1)(f) - Vital interests
  'public_register'         // Article 49(1)(g) - Public register
]);

export const transferMechanismTypeEnum = pgEnum('transfer_mechanism_type', [
  'adequacy_decision',      // EU Commission adequacy decision
  'standard_contractual_clauses', // Standard Contractual Clauses (SCCs)
  'international_data_transfer_agreement', // UK IDTA
  'binding_corporate_rules', // Binding Corporate Rules
  'approved_certification_scheme', // Certification schemes
  'approved_code_conduct',  // Codes of conduct
  'ad_hoc_contractual_clauses', // Ad hoc contractual clauses
  'no_mechanism_required'   // For adequacy decision countries
]);

export const transferStatusEnum = pgEnum('transfer_status', [
  'active',                 // Transfer is currently active
  'suspended',              // Transfer temporarily suspended
  'terminated',             // Transfer permanently ended
  'under_review',           // Transfer being assessed
  'pending_approval',       // Awaiting approval to commence
  'non_compliant',          // Transfer flagged as non-compliant
  'migrating_mechanism'     // Transitioning to new mechanism
]);

export const transferFrequencyEnum = pgEnum('transfer_frequency', [
  'continuous',             // Ongoing/real-time transfers
  'daily',                  // Daily batch transfers
  'weekly',                 // Weekly transfers
  'monthly',                // Monthly transfers
  'quarterly',              // Quarterly transfers
  'annual',                 // Annual transfers
  'ad_hoc',                 // One-off or irregular transfers
  'event_driven'            // Triggered by specific events
]);

export const transferRiskLevelEnum = pgEnum('transfer_risk_level', [
  'low',                    // Low risk transfer (adequate country + appropriate safeguards)
  'medium',                 // Medium risk (adequate safeguards but some concerns)
  'high',                   // High risk (limited safeguards or high-risk country)
  'very_high',              // Very high risk (minimal safeguards, authoritarian regime)
  'prohibited'              // Transfer prohibited by policy or law
]);

export const tiaStatusEnum = pgEnum('tia_status', [
  'draft',                  // TIA being prepared
  'under_review',           // TIA submitted for review
  'approved',               // TIA approved, transfer can proceed
  'rejected',               // TIA rejected, transfer denied
  'requires_revision',      // TIA needs updates before approval
  'expired',                // TIA approval has expired
  'withdrawn'               // TIA withdrawn by requester
]);

export const adequacyDecisionStatusEnum = pgEnum('adequacy_decision_status', [
  'adequate',               // Current adequacy decision in force
  'inadequate',             // No adequacy decision or revoked
  'under_review',           // Adequacy decision being reviewed
  'pending',                // Adequacy decision pending adoption
  'transitional'            // Temporary adequacy arrangement
]);

export const documentTypeEnum = pgEnum('document_type', [
  'transfer_impact_assessment', // TIA document
  'data_protection_agreement',  // DPA with processor
  'standard_contractual_clauses', // SCCs
  'international_data_transfer_agreement', // IDTA
  'binding_corporate_rules',    // BCR documentation
  'adequacy_decision_document', // Official adequacy decision
  'supplementary_measures',     // Additional safeguards documentation
  'transfer_approval_letter',   // Internal approval
  'due_diligence_report',       // Recipient due diligence
  'cessation_plan'              // Transfer cessation plan
]);

// International Transfers main table
export const internationalTransfers = pgTable("international_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Transfer identification
  transferName: varchar("transfer_name").notNull(), // Business name for transfer
  transferDescription: text("transfer_description"),
  transferReference: varchar("transfer_reference"), // Internal reference number
  
  // Data classification
  transferType: transferTypeEnum("transfer_type").notNull(),
  dataCategories: text("data_categories").array().notNull(), // Array of data categories
  dataSubjectCategories: text("data_subject_categories").array().notNull(), // Types of data subjects
  specialCategories: boolean("special_categories").default(false), // Article 9 special categories
  
  // Transfer details
  originCountry: varchar("origin_country").notNull().default('GB'), // ISO country code
  destinationCountry: varchar("destination_country").notNull(), // ISO country code
  recipient: varchar("recipient").notNull(), // Name of recipient organisation
  recipientContact: text("recipient_contact"), // Contact details
  transferPurpose: text("transfer_purpose").notNull(), // Purpose of transfer
  
  // Legal basis and mechanism
  legalBasis: transferLegalBasisEnum("legal_basis").notNull(),
  transferMechanism: transferMechanismTypeEnum("transfer_mechanism").notNull(),
  mechanismReference: varchar("mechanism_reference"), // Reference to mechanism (SCC version, etc.)
  
  // Transfer characteristics
  transferFrequency: transferFrequencyEnum("transfer_frequency").notNull(),
  volumeDescription: text("volume_description"), // Description of data volume
  retentionPeriod: integer("retention_period"), // Days
  transferStart: timestamp("transfer_start"),
  transferEnd: timestamp("transfer_end"),
  
  // Risk and compliance
  riskLevel: transferRiskLevelEnum("risk_level").notNull(),
  riskAssessmentDate: timestamp("risk_assessment_date"),
  riskAssessmentBy: varchar("risk_assessment_by"), // User ID
  complianceNotes: text("compliance_notes"),
  
  // Impact assessment reference
  transferImpactAssessmentId: varchar("transfer_impact_assessment_id"), // FK to TIA
  
  // Status and lifecycle
  status: transferStatusEnum("status").notNull().default('pending_approval'),
  approvedBy: varchar("approved_by"), // User ID
  approvedAt: timestamp("approved_at"),
  reviewDue: timestamp("review_due"), // Next review date
  
  // Monitoring and alerts
  lastReviewDate: timestamp("last_review_date"),
  nextReviewDate: timestamp("next_review_date"),
  alertsEnabled: boolean("alerts_enabled").default(true),
  
  // Documentation
  documents: jsonb("documents").$type<{
    type: string;
    filename: string;
    uploadedAt: Date;
    uploadedBy: string;
  }[]>().default([]),
  
  // Safeguards and additional measures
  technicalSafeguards: text("technical_safeguards").array().default([]),
  organisationalSafeguards: text("organisational_safeguards").array().default([]),
  supplementaryMeasures: text("supplementary_measures"),
  
  // Metadata
  createdBy: varchar("created_by").notNull(), // User ID
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_international_transfers_organisation_id").on(table.organisationId),
  index("idx_international_transfers_destination_country").on(table.destinationCountry),
  index("idx_international_transfers_status").on(table.status),
  index("idx_international_transfers_risk_level").on(table.riskLevel),
  index("idx_international_transfers_review_due").on(table.reviewDue),
  index("idx_international_transfers_transfer_type").on(table.transferType),
  index("idx_international_transfers_legal_basis").on(table.legalBasis),
  index("idx_international_transfers_created_by").on(table.createdBy),
]);

// Transfer Impact Assessments (TIA) table
export const transferImpactAssessments = pgTable("transfer_impact_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // TIA identification
  tiaReference: varchar("tia_reference").notNull(), // TIA reference number
  title: varchar("title").notNull(),
  description: text("description"),
  
  // Assessment scope
  dataCategories: text("data_categories").array().notNull(),
  dataSubjectCategories: text("data_subject_categories").array().notNull(),
  transferPurpose: text("transfer_purpose").notNull(),
  
  // Transfer details
  originCountry: varchar("origin_country").notNull().default('GB'),
  destinationCountry: varchar("destination_country").notNull(),
  recipient: varchar("recipient").notNull(),
  proposedMechanism: transferMechanismTypeEnum("proposed_mechanism").notNull(),
  
  // Risk assessment
  countryRiskScore: integer("country_risk_score"), // 1-10 scale
  recipientRiskScore: integer("recipient_risk_score"), // 1-10 scale
  dataRiskScore: integer("data_risk_score"), // 1-10 scale
  overallRiskScore: integer("overall_risk_score"), // Calculated composite score
  riskLevel: transferRiskLevelEnum("risk_level").notNull(),
  
  // Risk factors
  identifiedRisks: jsonb("identified_risks").$type<{
    category: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    likelihood: 'unlikely' | 'possible' | 'likely' | 'certain';
  }[]>().default([]),
  
  // Safeguards assessment
  existingSafeguards: text("existing_safeguards").array().default([]),
  proposedSafeguards: text("proposed_safeguards").array().default([]),
  supplementaryMeasures: text("supplementary_measures"),
  safeguardsEffectiveness: varchar("safeguards_effectiveness"), // Assessment of effectiveness
  
  // Legal assessment
  lawfulBasisAssessment: text("lawful_basis_assessment"),
  recipientLegalFramework: text("recipient_legal_framework"),
  governmentAccessRisks: text("government_access_risks"),
  dataSubjectRights: text("data_subject_rights"), // Rights in destination country
  
  // Decision and approval
  recommendation: varchar("recommendation"), // 'approve', 'reject', 'conditional'
  conditionalRequirements: text("conditional_requirements"),
  decisionRationale: text("decision_rationale"),
  
  // Status and workflow
  status: tiaStatusEnum("status").notNull().default('draft'),
  submittedBy: varchar("submitted_by"), // User ID
  submittedAt: timestamp("submitted_at"),
  reviewedBy: varchar("reviewed_by"), // User ID
  reviewedAt: timestamp("reviewed_at"),
  approvedBy: varchar("approved_by"), // User ID
  approvedAt: timestamp("approved_at"),
  
  // Validity and review
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  reviewRequired: boolean("review_required").default(true),
  nextReviewDate: timestamp("next_review_date"),
  
  // Consultation and stakeholders
  stakeholdersConsulted: text("stakeholders_consulted").array().default([]),
  consultationNotes: text("consultation_notes"),
  
  // Documentation
  documents: jsonb("documents").$type<{
    type: string;
    filename: string;
    uploadedAt: Date;
    uploadedBy: string;
  }[]>().default([]),
  
  // Metadata
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_transfer_impact_assessments_organisation_id").on(table.organisationId),
  index("idx_transfer_impact_assessments_destination_country").on(table.destinationCountry),
  index("idx_transfer_impact_assessments_status").on(table.status),
  index("idx_transfer_impact_assessments_risk_level").on(table.riskLevel),
  index("idx_transfer_impact_assessments_tia_reference").on(table.tiaReference),
  index("idx_transfer_impact_assessments_submitted_by").on(table.submittedBy),
  index("idx_transfer_impact_assessments_next_review_date").on(table.nextReviewDate),
  unique("idx_transfer_impact_assessments_org_reference_unique")
    .on(table.organisationId, table.tiaReference),
]);

// Transfer Mechanisms table (SCCs, IDTA, BCRs, etc.)
export const transferMechanisms = pgTable("transfer_mechanisms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Mechanism identification
  mechanismType: transferMechanismTypeEnum("mechanism_type").notNull(),
  mechanismName: varchar("mechanism_name").notNull(),
  mechanismReference: varchar("mechanism_reference"), // Version, reference number
  
  // Mechanism details
  description: text("description"),
  applicableCountries: text("applicable_countries").array().default([]), // Countries where applicable
  dataCategories: text("data_categories").array().default([]), // Applicable data types
  
  // Legal framework
  legalFramework: text("legal_framework"), // Legal basis and framework
  regulatoryApproval: boolean("regulatory_approval").default(false),
  approvalAuthority: varchar("approval_authority"), // Which authority approved
  approvalDate: timestamp("approval_date"),
  approvalReference: varchar("approval_reference"),
  
  // Validity and lifecycle
  effectiveFrom: timestamp("effective_from"),
  effectiveUntil: timestamp("effective_until"),
  autoRenewal: boolean("auto_renewal").default(false),
  renewalTerms: text("renewal_terms"),
  
  // Implementation
  implementationGuidance: text("implementation_guidance"),
  mandatoryProvisions: text("mandatory_provisions").array().default([]),
  optionalProvisions: text("optional_provisions").array().default([]),
  
  // Monitoring and compliance
  complianceRequirements: text("compliance_requirements").array().default([]),
  monitoringFrequency: varchar("monitoring_frequency"), // 'annual', 'biannual', etc.
  lastAuditDate: timestamp("last_audit_date"),
  nextAuditDate: timestamp("next_audit_date"),
  
  // Usage tracking
  transfersUsingMechanism: integer("transfers_using_mechanism").default(0),
  lastUsedDate: timestamp("last_used_date"),
  
  // Documents and templates
  documentTemplates: jsonb("document_templates").$type<{
    type: string;
    filename: string;
    version: string;
    uploadedAt: Date;
  }[]>().default([]),
  
  // Status
  isActive: boolean("is_active").default(true),
  isDeprecated: boolean("is_deprecated").default(false),
  deprecationNotice: text("deprecation_notice"),
  replacedBy: varchar("replaced_by"), // ID of replacement mechanism
  
  // Metadata
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_transfer_mechanisms_organisation_id").on(table.organisationId),
  index("idx_transfer_mechanisms_mechanism_type").on(table.mechanismType),
  index("idx_transfer_mechanisms_is_active").on(table.isActive),
  index("idx_transfer_mechanisms_effective_until").on(table.effectiveUntil),
  index("idx_transfer_mechanisms_next_audit_date").on(table.nextAuditDate),
  unique("idx_transfer_mechanisms_org_name_unique")
    .on(table.organisationId, table.mechanismName),
]);

// Standard Contractual Clauses specific table
export const standardContractualClauses = pgTable("standard_contractual_clauses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  transferMechanismId: varchar("transfer_mechanism_id").notNull(), // FK to transfer_mechanisms
  
  // SCC identification
  sccType: varchar("scc_type").notNull(), // 'controller_to_controller', 'controller_to_processor', etc.
  sccVersion: varchar("scc_version").notNull(), // EU SCC version (2021, etc.)
  adoptionDecision: varchar("adoption_decision"), // EU Commission decision reference
  
  // Parties
  dataExporter: jsonb("data_exporter").$type<{
    name: string;
    address: string;
    contactEmail: string;
    contactPhone?: string;
    authorizedRepresentative?: string;
  }>(),
  dataImporter: jsonb("data_importer").$type<{
    name: string;
    address: string;
    country: string;
    contactEmail: string;
    contactPhone?: string;
  }>(),
  
  // Transfer specifications
  transferDetails: jsonb("transfer_details").$type<{
    dataCategories: string[];
    dataSubjectCategories: string[];
    purposes: string[];
    processingOperations: string[];
    retentionPeriod: string;
  }>(),
  
  // Module selection (for EU SCCs)
  moduleOne: boolean("module_one").default(false), // Controller to controller
  moduleTwo: boolean("module_two").default(false), // Controller to processor
  moduleThree: boolean("module_three").default(false), // Processor to processor
  moduleFour: boolean("module_four").default(false), // Processor to controller
  
  // Annexes
  annexOne: jsonb("annex_one").$type<{
    dataCategories: string;
    dataSubjects: string;
    purposes: string;
    personalDataLocations: string;
  }>(), // Transfer details
  annexTwo: text("annex_two"), // Technical and organisational measures
  annexThree: text("annex_three"), // List of sub-processors (if applicable)
  
  // Execution and validity
  executionDate: timestamp("execution_date"),
  executedBy: varchar("executed_by"), // User ID
  digitalSignature: boolean("digital_signature").default(false),
  signatureDetails: jsonb("signature_details").$type<{
    exporterSignature: { date: Date; signatory: string; method: string };
    importerSignature: { date: Date; signatory: string; method: string };
  }>(),
  
  // Compliance monitoring
  lastReviewDate: timestamp("last_review_date"),
  nextReviewDate: timestamp("next_review_date"),
  complianceIssues: text("compliance_issues").array().default([]),
  remedialActions: text("remedial_actions").array().default([]),
  
  // Document management
  originalDocument: varchar("original_document"), // File path/URL
  amendmentHistory: jsonb("amendment_history").$type<{
    date: Date;
    amendmentType: string;
    description: string;
    amendedBy: string;
  }[]>().default([]),
  
  // Status
  isActive: boolean("is_active").default(true),
  terminationDate: timestamp("termination_date"),
  terminationReason: text("termination_reason"),
  
  // Metadata
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_standard_contractual_clauses_organisation_id").on(table.organisationId),
  index("idx_standard_contractual_clauses_transfer_mechanism_id").on(table.transferMechanismId),
  index("idx_standard_contractual_clauses_scc_type").on(table.sccType),
  index("idx_standard_contractual_clauses_execution_date").on(table.executionDate),
  index("idx_standard_contractual_clauses_next_review_date").on(table.nextReviewDate),
  index("idx_standard_contractual_clauses_is_active").on(table.isActive),
]);

// Adequacy Decisions cache table (updated from EU Commission/ICO)
export const adequacyDecisions = pgTable("adequacy_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Country/territory identification
  countryCode: varchar("country_code").notNull(), // ISO country code
  countryName: varchar("country_name").notNull(),
  region: varchar("region"), // Geographic region
  
  // Decision details
  status: adequacyDecisionStatusEnum("status").notNull(),
  decisionType: varchar("decision_type"), // 'full', 'partial', 'sectoral'
  adoptionDate: timestamp("adoption_date"),
  effectiveDate: timestamp("effective_date"),
  expiryDate: timestamp("expiry_date"),
  
  // Legal framework
  decisionReference: varchar("decision_reference"), // EU Commission decision number
  legalInstrument: varchar("legal_instrument"), // Decision, regulation, etc.
  scope: text("scope"), // Scope of adequacy
  limitations: text("limitations").array().default([]), // Any limitations
  
  // Review and monitoring
  reviewDate: timestamp("review_date"),
  reviewFrequency: varchar("review_frequency"), // 'annual', 'biannual', etc.
  lastAssessmentDate: timestamp("last_assessment_date"),
  nextAssessmentDate: timestamp("next_assessment_date"),
  
  // Risk factors
  riskFactors: text("risk_factors").array().default([]),
  riskLevel: transferRiskLevelEnum("risk_level").notNull().default('medium'),
  governmentAccess: text("government_access"), // Government access provisions
  dataSubjectRights: text("data_subject_rights"), // Available rights
  
  // Changes and updates
  changeHistory: jsonb("change_history").$type<{
    date: Date;
    changeType: string;
    description: string;
    impact: string;
  }[]>().default([]),
  
  // Sources and references
  sourceUrl: varchar("source_url"), // Official source
  documentUrl: varchar("document_url"), // Decision document
  lastUpdated: timestamp("last_updated").defaultNow(),
  dataSource: varchar("data_source").default('manual'), // 'api', 'manual', 'scraper'
  
  // Usage tracking
  transfersUsingDecision: integer("transfers_using_decision").default(0),
  organisationsAffected: integer("organisations_affected").default(0),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_adequacy_decisions_country_code").on(table.countryCode),
  index("idx_adequacy_decisions_status").on(table.status),
  index("idx_adequacy_decisions_risk_level").on(table.riskLevel),
  index("idx_adequacy_decisions_expiry_date").on(table.expiryDate),
  index("idx_adequacy_decisions_review_date").on(table.reviewDate),
  unique("idx_adequacy_decisions_country_code_unique").on(table.countryCode),
]);

// ===== COMPLIANCE DOCUMENTS SYSTEM =====
// Auto-generated legal documents for GDPR regulatory compliance

// Document type enum for compliance documents
export const complianceDocumentTypeEnum = pgEnum('compliance_document_type', [
  'privacy_policy',              // Privacy Policy (GDPR Articles 13-14)
  'cookie_policy',               // Cookie Policy (PECR compliance)
  'data_protection_agreement',   // Data Protection Agreement (DPA)
  'terms_of_service',           // Terms of Service
  'children_privacy_notice',     // Children's Privacy Notice (under 13)
  'consent_notice',             // Consent Collection Notice
  'legitimate_interests_assessment', // LIA documentation
  'data_retention_policy',      // Data Retention Policy
  'breach_notification_template', // Data breach notification templates
  'user_rights_information',    // Data subject rights information
  'international_transfer_notice', // Transfer disclosures
  'processor_agreement'         // Processor Agreement template
]);

// Document status for lifecycle management
export const complianceDocumentStatusEnum = pgEnum('compliance_document_status', [
  'draft',           // Document being prepared
  'pending_review',  // Awaiting legal/admin review
  'approved',        // Approved for publication
  'published',       // Currently published/active
  'archived',        // Archived version
  'superseded',      // Replaced by newer version
  'withdrawn'        // Withdrawn from publication
]);

// Document generation mode
export const documentGenerationModeEnum = pgEnum('document_generation_mode', [
  'automatic',       // Fully automated generation
  'semi_automatic',  // Generated with manual review
  'manual',          // Manually created/edited
  'template_based'   // Based on predefined template
]);

// Main compliance documents table
export const complianceDocuments = pgTable("compliance_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Document identification
  documentType: complianceDocumentTypeEnum("document_type").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  documentReference: varchar("document_reference"), // Internal reference/version number
  
  // Content and generation
  content: text("content").notNull(), // Generated document content
  htmlContent: text("html_content"), // HTML formatted content
  plainTextContent: text("plain_text_content"), // Plain text version
  generationMode: documentGenerationModeEnum("generation_mode").notNull().default('automatic'),
  templateId: varchar("template_id"), // Reference to template used
  
  // Version control
  version: varchar("version").notNull().default('1.0'),
  versionNotes: text("version_notes"),
  isCurrentVersion: boolean("is_current_version").notNull().default(true),
  parentDocumentId: varchar("parent_document_id"), // Reference to previous version
  
  // Status and lifecycle
  status: complianceDocumentStatusEnum("status").notNull().default('draft'),
  approvedBy: varchar("approved_by"), // User ID who approved
  approvedAt: timestamp("approved_at"),
  publishedAt: timestamp("published_at"),
  expiresAt: timestamp("expires_at"), // Auto-expiry for regular review
  
  // Legal and compliance metadata
  legalBasis: processingLawfulBasisEnum("legal_basis"),
  regulatoryRequirements: text("regulatory_requirements").array().default([]), // e.g., ['GDPR Article 13', 'PECR Regulation 6']
  applicableLaws: text("applicable_laws").array().default([]), // e.g., ['UK GDPR', 'Data Protection Act 2018']
  lastReviewDate: timestamp("last_review_date"),
  nextReviewDate: timestamp("next_review_date"),
  reviewFrequency: integer("review_frequency").default(365), // days
  
  // Document metadata
  wordCount: integer("word_count"),
  readingTime: integer("reading_time"), // estimated minutes
  language: varchar("language").default('en'),
  publicUrl: varchar("public_url"), // Published URL for public access
  downloadUrl: varchar("download_url"), // PDF download URL
  
  // Generation context - what data was used to generate
  dataSnapshot: jsonb("data_snapshot").default('{}'), // Snapshot of organization data used
  privacySettingsUsed: jsonb("privacy_settings_used").default('{}'),
  processingActivitiesUsed: jsonb("processing_activities_used").default('[]'),
  lastAutoGenerated: timestamp("last_auto_generated"),
  requiresRegeneration: boolean("requires_regeneration").default(false),
  
  // User tracking
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  lastModifiedBy: varchar("last_modified_by"),
  
  // Metadata
  metadata: jsonb("metadata").default('{}'),
  tags: text("tags").array().default([]),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_compliance_documents_organisation_id").on(table.organisationId),
  index("idx_compliance_documents_document_type").on(table.documentType),
  index("idx_compliance_documents_status").on(table.status),
  index("idx_compliance_documents_is_current_version").on(table.isCurrentVersion),
  index("idx_compliance_documents_published_at").on(table.publishedAt),
  index("idx_compliance_documents_expires_at").on(table.expiresAt),
  index("idx_compliance_documents_next_review_date").on(table.nextReviewDate),
  index("idx_compliance_documents_requires_regeneration").on(table.requiresRegeneration),
  index("idx_compliance_documents_parent_document_id").on(table.parentDocumentId),
  // Unique constraint to ensure only one current version per document type per org
  unique("unique_current_compliance_document").on(table.organisationId, table.documentType, table.isCurrentVersion),
]);

// Document templates for generating compliance documents
export const complianceDocumentTemplates = pgTable("compliance_document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Template identification
  name: varchar("name").notNull(),
  description: text("description"),
  documentType: complianceDocumentTypeEnum("document_type").notNull(),
  templateKey: varchar("template_key").notNull().unique(), // e.g., 'privacy_policy_standard'
  
  // Template content
  content: text("content").notNull(), // Template with placeholders
  htmlContent: text("html_content"), // HTML template
  variables: jsonb("variables").default('[]'), // Array of template variables with descriptions
  requiredData: jsonb("required_data").default('[]'), // Required organization data for generation
  
  // Legal framework
  legalBasis: text("legal_basis").array().default([]),
  regulatoryCompliance: text("regulatory_compliance").array().default([]), // Which regulations this satisfies
  applicableJurisdictions: text("applicable_jurisdictions").array().default(['UK']),
  
  // Template metadata
  version: varchar("version").notNull().default('1.0'),
  isDefault: boolean("is_default").default(false), // Default template for this document type
  isActive: boolean("is_active").default(true),
  lastLegalReview: timestamp("last_legal_review"),
  nextLegalReview: timestamp("next_legal_review"),
  
  // Usage and effectiveness
  usageCount: integer("usage_count").default(0),
  rating: decimal("rating", { precision: 3, scale: 2 }), // Template effectiveness rating
  
  // Customization options
  allowCustomization: boolean("allow_customization").default(true),
  customizationGuidelines: text("customization_guidelines"),
  
  // Authoring
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  reviewedBy: varchar("reviewed_by"), // Legal reviewer
  
  metadata: jsonb("metadata").default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_compliance_document_templates_document_type").on(table.documentType),
  index("idx_compliance_document_templates_template_key").on(table.templateKey),
  index("idx_compliance_document_templates_is_default").on(table.isDefault),
  index("idx_compliance_document_templates_is_active").on(table.isActive),
  index("idx_compliance_document_templates_next_legal_review").on(table.nextLegalReview),
]);

// Document generation audit trail
export const complianceDocumentAudit = pgTable("compliance_document_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  documentId: varchar("document_id").notNull(),
  
  // Audit details
  action: varchar("action").notNull(), // 'generated', 'updated', 'approved', 'published', 'withdrawn'
  actionBy: varchar("action_by").notNull(), // User ID
  actionDetails: text("action_details"),
  
  // Changes tracking
  changesSummary: text("changes_summary"),
  previousVersion: varchar("previous_version"),
  newVersion: varchar("new_version"),
  contentChanges: jsonb("content_changes").default('{}'), // Detailed diff information
  
  // Legal compliance tracking
  complianceNotes: text("compliance_notes"),
  legalReviewRequired: boolean("legal_review_required").default(false),
  riskAssessment: varchar("risk_assessment"), // 'low', 'medium', 'high'
  
  // Context
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").default('{}'),
  
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_compliance_document_audit_organisation_id").on(table.organisationId),
  index("idx_compliance_document_audit_document_id").on(table.documentId),
  index("idx_compliance_document_audit_action").on(table.action),
  index("idx_compliance_document_audit_action_by").on(table.actionBy),
  index("idx_compliance_document_audit_timestamp").on(table.timestamp),
  index("idx_compliance_document_audit_legal_review_required").on(table.legalReviewRequired),
]);

// Document publication settings
export const complianceDocumentPublications = pgTable("compliance_document_publications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  documentId: varchar("document_id").notNull(),
  
  // Publication settings
  isPublic: boolean("is_public").default(true), // Publicly accessible
  publicUrl: varchar("public_url").unique(), // Clean URL for public access
  passwordProtected: boolean("password_protected").default(false),
  accessPassword: varchar("access_password"), // Hashed password for protected documents
  
  // SEO and discoverability
  metaTitle: varchar("meta_title"),
  metaDescription: text("meta_description"),
  keywords: text("keywords").array().default([]),
  canonicalUrl: varchar("canonical_url"),
  
  // Display settings
  showLastUpdated: boolean("show_last_updated").default(true),
  showVersion: boolean("show_version").default(true),
  showContactInfo: boolean("show_contact_info").default(true),
  customStyling: text("custom_styling"), // Custom CSS
  
  // Access control
  allowedDomains: text("allowed_domains").array().default([]), // Domain restrictions
  ipWhitelist: text("ip_whitelist").array().default([]), // IP restrictions
  requiresAuthentication: boolean("requires_authentication").default(false),
  
  // Analytics
  viewCount: integer("view_count").default(0),
  downloadCount: integer("download_count").default(0),
  lastAccessed: timestamp("last_accessed"),
  
  // Status
  isActive: boolean("is_active").default(true),
  publishedAt: timestamp("published_at"),
  unpublishedAt: timestamp("unpublished_at"),
  
  // Metadata
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  metadata: jsonb("metadata").default('{}'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_compliance_document_publications_organisation_id").on(table.organisationId),
  index("idx_compliance_document_publications_document_id").on(table.documentId),
  index("idx_compliance_document_publications_public_url").on(table.publicUrl),
  index("idx_compliance_document_publications_is_public").on(table.isPublic),
  index("idx_compliance_document_publications_is_active").on(table.isActive),
  index("idx_compliance_document_publications_published_at").on(table.publishedAt),
  // Unique constraint to ensure one publication per document
  unique("unique_compliance_document_publication").on(table.documentId),
]);

// ===== PECR MARKETING CONSENT SYSTEM =====
// PECR (Privacy and Electronic Communications Regulations) compliant marketing consent

// Marketing consent records table - tracks granular consent for marketing communications
export const marketingConsent = pgTable("marketing_consent", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  organisationId: varchar("organisation_id").notNull(),
  
  // Consent details
  consentType: marketingConsentTypeEnum("consent_type").notNull(), // email, sms, phone, post, push_notifications
  consentStatus: consentStatusEnum("consent_status").notNull(), // granted, denied, withdrawn, pending
  consentSource: consentSourceEnum("consent_source").notNull(), // registration_form, preference_center, etc.
  
  // PECR compliance fields
  doubleOptIn: boolean("double_opt_in").default(false), // Whether double opt-in was completed
  doubleOptInConfirmedAt: timestamp("double_opt_in_confirmed_at"), // When double opt-in was confirmed
  ipAddress: varchar("ip_address"), // IP address when consent was given
  userAgent: text("user_agent"), // User agent when consent was given
  
  // Evidence and audit trail
  consentEvidence: jsonb("consent_evidence").default('{}'), // Evidence of consent (form data, checkboxes, etc.)
  evidenceType: consentEvidenceTypeEnum("evidence_type").notNull(),
  withdrawalReason: text("withdrawal_reason"), // User-provided reason for withdrawal
  
  // Legal basis and processing
  lawfulBasis: processingLawfulBasisEnum("lawful_basis").default('consent'),
  processingPurpose: text("processing_purpose").notNull(), // Clear description of what consent is for
  
  // Timestamps
  consentGivenAt: timestamp("consent_given_at").notNull(),
  consentWithdrawnAt: timestamp("consent_withdrawn_at"),
  lastModifiedAt: timestamp("last_modified_at").defaultNow(),
  expiryDate: timestamp("expiry_date"), // When consent expires (if applicable)
  
  // Metadata
  metadata: jsonb("metadata").default('{}'), // Additional compliance data
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_marketing_consent_user_id").on(table.userId),
  index("idx_marketing_consent_organisation_id").on(table.organisationId),
  index("idx_marketing_consent_type_status").on(table.consentType, table.consentStatus),
  index("idx_marketing_consent_given_at").on(table.consentGivenAt),
  index("idx_marketing_consent_withdrawn_at").on(table.consentWithdrawnAt),
  index("idx_marketing_consent_expiry").on(table.expiryDate),
  // Unique constraint: one active consent per user/org/type combination
  unique("unique_marketing_consent_user_org_type").on(table.userId, table.organisationId, table.consentType),
]);

// Communication preferences table - detailed user preferences for different communication types
export const communicationPreferences = pgTable("communication_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  organisationId: varchar("organisation_id").notNull(),
  
  // Communication settings
  communicationType: communicationTypeEnum("communication_type").notNull(),
  channel: marketingConsentTypeEnum("channel").notNull(), // email, sms, phone, post, push_notifications
  isEnabled: boolean("is_enabled").default(false),
  frequency: communicationFrequencyEnum("frequency").default('as_needed'),
  
  // Timing preferences
  preferredTimeStart: varchar("preferred_time_start"), // e.g., "09:00"
  preferredTimeEnd: varchar("preferred_time_end"), // e.g., "17:00"
  preferredDays: text("preferred_days").array().default([]), // e.g., ["monday", "tuesday"]
  timezone: varchar("timezone").default('UTC'),
  
  // Content preferences
  contentPreferences: jsonb("content_preferences").default('{}'), // Topics, categories, etc.
  languagePreference: varchar("language_preference").default('en'),
  
  // Suppression and opt-out
  globalOptOut: boolean("global_opt_out").default(false), // Global suppression
  suppressUntil: timestamp("suppress_until"), // Temporary suppression
  
  // Audit and compliance
  lastUpdatedBy: varchar("last_updated_by"), // User or admin who made the change
  ipAddress: varchar("ip_address"), // IP when preference was set
  userAgent: text("user_agent"), // User agent when preference was set
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_communication_preferences_user_id").on(table.userId),
  index("idx_communication_preferences_organisation_id").on(table.organisationId),
  index("idx_communication_preferences_type_channel").on(table.communicationType, table.channel),
  index("idx_communication_preferences_global_opt_out").on(table.globalOptOut),
  index("idx_communication_preferences_suppress_until").on(table.suppressUntil),
  // Unique constraint: one preference record per user/org/type/channel combination
  unique("unique_communication_preference").on(table.userId, table.organisationId, table.communicationType, table.channel),
]);

// Marketing campaigns table - manage marketing campaigns with consent verification
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Campaign details
  name: varchar("name").notNull(),
  description: text("description"),
  campaignType: communicationTypeEnum("campaign_type").notNull(),
  status: marketingCampaignStatusEnum("status").default('draft'),
  
  // Targeting and consent
  targetChannels: text("target_channels").array().notNull(), // email, sms, etc.
  requiredConsentTypes: text("required_consent_types").array().notNull(), // What consent is required
  respectDoNotDisturb: boolean("respect_do_not_disturb").default(true),
  honorFrequencyLimits: boolean("honor_frequency_limits").default(true),
  
  // Scheduling
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  // Content and templates
  emailTemplateId: varchar("email_template_id"), // Reference to email template
  smsTemplate: text("sms_template"),
  content: jsonb("content").default('{}'), // Campaign content data
  
  // Targeting criteria
  targetAudience: jsonb("target_audience").default('{}'), // Audience selection criteria
  excludeSegments: jsonb("exclude_segments").default('{}'), // Segments to exclude
  
  // Results and tracking
  targetCount: integer("target_count").default(0), // Planned recipients
  sentCount: integer("sent_count").default(0), // Actually sent
  deliveredCount: integer("delivered_count").default(0),
  openedCount: integer("opened_count").default(0),
  clickedCount: integer("clicked_count").default(0),
  unsubscribedCount: integer("unsubscribed_count").default(0),
  bounceCount: integer("bounce_count").default(0),
  
  // Compliance and audit
  complianceChecked: boolean("compliance_checked").default(false),
  complianceCheckData: jsonb("compliance_check_data").default('{}'),
  approvedBy: varchar("approved_by"), // Admin who approved the campaign
  approvedAt: timestamp("approved_at"),
  
  // Management
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  metadata: jsonb("metadata").default('{}'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_marketing_campaigns_organisation_id").on(table.organisationId),
  index("idx_marketing_campaigns_status").on(table.status),
  index("idx_marketing_campaigns_campaign_type").on(table.campaignType),
  index("idx_marketing_campaigns_scheduled_at").on(table.scheduledAt),
  index("idx_marketing_campaigns_created_by").on(table.createdBy),
]);

// Consent history table - comprehensive audit trail for all consent changes
export const consentHistory = pgTable("consent_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  organisationId: varchar("organisation_id").notNull(),
  
  // Reference to consent record
  marketingConsentId: varchar("marketing_consent_id"), // Link to marketing consent record
  consentType: marketingConsentTypeEnum("consent_type").notNull(),
  
  // Change details
  action: varchar("action").notNull(), // granted, withdrawn, modified, expired
  previousStatus: consentStatusEnum("previous_status"),
  newStatus: consentStatusEnum("new_status").notNull(),
  
  // Source and context
  source: consentSourceEnum("source").notNull(),
  triggeredBy: varchar("triggered_by"), // User ID who made the change (if admin action)
  automatedAction: boolean("automated_action").default(false), // Was this automated?
  
  // Evidence and technical details
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  requestId: varchar("request_id"), // For tracing API requests
  
  // Legal and compliance
  evidenceType: consentEvidenceTypeEnum("evidence_type").notNull(),
  evidenceData: jsonb("evidence_data").default('{}'), // Detailed evidence
  processingLawfulBasis: processingLawfulBasisEnum("processing_lawful_basis").default('consent'),
  
  // Context and metadata
  changeReason: text("change_reason"), // User-provided or system reason
  relatedCampaignId: varchar("related_campaign_id"), // If related to a campaign
  notes: text("notes"), // Admin notes
  metadata: jsonb("metadata").default('{}'),
  
  // Timing
  effectiveDate: timestamp("effective_date").notNull(), // When change takes effect
  recordedAt: timestamp("recorded_at").defaultNow(), // When record was created
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_consent_history_user_id").on(table.userId),
  index("idx_consent_history_organisation_id").on(table.organisationId),
  index("idx_consent_history_marketing_consent_id").on(table.marketingConsentId),
  index("idx_consent_history_consent_type").on(table.consentType),
  index("idx_consent_history_action").on(table.action),
  index("idx_consent_history_effective_date").on(table.effectiveDate),
  index("idx_consent_history_recorded_at").on(table.recordedAt),
  index("idx_consent_history_triggered_by").on(table.triggeredBy),
]);

// Suppression list table - manage global suppression and do-not-contact lists
export const suppressionList = pgTable("suppression_list", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Contact details
  email: varchar("email"),
  phone: varchar("phone"),
  hashedEmail: varchar("hashed_email"), // SHA-256 hash for privacy
  hashedPhone: varchar("hashed_phone"), // SHA-256 hash for privacy
  
  // Suppression details
  suppressionType: varchar("suppression_type").notNull(), // global, marketing, service
  channels: text("channels").array().notNull(), // Which channels to suppress
  reason: varchar("reason").notNull(), // complaint, bounce, unsubscribe, legal
  
  // Source and evidence
  source: varchar("source").notNull(), // user_request, admin_action, automated_bounce, etc.
  evidenceData: jsonb("evidence_data").default('{}'),
  originalRequestId: varchar("original_request_id"), // Original consent/unsubscribe request
  
  // Scope and duration
  isGlobal: boolean("is_global").default(false), // Global across all organisations
  isPermanent: boolean("is_permanent").default(true),
  suppressUntil: timestamp("suppress_until"), // Temporary suppression end date
  
  // Metadata and audit
  addedBy: varchar("added_by"), // Admin who added the suppression
  addedReason: text("added_reason"), // Admin-provided reason
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  // Status
  isActive: boolean("is_active").default(true),
  lastCheckedAt: timestamp("last_checked_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_suppression_list_organisation_id").on(table.organisationId),
  index("idx_suppression_list_email").on(table.email),
  index("idx_suppression_list_phone").on(table.phone),
  index("idx_suppression_list_hashed_email").on(table.hashedEmail),
  index("idx_suppression_list_hashed_phone").on(table.hashedPhone),
  index("idx_suppression_list_suppression_type").on(table.suppressionType),
  index("idx_suppression_list_is_active").on(table.isActive),
  index("idx_suppression_list_suppress_until").on(table.suppressUntil),
  index("idx_suppression_list_is_global").on(table.isGlobal),
]);

// GDPR Dashboard Configuration enums
export const dashboardWidgetTypeEnum = pgEnum('dashboard_widget_type', [
  'compliance_overview',      // Overall compliance health metrics
  'consent_metrics',          // Consent management statistics
  'data_retention_status',    // Data retention compliance status
  'user_rights_queue',        // Pending user rights requests
  'breach_alerts',            // Recent breach activity
  'international_transfers',  // Transfer compliance monitoring
  'audit_activity',           // Recent audit log activity
  'compliance_alerts',        // Critical compliance notifications
  'export_reports',          // Recent compliance exports
  'processing_activities'     // Active processing activities overview
]);

export const dashboardComplianceStatusEnum = pgEnum('dashboard_compliance_status', [
  'compliant',               // All requirements met (green)
  'attention_required',      // Some issues need attention (amber)
  'non_compliant',          // Critical issues requiring immediate action (red)
  'unknown'                 // Status cannot be determined
]);

export const exportJobStatusEnum = pgEnum('export_job_status', [
  'pending',                // Job queued for processing
  'processing',             // Currently generating export
  'completed',              // Export successful
  'failed',                 // Export failed
  'cancelled'               // Export cancelled by user
]);

export const exportFormatEnum = pgEnum('export_format', [
  'pdf',                    // PDF compliance report
  'csv',                    // CSV data export
  'json',                   // JSON data export
  'xml',                    // XML structured export
  'xlsx'                    // Excel spreadsheet export
]);

export const reportTypeEnum = pgEnum('report_type', [
  'ico_compliance',         // ICO-ready compliance report
  'consent_analytics',      // Consent management analytics
  'user_rights_summary',    // User rights performance report
  'breach_incident_report', // Data breach incident report
  'retention_audit',        // Data retention audit report
  'transfer_compliance',    // International transfer compliance
  'full_gdpr_audit',       // Comprehensive GDPR audit report
  'custom_export'          // Custom data export
]);

// GDPR Dashboard Configuration table
export const gdprDashboardConfig = pgTable("gdpr_dashboard_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().unique(),
  
  // Dashboard layout and preferences
  enabledWidgets: text("enabled_widgets").array().notNull().default(sql`ARRAY[]::text[]`), // Array of widget types
  widgetLayout: jsonb("widget_layout").$type<{
    widgetId: string;
    type: string;
    position: number;
    size: 'small' | 'medium' | 'large';
    visible: boolean;
    config?: Record<string, any>;
  }[]>().notNull().default('[]'),
  
  // Notification preferences
  alertThresholds: jsonb("alert_thresholds").$type<{
    consentRateBelow?: number;          // Alert if consent rate below %
    userRightsOverdue?: number;         // Alert if requests overdue (days)
    breachResponseTime?: number;        // Alert if breach response exceeds (hours)
    retentionProcessingDelay?: number;  // Alert if retention processing delayed (days)
  }>().notNull().default('{}'),
  
  // Report preferences
  defaultExportFormat: exportFormatEnum("default_export_format").notNull().default('pdf'),
  autoReportFrequency: varchar("auto_report_frequency").default('monthly'), // 'daily', 'weekly', 'monthly', 'quarterly'
  recipientEmails: text("recipient_emails").array().notNull().default(sql`ARRAY[]::text[]`),
  
  // Display preferences
  displayTimeZone: varchar("display_time_zone").notNull().default('Europe/London'),
  defaultDateRange: integer("default_date_range").notNull().default(30), // days
  showHistoricalTrends: boolean("show_historical_trends").notNull().default(true),
  
  // Compliance settings
  complianceFramework: varchar("compliance_framework").notNull().default('UK_GDPR'), // UK_GDPR, EU_GDPR, etc.
  enableRiskScoring: boolean("enable_risk_scoring").notNull().default(true),
  riskToleranceLevel: varchar("risk_tolerance_level").notNull().default('medium'), // 'low', 'medium', 'high'
  
  // Metadata
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_gdpr_dashboard_config_organisation_id").on(table.organisationId),
  index("idx_gdpr_dashboard_config_auto_report_frequency").on(table.autoReportFrequency),
]);

// Compliance Reports table
export const complianceReports = pgTable("compliance_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Report identification
  reportName: varchar("report_name").notNull(),
  reportType: reportTypeEnum("report_type").notNull(),
  reportReference: varchar("report_reference"), // Unique reference for tracking
  
  // Report parameters
  dateRangeStart: timestamp("date_range_start").notNull(),
  dateRangeEnd: timestamp("date_range_end").notNull(),
  includeModules: text("include_modules").array().notNull().default(sql`ARRAY[]::text[]`), // Which GDPR modules to include
  filterCriteria: jsonb("filter_criteria").notNull().default('{}'),
  
  // Report metadata
  totalRecords: integer("total_records").default(0),
  complianceScore: decimal("compliance_score", { precision: 5, scale: 2 }), // Overall compliance score
  riskLevel: dashboardComplianceStatusEnum("risk_level").notNull().default('unknown'),
  criticalIssues: integer("critical_issues").default(0),
  
  // Report content summary
  executiveSummary: text("executive_summary"),
  keyFindings: jsonb("key_findings").notNull().default('[]'),
  recommendations: jsonb("recommendations").notNull().default('[]'),
  complianceMetrics: jsonb("compliance_metrics").notNull().default('{}'),
  
  // File information
  generatedFileId: varchar("generated_file_id"), // Reference to object storage
  fileName: varchar("file_name"),
  fileSize: integer("file_size"),
  filePath: varchar("file_path"),
  checksumHash: varchar("checksum_hash"), // For integrity verification
  
  // Generation details
  generatedBy: varchar("generated_by").notNull(),
  generatedAt: timestamp("generated_at").defaultNow(),
  generationTimeMs: integer("generation_time_ms"),
  
  // Access and retention
  accessedCount: integer("accessed_count").default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  retentionUntil: timestamp("retention_until"),
  
  // Status and metadata
  isArchived: boolean("is_archived").default(false),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_compliance_reports_organisation_id").on(table.organisationId),
  index("idx_compliance_reports_report_type").on(table.reportType),
  index("idx_compliance_reports_generated_by").on(table.generatedBy),
  index("idx_compliance_reports_generated_at").on(table.generatedAt),
  index("idx_compliance_reports_risk_level").on(table.riskLevel),
  index("idx_compliance_reports_retention_until").on(table.retentionUntil),
  index("idx_compliance_reports_date_range").on(table.dateRangeStart, table.dateRangeEnd),
]);

// Export Jobs table (for tracking long-running export operations)
export const exportJobs = pgTable("export_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Job identification
  jobName: varchar("job_name").notNull(),
  jobDescription: text("job_description"),
  jobType: reportTypeEnum("job_type").notNull(),
  
  // Export parameters
  exportFormat: exportFormatEnum("export_format").notNull(),
  dateRangeStart: timestamp("date_range_start").notNull(),
  dateRangeEnd: timestamp("date_range_end").notNull(),
  exportParameters: jsonb("export_parameters").notNull().default('{}'),
  
  // Job status and progress
  status: exportJobStatusEnum("status").notNull().default('pending'),
  progress: integer("progress").default(0), // 0-100 percentage
  totalSteps: integer("total_steps").default(1),
  currentStep: integer("current_step").default(0),
  statusMessage: text("status_message"),
  
  // Error handling
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  
  // Output information
  outputFileId: varchar("output_file_id"), // Reference to object storage
  outputFileName: varchar("output_file_name"),
  outputFileSize: integer("output_file_size"),
  outputFilePath: varchar("output_file_path"),
  
  // Timing information
  requestedBy: varchar("requested_by").notNull(),
  requestedAt: timestamp("requested_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  executionTimeMs: integer("execution_time_ms"),
  
  // Expiration and cleanup
  expiresAt: timestamp("expires_at"), // When export file expires
  downloadCount: integer("download_count").default(0),
  lastDownloadAt: timestamp("last_download_at"),
  
  // Metadata
  priority: integer("priority").default(5), // 1-10 priority level
  backgroundJob: boolean("background_job").default(true),
  metadata: jsonb("metadata").notNull().default('{}'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_export_jobs_organisation_id").on(table.organisationId),
  index("idx_export_jobs_status").on(table.status),
  index("idx_export_jobs_job_type").on(table.jobType),
  index("idx_export_jobs_requested_by").on(table.requestedBy),
  index("idx_export_jobs_requested_at").on(table.requestedAt),
  index("idx_export_jobs_expires_at").on(table.expiresAt),
  index("idx_export_jobs_priority").on(table.priority),
]);

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordHash: true, // Don't allow direct passwordHash input - use password instead
  createdAt: true,
  updatedAt: true,
}).extend({
  password: z.string().min(6).optional(), // Allow password for creation, will be hashed into passwordHash
});

// Schema for user creation with password
export const createUserWithPasswordSchema = insertUserSchema.extend({
  password: z.string().min(6), // Required password for new user creation
});

export const insertOrganisationSchema = createInsertSchema(organisations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssignmentSchema = createInsertSchema(assignments).omit({
  id: true,
  assignedAt: true,
});

export const insertCompletionSchema = createInsertSchema(completions).omit({
  id: true,
  completedAt: true,
});

export const insertCertificateSchema = createInsertSchema(certificates).omit({
  id: true,
  issuedAt: true,
});

export const insertCertificateTemplateSchema = createInsertSchema(certificateTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScormAttemptSchema = createInsertSchema(scormAttempts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganisationSettingsSchema = createInsertSchema(organisationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlatformSettingsSchema = createInsertSchema(platformSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertTodoItemSchema = createInsertSchema(todoItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Plan insert schemas
export const insertPlanSchema = createInsertSchema(plans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlanFeatureSchema = createInsertSchema(planFeatures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlanFeatureMappingSchema = createInsertSchema(planFeatureMappings).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

// REMOVED: Email template insert schemas (replaced with hardcoded automated email templates)
// export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
//   id: true,
//   version: true, // Auto-managed
//   createdAt: true,
//   updatedAt: true,
// });

// export const insertOrgEmailTemplateSchema = createInsertSchema(orgEmailTemplates).omit({
//   id: true,
//   version: true, // Auto-managed
//   createdAt: true,
//   updatedAt: true,
// });

export const insertSystemEmailSettingsSchema = createInsertSchema(systemEmailSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  timestamp: true,
});

// Email orchestrator insert schemas
export const insertEmailSendSchema = createInsertSchema(emailSends).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailSettingsLockSchema = createInsertSchema(emailSettingsLock).omit({
  id: true,
  createdAt: true,
});

export const insertBillingLockSchema = createInsertSchema(billingLocks).omit({
  id: true,
  acquiredAt: true,
  createdAt: true,
});

// Email template system insert schemas
// DEPRECATED - OLD EMAIL TEMPLATE INSERT SCHEMAS (TO BE REMOVED)
// export const insertEmailTemplateDefaultsSchema = createInsertSchema(emailTemplateDefaults).omit({
//   id: true,
//   updatedAt: true,
// });

// export const insertEmailTemplateOverridesSchema = createInsertSchema(emailTemplateOverrides).omit({
//   id: true,
//   updatedAt: true,
// });

export const insertOrgNotificationSettingsSchema = createInsertSchema(orgNotificationSettings).omit({
  updatedAt: true,
});

export const insertEmailProviderConfigsSchema = createInsertSchema(emailProviderConfigs).omit({
  id: true,
  updatedAt: true,
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupportTicketResponseSchema = createInsertSchema(supportTicketResponses).omit({
  id: true,
  createdAt: true,
});

// Course folder insert schemas
export const insertCourseFolderSchema = createInsertSchema(courseFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganisationCourseFolderSchema = createInsertSchema(organisationCourseFolders).omit({
  id: true,
  createdAt: true,
});

export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({
  id: true,
  processedAt: true,
  createdAt: true,
});

// Compliance Documents insert schemas
export const insertComplianceDocumentSchema = createInsertSchema(complianceDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceDocumentTemplateSchema = createInsertSchema(complianceDocumentTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceDocumentAuditSchema = createInsertSchema(complianceDocumentAudit).omit({
  id: true,
  timestamp: true,
});

export const insertComplianceDocumentPublicationSchema = createInsertSchema(complianceDocumentPublications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// GDPR insert schemas (UK GDPR and Data Protection Act 2018 compliance)
export const insertConsentRecordSchema = createInsertSchema(consentRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPrivacySettingsSchema = createInsertSchema(privacySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Ensure proper validation for complex objects that align with UI shapes
  cookieSettings: z.object({
    strictlyNecessary: z.boolean().optional(),
    functional: z.boolean().optional(),
    analytics: z.boolean().optional(),
    advertising: z.boolean().optional(),
  }).optional(),
  privacyContacts: z.object({
    dpoEmail: z.string().email().optional(),
    privacyEmail: z.string().email().optional(),
    complaintsProcedure: z.string().optional(),
  }).optional(),
  internationalTransfers: z.object({
    enabled: z.boolean().optional(),
    countries: z.array(z.string()).optional(),
    safeguards: z.string().optional(),
  }).optional(),
  settings: z.record(z.any()).optional(),
});

export const insertUserRightRequestSchema = createInsertSchema(userRightRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProcessingActivitySchema = createInsertSchema(processingActivities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataBreachSchema = createInsertSchema(dataBreaches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRetentionRuleSchema = createInsertSchema(retentionRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRetentionScheduleSchema = createInsertSchema(retentionSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGdprAuditLogSchema = createInsertSchema(gdprAuditLogs).omit({
  id: true,
});

// Chain head schema for database-backed audit chain tracking
export const insertGdprAuditChainHeadSchema = createInsertSchema(gdprAuditChainHeads);

// Comprehensive audit log insert schemas
export const insertDataProcessingAuditLogSchema = createInsertSchema(dataProcessingAuditLogs).omit({
  id: true,
});

export const insertUserRightsAuditLogSchema = createInsertSchema(userRightsAuditLogs).omit({
  id: true,
});

export const insertConsentAuditLogSchema = createInsertSchema(consentAuditLogs).omit({
  id: true,
});

export const insertSystemAccessAuditLogSchema = createInsertSchema(systemAccessAuditLogs).omit({
  id: true,
});

export const insertAgeVerificationSchema = createInsertSchema(ageVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// UK GDPR Article 8 - Parental Consent insert schemas
export const insertParentalConsentRecordSchema = createInsertSchema(parentalConsentRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyAccountSchema = createInsertSchema(familyAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChildAccountLinkSchema = createInsertSchema(childAccountLinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChildProtectionSettingsSchema = createInsertSchema(childProtectionSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCookieInventorySchema = createInsertSchema(cookieInventory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Enhanced Data Retention insert schemas
export const insertDataRetentionPolicySchema = createInsertSchema(dataRetentionPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataLifecycleRecordSchema = createInsertSchema(dataLifecycleRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRetentionComplianceAuditSchema = createInsertSchema(retentionComplianceAudits).omit({
  id: true,
  createdAt: true,
});

export const insertSecureDeletionCertificateSchema = createInsertSchema(secureDeletionCertificates).omit({
  id: true,
  createdAt: true,
});

// International Transfers insert schemas (GDPR Chapter V)
export const insertInternationalTransferSchema = createInsertSchema(internationalTransfers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransferImpactAssessmentSchema = createInsertSchema(transferImpactAssessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransferMechanismSchema = createInsertSchema(transferMechanisms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStandardContractualClausesSchema = createInsertSchema(standardContractualClauses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdequacyDecisionSchema = createInsertSchema(adequacyDecisions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// PECR Marketing Consent insert schemas
export const insertMarketingConsentSchema = createInsertSchema(marketingConsent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommunicationPreferencesSchema = createInsertSchema(communicationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarketingCampaignsSchema = createInsertSchema(marketingCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsentHistorySchema = createInsertSchema(consentHistory).omit({
  id: true,
  createdAt: true,
});

export const insertSuppressionListSchema = createInsertSchema(suppressionList).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// GDPR Dashboard insert schemas
export const insertGdprDashboardConfigSchema = createInsertSchema(gdprDashboardConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceReportsSchema = createInsertSchema(complianceReports).omit({
  id: true,
  generatedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExportJobsSchema = createInsertSchema(exportJobs).omit({
  id: true,
  requestedAt: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type InsertOrganisation = z.infer<typeof insertOrganisationSchema>;
export type Organisation = typeof organisations.$inferSelect;

export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof courses.$inferSelect;

export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Assignment = typeof assignments.$inferSelect;

export type InsertCompletion = z.infer<typeof insertCompletionSchema>;
export type Completion = typeof completions.$inferSelect;

export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificates.$inferSelect;

export type InsertCertificateTemplate = z.infer<typeof insertCertificateTemplateSchema>;
export type CertificateTemplate = typeof certificateTemplates.$inferSelect;

export type InsertScormAttempt = z.infer<typeof insertScormAttemptSchema>;
export type ScormAttempt = typeof scormAttempts.$inferSelect;

export type InsertOrganisationSettings = z.infer<typeof insertOrganisationSettingsSchema>;
export type OrganisationSettings = typeof organisationSettings.$inferSelect;

export type InsertPlatformSettings = z.infer<typeof insertPlatformSettingsSchema>;
export type PlatformSettings = typeof platformSettings.$inferSelect;

export type InsertTodoItem = z.infer<typeof insertTodoItemSchema>;
export type TodoItem = typeof todoItems.$inferSelect;

// Plan types
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plans.$inferSelect;

export type InsertPlanFeature = z.infer<typeof insertPlanFeatureSchema>;
export type PlanFeature = typeof planFeatures.$inferSelect;

export type InsertPlanFeatureMapping = z.infer<typeof insertPlanFeatureMappingSchema>;
export type PlanFeatureMapping = typeof planFeatureMappings.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// REMOVED: Email template types (replaced with hardcoded automated email templates)
// export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
// export type EmailTemplate = typeof emailTemplates.$inferSelect;

// export type InsertOrgEmailTemplate = z.infer<typeof insertOrgEmailTemplateSchema>;
// export type OrgEmailTemplate = typeof orgEmailTemplates.$inferSelect;

// DEPRECATED - OLD EMAIL TEMPLATE TYPES (TO BE REMOVED)
// export type InsertEmailTemplateDefaults = z.infer<typeof insertEmailTemplateDefaultsSchema>;
// export type EmailTemplateDefaults = typeof emailTemplateDefaults.$inferSelect;
// export type InsertEmailTemplateOverrides = z.infer<typeof insertEmailTemplateOverridesSchema>;
// export type EmailTemplateOverrides = typeof emailTemplateOverrides.$inferSelect;

export type InsertOrgNotificationSettings = z.infer<typeof insertOrgNotificationSettingsSchema>;
export type OrgNotificationSettings = typeof orgNotificationSettings.$inferSelect;

export type InsertEmailProviderConfigs = z.infer<typeof insertEmailProviderConfigsSchema>;
export type EmailProviderConfigs = typeof emailProviderConfigs.$inferSelect;

// Course folder types
export type InsertCourseFolder = z.infer<typeof insertCourseFolderSchema>;
export type CourseFolder = typeof courseFolders.$inferSelect;

export type InsertOrganisationCourseFolder = z.infer<typeof insertOrganisationCourseFolderSchema>;
export type OrganisationCourseFolder = typeof organisationCourseFolders.$inferSelect;

// Email system types
export type InsertSystemEmailSettings = z.infer<typeof insertSystemEmailSettingsSchema>;
export type SystemEmailSettings = typeof systemEmailSettings.$inferSelect;

export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;

// Email orchestrator types  
export type InsertEmailSend = z.infer<typeof insertEmailSendSchema>;
export type EmailSend = typeof emailSends.$inferSelect;

export type InsertEmailSettingsLock = z.infer<typeof insertEmailSettingsLockSchema>;
export type EmailSettingsLock = typeof emailSettingsLock.$inferSelect;

// Billing lock types
export type InsertBillingLock = z.infer<typeof insertBillingLockSchema>;
export type BillingLock = typeof billingLocks.$inferSelect;

// Support ticket types
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;

export type InsertSupportTicketResponse = z.infer<typeof insertSupportTicketResponseSchema>;
export type SupportTicketResponse = typeof supportTicketResponses.$inferSelect;

// Webhook event types
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;
export type WebhookEvent = typeof webhookEvents.$inferSelect;

// GDPR types (UK GDPR and Data Protection Act 2018 compliance)
export type InsertConsentRecord = z.infer<typeof insertConsentRecordSchema>;
export type ConsentRecord = typeof consentRecords.$inferSelect;

export type InsertPrivacySettings = z.infer<typeof insertPrivacySettingsSchema>;
export type PrivacySettings = typeof privacySettings.$inferSelect;

export type InsertUserRightRequest = z.infer<typeof insertUserRightRequestSchema>;
export type UserRightRequest = typeof userRightRequests.$inferSelect;

export type InsertProcessingActivity = z.infer<typeof insertProcessingActivitySchema>;
export type ProcessingActivity = typeof processingActivities.$inferSelect;

export type InsertDataBreach = z.infer<typeof insertDataBreachSchema>;
export type DataBreach = typeof dataBreaches.$inferSelect;

export type InsertRetentionRule = z.infer<typeof insertRetentionRuleSchema>;
export type RetentionRule = typeof retentionRules.$inferSelect;

export type InsertRetentionSchedule = z.infer<typeof insertRetentionScheduleSchema>;
export type RetentionSchedule = typeof retentionSchedules.$inferSelect;

export type InsertGdprAuditLog = z.infer<typeof insertGdprAuditLogSchema>;
export type GdprAuditLog = typeof gdprAuditLogs.$inferSelect;

// Chain head types for database-backed audit chain tracking
export type InsertGdprAuditChainHead = z.infer<typeof insertGdprAuditChainHeadSchema>;
export type GdprAuditChainHead = typeof gdprAuditChainHeads.$inferSelect;

// Comprehensive audit log types
export type InsertDataProcessingAuditLog = z.infer<typeof insertDataProcessingAuditLogSchema>;
export type DataProcessingAuditLog = typeof dataProcessingAuditLogs.$inferSelect;

export type InsertUserRightsAuditLog = z.infer<typeof insertUserRightsAuditLogSchema>;
export type UserRightsAuditLog = typeof userRightsAuditLogs.$inferSelect;

export type InsertConsentAuditLog = z.infer<typeof insertConsentAuditLogSchema>;
export type ConsentAuditLog = typeof consentAuditLogs.$inferSelect;

export type InsertSystemAccessAuditLog = z.infer<typeof insertSystemAccessAuditLogSchema>;
export type SystemAccessAuditLog = typeof systemAccessAuditLogs.$inferSelect;

export type InsertAgeVerification = z.infer<typeof insertAgeVerificationSchema>;
export type AgeVerification = typeof ageVerifications.$inferSelect;

// UK GDPR Article 8 - Parental Consent types
export type InsertParentalConsentRecord = z.infer<typeof insertParentalConsentRecordSchema>;
export type ParentalConsentRecord = typeof parentalConsentRecords.$inferSelect;

export type InsertFamilyAccount = z.infer<typeof insertFamilyAccountSchema>;
export type FamilyAccount = typeof familyAccounts.$inferSelect;

export type InsertChildAccountLink = z.infer<typeof insertChildAccountLinkSchema>;
export type ChildAccountLink = typeof childAccountLinks.$inferSelect;

export type InsertChildProtectionSettings = z.infer<typeof insertChildProtectionSettingsSchema>;
export type ChildProtectionSettings = typeof childProtectionSettings.$inferSelect;

export type InsertCookieInventory = z.infer<typeof insertCookieInventorySchema>;
export type CookieInventory = typeof cookieInventory.$inferSelect;

// Enhanced Data Retention types
export type InsertDataRetentionPolicy = z.infer<typeof insertDataRetentionPolicySchema>;
export type DataRetentionPolicy = typeof dataRetentionPolicies.$inferSelect;

export type InsertDataLifecycleRecord = z.infer<typeof insertDataLifecycleRecordSchema>;
export type DataLifecycleRecord = typeof dataLifecycleRecords.$inferSelect;

export type InsertRetentionComplianceAudit = z.infer<typeof insertRetentionComplianceAuditSchema>;
export type RetentionComplianceAudit = typeof retentionComplianceAudits.$inferSelect;

export type InsertSecureDeletionCertificate = z.infer<typeof insertSecureDeletionCertificateSchema>;
export type SecureDeletionCertificate = typeof secureDeletionCertificates.$inferSelect;

// International Transfers types (GDPR Chapter V)
export type InsertInternationalTransfer = z.infer<typeof insertInternationalTransferSchema>;
export type InternationalTransfer = typeof internationalTransfers.$inferSelect;

export type InsertTransferImpactAssessment = z.infer<typeof insertTransferImpactAssessmentSchema>;
export type TransferImpactAssessment = typeof transferImpactAssessments.$inferSelect;

export type InsertTransferMechanism = z.infer<typeof insertTransferMechanismSchema>;
export type TransferMechanism = typeof transferMechanisms.$inferSelect;

export type InsertStandardContractualClauses = z.infer<typeof insertStandardContractualClausesSchema>;
export type StandardContractualClauses = typeof standardContractualClauses.$inferSelect;

export type InsertAdequacyDecision = z.infer<typeof insertAdequacyDecisionSchema>;
export type AdequacyDecision = typeof adequacyDecisions.$inferSelect;

// Compliance Documents types
export type InsertComplianceDocument = z.infer<typeof insertComplianceDocumentSchema>;
export type ComplianceDocument = typeof complianceDocuments.$inferSelect;

export type InsertComplianceDocumentTemplate = z.infer<typeof insertComplianceDocumentTemplateSchema>;
export type ComplianceDocumentTemplate = typeof complianceDocumentTemplates.$inferSelect;

export type InsertComplianceDocumentAudit = z.infer<typeof insertComplianceDocumentAuditSchema>;
export type ComplianceDocumentAudit = typeof complianceDocumentAudit.$inferSelect;

export type InsertComplianceDocumentPublication = z.infer<typeof insertComplianceDocumentPublicationSchema>;
export type ComplianceDocumentPublication = typeof complianceDocumentPublications.$inferSelect;

// PECR Marketing Consent types
export type InsertMarketingConsent = z.infer<typeof insertMarketingConsentSchema>;
export type MarketingConsent = typeof marketingConsent.$inferSelect;

export type InsertCommunicationPreferences = z.infer<typeof insertCommunicationPreferencesSchema>;
export type CommunicationPreferences = typeof communicationPreferences.$inferSelect;

export type InsertMarketingCampaigns = z.infer<typeof insertMarketingCampaignsSchema>;
export type MarketingCampaigns = typeof marketingCampaigns.$inferSelect;

export type InsertConsentHistory = z.infer<typeof insertConsentHistorySchema>;
export type ConsentHistory = typeof consentHistory.$inferSelect;

export type InsertSuppressionList = z.infer<typeof insertSuppressionListSchema>;
export type SuppressionList = typeof suppressionList.$inferSelect;

// GDPR Dashboard types
export type InsertGdprDashboardConfig = z.infer<typeof insertGdprDashboardConfigSchema>;
export type GdprDashboardConfig = typeof gdprDashboardConfig.$inferSelect;

export type InsertComplianceReports = z.infer<typeof insertComplianceReportsSchema>;
export type ComplianceReports = typeof complianceReports.$inferSelect;

export type InsertExportJobs = z.infer<typeof insertExportJobsSchema>;
export type ExportJobs = typeof exportJobs.$inferSelect;

// ===== INTEGRATION GDPR COMPLIANCE ENUMS AND TABLES =====

// Third-party integration types enum
export const integrationTypeEnum = pgEnum('integration_type', [
  'stripe_payments',           // Stripe payment processing
  'sendgrid_email',           // SendGrid email service
  'brevo_email',              // Brevo email service
  'smtp_email',               // Generic SMTP email
  'mailgun_email',            // Mailgun email service
  'postmark_email',           // Postmark email service
  'mailjet_email',            // Mailjet email service
  'sparkpost_email',          // SparkPost email service
  'google_analytics',         // Google Analytics tracking
  'google_tag_manager',       // Google Tag Manager
  'facebook_pixel',           // Facebook Pixel tracking
  'hotjar_analytics',         // Hotjar user behavior analytics
  'mixpanel_analytics',       // Mixpanel event tracking
  'segment_analytics',        // Segment data platform
  'intercom_support',         // Intercom customer support
  'zendesk_support',          // Zendesk customer support
  'hubspot_crm',             // HubSpot CRM integration
  'salesforce_crm',          // Salesforce CRM integration
  'slack_notifications',      // Slack notification integration
  'microsoft_teams',          // Microsoft Teams integration
  'zoom_meetings',            // Zoom meeting integration
  'calendly_scheduling',      // Calendly scheduling
  'typeform_surveys',         // Typeform survey integration
  'surveymonkey_surveys',     // SurveyMonkey integration
  'mailchimp_marketing',      // MailChimp marketing
  'constant_contact_marketing', // Constant Contact marketing
  'twilio_sms',              // Twilio SMS service
  'aws_s3_storage',          // AWS S3 object storage
  'google_cloud_storage',     // Google Cloud Storage
  'azure_storage',           // Azure Blob Storage
  'cloudflare_cdn',          // Cloudflare CDN and security
  'custom_webhook',          // Custom webhook integrations
  'custom_api'               // Custom API integrations
]);

// Integration data processing purposes
export const integrationProcessingPurposeEnum = pgEnum('integration_processing_purpose', [
  'payment_processing',       // Process payments and transactions
  'marketing_communication',  // Send marketing emails and messages
  'transactional_communication', // Send transactional emails (receipts, confirmations)
  'customer_support',        // Provide customer support services
  'analytics_tracking',      // Track user behavior and analytics
  'performance_monitoring',  // Monitor application performance
  'security_protection',     // Protect against fraud and security threats
  'legal_compliance',        // Meet legal and regulatory requirements
  'service_improvement',     // Improve services and user experience
  'personalization',         // Personalize user experience
  'lead_generation',         // Generate and manage leads
  'survey_research',         // Conduct surveys and research
  'event_tracking',          // Track events and user actions
  'content_delivery',        // Deliver content via CDN
  'data_backup',            // Backup and archive data
  'system_integration',      // Integrate with external systems
  'notification_delivery',   // Deliver push notifications and alerts
  'scheduling_coordination', // Coordinate meetings and schedules
  'document_management',     // Manage and store documents
  'collaboration'            // Enable team collaboration features
]);

// Integration consent requirements
export const integrationConsentRequirementEnum = pgEnum('integration_consent_requirement', [
  'none',                    // No explicit consent required (legitimate interest)
  'opt_out',                // Opt-out consent (user can decline)
  'opt_in',                 // Opt-in consent (user must explicitly agree)
  'explicit',               // Explicit consent required (special categories)
  'parental',               // Parental consent required (children)
  'conditional'             // Conditional consent based on context
]);

// Integration data transfer risk levels
export const integrationTransferRiskEnum = pgEnum('integration_transfer_risk', [
  'none',                   // No international transfer
  'low',                    // Transfer to adequate country
  'medium',                 // Transfer with appropriate safeguards
  'high',                   // Transfer to high-risk country
  'prohibited'              // Transfer prohibited by policy
]);

// Integration compliance status
export const integrationComplianceStatusEnum = pgEnum('integration_compliance_status', [
  'compliant',              // Fully GDPR compliant
  'needs_review',           // Requires compliance review
  'non_compliant',          // Not GDPR compliant
  'disabled',               // Disabled for compliance reasons
  'pending_assessment'      // Awaiting compliance assessment
]);

// Integration data retention periods (in days)
export const integrationRetentionPeriodEnum = pgEnum('integration_retention_period', [
  'session_only',           // Data deleted at session end
  '7_days',                // 7 days retention
  '30_days',               // 30 days retention  
  '90_days',               // 90 days retention
  '1_year',                // 1 year retention
  '2_years',               // 2 years retention
  '7_years',               // 7 years retention (financial records)
  'indefinite',            // Indefinite retention
  'custom'                 // Custom retention period
]);

// Integration GDPR settings table - stores GDPR configuration for each integration per organization
export const integrationGdprSettings = pgTable("integration_gdpr_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Integration identification
  integrationType: integrationTypeEnum("integration_type").notNull(),
  integrationName: varchar("integration_name").notNull(), // Human-readable name
  integrationDescription: text("integration_description"),
  
  // GDPR compliance configuration
  isEnabled: boolean("is_enabled").default(true),
  complianceStatus: integrationComplianceStatusEnum("compliance_status").notNull().default('pending_assessment'),
  lastAssessmentDate: timestamp("last_assessment_date"),
  nextReviewDate: timestamp("next_review_date"),
  assessedBy: varchar("assessed_by"), // User ID who performed assessment
  
  // Data processing details
  processingPurposes: integrationProcessingPurposeEnum("processing_purposes").array().notNull(),
  lawfulBasis: processingLawfulBasisEnum("lawful_basis").notNull(),
  dataCategories: dataCategoryEnum("data_categories").array().notNull(),
  
  // Consent requirements
  consentRequired: integrationConsentRequirementEnum("consent_required").notNull().default('none'),
  consentText: text("consent_text"), // Consent notice text
  consentVersion: varchar("consent_version").default('1.0'),
  
  // Data retention and lifecycle
  retentionPeriod: integrationRetentionPeriodEnum("retention_period").notNull().default('1_year'),
  customRetentionDays: integer("custom_retention_days"), // For custom retention
  autoDeleteEnabled: boolean("auto_delete_enabled").default(true),
  
  // International transfers
  transfersPersonalData: boolean("transfers_personal_data").default(false),
  transferDestinations: text("transfer_destinations").array().default([]), // Country codes
  transferRisk: integrationTransferRiskEnum("transfer_risk").notNull().default('none'),
  transferSafeguards: text("transfer_safeguards").array().default([]),
  transferMechanismId: varchar("transfer_mechanism_id"), // FK to transfer mechanisms
  
  // Privacy controls
  dataMinimizationEnabled: boolean("data_minimization_enabled").default(true),
  pseudonymizationEnabled: boolean("pseudonymization_enabled").default(false),
  encryptionRequired: boolean("encryption_required").default(true),
  
  // User rights support
  supportsDataAccess: boolean("supports_data_access").default(false),
  supportsDataRectification: boolean("supports_data_rectification").default(false),
  supportsDataErasure: boolean("supports_data_erasure").default(false),
  supportsDataPortability: boolean("supports_data_portability").default(false),
  supportsProcessingRestriction: boolean("supports_processing_restriction").default(false),
  
  // Breach notification requirements
  breachNotificationRequired: boolean("breach_notification_required").default(true),
  breachNotificationThreshold: varchar("breach_notification_threshold").default('any_breach'),
  breachContactInfo: jsonb("breach_contact_info").default('{}'),
  
  // Configuration and settings
  integrationConfig: jsonb("integration_config").notNull().default('{}'), // Integration-specific config
  privacySettings: jsonb("privacy_settings").notNull().default('{}'), // Privacy-specific settings
  complianceNotes: text("compliance_notes"),
  
  // Metadata
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_integration_gdpr_settings_organisation_id").on(table.organisationId),
  index("idx_integration_gdpr_settings_integration_type").on(table.integrationType),
  index("idx_integration_gdpr_settings_compliance_status").on(table.complianceStatus),
  index("idx_integration_gdpr_settings_enabled").on(table.isEnabled),
  index("idx_integration_gdpr_settings_next_review_date").on(table.nextReviewDate),
  index("idx_integration_gdpr_settings_transfers_data").on(table.transfersPersonalData),
  unique("idx_integration_gdpr_settings_org_type_unique")
    .on(table.organisationId, table.integrationType),
]);

// Integration user consent tracking - tracks user consent for specific integrations
export const integrationUserConsent = pgTable("integration_user_consent", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  userId: varchar("user_id").notNull(),
  
  // Integration reference
  integrationSettingsId: varchar("integration_settings_id").notNull(), // FK to integration_gdpr_settings
  integrationType: integrationTypeEnum("integration_type").notNull(),
  
  // Consent details
  consentStatus: consentStatusEnum("consent_status").notNull(),
  consentGiven: boolean("consent_given").notNull().default(false),
  consentVersion: varchar("consent_version").notNull().default('1.0'),
  consentText: text("consent_text"), // The consent text shown to user
  
  // Consent context
  consentSource: varchar("consent_source").notNull(), // 'signup', 'settings', 'checkout', 'api'
  consentChannel: varchar("consent_channel").notNull(), // 'web', 'mobile', 'api', 'admin'
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  geoLocation: varchar("geo_location"), // Country code
  
  // Consent lifecycle
  consentGrantedAt: timestamp("consent_granted_at"),
  consentExpiresAt: timestamp("consent_expires_at"),
  consentWithdrawnAt: timestamp("consent_withdrawn_at"),
  withdrawalReason: text("withdrawal_reason"),
  
  // Privacy preferences  
  processingRestricted: boolean("processing_restricted").default(false),
  marketingOptOut: boolean("marketing_opt_out").default(false),
  analyticsOptOut: boolean("analytics_opt_out").default(false),
  
  // Audit trail
  previousConsentId: varchar("previous_consent_id"), // Link to previous consent record
  consentHistory: jsonb("consent_history").default('[]'), // Array of consent change events
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_integration_user_consent_organisation_id").on(table.organisationId),
  index("idx_integration_user_consent_user_id").on(table.userId),
  index("idx_integration_user_consent_integration_settings_id").on(table.integrationSettingsId),
  index("idx_integration_user_consent_integration_type").on(table.integrationType),
  index("idx_integration_user_consent_status").on(table.consentStatus),
  index("idx_integration_user_consent_given").on(table.consentGiven),
  index("idx_integration_user_consent_expires_at").on(table.consentExpiresAt),
  index("idx_integration_user_consent_source").on(table.consentSource),
  unique("idx_integration_user_consent_user_integration_unique")
    .on(table.userId, table.integrationSettingsId),
]);

// Integration data processing activities - tracks data processing activities for GDPR RoPA compliance
export const integrationProcessingActivities = pgTable("integration_processing_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Integration reference
  integrationSettingsId: varchar("integration_settings_id").notNull(), // FK to integration_gdpr_settings  
  integrationType: integrationTypeEnum("integration_type").notNull(),
  
  // Processing activity details
  activityName: varchar("activity_name").notNull(),
  activityDescription: text("activity_description").notNull(),
  processingPurpose: integrationProcessingPurposeEnum("processing_purpose").notNull(),
  lawfulBasis: processingLawfulBasisEnum("lawful_basis").notNull(),
  
  // Data subjects and categories
  dataSubjectCategories: text("data_subject_categories").array().notNull(), // 'customers', 'employees', 'visitors'
  personalDataCategories: dataCategoryEnum("personal_data_categories").array().notNull(),
  specialCategoryData: boolean("special_category_data").default(false),
  specialCategories: text("special_categories").array().default([]), // Article 9 special categories
  
  // Recipients and transfers
  recipientCategories: text("recipient_categories").array().default([]), // Who receives the data
  thirdPartyRecipients: text("third_party_recipients").array().default([]), // Specific third parties
  internationalTransfers: boolean("international_transfers").default(false),
  transferDestinations: text("transfer_destinations").array().default([]), // Country codes
  transferSafeguards: text("transfer_safeguards").array().default([]),
  
  // Retention and security
  retentionPeriod: varchar("retention_period").notNull(),
  retentionCriteria: text("retention_criteria"),
  securityMeasures: text("security_measures").array().default([]),
  technicalSafeguards: text("technical_safeguards").array().default([]),
  organisationalSafeguards: text("organisational_safeguards").array().default([]),
  
  // Data sources and collection  
  dataSourceDescription: text("data_source_description"),
  collectionMethods: text("collection_methods").array().default([]), // 'forms', 'cookies', 'api', 'import'
  dataVolume: varchar("data_volume"), // 'low', 'medium', 'high'
  dataFrequency: varchar("data_frequency"), // 'continuous', 'daily', 'weekly', 'monthly'
  
  // Rights and obligations
  dataSubjectRights: text("data_subject_rights").array().default([]), // Which rights are supported
  rightsLimitations: text("rights_limitations"), // Any limitations on rights
  supervisoryAuthority: varchar("supervisory_authority").default('ICO'), // Relevant authority
  
  // Documentation and compliance
  legalDocuments: text("legal_documents").array().default([]), // Contracts, policies, etc.
  privacyNoticeUrl: varchar("privacy_notice_url"),
  lastReviewDate: timestamp("last_review_date"),
  nextReviewDate: timestamp("next_review_date"),
  complianceNotes: text("compliance_notes"),
  
  // Risk assessment
  riskLevel: varchar("risk_level").default('medium'), // 'low', 'medium', 'high'
  riskFactors: text("risk_factors").array().default([]),
  mitigationMeasures: text("mitigation_measures").array().default([]),
  dataProtectionImpactAssessment: boolean("data_protection_impact_assessment").default(false),
  
  // Metadata
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_integration_processing_activities_organisation_id").on(table.organisationId),
  index("idx_integration_processing_activities_integration_settings_id").on(table.integrationSettingsId),
  index("idx_integration_processing_activities_integration_type").on(table.integrationType),
  index("idx_integration_processing_activities_processing_purpose").on(table.processingPurpose),
  index("idx_integration_processing_activities_lawful_basis").on(table.lawfulBasis),
  index("idx_integration_processing_activities_international_transfers").on(table.internationalTransfers),
  index("idx_integration_processing_activities_special_category_data").on(table.specialCategoryData),
  index("idx_integration_processing_activities_next_review_date").on(table.nextReviewDate),
]);

// Integration audit logs - comprehensive audit trail for integration GDPR compliance
export const integrationAuditLogs = pgTable("integration_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  
  // Integration context
  integrationSettingsId: varchar("integration_settings_id"), // May be null for system-wide events
  integrationType: integrationTypeEnum("integration_type"),
  
  // Audit event details
  eventType: varchar("event_type").notNull(), // 'consent_granted', 'data_processed', 'settings_updated', etc.
  eventCategory: varchar("event_category").notNull(), // 'consent', 'processing', 'config', 'breach', 'rights'
  eventDescription: text("event_description").notNull(),
  
  // Subject and actor
  userId: varchar("user_id"), // Data subject (may be null for admin actions)
  actorId: varchar("actor_id"), // User who performed the action
  actorRole: userRoleEnum("actor_role"),
  actorType: varchar("actor_type").default('user'), // 'user', 'system', 'integration'
  
  // Event context
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  geoLocation: varchar("geo_location"),
  sessionId: varchar("session_id"),
  requestId: varchar("request_id"),
  
  // Data processing details
  dataCategories: dataCategoryEnum("data_categories").array().default([]),
  processingPurpose: integrationProcessingPurposeEnum("processing_purpose"),
  lawfulBasis: processingLawfulBasisEnum("lawful_basis"),
  consentRequired: boolean("consent_required"),
  consentVerified: boolean("consent_verified"),
  
  // Integration API details
  apiEndpoint: varchar("api_endpoint"),
  apiMethod: varchar("api_method"), // GET, POST, PUT, DELETE
  apiStatusCode: integer("api_status_code"),
  apiResponse: jsonb("api_response"), // Sanitized API response
  integrationReference: varchar("integration_reference"), // External ID from integration
  
  // Rights exercise tracking
  userRightType: userRightTypeEnum("user_right_type"), // For rights exercise events
  rightRequestId: varchar("right_request_id"), // FK to user_right_requests
  rightFulfilled: boolean("right_fulfilled"),
  rightResponse: text("right_response"),
  
  // Data transfer tracking
  dataTransferred: boolean("data_transferred").default(false),
  transferDestination: varchar("transfer_destination"), // Country or service
  transferMechanism: varchar("transfer_mechanism"),
  transferVolume: varchar("transfer_volume"), // 'low', 'medium', 'high'
  
  // Compliance and risk
  complianceStatus: integrationComplianceStatusEnum("compliance_status"),
  riskLevel: varchar("risk_level"), // 'low', 'medium', 'high', 'critical'
  alertTriggered: boolean("alert_triggered").default(false),
  alertType: varchar("alert_type"), // 'consent_expired', 'unauthorized_access', 'data_breach'
  
  // Event metadata  
  eventData: jsonb("event_data").default('{}'), // Additional event-specific data
  previousState: jsonb("previous_state"), // State before the event
  newState: jsonb("new_state"), // State after the event
  correlationId: varchar("correlation_id"), // Group related events
  
  // Legal and compliance context
  legalRequirement: text("legal_requirement"), // Which law/regulation requires this logging
  retentionPeriod: integer("retention_period").default(2557), // Days (7 years default)
  sensitiveData: boolean("sensitive_data").default(false), // Contains sensitive information
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_integration_audit_logs_organisation_id").on(table.organisationId),
  index("idx_integration_audit_logs_integration_settings_id").on(table.integrationSettingsId),
  index("idx_integration_audit_logs_integration_type").on(table.integrationType),
  index("idx_integration_audit_logs_event_type").on(table.eventType),
  index("idx_integration_audit_logs_event_category").on(table.eventCategory),
  index("idx_integration_audit_logs_user_id").on(table.userId),
  index("idx_integration_audit_logs_actor_id").on(table.actorId),
  index("idx_integration_audit_logs_user_right_type").on(table.userRightType),
  index("idx_integration_audit_logs_right_request_id").on(table.rightRequestId),
  index("idx_integration_audit_logs_compliance_status").on(table.complianceStatus),
  index("idx_integration_audit_logs_alert_triggered").on(table.alertTriggered),
  index("idx_integration_audit_logs_correlation_id").on(table.correlationId),
  index("idx_integration_audit_logs_created_at").on(table.createdAt),
]);

// Insert schemas for integration GDPR compliance tables
export const insertIntegrationGdprSettingsSchema = createInsertSchema(integrationGdprSettings);
export const insertIntegrationUserConsentSchema = createInsertSchema(integrationUserConsent);
export const insertIntegrationProcessingActivitiesSchema = createInsertSchema(integrationProcessingActivities);
export const insertIntegrationAuditLogsSchema = createInsertSchema(integrationAuditLogs);

// Integration GDPR compliance types
export type InsertIntegrationGdprSettings = z.infer<typeof insertIntegrationGdprSettingsSchema>;
export type IntegrationGdprSettings = typeof integrationGdprSettings.$inferSelect;

export type InsertIntegrationUserConsent = z.infer<typeof insertIntegrationUserConsentSchema>;
export type IntegrationUserConsent = typeof integrationUserConsent.$inferSelect;

export type InsertIntegrationProcessingActivities = z.infer<typeof insertIntegrationProcessingActivitiesSchema>;
export type IntegrationProcessingActivities = typeof integrationProcessingActivities.$inferSelect;

export type InsertIntegrationAuditLogs = z.infer<typeof insertIntegrationAuditLogsSchema>;
export type IntegrationAuditLogs = typeof integrationAuditLogs.$inferSelect;
