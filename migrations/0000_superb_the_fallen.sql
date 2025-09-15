CREATE TYPE "public"."adequacy_decision_status" AS ENUM('adequate', 'inadequate', 'under_review', 'pending', 'transitional');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('not_started', 'in_progress', 'completed', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."billing_cadence" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."billing_model" AS ENUM('metered_per_active_user', 'per_seat', 'flat_subscription');--> statement-breakpoint
CREATE TYPE "public"."billing_status" AS ENUM('active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'trialing', 'paused');--> statement-breakpoint
CREATE TYPE "public"."breach_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."breach_status" AS ENUM('detected', 'assessed', 'notified_ico', 'notified_subjects', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."completion_status" AS ENUM('pass', 'fail');--> statement-breakpoint
CREATE TYPE "public"."compliance_document_status" AS ENUM('draft', 'pending_review', 'approved', 'published', 'archived', 'superseded', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."compliance_document_type" AS ENUM('privacy_policy', 'cookie_policy', 'data_protection_agreement', 'terms_of_service', 'children_privacy_notice', 'consent_notice', 'legitimate_interests_assessment', 'data_retention_policy', 'breach_notification_template', 'user_rights_information', 'international_transfer_notice', 'processor_agreement');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('granted', 'denied', 'withdrawn', 'pending');--> statement-breakpoint
CREATE TYPE "public"."cookie_category" AS ENUM('strictly_necessary', 'functional', 'analytics', 'advertising');--> statement-breakpoint
CREATE TYPE "public"."course_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."data_category" AS ENUM('identity', 'contact', 'financial', 'demographic', 'education', 'technical', 'usage', 'special');--> statement-breakpoint
CREATE TYPE "public"."data_lifecycle_status" AS ENUM('active', 'retention_pending', 'deletion_scheduled', 'soft_deleted', 'deletion_pending', 'securely_erased', 'archived', 'frozen');--> statement-breakpoint
CREATE TYPE "public"."document_generation_mode" AS ENUM('automatic', 'semi_automatic', 'manual', 'template_based');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('transfer_impact_assessment', 'data_protection_agreement', 'standard_contractual_clauses', 'international_data_transfer_agreement', 'binding_corporate_rules', 'adequacy_decision_document', 'supplementary_measures', 'transfer_approval_letter', 'due_diligence_report', 'cessation_plan');--> statement-breakpoint
CREATE TYPE "public"."email_provider" AS ENUM('smtp_generic', 'sendgrid_api', 'brevo_api', 'mailgun_api', 'postmark_api', 'mailjet_api', 'sparkpost_api');--> statement-breakpoint
CREATE TYPE "public"."email_routing_source" AS ENUM('org_primary', 'org_fallback', 'system_default', 'mixed_config');--> statement-breakpoint
CREATE TYPE "public"."email_send_status" AS ENUM('pending', 'sent', 'failed', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."email_template_category" AS ENUM('admin', 'learner');--> statement-breakpoint
CREATE TYPE "public"."email_template_type" AS ENUM('welcome_account_created', 'course_assigned', 'course_reminder', 'course_overdue', 'training_expiring_soon', 'training_expired', 'course_completion_certificate', 'failed_attempt', 'password_reset', 'new_user_registered', 'user_completed_course', 'user_failed_course', 'staff_training_expiring', 'staff_training_expired', 'weekly_training_summary', 'smtp_test', 'system_test', 'new_user_welcome', 'admin.new_user_added', 'admin.new_admin_added', 'new_org_welcome', 'course_assigned_notification', 'course_completion_notification', 'course_failure_notification', 'plan_updated_notification');--> statement-breakpoint
CREATE TYPE "public"."email_trigger_event" AS ENUM('ORG_FAST_ADD', 'USER_FAST_ADD', 'COURSE_ASSIGNED', 'COURSE_COMPLETED', 'COURSE_FAILED', 'PLAN_UPDATED');--> statement-breakpoint
CREATE TYPE "public"."marketing_consent_type" AS ENUM('email', 'sms', 'phone', 'post', 'push_notifications');--> statement-breakpoint
CREATE TYPE "public"."organisation_status" AS ENUM('active', 'archived', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."price_change_policy" AS ENUM('prorate_immediately', 'at_period_end', 'manual');--> statement-breakpoint
CREATE TYPE "public"."processing_lawful_basis" AS ENUM('consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests');--> statement-breakpoint
CREATE TYPE "public"."retention_data_type" AS ENUM('user_profile', 'user_authentication', 'course_progress', 'certificates', 'communications', 'audit_logs', 'support_tickets', 'billing_records', 'consent_records', 'analytics_data', 'uploaded_files', 'system_logs', 'backup_data');--> statement-breakpoint
CREATE TYPE "public"."retention_deletion_method" AS ENUM('soft', 'hard');--> statement-breakpoint
CREATE TYPE "public"."retention_policy_trigger" AS ENUM('time_based', 'event_based', 'consent_withdrawal', 'account_deletion', 'contract_termination', 'manual_request', 'legal_obligation');--> statement-breakpoint
CREATE TYPE "public"."retention_schedule_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."scorm_attempt_status" AS ENUM('not_started', 'in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."scorm_standard" AS ENUM('1.2', '2004');--> statement-breakpoint
CREATE TYPE "public"."secure_erase_method" AS ENUM('simple_delete', 'overwrite_once', 'overwrite_multiple', 'cryptographic_erase', 'physical_destruction');--> statement-breakpoint
CREATE TYPE "public"."tax_behavior" AS ENUM('inclusive', 'exclusive');--> statement-breakpoint
CREATE TYPE "public"."tia_status" AS ENUM('draft', 'under_review', 'approved', 'rejected', 'requires_revision', 'expired', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('technical', 'billing', 'account', 'training', 'feature_request', 'bug_report', 'general');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."transfer_frequency" AS ENUM('continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'ad_hoc', 'event_driven');--> statement-breakpoint
CREATE TYPE "public"."transfer_legal_basis" AS ENUM('adequacy_decision', 'appropriate_safeguards', 'binding_corporate_rules', 'approved_code_conduct', 'approved_certification', 'specific_situation', 'explicit_consent', 'contract_performance', 'public_interest', 'legal_claims', 'vital_interests', 'public_register');--> statement-breakpoint
CREATE TYPE "public"."transfer_mechanism_type" AS ENUM('adequacy_decision', 'standard_contractual_clauses', 'international_data_transfer_agreement', 'binding_corporate_rules', 'approved_certification_scheme', 'approved_code_conduct', 'ad_hoc_contractual_clauses', 'no_mechanism_required');--> statement-breakpoint
CREATE TYPE "public"."transfer_risk_level" AS ENUM('low', 'medium', 'high', 'very_high', 'prohibited');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('active', 'suspended', 'terminated', 'under_review', 'pending_approval', 'non_compliant', 'migrating_mechanism');--> statement-breakpoint
CREATE TYPE "public"."transfer_type" AS ENUM('customer_data', 'employee_data', 'supplier_data', 'marketing_data', 'technical_data', 'financial_data', 'health_data', 'biometric_data', 'other_special_category');--> statement-breakpoint
CREATE TYPE "public"."user_right_status" AS ENUM('pending', 'in_progress', 'completed', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."user_right_type" AS ENUM('access', 'rectification', 'erasure', 'restriction', 'objection', 'portability');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "adequacy_decisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar NOT NULL,
	"country_name" varchar NOT NULL,
	"region" varchar,
	"status" "adequacy_decision_status" NOT NULL,
	"decision_type" varchar,
	"adoption_date" timestamp,
	"effective_date" timestamp,
	"expiry_date" timestamp,
	"decision_reference" varchar,
	"legal_instrument" varchar,
	"scope" text,
	"limitations" text[] DEFAULT '{}',
	"review_date" timestamp,
	"review_frequency" varchar,
	"last_assessment_date" timestamp,
	"next_assessment_date" timestamp,
	"risk_factors" text[] DEFAULT '{}',
	"risk_level" "transfer_risk_level" DEFAULT 'medium' NOT NULL,
	"government_access" text,
	"data_subject_rights" text,
	"change_history" jsonb DEFAULT '[]'::jsonb,
	"source_url" varchar,
	"document_url" varchar,
	"last_updated" timestamp DEFAULT now(),
	"data_source" varchar DEFAULT 'manual',
	"transfers_using_decision" integer DEFAULT 0,
	"organisations_affected" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "idx_adequacy_decisions_country_code_unique" UNIQUE("country_code")
);
--> statement-breakpoint
CREATE TABLE "age_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organisation_id" varchar NOT NULL,
	"date_of_birth" timestamp,
	"age_verified" boolean DEFAULT false NOT NULL,
	"parental_consent_required" boolean DEFAULT false NOT NULL,
	"parental_consent_given" boolean DEFAULT false NOT NULL,
	"parent_email" varchar,
	"parent_name" varchar,
	"verification_method" varchar NOT NULL,
	"verified_at" timestamp,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "age_verifications_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"organisation_id" varchar NOT NULL,
	"due_date" timestamp,
	"status" "assignment_status" DEFAULT 'not_started' NOT NULL,
	"assigned_by" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"started_at" timestamp,
	"completed_at" timestamp,
	"notifications_enabled" boolean DEFAULT true,
	CONSTRAINT "assignments_user_course_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"user_id" varchar,
	"action" varchar NOT NULL,
	"resource" varchar,
	"resource_id" varchar,
	"details" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "billing_locks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lock_type" varchar NOT NULL,
	"resource_id" varchar NOT NULL,
	"locked_by" varchar NOT NULL,
	"lock_reason" varchar,
	"expires_at" timestamp NOT NULL,
	"acquired_at" timestamp DEFAULT now(),
	"renewed_at" timestamp,
	"queue_position" integer,
	"correlation_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_billing_lock" UNIQUE("lock_type","resource_id")
);
--> statement-breakpoint
CREATE TABLE "certificate_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"template" text,
	"template_format" varchar DEFAULT 'html',
	"template_data" jsonb,
	"is_default" boolean DEFAULT false,
	"organisation_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"completion_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"course_id" varchar NOT NULL,
	"organisation_id" varchar NOT NULL,
	"certificate_url" varchar,
	"expiry_date" timestamp,
	"issued_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "completions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"course_id" varchar NOT NULL,
	"organisation_id" varchar NOT NULL,
	"score" numeric(5, 2),
	"status" "completion_status" NOT NULL,
	"attempt_number" integer DEFAULT 1,
	"time_spent" integer,
	"scorm_data" jsonb,
	"completed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_document_audit" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"document_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"action_by" varchar NOT NULL,
	"action_details" text,
	"changes_summary" text,
	"previous_version" varchar,
	"new_version" varchar,
	"content_changes" jsonb DEFAULT '{}',
	"compliance_notes" text,
	"legal_review_required" boolean DEFAULT false,
	"risk_assessment" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}',
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_document_publications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"document_id" varchar NOT NULL,
	"is_public" boolean DEFAULT true,
	"public_url" varchar,
	"password_protected" boolean DEFAULT false,
	"access_password" varchar,
	"meta_title" varchar,
	"meta_description" text,
	"keywords" text[] DEFAULT '{}',
	"canonical_url" varchar,
	"show_last_updated" boolean DEFAULT true,
	"show_version" boolean DEFAULT true,
	"show_contact_info" boolean DEFAULT true,
	"custom_styling" text,
	"allowed_domains" text[] DEFAULT '{}',
	"ip_whitelist" text[] DEFAULT '{}',
	"requires_authentication" boolean DEFAULT false,
	"view_count" integer DEFAULT 0,
	"download_count" integer DEFAULT 0,
	"last_accessed" timestamp,
	"is_active" boolean DEFAULT true,
	"published_at" timestamp,
	"unpublished_at" timestamp,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "compliance_document_publications_public_url_unique" UNIQUE("public_url"),
	CONSTRAINT "unique_compliance_document_publication" UNIQUE("document_id")
);
--> statement-breakpoint
CREATE TABLE "compliance_document_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"document_type" "compliance_document_type" NOT NULL,
	"template_key" varchar NOT NULL,
	"content" text NOT NULL,
	"html_content" text,
	"variables" jsonb DEFAULT '[]',
	"required_data" jsonb DEFAULT '[]',
	"legal_basis" text[] DEFAULT '{}',
	"regulatory_compliance" text[] DEFAULT '{}',
	"applicable_jurisdictions" text[] DEFAULT '{"UK"}',
	"version" varchar DEFAULT '1.0' NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"last_legal_review" timestamp,
	"next_legal_review" timestamp,
	"usage_count" integer DEFAULT 0,
	"rating" numeric(3, 2),
	"allow_customization" boolean DEFAULT true,
	"customization_guidelines" text,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"reviewed_by" varchar,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "compliance_document_templates_template_key_unique" UNIQUE("template_key")
);
--> statement-breakpoint
CREATE TABLE "compliance_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"document_type" "compliance_document_type" NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"document_reference" varchar,
	"content" text NOT NULL,
	"html_content" text,
	"plain_text_content" text,
	"generation_mode" "document_generation_mode" DEFAULT 'automatic' NOT NULL,
	"template_id" varchar,
	"version" varchar DEFAULT '1.0' NOT NULL,
	"version_notes" text,
	"is_current_version" boolean DEFAULT true NOT NULL,
	"parent_document_id" varchar,
	"status" "compliance_document_status" DEFAULT 'draft' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"published_at" timestamp,
	"expires_at" timestamp,
	"legal_basis" "processing_lawful_basis",
	"regulatory_requirements" text[] DEFAULT '{}',
	"applicable_laws" text[] DEFAULT '{}',
	"last_review_date" timestamp,
	"next_review_date" timestamp,
	"review_frequency" integer DEFAULT 365,
	"word_count" integer,
	"reading_time" integer,
	"language" varchar DEFAULT 'en',
	"public_url" varchar,
	"download_url" varchar,
	"data_snapshot" jsonb DEFAULT '{}',
	"privacy_settings_used" jsonb DEFAULT '{}',
	"processing_activities_used" jsonb DEFAULT '[]',
	"last_auto_generated" timestamp,
	"requires_regeneration" boolean DEFAULT false,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"last_modified_by" varchar,
	"metadata" jsonb DEFAULT '{}',
	"tags" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_current_compliance_document" UNIQUE("organisation_id","document_type","is_current_version")
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organisation_id" varchar NOT NULL,
	"consent_type" varchar NOT NULL,
	"status" "consent_status" NOT NULL,
	"lawful_basis" "processing_lawful_basis" NOT NULL,
	"purpose" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar NOT NULL,
	"user_agent" text NOT NULL,
	"policy_version" varchar NOT NULL,
	"withdrawn_at" timestamp,
	"expires_at" timestamp,
	"marketing_consents" jsonb DEFAULT '{}' NOT NULL,
	"cookie_consents" jsonb DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cookie_inventory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"purpose" text NOT NULL,
	"category" "cookie_category" NOT NULL,
	"duration" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"domain" varchar NOT NULL,
	"essential" boolean DEFAULT false NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "course_folders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"color" varchar DEFAULT '#3b82f6',
	"icon" varchar DEFAULT 'fas fa-folder',
	"sort_order" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"folder_id" varchar,
	"scorm_package_url" varchar,
	"cover_image_url" varchar,
	"estimated_duration" integer,
	"passmark" integer DEFAULT 80,
	"category" varchar,
	"tags" text,
	"certificate_expiry_period" integer,
	"launch_url_override" varchar(500),
	"scorm_version" varchar(10),
	"scorm_organizations" jsonb,
	"default_organization" varchar(191),
	"status" "course_status" DEFAULT 'draft' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_breaches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"severity" "breach_severity" NOT NULL,
	"status" "breach_status" DEFAULT 'detected' NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"reported_at" timestamp,
	"ico_notified_at" timestamp,
	"subjects_notified_at" timestamp,
	"affected_subjects" integer DEFAULT 0 NOT NULL,
	"data_categories" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"cause" text NOT NULL,
	"impact" text NOT NULL,
	"containment_measures" text NOT NULL,
	"preventive_measures" text NOT NULL,
	"notification_deadline" timestamp NOT NULL,
	"responsible" varchar NOT NULL,
	"attachments" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_lifecycle_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"data_type" "retention_data_type" NOT NULL,
	"resource_id" varchar NOT NULL,
	"resource_table" varchar NOT NULL,
	"status" "data_lifecycle_status" DEFAULT 'active' NOT NULL,
	"policy_id" varchar NOT NULL,
	"data_created_at" timestamp NOT NULL,
	"retention_eligible_at" timestamp NOT NULL,
	"soft_delete_scheduled_at" timestamp,
	"soft_deleted_at" timestamp,
	"secure_erase_scheduled_at" timestamp,
	"secure_erased_at" timestamp,
	"archived_at" timestamp,
	"frozen_at" timestamp,
	"deletion_reason" text,
	"deletion_method" "retention_deletion_method",
	"secure_erase_method" "secure_erase_method",
	"deletion_confirmation" varchar,
	"compliance_certificate" varchar,
	"last_processed_at" timestamp,
	"processing_errors" jsonb DEFAULT '[]' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_retention_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text NOT NULL,
	"data_type" "retention_data_type" NOT NULL,
	"retention_period" integer NOT NULL,
	"grace_period" integer DEFAULT 30 NOT NULL,
	"deletion_method" "retention_deletion_method" DEFAULT 'soft' NOT NULL,
	"secure_erase_method" "secure_erase_method" DEFAULT 'overwrite_multiple' NOT NULL,
	"trigger_type" "retention_policy_trigger" DEFAULT 'time_based' NOT NULL,
	"legal_basis" "processing_lawful_basis" NOT NULL,
	"regulatory_requirement" text,
	"priority" integer DEFAULT 100 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"automatic_deletion" boolean DEFAULT true NOT NULL,
	"requires_manual_review" boolean DEFAULT false NOT NULL,
	"notification_settings" jsonb DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar,
	"provider" "email_provider" NOT NULL,
	"from_email" varchar NOT NULL,
	"to_email" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"template_type" "email_template_type",
	"http_status" integer,
	"smtp_status" varchar,
	"endpoint" varchar,
	"message_id" varchar,
	"status" varchar NOT NULL,
	"error_short" varchar,
	"error_raw" text,
	"key_preview" varchar,
	"key_length" integer,
	"effective_field_sources" jsonb,
	"routing_source" "email_routing_source",
	"timestamp" timestamp DEFAULT now(),
	"smtp_host" varchar,
	"smtp_port" integer,
	"tls_used" boolean,
	"used_org_settings" boolean DEFAULT false,
	"fallback_used" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "email_provider_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar,
	"provider" "email_provider" NOT NULL,
	"config_json" jsonb NOT NULL,
	"is_default_for_org" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_sends" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" varchar NOT NULL,
	"trigger_event" "email_trigger_event" NOT NULL,
	"organisation_id" varchar,
	"template_key" varchar NOT NULL,
	"to_email" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"html_content" text NOT NULL,
	"text_content" text,
	"template_variables" jsonb,
	"status" "email_send_status" DEFAULT 'pending' NOT NULL,
	"provider" "email_provider",
	"provider_message_id" varchar,
	"error_message" text,
	"error_code" varchar,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"last_attempt_at" timestamp,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"from_email" varchar,
	"from_name" varchar,
	"reply_to" varchar,
	"routing_source" "email_routing_source",
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "email_sends_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "unique_email_send_idempotency" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "email_settings_lock" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lock_type" varchar NOT NULL,
	"resource_id" varchar NOT NULL,
	"locked_by" varchar NOT NULL,
	"lock_reason" varchar,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_email_lock" UNIQUE("lock_type","resource_id")
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"name" varchar NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"mjml" text NOT NULL,
	"text" text,
	"variables_schema" jsonb,
	"category" "email_template_category" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "email_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "gdpr_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"user_id" varchar,
	"admin_id" varchar,
	"action" varchar NOT NULL,
	"resource" varchar NOT NULL,
	"resource_id" varchar NOT NULL,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"ip_address" varchar NOT NULL,
	"user_agent" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "international_transfers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"transfer_name" varchar NOT NULL,
	"transfer_description" text,
	"transfer_reference" varchar,
	"transfer_type" "transfer_type" NOT NULL,
	"data_categories" text[] NOT NULL,
	"data_subject_categories" text[] NOT NULL,
	"special_categories" boolean DEFAULT false,
	"origin_country" varchar DEFAULT 'GB' NOT NULL,
	"destination_country" varchar NOT NULL,
	"recipient" varchar NOT NULL,
	"recipient_contact" text,
	"transfer_purpose" text NOT NULL,
	"legal_basis" "transfer_legal_basis" NOT NULL,
	"transfer_mechanism" "transfer_mechanism_type" NOT NULL,
	"mechanism_reference" varchar,
	"transfer_frequency" "transfer_frequency" NOT NULL,
	"volume_description" text,
	"retention_period" integer,
	"transfer_start" timestamp,
	"transfer_end" timestamp,
	"risk_level" "transfer_risk_level" NOT NULL,
	"risk_assessment_date" timestamp,
	"risk_assessment_by" varchar,
	"compliance_notes" text,
	"transfer_impact_assessment_id" varchar,
	"status" "transfer_status" DEFAULT 'pending_approval' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"review_due" timestamp,
	"last_review_date" timestamp,
	"next_review_date" timestamp,
	"alerts_enabled" boolean DEFAULT true,
	"documents" jsonb DEFAULT '[]'::jsonb,
	"technical_safeguards" text[] DEFAULT '{}',
	"organisational_safeguards" text[] DEFAULT '{}',
	"supplementary_measures" text,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org_email_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"template_key" varchar NOT NULL,
	"subject_override" text,
	"html_override" text,
	"mjml_override" text,
	"text_override" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_org_email_template" UNIQUE("org_id","template_key")
);
--> statement-breakpoint
CREATE TABLE "org_notification_settings" (
	"org_id" varchar PRIMARY KEY NOT NULL,
	"send_to_admins" boolean DEFAULT true,
	"extra_recipients" jsonb,
	"email_provider_config_id" varchar,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisation_course_folders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"folder_id" varchar NOT NULL,
	"granted_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organisation_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"signature_image_url" varchar,
	"signer_name" varchar,
	"signer_title" varchar,
	"certificate_text" text DEFAULT 'has successfully completed',
	"assignment_emails_enabled" boolean DEFAULT true,
	"reminder_emails_enabled" boolean DEFAULT true,
	"completion_emails_enabled" boolean DEFAULT true,
	"reminder_days" integer DEFAULT 7,
	"default_certificate_download" boolean DEFAULT false,
	"email_provider" "email_provider",
	"from_name" varchar,
	"from_email" varchar,
	"reply_to" varchar,
	"smtp_host" varchar,
	"smtp_port" integer,
	"smtp_username" varchar,
	"smtp_password" varchar,
	"smtp_secure" boolean,
	"api_key" varchar,
	"api_secret" varchar,
	"api_base_url" varchar,
	"api_domain" varchar,
	"api_region" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organisation_settings_organisation_id_unique" UNIQUE("organisation_id")
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"subdomain" varchar NOT NULL,
	"logo_url" varchar,
	"theme" varchar DEFAULT 'light',
	"accent_color" varchar DEFAULT '#3b82f6',
	"primary_color" varchar DEFAULT '#3b82f6',
	"use_custom_colors" boolean DEFAULT false,
	"contact_email" varchar,
	"contact_phone" varchar,
	"address" text,
	"status" "organisation_status" DEFAULT 'active' NOT NULL,
	"plan_id" varchar,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"stripe_subscription_item_id" varchar,
	"billing_status" "billing_status",
	"active_user_count" integer DEFAULT 0,
	"current_period_end" timestamp,
	"last_billing_sync" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organisations_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE "plan_feature_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"feature_id" varchar NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plan_features" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"category" varchar,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "plan_features_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"billing_model" "billing_model" NOT NULL,
	"cadence" "billing_cadence" DEFAULT 'monthly' NOT NULL,
	"currency" varchar(3) DEFAULT 'GBP' NOT NULL,
	"unit_amount" integer NOT NULL,
	"tax_behavior" "tax_behavior" DEFAULT 'exclusive' NOT NULL,
	"trial_days" integer,
	"min_seats" integer,
	"stripe_product_id" varchar,
	"stripe_price_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"price_change_policy" "price_change_policy" DEFAULT 'prorate_immediately' NOT NULL,
	"price_per_user" numeric(10, 2),
	"status" "plan_status" DEFAULT 'active' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"value" text,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "privacy_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"data_retention_period" integer DEFAULT 2555 NOT NULL,
	"cookie_settings" jsonb DEFAULT '{}' NOT NULL,
	"privacy_contacts" jsonb DEFAULT '{}' NOT NULL,
	"international_transfers" jsonb DEFAULT '{}' NOT NULL,
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "privacy_settings_organisation_id_unique" UNIQUE("organisation_id")
);
--> statement-breakpoint
CREATE TABLE "processing_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"purpose" text NOT NULL,
	"description" text NOT NULL,
	"lawful_basis" "processing_lawful_basis" NOT NULL,
	"data_categories" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"data_subjects" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"recipients" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"international_transfers" boolean DEFAULT false NOT NULL,
	"transfer_countries" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"retention_period" varchar NOT NULL,
	"security_measures" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"dpia" jsonb DEFAULT '{"required": false, "completed": false}' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "retention_compliance_audits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"audit_date" timestamp DEFAULT now() NOT NULL,
	"policy_id" varchar NOT NULL,
	"data_type" "retention_data_type" NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"compliant_records" integer DEFAULT 0 NOT NULL,
	"overdue_records" integer DEFAULT 0 NOT NULL,
	"error_records" integer DEFAULT 0 NOT NULL,
	"processed_records" integer DEFAULT 0 NOT NULL,
	"average_retention_period" integer,
	"longest_retention_period" integer,
	"oldest_record" timestamp,
	"compliance_rate" numeric(5, 2),
	"is_compliant" boolean DEFAULT true NOT NULL,
	"risk_level" varchar DEFAULT 'low' NOT NULL,
	"issues" jsonb DEFAULT '[]' NOT NULL,
	"recommendations" jsonb DEFAULT '[]' NOT NULL,
	"audit_notes" text,
	"audit_performed_by" varchar,
	"audit_duration" integer,
	"next_audit_due" timestamp,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "retention_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text NOT NULL,
	"data_type" varchar NOT NULL,
	"retention_period" integer NOT NULL,
	"deletion_method" "retention_deletion_method" DEFAULT 'soft' NOT NULL,
	"legal_basis" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "retention_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"data_type" varchar NOT NULL,
	"scheduled_deletion" timestamp NOT NULL,
	"status" "retention_schedule_status" DEFAULT 'scheduled' NOT NULL,
	"retention_rule_id" varchar NOT NULL,
	"processed_at" timestamp,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scorm_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" varchar NOT NULL,
	"assignment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"course_id" varchar NOT NULL,
	"organisation_id" varchar NOT NULL,
	"item_id" varchar,
	"scorm_version" varchar(10) NOT NULL,
	"status" "scorm_attempt_status" DEFAULT 'not_started',
	"lesson_status" varchar,
	"lesson_location" text,
	"completion_status" varchar,
	"success_status" varchar,
	"location" text,
	"progress_measure" numeric(5, 4),
	"score_raw" numeric(7, 2),
	"score_scaled" numeric(5, 4),
	"score_min" numeric(7, 2),
	"score_max" numeric(7, 2),
	"session_time" varchar,
	"suspend_data" text,
	"progress_percent" integer DEFAULT 0,
	"passed" boolean DEFAULT false,
	"completed" boolean DEFAULT false,
	"passmark" integer,
	"is_active" boolean DEFAULT true,
	"last_commit_at" timestamp,
	"finished_at" timestamp,
	"certificate_url" varchar,
	"certificate_generated_at" timestamp,
	"raw_scorm_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "scorm_attempts_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
CREATE TABLE "secure_deletion_certificates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"certificate_number" varchar NOT NULL,
	"user_id" varchar,
	"data_types" text[] NOT NULL,
	"record_count" integer NOT NULL,
	"deletion_method" "secure_erase_method" NOT NULL,
	"deletion_started" timestamp NOT NULL,
	"deletion_completed" timestamp NOT NULL,
	"verification_hash" varchar NOT NULL,
	"witnessed_by" varchar,
	"verification_method" varchar NOT NULL,
	"legal_basis" "processing_lawful_basis" NOT NULL,
	"regulatory_requirement" text,
	"request_origin" varchar NOT NULL,
	"request_reference" varchar,
	"certificate_template" varchar DEFAULT 'standard',
	"certificate_url" varchar,
	"digital_signature" text,
	"valid_until" timestamp,
	"deletion_reason" text NOT NULL,
	"compliance_notes" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "secure_deletion_certificates_certificate_number_unique" UNIQUE("certificate_number")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standard_contractual_clauses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"transfer_mechanism_id" varchar NOT NULL,
	"scc_type" varchar NOT NULL,
	"scc_version" varchar NOT NULL,
	"adoption_decision" varchar,
	"data_exporter" jsonb,
	"data_importer" jsonb,
	"transfer_details" jsonb,
	"module_one" boolean DEFAULT false,
	"module_two" boolean DEFAULT false,
	"module_three" boolean DEFAULT false,
	"module_four" boolean DEFAULT false,
	"annex_one" jsonb,
	"annex_two" text,
	"annex_three" text,
	"execution_date" timestamp,
	"executed_by" varchar,
	"digital_signature" boolean DEFAULT false,
	"signature_details" jsonb,
	"last_review_date" timestamp,
	"next_review_date" timestamp,
	"compliance_issues" text[] DEFAULT '{}',
	"remedial_actions" text[] DEFAULT '{}',
	"original_document" varchar,
	"amendment_history" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"termination_date" timestamp,
	"termination_reason" text,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "support_ticket_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"is_internal" boolean DEFAULT false,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" varchar(20) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"category" "ticket_category" DEFAULT 'general' NOT NULL,
	"created_by" varchar NOT NULL,
	"assigned_to" varchar,
	"organisation_id" varchar,
	"is_read" boolean DEFAULT false,
	"last_response_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "support_tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "system_email_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_provider" "email_provider" NOT NULL,
	"from_name" varchar NOT NULL,
	"from_email" varchar NOT NULL,
	"reply_to" varchar,
	"smtp_host" varchar,
	"smtp_port" integer,
	"smtp_username" varchar,
	"smtp_password" varchar,
	"smtp_secure" boolean,
	"api_key" varchar,
	"api_secret" varchar,
	"api_base_url" varchar,
	"api_domain" varchar,
	"api_region" varchar,
	"is_active" boolean DEFAULT true,
	"description" text,
	"updated_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "todo_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"task" text NOT NULL,
	"completed" boolean DEFAULT false,
	"order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transfer_impact_assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"tia_reference" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"data_categories" text[] NOT NULL,
	"data_subject_categories" text[] NOT NULL,
	"transfer_purpose" text NOT NULL,
	"origin_country" varchar DEFAULT 'GB' NOT NULL,
	"destination_country" varchar NOT NULL,
	"recipient" varchar NOT NULL,
	"proposed_mechanism" "transfer_mechanism_type" NOT NULL,
	"country_risk_score" integer,
	"recipient_risk_score" integer,
	"data_risk_score" integer,
	"overall_risk_score" integer,
	"risk_level" "transfer_risk_level" NOT NULL,
	"identified_risks" jsonb DEFAULT '[]'::jsonb,
	"existing_safeguards" text[] DEFAULT '{}',
	"proposed_safeguards" text[] DEFAULT '{}',
	"supplementary_measures" text,
	"safeguards_effectiveness" varchar,
	"lawful_basis_assessment" text,
	"recipient_legal_framework" text,
	"government_access_risks" text,
	"data_subject_rights" text,
	"recommendation" varchar,
	"conditional_requirements" text,
	"decision_rationale" text,
	"status" "tia_status" DEFAULT 'draft' NOT NULL,
	"submitted_by" varchar,
	"submitted_at" timestamp,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"approved_by" varchar,
	"approved_at" timestamp,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"review_required" boolean DEFAULT true,
	"next_review_date" timestamp,
	"stakeholders_consulted" text[] DEFAULT '{}',
	"consultation_notes" text,
	"documents" jsonb DEFAULT '[]'::jsonb,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "idx_transfer_impact_assessments_org_reference_unique" UNIQUE("organisation_id","tia_reference")
);
--> statement-breakpoint
CREATE TABLE "transfer_mechanisms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" varchar NOT NULL,
	"mechanism_type" "transfer_mechanism_type" NOT NULL,
	"mechanism_name" varchar NOT NULL,
	"mechanism_reference" varchar,
	"description" text,
	"applicable_countries" text[] DEFAULT '{}',
	"data_categories" text[] DEFAULT '{}',
	"legal_framework" text,
	"regulatory_approval" boolean DEFAULT false,
	"approval_authority" varchar,
	"approval_date" timestamp,
	"approval_reference" varchar,
	"effective_from" timestamp,
	"effective_until" timestamp,
	"auto_renewal" boolean DEFAULT false,
	"renewal_terms" text,
	"implementation_guidance" text,
	"mandatory_provisions" text[] DEFAULT '{}',
	"optional_provisions" text[] DEFAULT '{}',
	"compliance_requirements" text[] DEFAULT '{}',
	"monitoring_frequency" varchar,
	"last_audit_date" timestamp,
	"next_audit_date" timestamp,
	"transfers_using_mechanism" integer DEFAULT 0,
	"last_used_date" timestamp,
	"document_templates" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"is_deprecated" boolean DEFAULT false,
	"deprecation_notice" text,
	"replaced_by" varchar,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "idx_transfer_mechanisms_org_name_unique" UNIQUE("organisation_id","mechanism_name")
);
--> statement-breakpoint
CREATE TABLE "user_right_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organisation_id" varchar NOT NULL,
	"type" "user_right_type" NOT NULL,
	"status" "user_right_status" DEFAULT 'pending' NOT NULL,
	"description" text NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp,
	"processed_at" timestamp,
	"completed_at" timestamp,
	"rejection_reason" text,
	"admin_notes" text DEFAULT '' NOT NULL,
	"attachments" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"password_hash" varchar,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"organisation_id" varchar,
	"job_title" varchar,
	"department" varchar,
	"phone" varchar,
	"bio" text,
	"allow_certificate_download" boolean DEFAULT false,
	"requires_password_change" boolean DEFAULT false,
	"last_active" timestamp,
	"stripe_customer_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"processed_at" timestamp DEFAULT now(),
	"success" boolean NOT NULL,
	"error_message" text,
	"correlation_id" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "webhook_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE INDEX "idx_adequacy_decisions_country_code" ON "adequacy_decisions" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "idx_adequacy_decisions_status" ON "adequacy_decisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_adequacy_decisions_risk_level" ON "adequacy_decisions" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "idx_adequacy_decisions_expiry_date" ON "adequacy_decisions" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "idx_adequacy_decisions_review_date" ON "adequacy_decisions" USING btree ("review_date");--> statement-breakpoint
