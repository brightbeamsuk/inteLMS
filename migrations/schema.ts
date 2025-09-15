import { pgTable, varchar, timestamp, boolean, text, jsonb, numeric, integer, unique, index, serial, foreignKey, check, date, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const adequacyDecisionStatus = pgEnum("adequacy_decision_status", ['adequate', 'inadequate', 'under_review', 'pending', 'transitional'])
export const assignmentStatus = pgEnum("assignment_status", ['not_started', 'in_progress', 'completed', 'overdue'])
export const billingCadence = pgEnum("billing_cadence", ['monthly', 'annual'])
export const billingModel = pgEnum("billing_model", ['metered_per_active_user', 'per_seat', 'flat_subscription'])
export const breachSeverity = pgEnum("breach_severity", ['low', 'medium', 'high', 'critical'])
export const breachStatus = pgEnum("breach_status", ['detected', 'assessed', 'notified_ico', 'notified_subjects', 'resolved'])
export const completionStatus = pgEnum("completion_status", ['pass', 'fail'])
export const courseStatus = pgEnum("course_status", ['draft', 'published', 'archived'])
export const emailProvider = pgEnum("email_provider", ['smtp_generic', 'sendgrid_api', 'brevo_api', 'mailgun_api', 'postmark_api', 'mailjet_api', 'sparkpost_api'])
export const emailRoutingSource = pgEnum("email_routing_source", ['org_primary', 'org_fallback', 'system_default', 'mixed_config'])
export const emailTemplateCategory = pgEnum("email_template_category", ['admin', 'learner'])
export const emailTemplateType = pgEnum("email_template_type", ['welcome_account_created', 'course_assigned', 'course_reminder', 'course_overdue', 'training_expiring_soon', 'training_expired', 'course_completion_certificate', 'failed_attempt', 'password_reset', 'new_user_registered', 'user_completed_course', 'user_failed_course', 'staff_training_expiring', 'staff_training_expired', 'weekly_training_summary', 'smtp_test'])
export const organisationStatus = pgEnum("organisation_status", ['active', 'archived', 'deleted'])
export const planStatus = pgEnum("plan_status", ['active', 'inactive', 'archived'])
export const priceChangePolicy = pgEnum("price_change_policy", ['prorate_immediately', 'at_period_end', 'manual'])
export const scormAttemptStatus = pgEnum("scorm_attempt_status", ['not_started', 'in_progress', 'completed', 'abandoned'])
export const scormStandard = pgEnum("scorm_standard", ['1.2', '2004'])
export const taxBehavior = pgEnum("tax_behavior", ['inclusive', 'exclusive'])
export const tiaStatus = pgEnum("tia_status", ['draft', 'under_review', 'approved', 'rejected', 'requires_revision'])
export const transferFrequency = pgEnum("transfer_frequency", ['continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'ad_hoc', 'event_driven'])
export const transferLegalBasis = pgEnum("transfer_legal_basis", ['adequacy_decision', 'appropriate_safeguards', 'binding_corporate_rules', 'approved_code_conduct', 'approved_certification', 'specific_situation', 'explicit_consent', 'contract_performance', 'public_interest', 'legal_claims', 'vital_interests', 'public_register'])
export const transferMechanismType = pgEnum("transfer_mechanism_type", ['adequacy_decision', 'standard_contractual_clauses', 'international_data_transfer_agreement', 'binding_corporate_rules', 'approved_certification_scheme', 'approved_code_conduct', 'ad_hoc_contractual_clauses', 'no_mechanism_required'])
export const transferRiskLevel = pgEnum("transfer_risk_level", ['low', 'medium', 'high', 'very_high'])
export const transferStatus = pgEnum("transfer_status", ['active', 'suspended', 'terminated', 'under_review'])
export const transferType = pgEnum("transfer_type", ['customer_data', 'employee_data', 'supplier_data', 'marketing_data', 'technical_data', 'financial_data', 'health_data', 'biometric_data', 'other_special_category'])
export const userRole = pgEnum("user_role", ['superadmin', 'admin', 'user'])
export const userStatus = pgEnum("user_status", ['active', 'inactive'])


export const assignments = pgTable("assignments", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	courseId: varchar("course_id").notNull(),
	userId: varchar("user_id").notNull(),
	organisationId: varchar("organisation_id").notNull(),
	dueDate: timestamp("due_date", { mode: 'string' }),
	status: assignmentStatus().default('not_started').notNull(),
	assignedBy: varchar("assigned_by").notNull(),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow(),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	notificationsEnabled: boolean("notifications_enabled").default(true),
});

export const certificateTemplates = pgTable("certificate_templates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar().notNull(),
	template: text(),
	isDefault: boolean("is_default").default(false),
	organisationId: varchar("organisation_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	templateFormat: varchar("template_format").default('html'),
	templateData: jsonb("template_data"),
});

export const certificates = pgTable("certificates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	completionId: varchar("completion_id").notNull(),
	userId: varchar("user_id").notNull(),
	courseId: varchar("course_id").notNull(),
	organisationId: varchar("organisation_id").notNull(),
	certificateUrl: varchar("certificate_url"),
	expiryDate: timestamp("expiry_date", { mode: 'string' }),
	issuedAt: timestamp("issued_at", { mode: 'string' }).defaultNow(),
});

export const completions = pgTable("completions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	assignmentId: varchar("assignment_id").notNull(),
	userId: varchar("user_id").notNull(),
	courseId: varchar("course_id").notNull(),
	organisationId: varchar("organisation_id").notNull(),
	score: numeric({ precision: 5, scale:  2 }),
	status: completionStatus().notNull(),
	attemptNumber: integer("attempt_number").default(1),
	timeSpent: integer("time_spent"),
	scormData: jsonb("scorm_data"),
	completedAt: timestamp("completed_at", { mode: 'string' }).defaultNow(),
});

