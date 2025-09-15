/**
 * ComplianceReportingService - Automated GDPR compliance reporting and alerts
 * 
 * This service provides automated compliance reporting functionality:
 * - Scheduled compliance reports (daily, weekly, monthly, quarterly, annual)
 * - Critical compliance alerts and SLA breach notifications
 * - Regulatory deadline reminders and ICO submission notifications
 * - Export completion notifications and audit alerts
 * - Integration with EmailOrchestrator for delivery
 * - Multi-tenant organization scoping
 */

import { EmailOrchestrator, type TemplateRenderContext } from './EmailOrchestrator';
import { storage } from '../storage';
import { isGdprEnabled } from '../config/gdpr';

// Initialize EmailOrchestrator
const emailOrchestrator = new EmailOrchestrator();

export interface ComplianceReportSchedule {
  organisationId: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  recipients: string[];
  enabled: boolean;
  lastSent?: Date;
  nextScheduled?: Date;
  timezone?: string;
}

export interface ComplianceAlert {
  type: 'critical' | 'warning' | 'sla_breach' | 'deadline_reminder';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  organisationId?: string;
  triggeredBy: string;
  actionRequired?: boolean;
  dueDate?: Date;
}

export class ComplianceReportingService {
  private readonly LOG_PREFIX = '[ComplianceReporting]';

