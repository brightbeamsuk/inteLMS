/**
 * EmailNotificationService - Automatic email notifications for admin events
 * 
 * Handles automatic email notifications to organization administrators for:
 * - New Admin Added
 * - New User Added  
 * - Course Assigned
 * - Plan Updated
 * - Learner Completion Course
 * - Learner Course Failed
 * 
 * Features:
 * - Uses existing EmailOrchestrator for sending
 * - Template resolution (organization overrides vs superadmin defaults)
 * - De-duplication using resourceId
 * - Sends to all active Admin users of organization
 */

import { EmailOrchestrator, QueueEmailParams, TemplateRenderContext } from './EmailOrchestrator';
import { storage } from '../storage';

export class EmailNotificationService {
  private emailOrchestrator: EmailOrchestrator;

  constructor() {
    this.emailOrchestrator = new EmailOrchestrator();
  }

  /**
   * Get all active admin users for an organization
   */
  private async getOrganizationAdmins(organizationId: string): Promise<Array<{id: string, email: string, firstName?: string, lastName?: string}>> {
    try {
      const allUsers = await storage.getUsersByOrganisation(organizationId);
      const admins = allUsers.filter(user => user.role === 'admin' && user.status === 'active' && user.email);
      return admins.map(admin => ({
        id: admin.id,
        email: admin.email!,
        firstName: admin.firstName || undefined,
        lastName: admin.lastName || undefined
      }));
    } catch (error) {
      console.error('[EmailNotificationService] Failed to get organization admins:', error);
      return [];
    }
  }

  /**
   * Send notification to all admins with de-duplication
   */
  private async sendToAdmins(params: {
    organizationId: string;
    templateKey: string;
    triggerEvent: 'ORG_FAST_ADD' | 'USER_FAST_ADD' | 'COURSE_ASSIGNED' | 'COURSE_COMPLETED' | 'COURSE_FAILED' | 'PLAN_UPDATED';
    context: TemplateRenderContext;
    resourceId: string; // For de-duplication
  }): Promise<void> {
    const { organizationId, templateKey, triggerEvent, context, resourceId } = params;
    
    // Get all active admin users
    const admins = await this.getOrganizationAdmins(organizationId);
    
    if (admins.length === 0) {
      console.warn('[EmailNotificationService] No active admin users found for organization:', organizationId);
      return;
    }

    // Send to each admin with de-duplication
    for (const admin of admins) {
      try {
        const emailParams: QueueEmailParams = {
          triggerEvent,
          templateKey,
          toEmail: admin.email,
          context: {
            ...context,
            admin: {
              name: admin.firstName ? `${admin.firstName} ${admin.lastName || ''}`.trim() : admin.email,
              email: admin.email,
              fullName: admin.firstName ? `${admin.firstName} ${admin.lastName || ''}`.trim() : admin.email
            }
          },
          organisationId: organizationId,
          resourceId: `${resourceId}-${admin.id}`, // Unique per admin to prevent duplicates
          priority: 1 // Normal priority for admin notifications
        };

        await this.emailOrchestrator.queue(emailParams);
        console.log(`[EmailNotificationService] Queued ${templateKey} notification for admin ${admin.email}`);
      } catch (error) {
        console.error(`[EmailNotificationService] Failed to queue notification for admin ${admin.email}:`, error);
      }
    }
  }

  /**
   * Notify when a new admin is added to an organization
   */
  async notifyNewAdminAdded(organizationId: string, newAdminUserId: string, addedByUserId?: string): Promise<void> {
    try {
      // Get organization details
      const organization = await storage.getOrganisation(organizationId);
      if (!organization) {
        console.error('[EmailNotificationService] Organization not found:', organizationId);
        return;
      }

      // Get new admin details
      const newAdmin = await storage.getUser(newAdminUserId);
      if (!newAdmin) {
        console.error('[EmailNotificationService] New admin user not found:', newAdminUserId);
        return;
      }

      // Get added by user details (optional)
      let addedBy = null;
      if (addedByUserId) {
        addedBy = await storage.getUser(addedByUserId);
      }

      const context: TemplateRenderContext = {
        org: {
          name: organization.name,
          displayName: organization.displayName
        },
        user: {
          name: newAdmin.firstName ? `${newAdmin.firstName} ${newAdmin.lastName || ''}`.trim() : newAdmin.email!,
          email: newAdmin.email!,
          firstName: newAdmin.firstName || '',
          lastName: newAdmin.lastName || '',
          fullName: newAdmin.firstName ? `${newAdmin.firstName} ${newAdmin.lastName || ''}`.trim() : newAdmin.email!
        },
        addedBy: addedBy ? {
          name: addedBy.firstName ? `${addedBy.firstName} ${addedBy.lastName || ''}`.trim() : addedBy.email!,
          fullName: addedBy.firstName ? `${addedBy.firstName} ${addedBy.lastName || ''}`.trim() : addedBy.email!
        } : {
          name: 'System',
          fullName: 'System'
        },
        addedAt: new Date().toLocaleDateString()
      };

      await this.sendToAdmins({
        organizationId,
        templateKey: 'admin.new_admin_added',
        triggerEvent: 'ORG_FAST_ADD',
        context,
        resourceId: `new-admin-${newAdminUserId}`
      });

    } catch (error) {
      console.error('[EmailNotificationService] Failed to notify new admin added:', error);
    }
  }