export const platformSettings = pgTable("platform_settings", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	key: varchar().notNull(),
	value: text(),
	description: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("platform_settings_key_unique").on(table.key),
]);

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const todoItems = pgTable("todo_items", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	task: text().notNull(),
	completed: boolean().default(false),
	order: integer().default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const organisations = pgTable("organisations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar().notNull(),
	displayName: varchar("display_name").notNull(),
	subdomain: varchar().notNull(),
	logoUrl: varchar("logo_url"),
	theme: varchar().default('light'),
	contactEmail: varchar("contact_email"),
	contactPhone: varchar("contact_phone"),
	address: text(),
	status: organisationStatus().default('active').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	accentColor: varchar("accent_color").default('#3b82f6'),
	primaryColor: varchar("primary_color").default('#3b82f6'),
	useCustomColors: boolean("use_custom_colors").default(false),
	planId: varchar("plan_id"),
	stripeCustomerId: varchar("stripe_customer_id"),
	stripeSubscriptionId: varchar("stripe_subscription_id"),
	billingStatus: varchar("billing_status"),
	activeUserCount: integer("active_user_count").default(0),
	lastBillingSync: timestamp("last_billing_sync", { mode: 'string' }),
	stripeSubscriptionItemId: varchar("stripe_subscription_item_id"),
	currentPeriodEnd: timestamp("current_period_end", { mode: 'string' }),
}, (table) => [
	unique("organisations_subdomain_unique").on(table.subdomain),
]);

