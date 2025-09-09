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

// Users table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").notNull().default('user'),
  status: userStatusEnum("status").notNull().default('active'),
  organisationId: varchar("organisation_id"),
  jobTitle: varchar("job_title"),
  department: varchar("department"),
  phone: varchar("phone"),
  bio: text("bio"),
  allowCertificateDownload: boolean("allow_certificate_download").default(false),
  lastActive: timestamp("last_active"),
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
  planId: varchar("plan_id"), // Reference to the plan this organisation is subscribed to
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  pricePerUser: decimal("price_per_user", { precision: 10, scale: 2 }).notNull(), // Monthly price per user
  status: planStatusEnum("status").notNull().default('active'),
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

// Course folder types
export type InsertCourseFolder = z.infer<typeof insertCourseFolderSchema>;
export type CourseFolder = typeof courseFolders.$inferSelect;

export type InsertOrganisationCourseFolder = z.infer<typeof insertOrganisationCourseFolderSchema>;
export type OrganisationCourseFolder = typeof organisationCourseFolders.$inferSelect;