  /**
   * Send daily compliance digest to administrators
   */
  async sendDailyComplianceDigest(organisationId: string): Promise<void> {
    if (!isGdprEnabled()) {
      console.log(`${this.LOG_PREFIX} GDPR disabled, skipping daily digest`);
      return;
    }

    try {
      console.log(`${this.LOG_PREFIX} Generating daily compliance digest for org: ${organisationId}`);

      // Get organization details
      const organisation = await storage.getOrganisation(organisationId);
      if (!organisation) {
        throw new Error(`Organization not found: ${organisationId}`);
      }

      // Get admin users for the organization
      const adminUsers = await storage.getUsersByOrganisationAndRole(organisationId, 'admin');
      
      // Get compliance metrics for today
      const complianceMetrics = await storage.getComplianceMetrics(organisationId, {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date()
      });

      // Get critical alerts from the last 24 hours
      const criticalAlerts = await storage.getCriticalComplianceAlerts(organisationId, 1);

      // Prepare email context
      const context: TemplateRenderContext = {
        org: {
          name: organisation.name,
          displayName: organisation.displayName || organisation.name
        },
        complianceReport: {
          reportType: 'daily',
          reportPeriod: new Date().toLocaleDateString(),
          overallScore: complianceMetrics?.overallCompliance || 0,
          complianceStatus: this.getComplianceStatus(complianceMetrics?.overallCompliance || 0),
          criticalIssues: criticalAlerts?.length || 0,
          consentMetrics: {
            totalConsents: complianceMetrics?.consentMetrics?.totalConsents || 0,
            activeConsents: complianceMetrics?.consentMetrics?.activeConsents || 0,
            consentRate: complianceMetrics?.consentMetrics?.consentRate || 0,
            marketingConsentRate: complianceMetrics?.consentMetrics?.marketingConsentRate || 0
          },
          userRightsMetrics: {
            totalRequests: complianceMetrics?.userRights?.totalRequests || 0,
            pendingRequests: complianceMetrics?.userRights?.pendingRequests || 0,
            averageResponseTime: complianceMetrics?.userRights?.avgResponseTime || 0,
            slaCompliance: complianceMetrics?.userRights?.slaCompliance || 100
          },
          retentionMetrics: {
            totalRecords: complianceMetrics?.dataRetention?.totalRecords || 0,
            scheduledForDeletion: complianceMetrics?.dataRetention?.scheduledDeletions || 0,
            retentionCompliance: complianceMetrics?.dataRetention?.compliance || 100
          },
          breachMetrics: {
            activeBreaches: complianceMetrics?.breaches?.activeBreaches || 0,
            icoNotificationCompliance: complianceMetrics?.breaches?.icoNotificationCompliance || 100
          },
          actionItems: criticalAlerts?.map(alert => ({
            title: alert.title,
            description: alert.description,
            priority: alert.severity === 'critical' ? 'urgent' : 'high',
            dueDate: alert.dueDate?.toISOString()
          })) || []
        }
      };

      // Send digest to all admin users
      for (const admin of adminUsers) {
        await emailOrchestrator.queue({
          triggerEvent: 'COMPLIANCE_DAILY_DIGEST',
          templateKey: 'compliance_daily_digest',
          toEmail: admin.email,
          context: {
            ...context,
            user: {
              name: `${admin.firstName} ${admin.lastName}`,
              email: admin.email,
              firstName: admin.firstName,
              lastName: admin.lastName
            }
          },
          organisationId,
          resourceId: `daily-digest-${organisationId}-${new Date().toISOString().split('T')[0]}`,
          priority: 2
        });
      }

      console.log(`${this.LOG_PREFIX} Daily digest sent to ${adminUsers.length} administrators`);

    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Failed to send daily digest:`, error);
      throw error;
    }
  }

  /**
   * Send weekly compliance report
   */
  async sendWeeklyComplianceReport(organisationId: string): Promise<void> {
    if (!isGdprEnabled()) return;

    try {
      console.log(`${this.LOG_PREFIX} Generating weekly compliance report for org: ${organisationId}`);

      const organisation = await storage.getOrganisation(organisationId);
      const adminUsers = await storage.getUsersByOrganisationAndRole(organisationId, 'admin');
      
      const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date();
      
      const complianceMetrics = await storage.getComplianceMetrics(organisationId, {
        startDate: weekStart,
        endDate: weekEnd
      });

      const previousWeekMetrics = await storage.getComplianceMetrics(organisationId, {
        startDate: new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: weekStart
      });

      const context: TemplateRenderContext = {
        org: {
          name: organisation?.name,
          displayName: organisation?.displayName || organisation?.name
        },
        complianceReport: {
          reportType: 'weekly',
          reportPeriod: `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`,
          overallScore: complianceMetrics?.overallCompliance || 0,
          previousScore: previousWeekMetrics?.overallCompliance || 0,
          scoreChange: (complianceMetrics?.overallCompliance || 0) - (previousWeekMetrics?.overallCompliance || 0),
          complianceStatus: this.getComplianceStatus(complianceMetrics?.overallCompliance || 0),
          kpis: this.generateKPIs(complianceMetrics, previousWeekMetrics)
        }
      };

      for (const admin of adminUsers) {
        await emailOrchestrator.queue({
          triggerEvent: 'COMPLIANCE_WEEKLY_REPORT',
          templateKey: 'compliance_weekly_report',
          toEmail: admin.email,
          context: {
            ...context,
            user: {
              name: `${admin.firstName} ${admin.lastName}`,
              email: admin.email
            }
          },
          organisationId,
          resourceId: `weekly-report-${organisationId}-${weekStart.toISOString().split('T')[0]}`,
          priority: 2
        });
      }

      console.log(`${this.LOG_PREFIX} Weekly report sent successfully`);

    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Failed to send weekly report:`, error);
      throw error;
    }
  }

  /**
   * Send critical compliance alert
   */
  async sendCriticalComplianceAlert(alert: ComplianceAlert): Promise<void> {
    if (!isGdprEnabled()) return;

    try {
      console.log(`${this.LOG_PREFIX} Sending critical compliance alert:`, alert.type);

      // Determine recipients based on alert severity and organization
      const recipients = await this.getAlertRecipients(alert);

      const context: TemplateRenderContext = {
        complianceReport: {
          reportType: 'audit',
          complianceStatus: alert.type === 'critical' ? 'non_compliant' : 'attention_required',
          actionItems: [{
            title: alert.title,
            description: alert.description,
            priority: alert.priority,
            dueDate: alert.dueDate?.toISOString(),
            assignedTo: 'Admin Team'
          }]
        }
      };

      const triggerEvent = alert.type === 'critical' ? 'COMPLIANCE_ALERT_CRITICAL' : 'COMPLIANCE_ALERT_WARNING';

      for (const recipient of recipients) {
        await emailOrchestrator.queue({
          triggerEvent,
          templateKey: 'compliance_alert',
          toEmail: recipient.email,
          context: {
            ...context,
            user: {
              name: recipient.name,
              email: recipient.email
            }
          },
          organisationId: alert.organisationId,
          resourceId: `alert-${alert.type}-${Date.now()}`,
          priority: alert.type === 'critical' ? 5 : 3
        });
      }

      console.log(`${this.LOG_PREFIX} Critical alert sent to ${recipients.length} recipients`);

    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Failed to send critical alert:`, error);
      throw error;
    }
  }

  /**
   * Send SLA breach notification
   */
  async sendSLABreachNotification(organisationId: string, breachDetails: any): Promise<void> {
    if (!isGdprEnabled()) return;

    try {
      console.log(`${this.LOG_PREFIX} Sending SLA breach notification for org: ${organisationId}`);

      const organisation = await storage.getOrganisation(organisationId);
      const adminUsers = await storage.getUsersByOrganisationAndRole(organisationId, 'admin');

      const context: TemplateRenderContext = {
        org: {
          name: organisation?.name,
          displayName: organisation?.displayName
        },
        complianceReport: {
          reportType: 'audit',
          complianceStatus: 'non_compliant',
          userRightsMetrics: {
            overdueRequests: breachDetails.overdueCount || 0,
            averageResponseTime: breachDetails.avgResponseTime || 0,
            slaCompliance: breachDetails.slaCompliance || 0
          },
          actionItems: [{
            title: 'SLA Breach - Immediate Action Required',
            description: `${breachDetails.overdueCount} user rights requests are overdue. Regulatory SLA of 30 days has been exceeded.`,
            priority: 'urgent',
            dueDate: new Date().toISOString()
          }]
        }
      };

      for (const admin of adminUsers) {
        await emailOrchestrator.queue({
          triggerEvent: 'COMPLIANCE_SLA_BREACH',
          templateKey: 'compliance_alert',
          toEmail: admin.email,
          context: {
            ...context,
            user: {
              name: `${admin.firstName} ${admin.lastName}`,
              email: admin.email
            }
          },
          organisationId,
          resourceId: `sla-breach-${organisationId}-${Date.now()}`,
          priority: 5
        });
      }

      console.log(`${this.LOG_PREFIX} SLA breach notification sent`);

    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Failed to send SLA breach notification:`, error);
      throw error;
    }
  }

  /**
   * Send export completion notification
   */
  async sendExportCompletionNotification(
    organisationId: string, 
    requestedBy: string, 
    exportJob: any
  ): Promise<void> {
    if (!isGdprEnabled()) return;

    try {
      console.log(`${this.LOG_PREFIX} Sending export completion notification`);

      const organisation = await storage.getOrganisation(organisationId);
      const user = await storage.getUserById(requestedBy);

      if (!user) {
        throw new Error(`User not found: ${requestedBy}`);
      }

      const context: TemplateRenderContext = {
        org: {
          name: organisation?.name,
          displayName: organisation?.displayName
        },
        user: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        complianceReport: {
          reportType: 'audit',
          exportStatus: {
            jobId: exportJob.id,
            jobType: exportJob.exportType,
            status: exportJob.status,
            downloadUrl: exportJob.downloadUrl,
            expiresAt: exportJob.expiresAt,
            fileSize: this.formatFileSize(exportJob.actualSize || 0)
          }
        }
      };

      await emailOrchestrator.queue({
        triggerEvent: 'COMPLIANCE_EXPORT_READY',
        templateKey: 'compliance_export_notification',
        toEmail: user.email,
        context,
        organisationId,
        resourceId: `export-${exportJob.id}`,
        priority: 3
      });

      console.log(`${this.LOG_PREFIX} Export completion notification sent`);

    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Failed to send export notification:`, error);
      throw error;
    }
  }

  /**
   * Send regulatory deadline reminder
   */
  async sendRegulatoryDeadlineReminder(
    organisationId: string,
    deadline: { title: string; description: string; dueDate: Date; daysUntil: number }
  ): Promise<void> {
    if (!isGdprEnabled()) return;

    try {
      console.log(`${this.LOG_PREFIX} Sending regulatory deadline reminder`);

      const organisation = await storage.getOrganisation(organisationId);
      const adminUsers = await storage.getUsersByOrganisationAndRole(organisationId, 'admin');

      const urgency = deadline.daysUntil <= 1 ? 'critical' : 
                     deadline.daysUntil <= 7 ? 'high' : 
                     deadline.daysUntil <= 30 ? 'medium' : 'low';

      const context: TemplateRenderContext = {
        org: {
          name: organisation?.name,
          displayName: organisation?.displayName
        },
        complianceReport: {
          reportType: 'audit',
          upcomingDeadlines: [{
            title: deadline.title,
            description: deadline.description,
            dueDate: deadline.dueDate.toISOString(),
            daysUntil: deadline.daysUntil,
            urgency
          }]
        }
      };

      for (const admin of adminUsers) {
        await emailOrchestrator.queue({
          triggerEvent: 'REGULATORY_DEADLINE_REMINDER',
          templateKey: 'regulatory_deadline_alert',
          toEmail: admin.email,
          context: {
            ...context,
            user: {
              name: `${admin.firstName} ${admin.lastName}`,
              email: admin.email
            }
          },
          organisationId,
          resourceId: `deadline-${organisationId}-${deadline.title}-${deadline.dueDate.getTime()}`,
          priority: urgency === 'critical' ? 5 : 3
        });
      }

      console.log(`${this.LOG_PREFIX} Regulatory deadline reminder sent`);

    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Failed to send deadline reminder:`, error);
      throw error;
    }
  }

  // Helper methods

  private getComplianceStatus(score: number): 'compliant' | 'attention_required' | 'non_compliant' {
    if (score >= 85) return 'compliant';
    if (score >= 70) return 'attention_required';
    return 'non_compliant';
  }

  private generateKPIs(current: any, previous: any): Array<{
    name: string;
    value: string;
    trend: 'up' | 'down' | 'stable';
    status: 'good' | 'warning' | 'critical';
  }> {
    const kpis = [];

    // Overall Compliance Score
    const currentScore = current?.overallCompliance || 0;
    const previousScore = previous?.overallCompliance || 0;
    const scoreDiff = currentScore - previousScore;
    
    kpis.push({
      name: 'Overall Compliance',
      value: `${currentScore}%`,
      trend: scoreDiff > 0 ? 'up' : scoreDiff < 0 ? 'down' : 'stable',
      status: currentScore >= 85 ? 'good' : currentScore >= 70 ? 'warning' : 'critical'
    });

    // User Rights SLA
    const slaCompliance = current?.userRights?.slaCompliance || 100;
    kpis.push({
      name: 'User Rights SLA',
      value: `${slaCompliance}%`,
      trend: 'stable',
      status: slaCompliance >= 95 ? 'good' : slaCompliance >= 80 ? 'warning' : 'critical'
    });

    // Active Breaches
    const activeBreaches = current?.breaches?.activeBreaches || 0;
    kpis.push({
      name: 'Active Breaches',
      value: activeBreaches.toString(),
      trend: 'stable',
      status: activeBreaches === 0 ? 'good' : activeBreaches <= 2 ? 'warning' : 'critical'
    });

    return kpis;
  }

  private async getAlertRecipients(alert: ComplianceAlert): Promise<Array<{ name: string; email: string }>> {
    if (alert.organisationId) {
      const adminUsers = await storage.getUsersByOrganisationAndRole(alert.organisationId, 'admin');
      return adminUsers.map(user => ({
        name: `${user.firstName} ${user.lastName}`,
        email: user.email
      }));
    }
    
    // For system-wide alerts, get SuperAdmins
    const superAdmins = await storage.getUsersByRole('superadmin');
    return superAdmins.map(user => ({
      name: `${user.firstName} ${user.lastName}`,
      email: user.email
    }));
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Schedule automated compliance reports for an organization
   */
  async scheduleComplianceReports(organisationId: string): Promise<void> {
    // This would integrate with a job scheduler (like node-cron or bull-queue)
    // For now, we'll log the scheduling intent
    console.log(`${this.LOG_PREFIX} Scheduling compliance reports for org: ${organisationId}`);
    
    // Daily digest at 8 AM
    // Weekly report on Monday at 9 AM
    // Monthly report on 1st of month at 10 AM
    // Quarterly report on 1st of quarter at 10 AM
    // Annual report on January 1st at 10 AM
    
    // Implementation would depend on the chosen scheduler
    // Example: cron.schedule('0 8 * * *', () => this.sendDailyComplianceDigest(organisationId));
  }
}

// Export singleton instance
export const complianceReportingService = new ComplianceReportingService();