export const users = pgTable("users", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	email: varchar(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	role: userRole().default('user').notNull(),
	status: userStatus().default('active').notNull(),
	organisationId: varchar("organisation_id"),
	jobTitle: varchar("job_title"),
	department: varchar(),
	allowCertificateDownload: boolean("allow_certificate_download").default(false),
	lastActive: timestamp("last_active", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	phone: varchar(),
	bio: text(),
	stripeCustomerId: varchar("stripe_customer_id"),
	passwordHash: varchar("password_hash"),
	requiresPasswordChange: boolean("requires_password_change").default(false),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const courses = pgTable("courses", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	title: varchar().notNull(),
	description: text(),
	scormPackageUrl: varchar("scorm_package_url"),
	coverImageUrl: varchar("cover_image_url"),
	estimatedDuration: integer("estimated_duration"),
	passmark: integer().default(80),
	category: varchar(),
	tags: text(),
	certificateExpiryPeriod: integer("certificate_expiry_period"),
	status: courseStatus().default('draft').notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	launchUrlOverride: varchar("launch_url_override", { length: 500 }),
	scormVersion: varchar("scorm_version", { length: 10 }),
	scormOrganizations: jsonb("scorm_organizations"),
	defaultOrganization: varchar("default_organization", { length: 191 }),
	folderId: varchar("folder_id"),
});

export const scormAttempts = pgTable("scorm_attempts", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	attemptId: varchar("attempt_id").notNull(),
	assignmentId: varchar("assignment_id").notNull(),
	userId: varchar("user_id").notNull(),
	courseId: varchar("course_id").notNull(),
	organisationId: varchar("organisation_id").notNull(),
	scormVersion: varchar("scorm_version", { length: 10 }).notNull(),
	lessonStatus: varchar("lesson_status"),
	completionStatus: varchar("completion_status"),
	successStatus: varchar("success_status"),
	scoreRaw: numeric("score_raw", { precision: 7, scale:  2 }),
	scoreScaled: numeric("score_scaled", { precision: 5, scale:  4 }),
	scoreMin: numeric("score_min", { precision: 7, scale:  2 }),
	scoreMax: numeric("score_max", { precision: 7, scale:  2 }),
	sessionTime: varchar("session_time"),
	location: text(),
	passed: boolean().default(false),
	passmark: integer(),
	isActive: boolean("is_active").default(true),
	lastCommitAt: timestamp("last_commit_at", { mode: 'string' }),
	finishedAt: timestamp("finished_at", { mode: 'string' }),
	rawScormData: jsonb("raw_scorm_data"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	itemId: varchar("item_id"),
	status: scormAttemptStatus().default('not_started'),
	lessonLocation: text("lesson_location"),
	progressMeasure: numeric("progress_measure", { precision: 5, scale:  4 }),
	suspendData: text("suspend_data"),
	progressPercent: integer("progress_percent").default(0),
	completed: boolean().default(false),
	certificateUrl: varchar("certificate_url"),
	certificateGeneratedAt: timestamp("certificate_generated_at", { mode: 'string' }),
}, (table) => [
	unique("scorm_attempts_attempt_id_unique").on(table.attemptId),
]);

export const organisationSettings = pgTable("organisation_settings", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	organisationId: varchar("organisation_id").notNull(),
	signatureImageUrl: varchar("signature_image_url"),
	signerName: varchar("signer_name"),
	signerTitle: varchar("signer_title"),
	certificateText: text("certificate_text").default('has successfully completed'),
	assignmentEmailsEnabled: boolean("assignment_emails_enabled").default(true),
	reminderEmailsEnabled: boolean("reminder_emails_enabled").default(true),
	completionEmailsEnabled: boolean("completion_emails_enabled").default(true),
	reminderDays: integer("reminder_days").default(7),
	defaultCertificateDownload: boolean("default_certificate_download").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	smtpHost: varchar("smtp_host"),
	smtpPort: integer("smtp_port").default(587),
	smtpUsername: varchar("smtp_username"),
	smtpPassword: varchar("smtp_password"),
	smtpSecure: boolean("smtp_secure").default(true),
	fromEmail: varchar("from_email"),
	fromName: varchar("from_name"),
	brevoApiKey: varchar("brevo_api_key"),
	useBrevoApi: boolean("use_brevo_api").default(false),
	emailProvider: text("email_provider").default('sendgrid_api'),
	replyTo: text("reply_to"),
	apiKey: text("api_key"),
	apiSecret: text("api_secret"),
	apiBaseUrl: text("api_base_url"),
	apiDomain: text("api_domain"),
	apiRegion: text("api_region"),
}, (table) => [
	unique("organisation_settings_organisation_id_unique").on(table.organisationId),
]);

export const planFeatureMappings = pgTable("plan_feature_mappings", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	planId: varchar("plan_id").notNull(),
	featureId: varchar("feature_id").notNull(),
	enabled: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const planFeatures = pgTable("plan_features", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	key: varchar().notNull(),
	name: varchar().notNull(),
	description: text(),
	category: varchar(),
	isDefault: boolean("is_default").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("plan_features_key_unique").on(table.key),
]);

export const emailLogs = pgTable("email_logs", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	organisationId: varchar("organisation_id"),
	fromEmail: varchar("from_email").notNull(),
	toEmail: varchar("to_email").notNull(),
	subject: varchar().notNull(),
	templateType: emailTemplateType("template_type"),
	smtpHost: varchar("smtp_host").notNull(),
	smtpPort: integer("smtp_port").notNull(),
	smtpProvider: varchar("smtp_provider"),
	messageId: varchar("message_id"),
	status: varchar().notNull(),
	errorMessage: text("error_message"),
	tlsUsed: boolean("tls_used").default(true),
	responseCode: varchar("response_code"),
	sentAt: timestamp("sent_at", { mode: 'string' }).defaultNow(),
	userAgent: text("user_agent"),
	ipAddress: varchar("ip_address"),
	usedOrgSettings: boolean("used_org_settings").default(false),
	fallbackUsed: boolean("fallback_used").default(false),
	provider: text(),
	httpStatus: integer("http_status"),
	apiResponse: text("api_response"),
	deliveryTimestamp: timestamp("delivery_timestamp", { mode: 'string' }),
	smtpStatus: text("smtp_status"),
	endpoint: varchar(),
	errorShort: varchar("error_short"),
	errorRaw: text("error_raw"),
	keyPreview: varchar("key_preview"),
	keyLength: integer("key_length"),
	effectiveFieldSources: jsonb("effective_field_sources"),
	timestamp: timestamp({ mode: 'string' }).defaultNow(),
	routingSource: text("routing_source"),
});

