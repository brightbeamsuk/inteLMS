/**
 * Email Template Defaults Seeder
 * 
 * Seeds the EmailTemplateDefaults table with professional, production-ready
 * email templates for all admin notification types.
 * 
 * Run this seeder to populate default templates that organizations can
 * use immediately or customize through the EmailTemplateService.
 */

import { db } from '../db';
import { emailTemplateDefaults, type InsertEmailTemplateDefaults } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Professional email template data for all 6 admin notification types
const defaultEmailTemplates: InsertEmailTemplateDefaults[] = [
  {
    key: 'admin.new_admin_added',
    category: 'admin',
    subjectDefault: 'New Administrator Added to {{org.name}}',
    htmlDefault: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Administrator Added</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
    .footer { background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 0.9em; color: #6c757d; }
    .highlight { background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .details-row { display: flex; justify-content: space-between; margin: 8px 0; }
    .details-label { font-weight: 600; color: #495057; }
    .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .button:hover { background: #0056b3; }
    @media (max-width: 600px) {
      .container { padding: 10px; }
      .details-row { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; color: #007bff;">👥 New Administrator Added</h1>
    </div>
    
    <div class="content">
      <p>Hello {{admin.name}},</p>
      
      <div class="highlight">
        <strong>A new administrator has been added to your organization:</strong>
      </div>
      
      <div class="details">
        <div class="details-row">
          <span class="details-label">Organization:</span>
          <span>{{org.display_name}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">New Administrator:</span>
          <span>{{new_admin.full_name}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Email Address:</span>
          <span>{{new_admin.email}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Added By:</span>
          <span>{{added_by.full_name}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Date Added:</span>
          <span>{{added_at}}</span>
        </div>
      </div>
      
      <p>The new administrator now has full access to manage users, courses, and organization settings. They can:</p>
      <ul>
        <li>Add and manage users</li>
        <li>Assign courses and training materials</li>
        <li>View reports and analytics</li>
        <li>Configure organization settings</li>
      </ul>
      
      <p style="margin: 30px 0;">
        <a href="https://{{org.subdomain}}.yourlms.com/admin/users" class="button">View Admin Users</a>
      </p>
      
      <p>If you have any questions about this change, please contact your system administrator.</p>
      
      <p>Best regards,<br>
      <strong>{{org.display_name}} Learning Management System</strong></p>
    </div>
    
    <div class="footer">
      This is an automated notification from your learning management system.
    </div>
  </div>
</body>
</html>`,
    textDefault: `New Administrator Added to {{org.name}}

Hello {{admin.name}},

A new administrator has been added to your organization:

Organization: {{org.display_name}}
New Administrator: {{new_admin.full_name}}
Email Address: {{new_admin.email}}
Added By: {{added_by.full_name}}
Date Added: {{added_at}}

The new administrator now has full access to manage users, courses, and organization settings. They can:
- Add and manage users
- Assign courses and training materials
- View reports and analytics
- Configure organization settings

View admin users: https://{{org.subdomain}}.yourlms.com/admin/users

If you have any questions about this change, please contact your system administrator.

Best regards,
{{org.display_name}} Learning Management System

This is an automated notification from your learning management system.`,
    variablesSchema: {
      org: {
        name: 'string',
        display_name: 'string',
        subdomain: 'string'
      },
      admin: {
        name: 'string',
        email: 'string',
        full_name: 'string'
      },
      new_admin: {
        name: 'string',
        email: 'string',
        full_name: 'string'
      },
      added_by: {
        name: 'string',
        full_name: 'string'
      },
      added_at: 'string'
    },
    updatedBy: 'system'
  },

  {
    key: 'admin.new_user_added',
    category: 'admin',
    subjectDefault: 'New Learner Enrolled: {{user.full_name}}',
    htmlDefault: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Learner Enrolled</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
    .footer { background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 0.9em; color: #6c757d; }
    .highlight { background: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .details-row { display: flex; justify-content: space-between; margin: 8px 0; }
    .details-label { font-weight: 600; color: #495057; }
    .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .button:hover { background: #218838; }
    @media (max-width: 600px) {
      .container { padding: 10px; }
      .details-row { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; color: #28a745;">📚 New Learner Enrolled</h1>
    </div>
    
    <div class="content">
      <p>Hello {{admin.name}},</p>
      
      <div class="highlight">
        <strong>A new learner has been enrolled in your organization:</strong>
      </div>
      
      <div class="details">
        <div class="details-row">
          <span class="details-label">Organization:</span>
          <span>{{org.display_name}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Learner Name:</span>
          <span>{{user.full_name}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Email Address:</span>
          <span>{{user.email}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Job Title:</span>
          <span>{{user.job_title}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Department:</span>
          <span>{{user.department}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Added By:</span>
          <span>{{added_by.full_name}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Enrollment Date:</span>
          <span>{{added_at}}</span>
        </div>
      </div>
      
      <p>The new learner can now:</p>
      <ul>
        <li>Access assigned training courses</li>
        <li>Track their learning progress</li>
        <li>Download completion certificates</li>
        <li>View their learning dashboard</li>
      </ul>
      
      <p>Next steps:</p>
      <ul>
        <li>Assign relevant courses to the learner</li>
        <li>Set up any required training schedules</li>
        <li>Monitor their progress through reports</li>
      </ul>
      
      <p style="margin: 30px 0;">
        <a href="https://{{org.subdomain}}.yourlms.com/admin/users" class="button">Manage Users</a>
      </p>
      
      <p>Welcome aboard, {{user.full_name}}!</p>
      
      <p>Best regards,<br>
      <strong>{{org.display_name}} Learning Management System</strong></p>
    </div>
    
    <div class="footer">
      This is an automated notification from your learning management system.
    </div>
  </div>
</body>
</html>`,
    textDefault: `New Learner Enrolled: {{user.full_name}}

Hello {{admin.name}},

A new learner has been enrolled in your organization:

Organization: {{org.display_name}}
Learner Name: {{user.full_name}}
Email Address: {{user.email}}
Job Title: {{user.job_title}}
Department: {{user.department}}
Added By: {{added_by.full_name}}
Enrollment Date: {{added_at}}

The new learner can now:
- Access assigned training courses
- Track their learning progress
- Download completion certificates
- View their learning dashboard

Next steps:
- Assign relevant courses to the learner
- Set up any required training schedules
- Monitor their progress through reports

Manage users: https://{{org.subdomain}}.yourlms.com/admin/users

Welcome aboard, {{user.full_name}}!

Best regards,
{{org.display_name}} Learning Management System

This is an automated notification from your learning management system.`,
    variablesSchema: {
      org: {
        name: 'string',
        display_name: 'string',
        subdomain: 'string'
      },
      admin: {
        name: 'string',
        email: 'string',
        full_name: 'string'
      },
      user: {
        id: 'string',
        name: 'string',
        email: 'string',
        full_name: 'string',
        job_title: 'string',
        department: 'string'
      },
      added_by: {
        name: 'string',
        full_name: 'string'
      },
      added_at: 'string'
    },
    updatedBy: 'system'
  },

  {
    key: 'admin.new_course_assigned',
    category: 'admin',
    subjectDefault: 'Course Assigned: {{course.title}} → {{user.full_name}}',
    htmlDefault: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Course Assignment Notification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
    .footer { background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 0.9em; color: #6c757d; }
    .highlight { background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107; }
    .details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .details-row { display: flex; justify-content: space-between; margin: 8px 0; }
    .details-label { font-weight: 600; color: #495057; }
    .course-info { background: #e3f2fd; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .button { display: inline-block; background: #ffc107; color: #212529; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .button:hover { background: #e0a800; }
    @media (max-width: 600px) {
      .container { padding: 10px; }
      .details-row { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; color: #ffc107;">🎯 Course Assignment</h1>
    </div>
    
    <div class="content">
      <p>Hello {{admin.name}},</p>
      
      <div class="highlight">
        <strong>A course has been assigned to one of your learners:</strong>
      </div>
      
      <div class="course-info">
        <h3 style="margin: 0 0 15px 0; color: #0d47a1;">📖 {{course.title}}</h3>
        <p style="margin: 5px 0; color: #555;">{{course.description}}</p>
        <div style="display: flex; gap: 20px; margin-top: 15px; flex-wrap: wrap;">
          <span style="background: white; padding: 5px 10px; border-radius: 4px; font-size: 0.9em;">
            <strong>Category:</strong> {{course.category}}
          </span>
          <span style="background: white; padding: 5px 10px; border-radius: 4px; font-size: 0.9em;">
            <strong>Duration:</strong> {{course.estimated_duration}} minutes
          </span>
        </div>
      </div>
      
      <div class="details">
        <div class="details-row">
          <span class="details-label">Organization:</span>
          <span>{{org.display_name}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Assigned To:</span>
          <span>{{user.full_name}} ({{user.email}})</span>
        </div>
        <div class="details-row">
          <span class="details-label">Assigned By:</span>
          <span>{{assigned_by.full_name}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Assignment Date:</span>
          <span>{{assigned_at}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Due Date:</span>
          <span style="color: #dc3545; font-weight: 600;">{{due_date}}</span>
        </div>
      </div>
      
      <p>The learner will be notified about this assignment and can begin the course immediately. You can:</p>
      <ul>
        <li>Monitor their progress through the admin dashboard</li>
        <li>View completion status and scores</li>
        <li>Download completion reports</li>
        <li>Set up reminder notifications if needed</li>
      </ul>
      
      <p style="margin: 30px 0;">
        <a href="https://{{org.subdomain}}.yourlms.com/admin/assignments" class="button">View All Assignments</a>
      </p>
      
      <p>The learner will receive their own notification and can access the course through their learning dashboard.</p>
      
      <p>Best regards,<br>
      <strong>{{org.display_name}} Learning Management System</strong></p>
    </div>
    
    <div class="footer">
      This is an automated notification from your learning management system.
    </div>
  </div>
</body>
</html>`,
    textDefault: `Course Assigned: {{course.title}} → {{user.full_name}}

Hello {{admin.name}},

A course has been assigned to one of your learners:

COURSE DETAILS:
Title: {{course.title}}
Description: {{course.description}}
Category: {{course.category}}
Duration: {{course.estimated_duration}} minutes

ASSIGNMENT DETAILS:
Organization: {{org.display_name}}
Assigned To: {{user.full_name}} ({{user.email}})
Assigned By: {{assigned_by.full_name}}
Assignment Date: {{assigned_at}}
Due Date: {{due_date}}

The learner will be notified about this assignment and can begin the course immediately. You can:
- Monitor their progress through the admin dashboard
- View completion status and scores
- Download completion reports
- Set up reminder notifications if needed

View all assignments: https://{{org.subdomain}}.yourlms.com/admin/assignments

The learner will receive their own notification and can access the course through their learning dashboard.

Best regards,
{{org.display_name}} Learning Management System

This is an automated notification from your learning management system.`,
    variablesSchema: {
      org: {
        name: 'string',
        display_name: 'string',
        subdomain: 'string'
      },
      admin: {
        name: 'string',
        email: 'string',
        full_name: 'string'
      },
      user: {
        id: 'string',
        name: 'string',
        email: 'string',
        full_name: 'string',
        job_title: 'string',
        department: 'string'
      },
      course: {
        title: 'string',
        description: 'string',
        category: 'string',
        estimated_duration: 'number'
      },
      assigned_by: {
        name: 'string',
        full_name: 'string'
      },
      assigned_at: 'string',
      due_date: 'string'
    },
    updatedBy: 'system'
  },

  {
    key: 'admin.plan_updated',
    category: 'admin',
    subjectDefault: 'Billing Plan Updated for {{org.name}}',
    htmlDefault: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Billing Plan Updated</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
    .footer { background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 0.9em; color: #6c757d; }
    .highlight { background: #f0f8ff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #007bff; }
    .details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .details-row { display: flex; justify-content: space-between; margin: 8px 0; }
    .details-label { font-weight: 600; color: #495057; }
    .price-comparison { background: #e8f5e8; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: center; }
    .price-old { color: #dc3545; text-decoration: line-through; font-size: 1.1em; }
    .price-new { color: #28a745; font-weight: bold; font-size: 1.3em; margin-left: 10px; }
    .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .button:hover { background: #0056b3; }
    .warning { background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107; }
    @media (max-width: 600px) {
      .container { padding: 10px; }
      .details-row { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; color: #007bff;">💳 Billing Plan Updated</h1>
    </div>
    
    <div class="content">
      <p>Hello {{admin.name}},</p>
      
      <div class="highlight">
        <strong>Your organization's billing plan has been updated:</strong>
      </div>
      
      <div class="details">
        <div class="details-row">
          <span class="details-label">Organization:</span>
          <span>{{org.display_name}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">New Plan:</span>
          <span style="font-weight: 600; color: #007bff;">{{plan.name}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Billing Frequency:</span>
          <span>{{plan.billing_cadence}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Updated By:</span>
          <span>{{changed_by.full_name}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Change Date:</span>
          <span>{{changed_at}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Effective Date:</span>
          <span style="font-weight: 600;">{{effective_date}}</span>
        </div>
      </div>
      
      <div class="price-comparison">
        <h3 style="margin: 0 0 15px 0;">Pricing Change</h3>
        <div>
          <span class="price-old">$\{{plan.old_price}}</span>
          <span class="price-new">$\{{plan.new_price}}</span>
          <span style="color: #6c757d; display: block; margin-top: 5px; font-size: 0.9em;">per {{plan.billing_cadence}}</span>
        </div>
      </div>
      
      <div class="warning">
        <strong>⚠️ Important:</strong> Your next billing cycle will reflect the new pricing. You'll receive a separate billing confirmation email with payment details.
      </div>
      
      <p>Plan benefits and features:</p>
      <ul>
        <li>All current features remain active</li>
        <li>Billing will update automatically</li>
        <li>No action required from your side</li>
        <li>Access to any new plan features (if applicable)</li>
      </ul>
      
      <p style="margin: 30px 0;">
        <a href="https://{{org.subdomain}}.yourlms.com/admin/billing" class="button">View Billing Details</a>
      </p>
      
      <p>If you have any questions about this billing change or need to discuss your plan options, please contact our support team.</p>
      
      <p>Thank you for your continued trust in our platform!</p>
      
      <p>Best regards,<br>
      <strong>{{org.display_name}} Learning Management System</strong></p>
    </div>
    
    <div class="footer">
      This is an automated notification from your learning management system.
    </div>
  </div>
</body>
</html>`,
    textDefault: `Billing Plan Updated for {{org.name}}

Hello {{admin.name}},

Your organization's billing plan has been updated:

Organization: {{org.display_name}}
New Plan: {{plan.name}}
Billing Frequency: {{plan.billing_cadence}}
Updated By: {{changed_by.full_name}}
Change Date: {{changed_at}}
Effective Date: {{effective_date}}

PRICING CHANGE:
Previous: $\{{plan.old_price}} per {{plan.billing_cadence}}
New: $\{{plan.new_price}} per {{plan.billing_cadence}}

IMPORTANT: Your next billing cycle will reflect the new pricing. You'll receive a separate billing confirmation email with payment details.

Plan benefits and features:
- All current features remain active
- Billing will update automatically
- No action required from your side
- Access to any new plan features (if applicable)

View billing details: https://{{org.subdomain}}.yourlms.com/admin/billing

If you have any questions about this billing change or need to discuss your plan options, please contact our support team.

Thank you for your continued trust in our platform!

Best regards,
{{org.display_name}} Learning Management System

This is an automated notification from your learning management system.`,
    variablesSchema: {
      org: {
        name: 'string',
        display_name: 'string',
        subdomain: 'string'
      },
      admin: {
        name: 'string',
        email: 'string',
        full_name: 'string'
      },
      plan: {
        name: 'string',
        old_price: 'number',
        new_price: 'number',
        billing_cadence: 'string'
      },
      changed_by: {
        name: 'string',
        full_name: 'string'
      },
      changed_at: 'string',
      effective_date: 'string'
    },
    updatedBy: 'system'
  },

  {
    key: 'admin.learner_completed_course',
    category: 'admin',
    subjectDefault: '🎉 Course Completed: {{user.full_name}} - {{course.title}}',
    htmlDefault: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Course Completion Notification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
    .footer { background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 0.9em; color: #6c757d; }
    .highlight { background: #d4edda; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #28a745; }
    .details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .details-row { display: flex; justify-content: space-between; margin: 8px 0; }
    .details-label { font-weight: 600; color: #495057; }
    .score-badge { background: #28a745; color: white; padding: 10px 20px; border-radius: 25px; font-weight: bold; font-size: 1.2em; display: inline-block; margin: 15px 0; }
    .course-info { background: #e3f2fd; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .stats { display: flex; gap: 20px; flex-wrap: wrap; margin: 20px 0; }
    .stat-item { background: white; padding: 15px; border-radius: 6px; text-align: center; flex: 1; min-width: 120px; }
    .stat-value { font-size: 1.5em; font-weight: bold; color: #28a745; }
    .stat-label { font-size: 0.9em; color: #6c757d; }
    .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .button:hover { background: #218838; }
    @media (max-width: 600px) {
      .container { padding: 10px; }
      .details-row { flex-direction: column; }
      .stats { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; color: #28a745;">🏆 Course Completed!</h1>
    </div>
    
    <div class="content">
      <p>Hello {{admin.name}},</p>
      
      <div class="highlight">
        <strong>Excellent news! One of your learners has successfully completed a course:</strong>
      </div>
      
      <div class="course-info">
        <h3 style="margin: 0 0 10px 0; color: #0d47a1;">📚 {{course.title}}</h3>
        <p style="margin: 5px 0; color: #555;">{{course.description}}</p>
      </div>
      
      <div class="details">
        <div class="details-row">
          <span class="details-label">Organization:</span>
          <span>{{org.display_name}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Learner:</span>
          <span>{{user.full_name}} ({{user.email}})</span>
        </div>
        <div class="details-row">
          <span class="details-label">Department:</span>
          <span>{{user.department}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Completion Date:</span>
          <span>{{completed_at}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Status:</span>
          <span style="color: #28a745; font-weight: 600; text-transform: uppercase;">{{attempt.status}}</span>
        </div>
      </div>
      
      <div style="text-align: center; margin: 25px 0;">
        <div class="score-badge">Score: {{attempt.score}}%</div>
      </div>
      
      <div class="stats">
        <div class="stat-item">
          <div class="stat-value">{{attempt.time_spent}}</div>
          <div class="stat-label">Minutes Spent</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{attempt.score}}%</div>
          <div class="stat-label">Final Score</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">✅</div>
          <div class="stat-label">Completed</div>
        </div>
      </div>
      
      <p>This completion demonstrates {{user.full_name}}'s commitment to professional development and compliance training. Key achievements:</p>
      <ul>
        <li>Successfully met all course objectives</li>
        <li>Achieved passing score requirements</li>
        <li>Certificate of completion available</li>
        <li>Knowledge retention validated</li>
      </ul>
      
      <p style="margin: 30px 0;">
        <a href="https://{{org.subdomain}}.yourlms.com/admin/reports" class="button">View Detailed Report</a>
      </p>
      
      <p>The learner can now download their completion certificate and has demonstrated competency in this training area.</p>
      
      <p>Congratulations to {{user.full_name}} on this achievement!</p>
      
      <p>Best regards,<br>
      <strong>{{org.display_name}} Learning Management System</strong></p>
    </div>
    
    <div class="footer">
      This is an automated notification from your learning management system.
    </div>
  </div>
</body>
</html>`,
    textDefault: `🎉 Course Completed: {{user.full_name}} - {{course.title}}

Hello {{admin.name}},

Excellent news! One of your learners has successfully completed a course:

COURSE: {{course.title}}
Description: {{course.description}}

COMPLETION DETAILS:
Organization: {{org.display_name}}
Learner: {{user.full_name}} ({{user.email}})
Department: {{user.department}}
Completion Date: {{completed_at}}
Status: {{attempt.status}}
Final Score: {{attempt.score}}%
Time Spent: {{attempt.time_spent}} minutes

This completion demonstrates {{user.full_name}}'s commitment to professional development and compliance training. Key achievements:
- Successfully met all course objectives
- Achieved passing score requirements
- Certificate of completion available
- Knowledge retention validated

View detailed report: https://{{org.subdomain}}.yourlms.com/admin/reports

The learner can now download their completion certificate and has demonstrated competency in this training area.

Congratulations to {{user.full_name}} on this achievement!

Best regards,
{{org.display_name}} Learning Management System

This is an automated notification from your learning management system.`,
    variablesSchema: {
      org: {
        name: 'string',
        display_name: 'string',
        subdomain: 'string'
      },
      admin: {
        name: 'string',
        email: 'string',
        full_name: 'string'
      },
      user: {
        id: 'string',
        name: 'string',
        email: 'string',
        full_name: 'string',
        job_title: 'string',
        department: 'string'
      },
      course: {
        title: 'string',
        description: 'string',
        category: 'string',
        estimated_duration: 'number'
      },
      attempt: {
        score: 'number',
        status: 'string',
        time_spent: 'number'
      },
      completed_at: 'string'
    },
    updatedBy: 'system'
  },

  {
    key: 'admin.learner_failed_course',
    category: 'admin',
    subjectDefault: '⚠️ Course Failed: {{user.full_name}} - {{course.title}}',
    htmlDefault: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Course Failed Notification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
    .footer { background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 0.9em; color: #6c757d; }
    .highlight { background: #f8d7da; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc3545; }
    .details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .details-row { display: flex; justify-content: space-between; margin: 8px 0; }
    .details-label { font-weight: 600; color: #495057; }
    .score-badge { background: #dc3545; color: white; padding: 10px 20px; border-radius: 25px; font-weight: bold; font-size: 1.2em; display: inline-block; margin: 15px 0; }
    .course-info { background: #fff3cd; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .stats { display: flex; gap: 20px; flex-wrap: wrap; margin: 20px 0; }
    .stat-item { background: white; padding: 15px; border-radius: 6px; text-align: center; flex: 1; min-width: 120px; }
    .stat-value { font-size: 1.5em; font-weight: bold; color: #dc3545; }
    .stat-label { font-size: 0.9em; color: #6c757d; }
    .action-box { background: #e3f2fd; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .button:hover { background: #c82333; }
    .button-secondary { display: inline-block; background: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 10px 20px 0; }
    .button-secondary:hover { background: #5a6268; }
    @media (max-width: 600px) {
      .container { padding: 10px; }
      .details-row { flex-direction: column; }
      .stats { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; color: #dc3545;">📚❌ Course Failed</h1>
    </div>
    
    <div class="content">
      <p>Hello {{admin.name}},</p>
      
      <div class="highlight">
        <strong>One of your learners did not pass a required course and may need additional support:</strong>
      </div>
      
      <div class="course-info">
        <h3 style="margin: 0 0 10px 0; color: #856404;">📖 {{course.title}}</h3>
        <p style="margin: 5px 0; color: #555;">{{course.description}}</p>
      </div>
      
      <div class="details">
        <div class="details-row">
          <span class="details-label">Organization:</span>
          <span>{{org.display_name}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Learner:</span>
          <span>{{user.full_name}} ({{user.email}})</span>
        </div>
        <div class="details-row">
          <span class="details-label">Department:</span>
          <span>{{user.department}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Job Title:</span>
          <span>{{user.job_title}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Attempt Date:</span>
          <span>{{failed_at}}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Status:</span>
          <span style="color: #dc3545; font-weight: 600; text-transform: uppercase;">{{attempt.status}}</span>
        </div>
      </div>
      
      <div style="text-align: center; margin: 25px 0;">
        <div class="score-badge">Score: {{attempt.score}}%</div>
        <p style="color: #dc3545; font-weight: 600; margin: 10px 0;">Passing score required: 80%</p>
      </div>
      
      <div class="stats">
        <div class="stat-item">
          <div class="stat-value">{{attempt.time_spent}}</div>
          <div class="stat-label">Minutes Spent</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{attempt.score}}%</div>
          <div class="stat-label">Score Achieved</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">❌</div>
          <div class="stat-label">Failed</div>
        </div>
      </div>
      
      <div class="action-box">
        <h4 style="margin: 0 0 15px 0; color: #0d47a1;">💡 Recommended Next Steps:</h4>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Review the learner's attempt details and identify knowledge gaps</li>
          <li>Provide additional training resources or one-on-one support</li>
          <li>Schedule a follow-up meeting to discuss learning needs</li>
          <li>Consider prerequisite training if applicable</li>
          <li>Allow for course retake once additional preparation is completed</li>
        </ul>
      </div>
      
      <p>The learner will need to retake this course to meet compliance requirements. Consider providing:</p>
      <ul>
        <li>Additional study materials</li>
        <li>Mentoring or coaching support</li>
        <li>Alternative learning resources</li>
        <li>Extended time for preparation</li>
      </ul>
      
      <p style="margin: 30px 0;">
        <a href="https://{{org.subdomain}}.yourlms.com/admin/users/{{user.id}}" class="button">View Learner Profile</a>
        <a href="https://{{org.subdomain}}.yourlms.com/admin/reports" class="button-secondary">View Detailed Report</a>
      </p>
      
      <p>Supporting your learners through challenges ensures better outcomes and maintains compliance standards.</p>
      
      <p>Best regards,<br>
      <strong>{{org.display_name}} Learning Management System</strong></p>
    </div>
    
    <div class="footer">
      This is an automated notification from your learning management system.
    </div>
  </div>
</body>
</html>`,
    textDefault: `⚠️ Course Failed: {{user.full_name}} - {{course.title}}

Hello {{admin.name}},

One of your learners did not pass a required course and may need additional support:

COURSE: {{course.title}}
Description: {{course.description}}

ATTEMPT DETAILS:
Organization: {{org.display_name}}
Learner: {{user.full_name}} ({{user.email}})
Department: {{user.department}}
Job Title: {{user.job_title}}
Attempt Date: {{failed_at}}
Status: {{attempt.status}}
Score Achieved: {{attempt.score}}%
Time Spent: {{attempt.time_spent}} minutes
Passing Score Required: 80%

RECOMMENDED NEXT STEPS:
- Review the learner's attempt details and identify knowledge gaps
- Provide additional training resources or one-on-one support
- Schedule a follow-up meeting to discuss learning needs
- Consider prerequisite training if applicable
- Allow for course retake once additional preparation is completed

The learner will need to retake this course to meet compliance requirements. Consider providing:
- Additional study materials
- Mentoring or coaching support
- Alternative learning resources
- Extended time for preparation

View learner profile: https://{{org.subdomain}}.yourlms.com/admin/users/{{user.id}}
View detailed report: https://{{org.subdomain}}.yourlms.com/admin/reports

Supporting your learners through challenges ensures better outcomes and maintains compliance standards.

Best regards,
{{org.display_name}} Learning Management System

This is an automated notification from your learning management system.`,
    variablesSchema: {
      org: {
        name: 'string',
        display_name: 'string',
        subdomain: 'string'
      },
      admin: {
        name: 'string',
        email: 'string',
        full_name: 'string'
      },
      user: {
        id: 'string',
        name: 'string',
        email: 'string',
        full_name: 'string',
        job_title: 'string',
        department: 'string'
      },
      course: {
        title: 'string',
        description: 'string',
        category: 'string',
        estimated_duration: 'number'
      },
      attempt: {
        score: 'number',
        status: 'string',
        time_spent: 'number'
      },
      failed_at: 'string'
    },
    updatedBy: 'system'
  }
];

/**
 * Seeds the EmailTemplateDefaults table with professional email templates
 * 
 * @param force - Force overwrite existing templates
 * @returns Object with seeded template count and any errors
 */
export async function seedEmailTemplateDefaults(force: boolean = false): Promise<{
  seeded: number;
  skipped: number;
  errors: string[];
}> {
  const result = {
    seeded: 0,
    skipped: 0,
    errors: [] as string[]
  };

  console.log('🌱 Starting email template defaults seeding...');

  for (const template of defaultEmailTemplates) {
    try {
      // Check if template already exists
      const existing = await db
        .select()
        .from(emailTemplateDefaults)
        .where(eq(emailTemplateDefaults.key, template.key))
        .limit(1);

      if (existing.length > 0 && !force) {
        console.log(`⏭️  Skipping existing template: ${template.key}`);
        result.skipped++;
        continue;
      }

      if (existing.length > 0 && force) {
        // Update existing template
        await db
          .update(emailTemplateDefaults)
          .set({
            ...template,
            updatedAt: new Date()
          })
          .where(eq(emailTemplateDefaults.key, template.key));
        
        console.log(`🔄 Updated template: ${template.key}`);
      } else {
        // Insert new template
        await db
          .insert(emailTemplateDefaults)
          .values(template);
        
        console.log(`✅ Seeded template: ${template.key}`);
      }

      result.seeded++;

    } catch (error) {
      const errorMsg = `Failed to seed template ${template.key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      result.errors.push(errorMsg);
    }
  }

  console.log(`🌱 Email template seeding complete: ${result.seeded} seeded, ${result.skipped} skipped, ${result.errors.length} errors`);
  
  return result;
}

/**
 * Utility function to seed templates from command line or API
 */
export async function runEmailTemplateSeeder(force: boolean = false): Promise<void> {
  try {
    const result = await seedEmailTemplateDefaults(force);
    
    if (result.errors.length > 0) {
      console.error('❌ Seeding completed with errors:', result.errors);
      process.exit(1);
    } else {
      console.log('✅ Email template seeding completed successfully!');
    }
  } catch (error) {
    console.error('💥 Fatal error during seeding:', error);
    process.exit(1);
  }
}

// If run directly from command line
if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes('--force');
  runEmailTemplateSeeder(force);
}