  /**
   * Notify when a new user/learner is added to an organization
   */
  async notifyNewUserAdded(organizationId: string, newUserId: string, addedByUserId?: string): Promise<void> {
    try {
      // Get organization details
      const organization = await storage.getOrganisation(organizationId);
      if (!organization) {
        console.error('[EmailNotificationService] Organization not found:', organizationId);
        return;
      }

      // Get new user details
      const newUser = await storage.getUser(newUserId);
      if (!newUser) {
        console.error('[EmailNotificationService] New user not found:', newUserId);
        return;
      }

      // Get added by user details (optional)
      let addedBy = null;
      if (addedByUserId) {
        addedBy = await storage.getUser(addedByUserId);
      }

      const context: TemplateRenderContext = {
        org: {
          name: organization.name,
          displayName: organization.displayName
        },
        user: {
          name: newUser.firstName ? `${newUser.firstName} ${newUser.lastName || ''}`.trim() : newUser.email!,
          email: newUser.email!,
          firstName: newUser.firstName || '',
          lastName: newUser.lastName || '',
          fullName: newUser.firstName ? `${newUser.firstName} ${newUser.lastName || ''}`.trim() : newUser.email!
        },
        addedBy: addedBy ? {
          name: addedBy.firstName ? `${addedBy.firstName} ${addedBy.lastName || ''}`.trim() : addedBy.email!,
          fullName: addedBy.firstName ? `${addedBy.firstName} ${addedBy.lastName || ''}`.trim() : addedBy.email!
        } : {
          name: 'System',
          fullName: 'System'
        },
        addedAt: new Date().toLocaleDateString()
      };

      await this.sendToAdmins({
        organizationId,
        templateKey: 'admin.new_user_added',
        triggerEvent: 'USER_FAST_ADD',
        context,
        resourceId: `new-user-${newUserId}`
      });

    } catch (error) {
      console.error('[EmailNotificationService] Failed to notify new user added:', error);
    }
  }

  /**
   * Notify when a course is assigned to a learner
   */
  async notifyCourseAssigned(organizationId: string, userId: string, courseId: string, assignedByUserId?: string): Promise<void> {
    try {
      // Get organization details
      const organization = await storage.getOrganisation(organizationId);
      if (!organization) {
        console.error('[EmailNotificationService] Organization not found:', organizationId);
        return;
      }

      // Get user details
      const user = await storage.getUser(userId);
      if (!user) {
        console.error('[EmailNotificationService] User not found:', userId);
        return;
      }

      // Get course details
      const course = await storage.getCourse(courseId);
      if (!course) {
        console.error('[EmailNotificationService] Course not found:', courseId);
        return;
      }

      // Get assigned by user details (optional)
      let assignedBy = null;
      if (assignedByUserId) {
        assignedBy = await storage.getUser(assignedByUserId);
      }

      const context: TemplateRenderContext = {
        org: {
          name: organization.name,
          displayName: organization.displayName
        },
        user: {
          name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email!,
          email: user.email!,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          fullName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email!
        },
        course: {
          title: course.title,
          description: course.description || ''
        },
        assignedBy: assignedBy ? {
          name: assignedBy.firstName ? `${assignedBy.firstName} ${assignedBy.lastName || ''}`.trim() : assignedBy.email!
        } : {
          name: 'System'
        },
        assignedAt: new Date().toLocaleDateString()
      };

      await this.sendToAdmins({
        organizationId,
        templateKey: 'admin.new_course_assigned',
        triggerEvent: 'COURSE_ASSIGNED',
        context,
        resourceId: `assigned-${userId}-${courseId}`
      });

    } catch (error) {
      console.error('[EmailNotificationService] Failed to notify course assigned:', error);
    }
  }