export const courseFolders = pgTable("course_folders", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar().notNull(),
	description: text(),
	color: varchar().default('#3b82f6'),
	icon: varchar().default('fas fa-folder'),
	sortOrder: integer("sort_order").default(0),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const organisationCourseFolders = pgTable("organisation_course_folders", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	organisationId: varchar("organisation_id").notNull(),
	folderId: varchar("folder_id").notNull(),
	grantedBy: varchar("granted_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	organisationId: varchar("organisation_id").notNull(),
	userId: varchar("user_id"),
	action: varchar().notNull(),
	resource: varchar(),
	resourceId: varchar("resource_id"),
	details: jsonb(),
	ipAddress: varchar("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const systemSmtpSettings = pgTable("system_smtp_settings", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	smtpHost: varchar("smtp_host").notNull(),
	smtpPort: integer("smtp_port").default(587).notNull(),
	smtpUsername: varchar("smtp_username").notNull(),
	smtpPassword: varchar("smtp_password").notNull(),
	smtpSecure: boolean("smtp_secure").default(true),
	fromEmail: varchar("from_email").notNull(),
	fromName: varchar("from_name").notNull(),
	isActive: boolean("is_active").default(true),
	description: text(),
	updatedBy: varchar("updated_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const systemEmailSettings = pgTable("system_email_settings", {
	id: serial().primaryKey().notNull(),
	emailProvider: text("email_provider").default('sendgrid_api'),
	fromEmail: text("from_email"),
	fromName: text("from_name"),
	replyTo: text("reply_to"),
	description: text(),
	smtpHost: text("smtp_host"),
	smtpPort: integer("smtp_port").default(587),
	smtpUsername: text("smtp_username"),
	smtpPassword: text("smtp_password"),
	smtpSecure: boolean("smtp_secure").default(true),
	apiKey: text("api_key"),
	apiSecret: text("api_secret"),
	apiBaseUrl: text("api_base_url"),
	apiDomain: text("api_domain"),
	apiRegion: text("api_region"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	isActive: boolean("is_active").default(true),
	updatedBy: text("updated_by"),
});

export const plans = pgTable("plans", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar().notNull(),
	description: text(),
	pricePerUser: numeric("price_per_user", { precision: 10, scale:  2 }).notNull(),
	status: planStatus().default('active').notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	billingModel: billingModel("billing_model"),
	cadence: billingCadence().default('monthly'),
	currency: varchar({ length: 3 }).default('GBP'),
	unitAmount: integer("unit_amount"),
	taxBehavior: taxBehavior("tax_behavior").default('exclusive'),
	trialDays: integer("trial_days"),
	minSeats: integer("min_seats"),
	stripeProductId: varchar("stripe_product_id"),
	stripePriceId: varchar("stripe_price_id"),
	isActive: boolean("is_active").default(true),
	priceChangePolicy: priceChangePolicy("price_change_policy").default('prorate_immediately'),
});

export const orgEmailTemplates = pgTable("org_email_templates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	orgId: varchar("org_id").notNull(),
	templateKey: varchar("template_key").notNull(),
	subjectOverride: varchar("subject_override"),
	htmlOverride: text("html_override"),
	mjmlOverride: text("mjml_override"),
	textOverride: text("text_override"),
	version: integer().default(1),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_org_email_templates_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_org_email_templates_org_id").using("btree", table.orgId.asc().nullsLast().op("text_ops")),
	index("idx_org_email_templates_template_key").using("btree", table.templateKey.asc().nullsLast().op("text_ops")),
	unique("org_email_templates_org_id_template_key_unique").on(table.orgId, table.templateKey),
]);

export const supportTicketResponses = pgTable("support_ticket_responses", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	ticketId: varchar("ticket_id").notNull(),
	message: text().notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isInternal: boolean("is_internal").default(false),
	userId: varchar("user_id").notNull(),
	attachments: jsonb(),
}, (table) => [
	foreignKey({
			columns: [table.ticketId],
			foreignColumns: [supportTickets.id],
			name: "support_ticket_responses_ticket_id_fkey"
		}).onDelete("cascade"),
]);

export const supportTickets = pgTable("support_tickets", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	status: varchar({ length: 50 }).default('open'),
	priority: varchar({ length: 50 }).default('medium'),
	category: varchar({ length: 100 }).default('general'),
	createdBy: varchar("created_by").notNull(),
	organisationId: varchar("organisation_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	lastResponseAt: timestamp("last_response_at", { withTimezone: true, mode: 'string' }),
	assignedTo: varchar("assigned_to"),
	isRead: boolean("is_read").default(false),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	ticketNumber: varchar("ticket_number", { length: 20 }),
}, (table) => [
	unique("support_tickets_ticket_number_key").on(table.ticketNumber),
	check("support_tickets_status_check", sql`(status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'resolved'::character varying, 'closed'::character varying])::text[])`),
	check("support_tickets_priority_check", sql`(priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[])`),
	check("support_tickets_category_check", sql`(category)::text = ANY ((ARRAY['general'::character varying, 'technical'::character varying, 'billing'::character varying, 'feature_request'::character varying, 'bug_report'::character varying])::text[])`),
]);

export const emailTemplateDefaults = pgTable("email_template_defaults", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	key: varchar().notNull(),
	category: emailTemplateCategory().notNull(),
	subject: varchar().notNull(),
	htmlContent: text("html_content").notNull(),
	textContent: text("text_content"),
	variablesSchema: jsonb("variables_schema"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	updatedBy: varchar("updated_by").notNull(),
}, (table) => [
	unique("email_template_defaults_key_key").on(table.key),
]);

export const emailTemplateOverrides = pgTable("email_template_overrides", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	orgId: varchar("org_id").notNull(),
	templateKey: varchar("template_key").notNull(),
	subjectOverride: varchar("subject_override"),
	htmlOverride: text("html_override"),
	textOverride: text("text_override"),
	isActive: boolean("is_active").default(true),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	updatedBy: varchar("updated_by").notNull(),
}, (table) => [
	index("idx_email_override_org_template").using("btree", table.orgId.asc().nullsLast().op("text_ops"), table.templateKey.asc().nullsLast().op("text_ops")),
]);

