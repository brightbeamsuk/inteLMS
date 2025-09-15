/**
 * Breach Deadline Monitoring Service
 * Automated monitoring and alerting for GDPR Articles 33 & 34 compliance deadlines
 * Handles ICO notification deadlines (72h) and escalation workflows
 */

import { storage } from '../storage';
import { emailOrchestrator } from './EmailOrchestrator';
import { breachNotificationService } from './BreachNotificationService';
import type { DataBreach } from '@shared/schema';

export class BreachDeadlineService {
  private readonly LOG_PREFIX = '[BreachDeadlineService]';
  
  // Monitoring thresholds (in hours)
  private readonly ICO_DEADLINE_HOURS = 72; // Article 33 requirement
  private readonly WARNING_THRESHOLD_HOURS = 24; // Warning 24h before deadline
  private readonly URGENT_THRESHOLD_HOURS = 8; // Urgent alert 8h before deadline
  
  constructor() {
    console.log(`${this.LOG_PREFIX} Initialized breach deadline monitoring service`);
  }

  /**
   * Monitor all active breaches for compliance deadlines
   * Should be called regularly (e.g., hourly via cron job)
   */
  async monitorAllDeadlines(): Promise<void> {
    try {
      console.log(`${this.LOG_PREFIX} Starting deadline monitoring sweep...`);

      // Get all active breaches (not resolved)
      const activeBreaches = await this.getActiveBreaches();
      console.log(`${this.LOG_PREFIX} Found ${activeBreaches.length} active breaches to monitor`);

      // Check each breach for deadline violations
      for (const breach of activeBreaches) {
        await this.checkBreachDeadlines(breach);
      }

      console.log(`${this.LOG_PREFIX} Completed deadline monitoring sweep`);
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error in deadline monitoring:`, error);
      throw error;
    }
  }

  /**
   * Check specific breach for deadline violations and send appropriate alerts
   */
  async checkBreachDeadlines(breach: DataBreach): Promise<void> {
    try {
      const now = new Date();
      const deadlineStatus = this.calculateDeadlineStatus(breach, now);

      console.log(`${this.LOG_PREFIX} Checking breach ${breach.id}: ${deadlineStatus.status}`);

      // Handle ICO notification deadline monitoring
      if (this.requiresIcoNotification(breach) && !breach.icoNotifiedAt) {
        await this.handleIcoDeadlineStatus(breach, deadlineStatus);
      }

      // Handle individual notification monitoring
      if (this.requiresIndividualNotification(breach) && !breach.subjectsNotifiedAt) {
        await this.handleSubjectNotificationStatus(breach, deadlineStatus);
      }

      // Log compliance status
      await this.logComplianceCheck(breach, deadlineStatus);

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error checking breach ${breach.id}:`, error);
    }
  }

  /**
   * Calculate comprehensive deadline status for a breach
   */
  private calculateDeadlineStatus(breach: DataBreach, now: Date) {
    const detectedAt = new Date(breach.detectedAt);
    const notificationDeadline = new Date(breach.notificationDeadline);
    
    const hoursElapsed = Math.floor((now.getTime() - detectedAt.getTime()) / (1000 * 60 * 60));
    const hoursUntilDeadline = Math.floor((notificationDeadline.getTime() - now.getTime()) / (1000 * 60 * 60));
    const isOverdue = now > notificationDeadline;

    let status: 'normal' | 'warning' | 'urgent' | 'overdue';
    
    if (isOverdue) {
      status = 'overdue';
    } else if (hoursUntilDeadline <= this.URGENT_THRESHOLD_HOURS) {
      status = 'urgent';
    } else if (hoursUntilDeadline <= this.WARNING_THRESHOLD_HOURS) {
      status = 'warning';
    } else {
      status = 'normal';
    }

    return {
      status,
      hoursElapsed,
      hoursUntilDeadline,
      isOverdue,
      deadlineDate: notificationDeadline,
      detectionDate: detectedAt
    };
  }

  /**
   * Handle ICO notification deadline status and alerts
   */
  private async handleIcoDeadlineStatus(breach: DataBreach, deadlineStatus: any): Promise<void> {
    const organisation = await storage.getOrganisation(breach.organisationId);
    if (!organisation) return;

    switch (deadlineStatus.status) {
      case 'overdue':
        await this.sendOverdueIcoAlert(breach, organisation, deadlineStatus);
        break;
      case 'urgent':
        await this.sendUrgentIcoAlert(breach, organisation, deadlineStatus);
        break;
      case 'warning':
        await this.sendWarningIcoAlert(breach, organisation, deadlineStatus);
        break;
      default:
        // Normal status - no alert needed
        break;
    }
  }

  /**
   * Handle individual notification status
   */
  private async handleSubjectNotificationStatus(breach: DataBreach, deadlineStatus: any): Promise<void> {
    // Individual notifications have more flexible timing but still need monitoring
    if (deadlineStatus.status === 'overdue' && this.requiresIndividualNotification(breach)) {
      const organisation = await storage.getOrganisation(breach.organisationId);
      if (organisation) {
        await this.sendOverdueSubjectAlert(breach, organisation, deadlineStatus);
      }
    }
  }

  /**
   * Send overdue ICO notification alert
   */
  private async sendOverdueIcoAlert(breach: DataBreach, organisation: any, deadlineStatus: any): Promise<void> {
    console.log(`${this.LOG_PREFIX} CRITICAL: ICO notification overdue for breach ${breach.id}`);

    // Get DPO or admin contacts
    const adminUsers = await this.getBreachAdminUsers(breach.organisationId);
    
    for (const admin of adminUsers) {
      try {
        await this.sendEscalationEmail(admin, {
          type: 'ico_overdue',
          breach,
          organisation,
          deadlineStatus,
          subject: `🚨 CRITICAL: ICO Notification OVERDUE - ${breach.title}`,
          priority: 1
        });
      } catch (error) {
        console.error(`${this.LOG_PREFIX} Failed to send overdue alert to ${admin.email}:`, error);
      }
    }

    // Log critical audit event
    await this.logCriticalDeadlineEvent(breach, 'ico_notification_overdue', deadlineStatus);
  }

  /**
   * Send urgent ICO notification alert
   */
  private async sendUrgentIcoAlert(breach: DataBreach, organisation: any, deadlineStatus: any): Promise<void> {
    console.log(`${this.LOG_PREFIX} URGENT: ICO notification due in ${deadlineStatus.hoursUntilDeadline}h for breach ${breach.id}`);

    const adminUsers = await this.getBreachAdminUsers(breach.organisationId);
    
    for (const admin of adminUsers) {
      try {
        await this.sendEscalationEmail(admin, {
          type: 'ico_urgent',
          breach,
          organisation,
          deadlineStatus,
          subject: `⚠️ URGENT: ICO Notification Due in ${deadlineStatus.hoursUntilDeadline}h - ${breach.title}`,
          priority: 2
        });
      } catch (error) {
        console.error(`${this.LOG_PREFIX} Failed to send urgent alert to ${admin.email}:`, error);
      }
    }

    await this.logCriticalDeadlineEvent(breach, 'ico_notification_urgent', deadlineStatus);
  }

  /**
   * Send warning ICO notification alert
   */
  private async sendWarningIcoAlert(breach: DataBreach, organisation: any, deadlineStatus: any): Promise<void> {
    console.log(`${this.LOG_PREFIX} WARNING: ICO notification due in ${deadlineStatus.hoursUntilDeadline}h for breach ${breach.id}`);

    const adminUsers = await this.getBreachAdminUsers(breach.organisationId);
    
    for (const admin of adminUsers) {
      try {
        await this.sendEscalationEmail(admin, {
          type: 'ico_warning',
          breach,
          organisation,
          deadlineStatus,
          subject: `⏰ Reminder: ICO Notification Due in ${deadlineStatus.hoursUntilDeadline}h - ${breach.title}`,
          priority: 3
        });
      } catch (error) {
        console.error(`${this.LOG_PREFIX} Failed to send warning alert to ${admin.email}:`, error);
      }
    }

    await this.logCriticalDeadlineEvent(breach, 'ico_notification_warning', deadlineStatus);
  }

  /**
   * Send overdue subject notification alert
   */
  private async sendOverdueSubjectAlert(breach: DataBreach, organisation: any, deadlineStatus: any): Promise<void> {
    console.log(`${this.LOG_PREFIX} OVERDUE: Individual notifications overdue for breach ${breach.id}`);

    const adminUsers = await this.getBreachAdminUsers(breach.organisationId);
    
    for (const admin of adminUsers) {
      try {
        await this.sendEscalationEmail(admin, {
          type: 'subjects_overdue',
          breach,
          organisation,
          deadlineStatus,
          subject: `⚠️ Overdue: Individual Notifications Required - ${breach.title}`,
          priority: 2
        });
      } catch (error) {
        console.error(`${this.LOG_PREFIX} Failed to send subject alert to ${admin.email}:`, error);
      }
    }

    await this.logCriticalDeadlineEvent(breach, 'subject_notification_overdue', deadlineStatus);
  }

  /**
   * Send escalation email using EmailOrchestrator
   */
  private async sendEscalationEmail(admin: any, alertData: any): Promise<void> {
    try {
      const context = {
        org: {
          name: alertData.organisation.name,
          displayName: alertData.organisation.displayName || alertData.organisation.name
        },
        admin: {
          name: `${admin.firstName} ${admin.lastName}`,
          email: admin.email,
          fullName: `${admin.firstName} ${admin.lastName}`
        },
        breach: {
          id: alertData.breach.id,
          title: alertData.breach.title,
          description: alertData.breach.description,
          severity: alertData.breach.severity,
          detectedAt: alertData.breach.detectedAt.toISOString(),
          affectedSubjects: alertData.breach.affectedSubjects,
          hoursElapsed: alertData.deadlineStatus.hoursElapsed,
          hoursUntilDeadline: alertData.deadlineStatus.hoursUntilDeadline,
          isOverdue: alertData.deadlineStatus.isOverdue,
          deadlineDate: alertData.deadlineStatus.deadlineDate.toISOString()
        },
        alert: {
          type: alertData.type,
          priority: alertData.priority,
          urgencyLevel: alertData.deadlineStatus.status
        }
      };

      await emailOrchestrator.queue({
        triggerEvent: 'COURSE_FAILED',
        templateKey: 'breach_deadline_escalation',
        toEmail: admin.email,
        organisationId: alertData.breach.organisationId,
        resourceId: `${alertData.breach.id}-deadline-${alertData.type}`,
        priority: alertData.priority,
        context
      });

      console.log(`${this.LOG_PREFIX} Escalation email queued for ${admin.email}: ${alertData.type}`);
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to queue escalation email:`, error);
      throw error;
    }
  }

  /**
   * Log critical deadline events for audit
   */
  private async logCriticalDeadlineEvent(breach: DataBreach, eventType: string, deadlineStatus: any): Promise<void> {
    try {
      await storage.createAuditLog({
        organisationId: breach.organisationId,
        userId: null, // System-generated
        action: `breach_deadline_${eventType}`,
        resource: 'data_breach' as any,
        resourceId: breach.id,
        details: {
          breachTitle: breach.title,
          severity: breach.severity,
          affectedSubjects: breach.affectedSubjects,
          hoursElapsed: deadlineStatus.hoursElapsed,
          hoursUntilDeadline: deadlineStatus.hoursUntilDeadline,
          isOverdue: deadlineStatus.isOverdue,
          deadlineDate: deadlineStatus.deadlineDate.toISOString(),
          alertType: eventType,
          complianceStatus: deadlineStatus.status
        },
        ipAddress: '127.0.0.1', // System process
        userAgent: 'BreachDeadlineService/1.0'
      });
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to log deadline event:`, error);
    }
  }

  /**
   * Log routine compliance checks
   */
  private async logComplianceCheck(breach: DataBreach, deadlineStatus: any): Promise<void> {
    try {
      // Only log for concerning statuses to avoid spam
      if (['warning', 'urgent', 'overdue'].includes(deadlineStatus.status)) {
        await storage.createAuditLog({
          organisationId: breach.organisationId,
          userId: null,
          action: 'breach_deadline_check',
          resource: 'data_breach' as any,
          resourceId: breach.id,
          details: {
            complianceStatus: deadlineStatus.status,
            hoursUntilDeadline: deadlineStatus.hoursUntilDeadline,
            icoNotified: !!breach.icoNotifiedAt,
            subjectsNotified: !!breach.subjectsNotifiedAt,
            checkTimestamp: new Date().toISOString()
          },
          ipAddress: '127.0.0.1',
          userAgent: 'BreachDeadlineService/1.0'
        });
      }
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to log compliance check:`, error);
    }
  }

  /**
   * Get active breaches requiring monitoring
   */
  private async getActiveBreaches(): Promise<DataBreach[]> {
    try {
      // Get all organisations first, then their breaches
      const organisations = await storage.getAllOrganisations();
      let allBreaches: DataBreach[] = [];
      
      for (const org of organisations) {
        const orgBreaches = await storage.getDataBreachesByOrganisation(org.id);
        allBreaches = [...allBreaches, ...orgBreaches];
      }
      
      // Filter to active breaches requiring compliance monitoring
      return allBreaches.filter((breach: DataBreach) => 
        ['detected', 'investigating', 'contained', 'notified'].includes(breach.status) &&
        (this.requiresIcoNotification(breach) && !breach.icoNotifiedAt ||
         this.requiresIndividualNotification(breach) && !breach.subjectsNotifiedAt)
      );
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error fetching active breaches:`, error);
      return [];
    }
  }

  /**
   * Get admin users for breach escalation
   */
  private async getBreachAdminUsers(organisationId: string): Promise<any[]> {
    try {
      // Get DPO and admin users for the organisation
      const orgUsers = await storage.getUsersWithFilters({
        organisationId,
        role: ['dpo', 'admin', 'compliance_manager']
      });
      
      return orgUsers.filter((user: any) => user.isActive);
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error fetching admin users:`, error);
      return [];
    }
  }

  /**
   * Check if breach requires ICO notification
   */
  private requiresIcoNotification(breach: DataBreach): boolean {
    // All breaches require ICO notification under Article 33 unless very low risk
    return ['medium', 'high', 'critical'].includes(breach.severity);
  }

  /**
   * Check if breach requires individual notification
   */
  private requiresIndividualNotification(breach: DataBreach): boolean {
    // High-risk breaches require individual notification under Article 34
    return ['high', 'critical'].includes(breach.severity);
  }

  /**
   * Get deadline monitoring status for API endpoints
   */
  async getMonitoringStatus(): Promise<any> {
    try {
      const activeBreaches = await this.getActiveBreaches();
      const now = new Date();
      
      const statusSummary = {
        totalActive: activeBreaches.length,
        overdue: 0,
        urgent: 0,
        warning: 0,
        normal: 0,
        details: [] as any[]
      };

      for (const breach of activeBreaches) {
        const deadlineStatus = this.calculateDeadlineStatus(breach, now);
        
        // Use type assertion to avoid index signature error
        (statusSummary as any)[deadlineStatus.status]++;
        
        statusSummary.details.push({
          id: breach.id,
          title: breach.title,
          severity: breach.severity,
          status: deadlineStatus.status,
          hoursUntilDeadline: deadlineStatus.hoursUntilDeadline,
          icoNotified: !!breach.icoNotifiedAt,
          subjectsNotified: !!breach.subjectsNotifiedAt
        });
      }

      return statusSummary;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error getting monitoring status:`, error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Export singleton instance
export const breachDeadlineService = new BreachDeadlineService();