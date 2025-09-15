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
export const processingLawfulBasisEnum = pgEnum('processing_lawful_basis', ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests']);
export const dataCategoryEnum = pgEnum('data_category', ['identity', 'contact', 'financial', 'demographic', 'education', 'technical', 'usage', 'special']);
export const userRightTypeEnum = pgEnum('user_right_type', ['access', 'rectification', 'erasure', 'restriction', 'objection', 'portability']);
export const userRightStatusEnum = pgEnum('user_right_status', ['pending', 'in_progress', 'completed', 'rejected', 'expired']);
export const breachSeverityEnum = pgEnum('breach_severity', ['low', 'medium', 'high', 'critical']);
export const breachStatusEnum = pgEnum('breach_status', ['detected', 'assessed', 'notified_ico', 'notified_subjects', 'resolved']);
export const cookieCategoryEnum = pgEnum('cookie_category', ['strictly_necessary', 'functional', 'analytics', 'advertising']);
export const marketingConsentTypeEnum = pgEnum('marketing_consent_type', ['email', 'sms', 'phone', 'post', 'push_notifications']);
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
  templateFormat: varchar("template_format", { enum: ["html", "visual"] }).default("html"), // 'html' or 'visual'
  templateData: jsonb("template_data"), // JSON data for visual templates
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

// NEW ROBUST EMAIL TEMPLATE SCHEMA

// EmailTemplate table - platform-level default email templates with MJML support
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(), // e.g., 'welcome', 'course_assigned', 'training_expiring'
  name: varchar("name").notNull(), // Human-readable title
  subject: text("subject").notNull(), // Handlebars-enabled subject template
  html: text("html").notNull(), // Compiled HTML from MJML
  mjml: text("mjml").notNull(), // Source MJML template
  text: text("text"), // Optional plain text version
  variablesSchema: jsonb("variables_schema"), // JSON schema defining required/optional variables
  category: emailTemplateCategoryEnum("category").notNull(), // learner | admin
  version: integer("version").notNull().default(1), // Version control for templates
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_email_template_key").on(table.key),
  index("idx_email_template_category").on(table.category),
  index("idx_email_template_active").on(table.isActive),
]);

// OrgEmailTemplate table - organization-specific overrides for email templates
export const orgEmailTemplates = pgTable("org_email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(), // FK to organisations
  templateKey: varchar("template_key").notNull(), // FK to EmailTemplate.key
  subjectOverride: text("subject_override"), // Override subject template
  htmlOverride: text("html_override"), // Override compiled HTML
  mjmlOverride: text("mjml_override"), // Override MJML source
  textOverride: text("text_override"), // Override plain text version
  version: integer("version").notNull().default(1), // Track override version
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_org_email_template_org").on(table.orgId),
  index("idx_org_email_template_key").on(table.templateKey),
  index("idx_org_email_template_org_key").on(table.orgId, table.templateKey),
  // Unique constraint to prevent duplicate overrides for same org+template
  unique("unique_org_email_template").on(table.orgId, table.templateKey),
]);

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

// NEW ROBUST EMAIL TEMPLATE RELATIONS

// EmailTemplate relations (platform defaults - no org relationship)
export const emailTemplatesRelations = relations(emailTemplates, ({ many }) => ({
  orgOverrides: many(orgEmailTemplates), // One template can have many org overrides
}));

// OrgEmailTemplate relations (tenant overrides)
export const orgEmailTemplatesRelations = relations(orgEmailTemplates, ({ one }) => ({
  organisation: one(organisations, {
    fields: [orgEmailTemplates.orgId],
    references: [organisations.id],
  }),
  template: one(emailTemplates, {
    fields: [orgEmailTemplates.templateKey],
    references: [emailTemplates.key],
  }),
}));

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
  action: varchar("action").notNull(),
  resource: varchar("resource").notNull(),
  resourceId: varchar("resource_id").notNull(),
  details: jsonb("details").notNull().default('{}'),
  ipAddress: varchar("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_gdpr_audit_logs_organisation_id").on(table.organisationId),
  index("idx_gdpr_audit_logs_user_id").on(table.userId),
  index("idx_gdpr_audit_logs_admin_id").on(table.adminId),
  index("idx_gdpr_audit_logs_action").on(table.action),
  index("idx_gdpr_audit_logs_resource").on(table.resource),
  index("idx_gdpr_audit_logs_timestamp").on(table.timestamp),
]);

export const ageVerifications = pgTable("age_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  organisationId: varchar("organisation_id").notNull(),
  dateOfBirth: timestamp("date_of_birth"),
  ageVerified: boolean("age_verified").notNull().default(false),
  parentalConsentRequired: boolean("parental_consent_required").notNull().default(false),
  parentalConsentGiven: boolean("parental_consent_given").notNull().default(false),
  parentEmail: varchar("parent_email"),
  parentName: varchar("parent_name"),
  verificationMethod: varchar("verification_method").notNull(),
  verifiedAt: timestamp("verified_at"),
  metadata: jsonb("metadata").notNull().default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_age_verifications_user_id").on(table.userId),
  index("idx_age_verifications_organisation_id").on(table.organisationId),
  index("idx_age_verifications_age_verified").on(table.ageVerified),
  index("idx_age_verifications_parental_consent_required").on(table.parentalConsentRequired),
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
  name: varchar("name").notNull(),
  description: text("description").notNull(),
  dataType: retentionDataTypeEnum("data_type").notNull(),
  retentionPeriod: integer("retention_period").notNull(), // days
  gracePeriod: integer("grace_period").notNull().default(30), // days before secure erase
  deletionMethod: retentionDeletionMethodEnum("deletion_method").notNull().default('soft'),
  secureEraseMethod: secureEraseMethodEnum("secure_erase_method").notNull().default('overwrite_multiple'),
  triggerType: retentionPolicyTriggerEnum("trigger_type").notNull().default('time_based'),
  legalBasis: processingLawfulBasisEnum("legal_basis").notNull(),
  regulatoryRequirement: text("regulatory_requirement"), // e.g., "GDPR Article 6(1)(c)", "Companies Act 2006"
  priority: integer("priority").notNull().default(100), // Higher number = higher priority for conflicts
  enabled: boolean("enabled").notNull().default(true),
  automaticDeletion: boolean("automatic_deletion").notNull().default(true),
  requiresManualReview: boolean("requires_manual_review").notNull().default(false),
  notificationSettings: jsonb("notification_settings").notNull().default('{}'), // Notification preferences
  metadata: jsonb("metadata").notNull().default('{}'),
  createdBy: varchar("created_by").notNull(),
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

// NEW ROBUST EMAIL TEMPLATE INSERT SCHEMAS
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  version: true, // Auto-managed
  createdAt: true,
  updatedAt: true,
});

export const insertOrgEmailTemplateSchema = createInsertSchema(orgEmailTemplates).omit({
  id: true,
  version: true, // Auto-managed
  createdAt: true,
  updatedAt: true,
});

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

export const insertAgeVerificationSchema = createInsertSchema(ageVerifications).omit({
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

// NEW ROBUST EMAIL TEMPLATE TYPES
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

export type InsertOrgEmailTemplate = z.infer<typeof insertOrgEmailTemplateSchema>;
export type OrgEmailTemplate = typeof orgEmailTemplates.$inferSelect;

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

export type InsertAgeVerification = z.infer<typeof insertAgeVerificationSchema>;
export type AgeVerification = typeof ageVerifications.$inferSelect;

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