export const orgNotificationSettings = pgTable("org_notification_settings", {
	orgId: varchar("org_id").primaryKey().notNull(),
	sendToAdmins: boolean("send_to_admins").default(true),
	extraRecipients: jsonb("extra_recipients"),
	emailProviderConfigId: varchar("email_provider_config_id"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	updatedBy: varchar("updated_by").notNull(),
});

export const emailProviderConfigs = pgTable("email_provider_configs", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	orgId: varchar("org_id"),
	provider: varchar().notNull(),
	configJson: jsonb("config_json").notNull(),
	isDefaultForOrg: boolean("is_default_for_org").default(false),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	updatedBy: varchar("updated_by").notNull(),
}, (table) => [
	index("idx_email_provider_default").using("btree", table.isDefaultForOrg.asc().nullsLast().op("bool_ops")),
	index("idx_email_provider_org").using("btree", table.orgId.asc().nullsLast().op("text_ops")),
]);

export const emailTemplates = pgTable("email_templates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	key: varchar().notNull(),
	name: varchar().notNull(),
	subject: text().notNull(),
	html: text().notNull(),
	mjml: text().notNull(),
	text: text(),
	variablesSchema: jsonb("variables_schema"),
	category: varchar().notNull(),
	version: integer().default(1).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_email_template_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_email_template_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("idx_email_template_key").using("btree", table.key.asc().nullsLast().op("text_ops")),
	unique("email_templates_key_key").on(table.key),
]);