  /**
   * Notify when organization's plan is updated
   */
  async notifyPlanUpdated(organizationId: string, oldPlanId?: string, newPlanId?: string, changedByUserId?: string): Promise<void> {
    try {
      // Get organization details
      const organization = await storage.getOrganisation(organizationId);
      if (!organization) {
        console.error('[EmailNotificationService] Organization not found:', organizationId);
        return;
      }

      // Get plan details
      let oldPlan = null;
      let newPlan = null;
      if (oldPlanId) {
        oldPlan = await storage.getPlan(oldPlanId);
      }
      if (newPlanId) {
        newPlan = await storage.getPlan(newPlanId);
      }

      // Get changed by user details (optional)
      let changedBy = null;
      if (changedByUserId) {
        changedBy = await storage.getUser(changedByUserId);
      }

      const context: TemplateRenderContext = {
        org: {
          name: organization.name,
          displayName: organization.displayName
        },
        plan: {
          name: newPlan?.name || 'Updated Plan',
          oldPrice: oldPlan ? `${oldPlan.pricePerUser || 0}` : '0',
          newPrice: newPlan ? `${newPlan.pricePerUser || 0}` : '0'
        },
        changedBy: changedBy ? {
          name: changedBy.firstName ? `${changedBy.firstName} ${changedBy.lastName || ''}`.trim() : changedBy.email!
        } : {
          name: 'System'
        },
        changedAt: new Date().toLocaleDateString()
      };

      await this.sendToAdmins({
        organizationId,
        templateKey: 'admin.plan_updated',
        triggerEvent: 'PLAN_UPDATED',
        context,
        resourceId: `plan-updated-${organizationId}-${Date.now()}`
      });

    } catch (error) {
      console.error('[EmailNotificationService] Failed to notify plan updated:', error);
    }
  }

  /**
   * Notify when a learner completes a course
   */
  async notifyLearnerCompletedCourse(organizationId: string, userId: string, courseId: string, completionId: string): Promise<void> {
    try {
      // Get organization details
      const organization = await storage.getOrganisation(organizationId);
      if (!organization) {
        console.error('[EmailNotificationService] Organization not found:', organizationId);
        return;
      }

      // Get user details
      const user = await storage.getUser(userId);
      if (!user) {
        console.error('[EmailNotificationService] User not found:', userId);
        return;
      }

      // Get course details
      const course = await storage.getCourse(courseId);
      if (!course) {
        console.error('[EmailNotificationService] Course not found:', courseId);
        return;
      }

      // Get completion details
      const completion = await storage.getCompletion(completionId);
      
      const context: TemplateRenderContext = {
        org: {
          name: organization.name,
          displayName: organization.displayName
        },
        user: {
          name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email!,
          email: user.email!,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          fullName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email!
        },
        course: {
          title: course.title,
          description: course.description || ''
        },
        attempt: {
          score: completion?.score?.toString() || 'N/A',
          passed: completion?.status === 'pass'
        },
        completedAt: new Date().toLocaleDateString()
      };

      await this.sendToAdmins({
        organizationId,
        templateKey: 'admin.learner_completed_course',
        triggerEvent: 'COURSE_COMPLETED',
        context,
        resourceId: `completed-${completionId}`
      });

    } catch (error) {
      console.error('[EmailNotificationService] Failed to notify learner completed course:', error);
    }
  }

  /**
   * Notify when a learner fails a course
   */
  async notifyLearnerFailedCourse(organizationId: string, userId: string, courseId: string, attemptId: string): Promise<void> {
    try {
      // Get organization details
      const organization = await storage.getOrganisation(organizationId);
      if (!organization) {
        console.error('[EmailNotificationService] Organization not found:', organizationId);
        return;
      }

      // Get user details
      const user = await storage.getUser(userId);
      if (!user) {
        console.error('[EmailNotificationService] User not found:', userId);
        return;
      }

      // Get course details
      const course = await storage.getCourse(courseId);
      if (!course) {
        console.error('[EmailNotificationService] Course not found:', courseId);
        return;
      }

      // Get attempt details (try to get from SCORM attempts table)
      let attempt = null;
      try {
        attempt = await storage.getScormAttempt(attemptId);
      } catch (error) {
        console.warn('[EmailNotificationService] Could not get attempt details:', error);
      }

      const context: TemplateRenderContext = {
        org: {
          name: organization.name,
          displayName: organization.displayName
        },
        user: {
          name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email!,
          email: user.email!,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          fullName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email!
        },
        course: {
          title: course.title,
          description: course.description || ''
        },
        attempt: {
          score: attempt?.score?.toString() || 'N/A',
          passed: false
        },
        completedAt: new Date().toLocaleDateString()
      };

      await this.sendToAdmins({
        organizationId,
        templateKey: 'admin.learner_failed_course',
        triggerEvent: 'COURSE_FAILED',
        context,
        resourceId: `failed-${attemptId}`
      });

    } catch (error) {
      console.error('[EmailNotificationService] Failed to notify learner failed course:', error);
    }
  }
}

// Export singleton instance
export const emailNotificationService = new EmailNotificationService();