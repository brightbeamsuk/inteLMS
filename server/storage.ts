import {
  users,
  organisations,
  courses,
  assignments,
  completions,
  certificates,
  certificateTemplates,
  organisationSettings,
  platformSettings,
  todoItems,
  type User,
  type UpsertUser,
  type InsertUser,
  type Organisation,
  type InsertOrganisation,
  type Course,
  type InsertCourse,
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

  // Course operations
  getCourse(id: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: string, course: Partial<InsertCourse>): Promise<Course>;
  deleteCourse(id: string): Promise<void>;
  getAllCourses(): Promise<Course[]>;
  getCoursesByStatus(status: string): Promise<Course[]>;

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

  async getCertificatesByUser(userId: string): Promise<Certificate[]> {
    return await db.select().from(certificates).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt));
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
}

export const storage = new DatabaseStorage();