export const internationalTransfers = pgTable("international_transfers", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	organisationId: varchar("organisation_id").notNull(),
	transferName: varchar("transfer_name").notNull(),
	transferDescription: text("transfer_description"),
	transferReference: varchar("transfer_reference"),
	transferType: transferType("transfer_type").notNull(),
	dataCategories: text("data_categories").array().notNull(),
	dataSubjectCategories: text("data_subject_categories").array().notNull(),
	specialCategories: boolean("special_categories").default(false),
	originCountry: varchar("origin_country").default('GB').notNull(),
	destinationCountry: varchar("destination_country").notNull(),
	recipient: varchar().notNull(),
	recipientContact: text("recipient_contact"),
	transferPurpose: text("transfer_purpose").notNull(),
	legalBasis: transferLegalBasis("legal_basis").notNull(),
	transferMechanism: transferMechanismType("transfer_mechanism").notNull(),
	mechanismReference: varchar("mechanism_reference"),
	transferFrequency: transferFrequency("transfer_frequency").notNull(),
	volumeDescription: text("volume_description"),
	retentionPeriod: varchar("retention_period"),
	status: transferStatus().default('active').notNull(),
	effectiveDate: date("effective_date"),
	terminationDate: date("termination_date"),
	reviewDate: date("review_date"),
	riskLevel: transferRiskLevel("risk_level").default('medium').notNull(),
	riskFactors: text("risk_factors").array(),
	safeguards: text().array(),
	technicalMeasures: text("technical_measures"),
	organisationalMeasures: text("organisational_measures"),
	approvalRequired: boolean("approval_required").default(true),
	approvedBy: varchar("approved_by"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	documentationReference: varchar("documentation_reference"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const emailSettingsLock = pgTable("email_settings_lock", {
	id: varchar({ length: 255 }).default((gen_random_uuid())).primaryKey().notNull(),
	lockType: varchar("lock_type", { length: 50 }).notNull(),
	resourceId: varchar("resource_id", { length: 255 }).notNull(),
	acquiredAt: timestamp("acquired_at", { mode: 'string' }).defaultNow(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
}, (table) => [
	unique("email_settings_lock_lock_type_resource_id_key").on(table.lockType, table.resourceId),
]);

export const transferImpactAssessments = pgTable("transfer_impact_assessments", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	organisationId: varchar("organisation_id").notNull(),
	tiaReference: varchar("tia_reference").notNull(),
	title: varchar().notNull(),
	description: text(),
	dataCategories: text("data_categories").array().notNull(),
	destinationCountry: varchar("destination_country").notNull(),
	recipient: varchar().notNull(),
	proposedMechanism: transferMechanismType("proposed_mechanism").notNull(),
	countryRiskScore: integer("country_risk_score"),
	recipientRiskScore: integer("recipient_risk_score"),
	dataRiskScore: integer("data_risk_score"),
	overallRiskScore: integer("overall_risk_score"),
	riskLevel: transferRiskLevel("risk_level").default('medium').notNull(),
	riskFactors: text("risk_factors").array(),
	likelihoodAssessment: text("likelihood_assessment"),
	impactAssessment: text("impact_assessment"),
	harmCategories: text("harm_categories").array(),
	affectedDataSubjects: text("affected_data_subjects").array(),
	proposedSafeguards: text("proposed_safeguards").array(),
	additionalMeasures: text("additional_measures"),
	residualRiskAssessment: text("residual_risk_assessment"),
	legalBasisAssessment: text("legal_basis_assessment"),
	adequacyAssessment: text("adequacy_assessment"),
	necessityAssessment: text("necessity_assessment"),
	proportionalityAssessment: text("proportionality_assessment"),
	consultationRequired: boolean("consultation_required").default(false),
	consultationCompleted: boolean("consultation_completed").default(false),
	consultationFeedback: text("consultation_feedback"),
	recommendation: text(),
	decision: text(),
	status: tiaStatus().default('draft').notNull(),
	submittedBy: varchar("submitted_by"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	reviewedBy: varchar("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	approvedBy: varchar("approved_by"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	validFrom: timestamp("valid_from", { mode: 'string' }),
	validUntil: timestamp("valid_until", { mode: 'string' }),
	reviewRequired: boolean("review_required").default(true),
	nextReviewDate: timestamp("next_review_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const emailSends = pgTable("email_sends", {
	id: varchar({ length: 255 }).default((gen_random_uuid())).primaryKey().notNull(),
	organisationId: varchar("organisation_id", { length: 255 }),
	triggerEvent: varchar("trigger_event", { length: 50 }).notNull(),
	templateKey: varchar("template_key", { length: 100 }).notNull(),
	toEmail: varchar("to_email", { length: 255 }).notNull(),
	toName: varchar("to_name", { length: 255 }),
	fromEmail: varchar("from_email", { length: 255 }).notNull(),
	fromName: varchar("from_name", { length: 255 }).notNull(),
	subject: text().notNull(),
	htmlContent: text("html_content").notNull(),
	textContent: text("text_content"),
	templateVariables: jsonb("template_variables"),
	status: varchar({ length: 20 }).default('pending'),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	failedReason: text("failed_reason"),
	retryCount: integer("retry_count").default(0),
	nextRetryAt: timestamp("next_retry_at", { mode: 'string' }),
	idempotencyKey: varchar("idempotency_key", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	provider: emailProvider(),
	providerMessageId: varchar("provider_message_id"),
	errorMessage: text("error_message"),
	errorCode: varchar("error_code"),
	lastAttemptAt: timestamp("last_attempt_at", { mode: 'string' }),
	deliveredAt: timestamp("delivered_at", { mode: 'string' }),
	replyTo: varchar("reply_to"),
	routingSource: emailRoutingSource("routing_source"),
}, (table) => [
	unique("email_sends_idempotency_key_key").on(table.idempotencyKey),
	check("email_sends_status_check", sql`(status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'failed'::character varying, 'retrying'::character varying])::text[])`),
]);

export const billingLocks = pgTable("billing_locks", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	lockType: varchar("lock_type").notNull(),
	resourceId: varchar("resource_id").notNull(),
	lockedBy: varchar("locked_by").notNull(),
	lockReason: varchar("lock_reason"),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	acquiredAt: timestamp("acquired_at", { mode: 'string' }).defaultNow(),
	renewedAt: timestamp("renewed_at", { mode: 'string' }),
	queuePosition: integer("queue_position"),
	correlationId: varchar("correlation_id"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_billing_lock_expires").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_billing_lock_resource").using("btree", table.lockType.asc().nullsLast().op("text_ops"), table.resourceId.asc().nullsLast().op("text_ops")),
]);

export const dataBreaches = pgTable("data_breaches", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	organisationId: varchar("organisation_id").notNull(),
	title: varchar().notNull(),
	description: text().notNull(),
	severity: breachSeverity().notNull(),
	status: breachStatus().default('detected').notNull(),
	detectedAt: timestamp("detected_at", { mode: 'string' }).defaultNow().notNull(),
	reportedAt: timestamp("reported_at", { mode: 'string' }),
	icoNotifiedAt: timestamp("ico_notified_at", { mode: 'string' }),
	subjectsNotifiedAt: timestamp("subjects_notified_at", { mode: 'string' }),
	affectedSubjects: integer("affected_subjects").default(0).notNull(),
	dataCategories: text("data_categories").array().default(["RAY"]).notNull(),
	cause: text().notNull(),
	impact: text().notNull(),
	containmentMeasures: text("containment_measures").notNull(),
	preventiveMeasures: text("preventive_measures").notNull(),
	notificationDeadline: timestamp("notification_deadline", { mode: 'string' }).notNull(),
	responsible: varchar().notNull(),
	attachments: text().array().default(["RAY"]).notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_data_breaches_detected_at").using("btree", table.detectedAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_data_breaches_notification_deadline").using("btree", table.notificationDeadline.asc().nullsLast().op("timestamp_ops")),
	index("idx_data_breaches_organisation_id").using("btree", table.organisationId.asc().nullsLast().op("text_ops")),
	index("idx_data_breaches_severity").using("btree", table.severity.asc().nullsLast().op("enum_ops")),
	index("idx_data_breaches_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
]);

export const transferMechanisms = pgTable("transfer_mechanisms", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	organisationId: varchar("organisation_id").notNull(),
	mechanismType: transferMechanismType("mechanism_type").notNull(),
	mechanismName: varchar("mechanism_name").notNull(),
	mechanismReference: varchar("mechanism_reference"),
	description: text(),
	applicableCountries: text("applicable_countries").array().default([""]),
	dataCategories: text("data_categories").array().default([""]),
	legalFramework: text("legal_framework"),
	regulatoryApproval: boolean("regulatory_approval").default(false),
	approvalAuthority: varchar("approval_authority"),
	approvalDate: timestamp("approval_date", { mode: 'string' }),
	approvalReference: varchar("approval_reference"),
	effectiveDate: timestamp("effective_date", { mode: 'string' }),
	expiryDate: timestamp("expiry_date", { mode: 'string' }),
	renewalRequired: boolean("renewal_required").default(true),
	renewalDate: timestamp("renewal_date", { mode: 'string' }),
	lastReviewDate: timestamp("last_review_date", { mode: 'string' }),
	nextReviewDate: timestamp("next_review_date", { mode: 'string' }),
	documentationLocation: text("documentation_location"),
	templateLocation: text("template_location"),
	guidanceNotes: text("guidance_notes"),
	status: transferStatus().default('active').notNull(),
	complianceVerified: boolean("compliance_verified").default(false),
	verificationDate: timestamp("verification_date", { mode: 'string' }),
	verifiedBy: varchar("verified_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const standardContractualClauses = pgTable("standard_contractual_clauses", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	organisationId: varchar("organisation_id").notNull(),
	transferMechanismId: varchar("transfer_mechanism_id").notNull(),
	sccType: varchar("scc_type").notNull(),
	sccVersion: varchar("scc_version").notNull(),
	adoptionDecision: varchar("adoption_decision"),
	dataExporterName: varchar("data_exporter_name").notNull(),
	dataExporterContact: text("data_exporter_contact"),
	dataImporterName: varchar("data_importer_name").notNull(),
	dataImporterContact: text("data_importer_contact"),
	dataCategories: text("data_categories").array().notNull(),
	specialCategories: boolean("special_categories").default(false),
	processingPurposes: text("processing_purposes").array().notNull(),
	retentionPeriod: varchar("retention_period"),
	technicalMeasures: text("technical_measures"),
	organisationalMeasures: text("organisational_measures"),
	countrySpecificMeasures: text("country_specific_measures"),
	signatureDate: date("signature_date"),
	effectiveDate: date("effective_date"),
	terminationDate: date("termination_date"),
	signedByExporter: varchar("signed_by_exporter"),
	signedByImporter: varchar("signed_by_importer"),
	monitoringRequired: boolean("monitoring_required").default(true),
	lastMonitoringDate: date("last_monitoring_date"),
	nextMonitoringDate: date("next_monitoring_date"),
	complianceStatus: varchar("compliance_status").default('compliant'),
	contractLocation: text("contract_location"),
	appendixDetails: text("appendix_details"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const adequacyDecisions = pgTable("adequacy_decisions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	countryCode: varchar("country_code").notNull(),
	countryName: varchar("country_name").notNull(),
	region: varchar(),
	status: adequacyDecisionStatus().notNull(),
	decisionType: varchar("decision_type"),
	adoptionDate: timestamp("adoption_date", { mode: 'string' }),
	effectiveDate: timestamp("effective_date", { mode: 'string' }),
	expiryDate: timestamp("expiry_date", { mode: 'string' }),
	decisionReference: varchar("decision_reference"),
	legalInstrument: varchar("legal_instrument"),
	scope: text(),
	limitations: text().array().default([""]),
	reviewDate: timestamp("review_date", { mode: 'string' }),
	reviewFrequency: varchar("review_frequency"),
	lastAssessmentDate: timestamp("last_assessment_date", { mode: 'string' }),
	nextAssessmentDate: timestamp("next_assessment_date", { mode: 'string' }),
	monitoringRequired: boolean("monitoring_required").default(true),
	monitoringAuthority: varchar("monitoring_authority"),
	reportingRequirements: text("reporting_requirements"),
	privacyLawAssessment: text("privacy_law_assessment"),
	surveillanceConcerns: text("surveillance_concerns"),
	ruleOfLawAssessment: text("rule_of_law_assessment"),
	enforcementMechanisms: text("enforcement_mechanisms"),
	decisionTextUrl: text("decision_text_url"),
	assessmentReportUrl: text("assessment_report_url"),
	implementationGuidance: text("implementation_guidance"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	unique("adequacy_decisions_country_code_key").on(table.countryCode),
]);
