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
  'system_test'
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
  'queued',      // Queued for sending
  'sending',     // Currently being sent
  'sent',        // Successfully sent
  'failed',      // Permanently failed after retries
  'retrying'     // Temporarily failed, will retry
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
});

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
  status: emailSendStatusEnum("status").notNull().default('queued'),
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
