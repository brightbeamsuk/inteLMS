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
  emailTemplates,
  systemEmailSettings,
  emailLogs,
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
  type EmailTemplate,
  type InsertEmailTemplate,
  type SystemEmailSettings,
  type InsertSystemEmailSettings,
  type EmailLog,
  type InsertEmailLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, count, sql, like, or, isNull } from "drizzle-orm";

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
    role?: string;
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
    billingStatus?: string;
    activeUserCount?: number;
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
    coursesAssigned: number;
    coursesCompleted: number;
    complianceRate: number;
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

  // Email template operations
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplatesByOrganisation(organisationId: string): Promise<EmailTemplate[]>;
  updateEmailTemplate(id: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate>;
  deleteEmailTemplate(id: string): Promise<void>;

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
    role?: string;
    organisationId?: string;
    status?: string;
    search?: string;
  }): Promise<User[]> {
    let query = db.select().from(users);

    const conditions = [];
    if (filters.role) conditions.push(eq(users.role, filters.role as any));
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
      query = query.where(and(...conditions));
    }

    return await query.orderBy(asc(users.firstName));
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
    billingStatus?: string;
    activeUserCount?: number;
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

    const activeUserCount = activeUserResult?.count || 0;
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
    coursesAssigned: number;
    coursesCompleted: number;
    complianceRate: number;
  }> {
    const [userCount] = await db.select({ count: count() }).from(users).where(and(eq(users.organisationId, organisationId), eq(users.status, 'active')));
    const [adminCount] = await db.select({ count: count() }).from(users).where(and(eq(users.organisationId, organisationId), eq(users.role, 'admin'), eq(users.status, 'active')));
    const [assignmentCount] = await db.select({ count: count() }).from(assignments).where(eq(assignments.organisationId, organisationId));
    const [completionCount] = await db.select({ count: count() }).from(completions).where(eq(completions.organisationId, organisationId));
    
    const complianceRate = assignmentCount.count > 0 ? Math.round((completionCount.count / assignmentCount.count) * 100) : 0;

    return {
      activeUsers: userCount.count,
      adminUsers: adminCount.count,
      coursesAssigned: assignmentCount.count,
      coursesCompleted: completionCount.count,
      complianceRate,
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
    const [successfulCount] = await db.select({ count: count() }).from(completions).where(and(eq(completions.courseId, courseId), eq(completions.status, 'completed')));
    
    // Get unique organizations using this course
    const organizationsUsing = await db
      .selectDistinct({ orgId: assignments.organisationId })
      .from(assignments)
      .where(eq(assignments.courseId, courseId));
    
    // Calculate average score from successful completions
    const scoreResults = await db
      .select({ score: completions.score })
      .from(completions)
      .where(and(eq(completions.courseId, courseId), eq(completions.status, 'completed')));
    
    const averageScore = scoreResults.length > 0 
      ? scoreResults.reduce((sum, c) => sum + (c.score || 0), 0) / scoreResults.length
      : 0;
    
    // Calculate average time to complete (in minutes)
    const timeResults = await db
      .select({
        assignedAt: assignments.assignedAt,
        completedAt: completions.completedAt
      })
      .from(assignments)
      .innerJoin(completions, eq(assignments.id, completions.assignmentId))
      .where(and(eq(assignments.courseId, courseId), eq(completions.status, 'completed')));
    
    const averageTimeToComplete = timeResults.length > 0
      ? timeResults.reduce((sum, t) => {
          if (t.assignedAt && t.completedAt) {
            const diffInMs = new Date(t.completedAt).getTime() - new Date(t.assignedAt).getTime();
            return sum + (diffInMs / (1000 * 60)); // Convert to minutes
          }
          return sum;
        }, 0) / timeResults.length
      : 0;
    
    const completionRate = assignmentCount.count > 0 
      ? (successfulCount.count / assignmentCount.count) * 100
      : 0;

    return {
      courseId,
      totalAssignments: assignmentCount.count,
      totalCompletions: completionCount.count,
      successfulCompletions: successfulCount.count,
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

  async getEmailTemplatesByOrganisation(organisationId: string): Promise<EmailTemplate[]> {
    return await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.organisationId, organisationId))
      .orderBy(asc(emailTemplates.templateType));
  }

  async updateEmailTemplate(id: string, templateData: Partial<InsertEmailTemplate>): Promise<EmailTemplate> {
    const [template] = await db
      .update(emailTemplates)
      .set({ ...templateData, updatedAt: new Date() })
      .where(eq(emailTemplates.id, id))
      .returning();
    return template;
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
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

    let query = db.select().from(emailLogs);

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
      query = query.where(and(...conditions));
    }

    return await query
      .orderBy(desc(emailLogs.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async getEmailLogById(id: string): Promise<EmailLog | undefined> {
    const [log] = await db.select().from(emailLogs).where(eq(emailLogs.id, id));
    return log;
  }
}

export const storage = new DatabaseStorage();