CREATE INDEX "idx_age_verifications_user_id" ON "age_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_age_verifications_organisation_id" ON "age_verifications" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_age_verifications_age_verified" ON "age_verifications" USING btree ("age_verified");--> statement-breakpoint
CREATE INDEX "idx_age_verifications_parental_consent_required" ON "age_verifications" USING btree ("parental_consent_required");--> statement-breakpoint
CREATE INDEX "idx_billing_lock_resource" ON "billing_locks" USING btree ("lock_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_billing_lock_expires" ON "billing_locks" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_billing_lock_queue" ON "billing_locks" USING btree ("lock_type","resource_id","queue_position");--> statement-breakpoint
CREATE INDEX "idx_billing_lock_correlation" ON "billing_locks" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_audit_organisation_id" ON "compliance_document_audit" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_audit_document_id" ON "compliance_document_audit" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_audit_action" ON "compliance_document_audit" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_audit_action_by" ON "compliance_document_audit" USING btree ("action_by");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_audit_timestamp" ON "compliance_document_audit" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_audit_legal_review_required" ON "compliance_document_audit" USING btree ("legal_review_required");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_publications_organisation_id" ON "compliance_document_publications" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_publications_document_id" ON "compliance_document_publications" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_publications_public_url" ON "compliance_document_publications" USING btree ("public_url");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_publications_is_public" ON "compliance_document_publications" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_publications_is_active" ON "compliance_document_publications" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_publications_published_at" ON "compliance_document_publications" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_templates_document_type" ON "compliance_document_templates" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_templates_template_key" ON "compliance_document_templates" USING btree ("template_key");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_templates_is_default" ON "compliance_document_templates" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_templates_is_active" ON "compliance_document_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_compliance_document_templates_next_legal_review" ON "compliance_document_templates" USING btree ("next_legal_review");--> statement-breakpoint
CREATE INDEX "idx_compliance_documents_organisation_id" ON "compliance_documents" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_documents_document_type" ON "compliance_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_compliance_documents_status" ON "compliance_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_compliance_documents_is_current_version" ON "compliance_documents" USING btree ("is_current_version");--> statement-breakpoint
CREATE INDEX "idx_compliance_documents_published_at" ON "compliance_documents" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_compliance_documents_expires_at" ON "compliance_documents" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_compliance_documents_next_review_date" ON "compliance_documents" USING btree ("next_review_date");--> statement-breakpoint
CREATE INDEX "idx_compliance_documents_requires_regeneration" ON "compliance_documents" USING btree ("requires_regeneration");--> statement-breakpoint
CREATE INDEX "idx_compliance_documents_parent_document_id" ON "compliance_documents" USING btree ("parent_document_id");--> statement-breakpoint
CREATE INDEX "idx_consent_records_user_id" ON "consent_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_consent_records_organisation_id" ON "consent_records" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_consent_records_status" ON "consent_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_consent_records_timestamp" ON "consent_records" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_cookie_inventory_organisation_id" ON "cookie_inventory" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_cookie_inventory_category" ON "cookie_inventory" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_cookie_inventory_essential" ON "cookie_inventory" USING btree ("essential");--> statement-breakpoint
CREATE INDEX "idx_data_breaches_organisation_id" ON "data_breaches" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_data_breaches_severity" ON "data_breaches" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_data_breaches_status" ON "data_breaches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_data_breaches_detected_at" ON "data_breaches" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "idx_data_breaches_notification_deadline" ON "data_breaches" USING btree ("notification_deadline");--> statement-breakpoint
CREATE INDEX "idx_data_lifecycle_records_organisation_id" ON "data_lifecycle_records" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_data_lifecycle_records_user_id" ON "data_lifecycle_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_data_lifecycle_records_data_type" ON "data_lifecycle_records" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "idx_data_lifecycle_records_status" ON "data_lifecycle_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_data_lifecycle_records_policy_id" ON "data_lifecycle_records" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "idx_data_lifecycle_records_resource" ON "data_lifecycle_records" USING btree ("resource_table","resource_id");--> statement-breakpoint
CREATE INDEX "idx_data_lifecycle_records_retention_eligible" ON "data_lifecycle_records" USING btree ("retention_eligible_at");--> statement-breakpoint
CREATE INDEX "idx_data_lifecycle_records_soft_delete_scheduled" ON "data_lifecycle_records" USING btree ("soft_delete_scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_data_lifecycle_records_secure_erase_scheduled" ON "data_lifecycle_records" USING btree ("secure_erase_scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_data_lifecycle_processing" ON "data_lifecycle_records" USING btree ("status","last_processed_at");--> statement-breakpoint
CREATE INDEX "idx_data_retention_policies_organisation_id" ON "data_retention_policies" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_data_retention_policies_data_type" ON "data_retention_policies" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "idx_data_retention_policies_enabled" ON "data_retention_policies" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_data_retention_policies_trigger_type" ON "data_retention_policies" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "idx_data_retention_policies_priority" ON "data_retention_policies" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_data_retention_policies_automatic_deletion" ON "data_retention_policies" USING btree ("automatic_deletion");--> statement-breakpoint
CREATE INDEX "idx_email_provider_org" ON "email_provider_configs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_email_provider_default" ON "email_provider_configs" USING btree ("is_default_for_org");--> statement-breakpoint
CREATE INDEX "idx_email_sends_status" ON "email_sends" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_email_sends_trigger" ON "email_sends" USING btree ("trigger_event");--> statement-breakpoint
CREATE INDEX "idx_email_sends_org" ON "email_sends" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_email_sends_retry" ON "email_sends" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_email_sends_created" ON "email_sends" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_email_lock_resource" ON "email_settings_lock" USING btree ("lock_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_email_lock_expires" ON "email_settings_lock" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_email_template_key" ON "email_templates" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_email_template_category" ON "email_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_email_template_active" ON "email_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_gdpr_audit_logs_organisation_id" ON "gdpr_audit_logs" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_gdpr_audit_logs_user_id" ON "gdpr_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gdpr_audit_logs_admin_id" ON "gdpr_audit_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_gdpr_audit_logs_action" ON "gdpr_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_gdpr_audit_logs_resource" ON "gdpr_audit_logs" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "idx_gdpr_audit_logs_timestamp" ON "gdpr_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_international_transfers_organisation_id" ON "international_transfers" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_international_transfers_destination_country" ON "international_transfers" USING btree ("destination_country");--> statement-breakpoint
CREATE INDEX "idx_international_transfers_status" ON "international_transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_international_transfers_risk_level" ON "international_transfers" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "idx_international_transfers_review_due" ON "international_transfers" USING btree ("review_due");--> statement-breakpoint
CREATE INDEX "idx_international_transfers_transfer_type" ON "international_transfers" USING btree ("transfer_type");--> statement-breakpoint
CREATE INDEX "idx_international_transfers_legal_basis" ON "international_transfers" USING btree ("legal_basis");--> statement-breakpoint
CREATE INDEX "idx_international_transfers_created_by" ON "international_transfers" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_org_email_template_org" ON "org_email_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_org_email_template_key" ON "org_email_templates" USING btree ("template_key");--> statement-breakpoint
CREATE INDEX "idx_org_email_template_org_key" ON "org_email_templates" USING btree ("org_id","template_key");--> statement-breakpoint
CREATE INDEX "idx_organisation_billing_status" ON "organisations" USING btree ("billing_status");--> statement-breakpoint
CREATE INDEX "idx_organisation_stripe_customer" ON "organisations" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_organisation_subscription" ON "organisations" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_privacy_settings_organisation_id" ON "privacy_settings" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_processing_activities_organisation_id" ON "processing_activities" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_processing_activities_lawful_basis" ON "processing_activities" USING btree ("lawful_basis");--> statement-breakpoint
CREATE INDEX "idx_retention_compliance_audits_organisation_id" ON "retention_compliance_audits" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_retention_compliance_audits_policy_id" ON "retention_compliance_audits" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "idx_retention_compliance_audits_data_type" ON "retention_compliance_audits" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "idx_retention_compliance_audits_audit_date" ON "retention_compliance_audits" USING btree ("audit_date");--> statement-breakpoint
CREATE INDEX "idx_retention_compliance_audits_compliance" ON "retention_compliance_audits" USING btree ("is_compliant","compliance_rate");--> statement-breakpoint
CREATE INDEX "idx_retention_compliance_audits_risk_level" ON "retention_compliance_audits" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "idx_retention_compliance_audits_next_due" ON "retention_compliance_audits" USING btree ("next_audit_due");--> statement-breakpoint
CREATE INDEX "idx_retention_rules_organisation_id" ON "retention_rules" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_retention_rules_data_type" ON "retention_rules" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "idx_retention_rules_enabled" ON "retention_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_retention_schedules_organisation_id" ON "retention_schedules" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_retention_schedules_user_id" ON "retention_schedules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_retention_schedules_scheduled_deletion" ON "retention_schedules" USING btree ("scheduled_deletion");--> statement-breakpoint
CREATE INDEX "idx_retention_schedules_status" ON "retention_schedules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_retention_schedules_retention_rule_id" ON "retention_schedules" USING btree ("retention_rule_id");--> statement-breakpoint
CREATE INDEX "idx_secure_deletion_certificates_organisation_id" ON "secure_deletion_certificates" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_secure_deletion_certificates_certificate_number" ON "secure_deletion_certificates" USING btree ("certificate_number");--> statement-breakpoint
CREATE INDEX "idx_secure_deletion_certificates_user_id" ON "secure_deletion_certificates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_secure_deletion_certificates_deletion_completed" ON "secure_deletion_certificates" USING btree ("deletion_completed");--> statement-breakpoint
CREATE INDEX "idx_secure_deletion_certificates_request_origin" ON "secure_deletion_certificates" USING btree ("request_origin");--> statement-breakpoint
CREATE INDEX "idx_secure_deletion_certificates_legal_basis" ON "secure_deletion_certificates" USING btree ("legal_basis");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_standard_contractual_clauses_organisation_id" ON "standard_contractual_clauses" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_standard_contractual_clauses_transfer_mechanism_id" ON "standard_contractual_clauses" USING btree ("transfer_mechanism_id");--> statement-breakpoint
CREATE INDEX "idx_standard_contractual_clauses_scc_type" ON "standard_contractual_clauses" USING btree ("scc_type");--> statement-breakpoint
CREATE INDEX "idx_standard_contractual_clauses_execution_date" ON "standard_contractual_clauses" USING btree ("execution_date");--> statement-breakpoint
CREATE INDEX "idx_standard_contractual_clauses_next_review_date" ON "standard_contractual_clauses" USING btree ("next_review_date");--> statement-breakpoint
CREATE INDEX "idx_standard_contractual_clauses_is_active" ON "standard_contractual_clauses" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_transfer_impact_assessments_organisation_id" ON "transfer_impact_assessments" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_impact_assessments_destination_country" ON "transfer_impact_assessments" USING btree ("destination_country");--> statement-breakpoint
CREATE INDEX "idx_transfer_impact_assessments_status" ON "transfer_impact_assessments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_transfer_impact_assessments_risk_level" ON "transfer_impact_assessments" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "idx_transfer_impact_assessments_tia_reference" ON "transfer_impact_assessments" USING btree ("tia_reference");--> statement-breakpoint
CREATE INDEX "idx_transfer_impact_assessments_submitted_by" ON "transfer_impact_assessments" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "idx_transfer_impact_assessments_next_review_date" ON "transfer_impact_assessments" USING btree ("next_review_date");--> statement-breakpoint
CREATE INDEX "idx_transfer_mechanisms_organisation_id" ON "transfer_mechanisms" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_mechanisms_mechanism_type" ON "transfer_mechanisms" USING btree ("mechanism_type");--> statement-breakpoint
CREATE INDEX "idx_transfer_mechanisms_is_active" ON "transfer_mechanisms" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_transfer_mechanisms_effective_until" ON "transfer_mechanisms" USING btree ("effective_until");--> statement-breakpoint
CREATE INDEX "idx_transfer_mechanisms_next_audit_date" ON "transfer_mechanisms" USING btree ("next_audit_date");--> statement-breakpoint
CREATE INDEX "idx_user_right_requests_user_id" ON "user_right_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_right_requests_organisation_id" ON "user_right_requests" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "idx_user_right_requests_status" ON "user_right_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_right_requests_type" ON "user_right_requests" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_user_right_requests_requested_at" ON "user_right_requests" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_stripe_event_id" ON "webhook_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_processed_at" ON "webhook_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_event_type" ON "webhook_events" USING btree ("event_type");