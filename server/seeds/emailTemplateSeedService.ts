/**
 * Email Template Seed Service
 * 
 * Self-healing seed system for email templates with platform defaults.
 * Provides professional, responsive MJML templates for all required template keys
 * with comprehensive variable schemas and UK spelling throughout.
 * 
 * Features:
 * - Upserts missing platform defaults without overwriting existing templates
 * - Professional MJML templates compiled to responsive HTML
 * - Comprehensive variable schemas for template validation
 * - UK spelling and professional tone for all content
 * - Self-healing: triggers automatically when templates are missing
 */

import { EmailTemplateService, type TemplateInput } from '../services/EmailTemplateService';
import { storage } from '../storage';

export class EmailTemplateSeedService {
  private readonly LOG_PREFIX = '[EmailTemplateSeed]';
  private emailTemplateService: EmailTemplateService;

  constructor() {
    this.emailTemplateService = new EmailTemplateService();
  }

  /**
   * Get all required platform default templates with MJML content
   */
  private getPlatformTemplateDefaults(): TemplateInput[] {
    return [
      // ========================================================================
      // ADMIN TEMPLATES - Core system templates for organization management
      // ========================================================================

      {
        key: 'new_org_welcome',
        name: 'New Organisation Welcome',
        category: 'admin',
        subject: 'Your organisation {{orgName}} is set up — login details inside',
        mjml: `
<mjml>
  <mj-head>
    <mj-title>Your organisation {{orgName}} is set up</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" />
      <mj-text line-height="1.6" color="#374151" />
      <mj-button background-color="#3B82F6" border-radius="8px" font-weight="600" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F9FAFB">
    <mj-section background-color="#FFFFFF" border-radius="12px" padding="0">
      <!-- Header -->
      <mj-column>
        <mj-spacer height="32px" />
        <mj-text align="center" font-size="32px" font-weight="700" color="#1F2937" line-height="1.2">
          🎉 Your organisation is ready!
        </mj-text>
        <mj-text align="center" font-size="18px" color="#6B7280" padding-top="8px">
          {{orgName}} has been successfully set up
        </mj-text>
        <mj-spacer height="32px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px">
          Hello {{adminName}},
        </mj-text>
        <mj-text font-size="16px">
          Great news! Your organisation <strong>{{orgName}}</strong> has been successfully set up and is ready to use. 
          Below are your administrator login details to get started.
        </mj-text>

        <!-- Login Details Card -->
        <mj-section background-color="#F8FAFC" border-radius="8px" padding="24px" border="2px solid #3B82F6">
          <mj-column>
            <mj-text font-size="18px" font-weight="600" color="#1F2937" padding-bottom="16px">
              🔐 Your Administrator Login Details
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Login URL:</strong> {{loginUrl}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Email:</strong> {{adminEmail}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Temporary Password:</strong> {{temporaryPassword}}
            </mj-text>
            <mj-text font-size="12px" padding="8px 0" color="#DC2626">
              <strong>Important:</strong> Please change your password after first login
            </mj-text>
          </mj-column>
        </mj-section>

        <mj-text font-size="16px" padding-top="24px">
          <strong>Next steps to get started:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • Log in using the credentials above<br/>
          • Change your password and complete your profile<br/>
          • Set up your organisation settings and branding<br/>
          • Upload courses and training materials<br/>
          • Invite users to your organisation<br/>
          • Configure email settings and notifications
        </mj-text>

        <mj-button href="{{loginUrl}}" align="center" background-color="#3B82F6" color="#FFFFFF" font-size="16px" padding="24px 0">
          Access Administrator Dashboard
        </mj-button>

        <mj-text font-size="16px" color="#6B7280" align="center" padding-top="24px">
          If you need any assistance getting started, our support team is here to help.
        </mj-text>

        <mj-text font-size="16px" padding-top="32px">
          Welcome aboard!<br/>
          <strong>The inteLMS Team</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#F9FAFB" padding="32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9CA3AF">
          This is an automated message from inteLMS Learning Management System.
          <br/>You received this because an organisation account was created for you.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: `Your organisation {{orgName}} is set up — login details inside

Hello {{adminName}},

Great news! Your organisation {{orgName}} has been successfully set up and is ready to use. Below are your administrator login details to get started.

YOUR ADMINISTRATOR LOGIN DETAILS:
Login URL: {{loginUrl}}
Email: {{adminEmail}}
Temporary Password: {{temporaryPassword}}

IMPORTANT: Please change your password after first login

NEXT STEPS TO GET STARTED:
• Log in using the credentials above
• Change your password and complete your profile
• Set up your organisation settings and branding
• Upload courses and training materials
• Invite users to your organisation
• Configure email settings and notifications

Access your administrator dashboard: {{loginUrl}}

If you need any assistance getting started, our support team is here to help.

Welcome aboard!
The inteLMS Team

This is an automated message from inteLMS Learning Management System.
You received this because an organisation account was created for you.`,
        variablesSchema: {
          type: 'object',
          required: ['orgName', 'adminName', 'adminEmail', 'loginUrl', 'temporaryPassword'],
          properties: {
            orgName: { type: 'string', description: 'Organization name' },
            adminName: { type: 'string', description: 'Administrator name' },
            adminEmail: { type: 'string', description: 'Administrator email address' },
            loginUrl: { type: 'string', description: 'Login URL for the organisation' },
            temporaryPassword: { type: 'string', description: 'Temporary password for first login' }
          }
        }
      },

      {
        key: 'new_user_welcome',
        name: 'New User Welcome',
        category: 'learner',
        subject: 'Welcome to {{orgName}} training — your login details',
        mjml: `
<mjml>
  <mj-head>
    <mj-title>Welcome to {{orgName}} training</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" />
      <mj-text line-height="1.6" color="#374151" />
      <mj-button background-color="#059669" border-radius="8px" font-weight="600" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F9FAFB">
    <mj-section background-color="#FFFFFF" border-radius="12px" padding="0">
      <!-- Header -->
      <mj-column>
        <mj-spacer height="32px" />
        <mj-text align="center" font-size="32px" font-weight="700" color="#1F2937" line-height="1.2">
          🎓 Welcome to {{orgName}}!
        </mj-text>
        <mj-text align="center" font-size="18px" color="#6B7280" padding-top="8px">
          Your training account is ready
        </mj-text>
        <mj-spacer height="32px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px">
          Hello {{userName}},
        </mj-text>
        <mj-text font-size="16px">
          Welcome to <strong>{{orgName}}</strong>! Your training account has been created and you're ready to begin your learning journey.
          Below are your login credentials to access your training platform.
        </mj-text>

        <!-- Login Details Card -->
        <mj-section background-color="#ECFDF5" border-radius="8px" padding="24px" border="2px solid #059669">
          <mj-column>
            <mj-text font-size="18px" font-weight="600" color="#047857" padding-bottom="16px">
              🔐 Your Login Details
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Login URL:</strong> {{loginUrl}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Email:</strong> {{userEmail}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Temporary Password:</strong> {{temporaryPassword}}
            </mj-text>
            <mj-text font-size="12px" padding="8px 0" color="#DC2626">
              <strong>Important:</strong> Please change your password after first login
            </mj-text>
          </mj-column>
        </mj-section>

        <mj-text font-size="16px" padding-top="24px">
          <strong>What you can do in your training platform:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • Access your assigned courses and training materials<br/>
          • Track your learning progress and achievements<br/>
          • Complete assessments and earn certificates<br/>
          • View your training schedule and deadlines<br/>
          • Update your profile and learning preferences<br/>
          • Download completion certificates
        </mj-text>

        <mj-button href="{{loginUrl}}" align="center" background-color="#059669" color="#FFFFFF" font-size="16px" padding="24px 0">
          Start Your Training Journey
        </mj-button>

        <mj-text font-size="16px" color="#6B7280" align="center" padding-top="24px">
          If you have any questions about your training, please contact your administrator or our support team.
        </mj-text>

        <mj-text font-size="16px" padding-top="32px">
          Happy learning!<br/>
          <strong>The {{orgName}} Team</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#F9FAFB" padding="32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9CA3AF">
          This is an automated message from {{orgName}} Learning Management System.
          <br/>You received this because a training account was created for you.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: `Welcome to {{orgName}} training — your login details

Hello {{userName}},

Welcome to {{orgName}}! Your training account has been created and you're ready to begin your learning journey. Below are your login credentials to access your training platform.

YOUR LOGIN DETAILS:
Login URL: {{loginUrl}}
Email: {{userEmail}}
Temporary Password: {{temporaryPassword}}

IMPORTANT: Please change your password after first login

WHAT YOU CAN DO IN YOUR TRAINING PLATFORM:
• Access your assigned courses and training materials
• Track your learning progress and achievements
• Complete assessments and earn certificates
• View your training schedule and deadlines
• Update your profile and learning preferences
• Download completion certificates

Start your training journey: {{loginUrl}}

If you have any questions about your training, please contact your administrator or our support team.

Happy learning!
The {{orgName}} Team

This is an automated message from {{orgName}} Learning Management System.
You received this because a training account was created for you.`,
        variablesSchema: {
          type: 'object',
          required: ['orgName', 'userName', 'userEmail', 'loginUrl', 'temporaryPassword'],
          properties: {
            orgName: { type: 'string', description: 'Organization name' },
            userName: { type: 'string', description: 'User name' },
            userEmail: { type: 'string', description: 'User email address' },
            loginUrl: { type: 'string', description: 'Login URL for the training platform' },
            temporaryPassword: { type: 'string', description: 'Temporary password for first login' }
          }
        }
      },

      // ========================================================================
      // LEARNER TEMPLATES
      // ========================================================================

      {
        key: 'welcome',
        name: 'Welcome Email',
        category: 'learner',
        subject: 'Welcome to {{org.name}} - Your Learning Journey Begins',
        mjml: `
<mjml>
  <mj-head>
    <mj-title>Welcome to {{org.name}}</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" />
      <mj-text line-height="1.6" color="#374151" />
      <mj-button background-color="#3B82F6" border-radius="8px" font-weight="600" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F9FAFB">
    <mj-section background-color="#FFFFFF" border-radius="12px" padding="0">
      <!-- Header -->
      <mj-column>
        <mj-spacer height="32px" />
        <mj-text align="center" font-size="32px" font-weight="700" color="#1F2937" line-height="1.2">
          🎉 Welcome to {{org.name}}!
        </mj-text>
        <mj-text align="center" font-size="18px" color="#6B7280" padding-top="8px">
          Your learning journey starts here
        </mj-text>
        <mj-spacer height="32px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px">
          Hello {{user.name}},
        </mj-text>
        <mj-text font-size="16px">
          Welcome to {{org.name}}! We're delighted to have you join our learning community. 
          Your account has been successfully created and you're ready to begin your professional development journey.
        </mj-text>

        <!-- Account Details Card -->
        <mj-section background-color="#F8FAFC" border-radius="8px" padding="24px">
          <mj-column>
            <mj-text font-size="18px" font-weight="600" color="#1F2937" padding-bottom="16px">
              📋 Your Account Details
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Name:</strong> {{user.full_name}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Email:</strong> {{user.email}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Organisation:</strong> {{org.name}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Role:</strong> {{user.role}}
            </mj-text>
          </mj-column>
        </mj-section>

        <mj-text font-size="16px" padding-top="24px">
          <strong>What you can do next:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • Access your learning dashboard and explore available courses<br/>
          • Complete your profile with additional details<br/>
          • Browse the course catalogue and learning resources<br/>
          • Track your progress and achievements<br/>
          • Download completion certificates as you progress
        </mj-text>

        <mj-button href="{{org.login_url}}" align="center" background-color="#3B82F6" color="#FFFFFF" font-size="16px" padding="24px 0">
          Access Your Learning Dashboard
        </mj-button>

        <mj-text font-size="16px" color="#6B7280" align="center" padding-top="24px">
          If you have any questions, don't hesitate to contact your administrator or our support team.
        </mj-text>

        <mj-text font-size="16px" padding-top="32px">
          Best regards,<br/>
          <strong>The {{org.name}} Team</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#F9FAFB" padding="32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9CA3AF">
          This is an automated message from {{org.name}} Learning Management System.
          <br/>You received this because an account was created for you.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: `Welcome to {{org.name}} - Your Learning Journey Begins

Hello {{user.name}},

Welcome to {{org.name}}! We're delighted to have you join our learning community. Your account has been successfully created and you're ready to begin your professional development journey.

YOUR ACCOUNT DETAILS:
Name: {{user.full_name}}
Email: {{user.email}}
Organisation: {{org.name}}
Role: {{user.role}}

WHAT YOU CAN DO NEXT:
• Access your learning dashboard and explore available courses
• Complete your profile with additional details
• Browse the course catalogue and learning resources
• Track your progress and achievements
• Download completion certificates as you progress

Access your learning dashboard: {{org.login_url}}

If you have any questions, don't hesitate to contact your administrator or our support team.

Best regards,
The {{org.name}} Team

This is an automated message from {{org.name}} Learning Management System.
You received this because an account was created for you.`,
        variablesSchema: {
          type: 'object',
          required: ['org', 'user'],
          properties: {
            org: {
              type: 'object',
              required: ['name', 'login_url'],
              properties: {
                name: { type: 'string', description: 'Organisation name' },
                login_url: { type: 'string', description: 'Login URL for the organisation' }
              }
            },
            user: {
              type: 'object',
              required: ['name', 'email', 'full_name', 'role'],
              properties: {
                name: { type: 'string', description: 'User first name or display name' },
                email: { type: 'string', description: 'User email address' },
                full_name: { type: 'string', description: 'User full name' },
                role: { type: 'string', description: 'User role (learner, admin, etc.)' }
              }
            }
          }
        }
      },

      {
        key: 'course_assigned',
        name: 'Course Assignment Notification',
        category: 'learner',
        subject: 'You\'ve been assigned: {{courseTitle}}',
        mjml: `
<mjml>
  <mj-head>
    <mj-title>Course Assignment: {{course.title}}</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" />
      <mj-text line-height="1.6" color="#374151" />
      <mj-button background-color="#059669" border-radius="8px" font-weight="600" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F9FAFB">
    <mj-section background-color="#FFFFFF" border-radius="12px" padding="0">
      <!-- Header -->
      <mj-column>
        <mj-spacer height="32px" />
        <mj-text align="center" font-size="32px" font-weight="700" color="#1F2937" line-height="1.2">
          📚 New Course Assigned
        </mj-text>
        <mj-text align="center" font-size="18px" color="#6B7280" padding-top="8px">
          Time to enhance your skills!
        </mj-text>
        <mj-spacer height="32px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px">
          Hello {{userName}},
        </mj-text>
        <mj-text font-size="16px">
          Great news! A new course has been assigned to you. This is an excellent opportunity to develop your skills and advance your professional knowledge.
        </mj-text>

        <!-- Course Details Card -->
        <mj-section background-color="#ECFDF5" border-radius="8px" padding="24px" border="2px solid #10B981">
          <mj-column>
            <mj-text font-size="20px" font-weight="600" color="#065F46" padding-bottom="12px">
              🎯 {{course.title}}
            </mj-text>
            <mj-text font-size="16px" color="#047857" padding-bottom="16px">
              {{course.description}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Category:</strong> {{course.category}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Estimated Duration:</strong> {{course.estimated_duration}} minutes
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Assigned by:</strong> {{assigned_by.name}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Due Date:</strong> {{due_date}}
            </mj-text>
          </mj-column>
        </mj-section>

        <mj-text font-size="16px" padding-top="24px">
          <strong>Why this course matters:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • Develop essential skills for your role<br/>
          • Stay current with industry best practices<br/>
          • Enhance your professional qualifications<br/>
          • Contribute to your team's success<br/>
          • Earn a completion certificate
        </mj-text>

        <mj-button href="{{course.start_url}}" align="center" background-color="#059669" color="#FFFFFF" font-size="16px" padding="24px 0">
          Start Course Now
        </mj-button>

        <mj-text font-size="14px" color="#6B7280" align="center" padding-top="16px">
          You can access this course anytime from your learning dashboard and pick up where you left off.
        </mj-text>

        <mj-text font-size="16px" padding-top="32px">
          Happy learning!<br/>
          <strong>The {{org.name}} Team</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#F9FAFB" padding="32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9CA3AF">
          This course assignment was sent by {{org.name}}.
          <br/>Questions? Contact your administrator or our support team.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: `New Course Assigned: {{course.title}}

Hello {{user.name}},

Great news! A new course has been assigned to you. This is an excellent opportunity to develop your skills and advance your professional knowledge.

COURSE DETAILS:
Title: {{course.title}}
Description: {{course.description}}
Category: {{course.category}}
Estimated Duration: {{course.estimated_duration}} minutes
Assigned by: {{assigned_by.name}}
Due Date: {{due_date}}

WHY THIS COURSE MATTERS:
• Develop essential skills for your role
• Stay current with industry best practices
• Enhance your professional qualifications
• Contribute to your team's success
• Earn a completion certificate

Start Course Now: {{course.start_url}}

You can access this course anytime from your learning dashboard and pick up where you left off.

Happy learning!
The {{org.name}} Team

This course assignment was sent by {{org.name}}.
Questions? Contact your administrator or our support team.`,
        variablesSchema: {
          type: 'object',
          required: ['org', 'user', 'course', 'assigned_by', 'due_date'],
          properties: {
            org: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Organisation name' }
              }
            },
            user: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'User first name' }
              }
            },
            course: {
              type: 'object',
              required: ['title', 'description', 'category', 'estimated_duration', 'start_url'],
              properties: {
                title: { type: 'string', description: 'Course title' },
                description: { type: 'string', description: 'Course description' },
                category: { type: 'string', description: 'Course category' },
                estimated_duration: { type: 'number', description: 'Course duration in minutes' },
                start_url: { type: 'string', description: 'URL to start the course' }
              }
            },
            assigned_by: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Name of person who assigned the course' }
              }
            },
            due_date: { type: 'string', description: 'Due date for course completion' }
          }
        }
      },

      {
        key: 'course_reminder',
        name: 'Course Reminder',
        category: 'learner',
        subject: 'Reminder: Complete {{course.title}} by {{due_date}}',
        mjml: `
<mjml>
  <mj-head>
    <mj-title>Course Reminder: {{course.title}}</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" />
      <mj-text line-height="1.6" color="#374151" />
      <mj-button background-color="#F59E0B" border-radius="8px" font-weight="600" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F9FAFB">
    <mj-section background-color="#FFFFFF" border-radius="12px" padding="0">
      <!-- Header -->
      <mj-column>
        <mj-spacer height="32px" />
        <mj-text align="center" font-size="32px" font-weight="700" color="#1F2937" line-height="1.2">
          ⏰ Course Reminder
        </mj-text>
        <mj-text align="center" font-size="18px" color="#6B7280" padding-top="8px">
          Don't forget to complete your training
        </mj-text>
        <mj-spacer height="32px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px">
          Hello {{user.name}},
        </mj-text>
        <mj-text font-size="16px">
          This is a friendly reminder that you have a course deadline approaching. We want to ensure you have enough time to complete your training successfully.
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Course Progress Card -->
    <mj-section background-color="#FFFBEB" padding="24px 32px" border="2px solid #F59E0B">
      <mj-column>
        <mj-text font-size="20px" font-weight="600" color="#92400E" padding-bottom="12px">
          📖 {{course.title}}
        </mj-text>
        <mj-text font-size="16px" color="#D97706" padding-bottom="16px">
          {{course.description}}
        </mj-text>
        <mj-text font-size="14px" padding="4px 0">
          <strong>Progress:</strong> {{progress.percentage}}% complete
        </mj-text>
        <mj-text font-size="14px" padding="4px 0">
          <strong>Time Remaining:</strong> {{progress.estimated_time_left}} minutes
        </mj-text>
        <mj-text font-size="14px" padding="4px 0">
          <strong>Due Date:</strong> {{due_date}}
        </mj-text>
        <mj-text font-size="14px" padding="4px 0">
          <strong>Days Until Due:</strong> {{days_until_due}} days
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px" padding-top="24px">
          <strong>Complete your training to:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • Meet your professional development requirements<br/>
          • Avoid any compliance issues<br/>
          • Earn your completion certificate<br/>
          • Apply new skills in your role<br/>
          • Stay on track with your learning goals
        </mj-text>

        <mj-button href="{{course.continue_url}}" align="center" background-color="#F59E0B" color="#FFFFFF" font-size="16px" padding="24px 0">
          Continue Course
        </mj-button>

        <mj-text font-size="14px" color="#6B7280" align="center" padding-top="16px">
          Having trouble? Contact your administrator for assistance or deadline extension.
        </mj-text>

        <mj-text font-size="16px" padding-top="32px">
          Best of luck with your studies!<br/>
          <strong>The {{org.name}} Team</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#F9FAFB" padding="32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9CA3AF">
          This reminder was sent by {{org.name}} Learning Management System.
          <br/>You can adjust notification preferences in your account settings.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: `Reminder: Complete {{course.title}} by {{due_date}}

Hello {{user.name}},

This is a friendly reminder that you have a course deadline approaching. We want to ensure you have enough time to complete your training successfully.

COURSE PROGRESS:
Title: {{course.title}}
Description: {{course.description}}
Progress: {{progress.percentage}}% complete
Time Remaining: {{progress.estimated_time_left}} minutes
Due Date: {{due_date}}
Days Until Due: {{days_until_due}} days

COMPLETE YOUR TRAINING TO:
• Meet your professional development requirements
• Avoid any compliance issues
• Earn your completion certificate
• Apply new skills in your role
• Stay on track with your learning goals

Continue Course: {{course.continue_url}}

Having trouble? Contact your administrator for assistance or deadline extension.

Best of luck with your studies!
The {{org.name}} Team

This reminder was sent by {{org.name}} Learning Management System.
You can adjust notification preferences in your account settings.`,
        variablesSchema: {
          type: 'object',
          required: ['org', 'user', 'course', 'progress', 'due_date', 'days_until_due'],
          properties: {
            org: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Organisation name' }
              }
            },
            user: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'User first name' }
              }
            },
            course: {
              type: 'object',
              required: ['title', 'description', 'continue_url'],
              properties: {
                title: { type: 'string', description: 'Course title' },
                description: { type: 'string', description: 'Course description' },
                continue_url: { type: 'string', description: 'URL to continue the course' }
              }
            },
            progress: {
              type: 'object',
              required: ['percentage', 'estimated_time_left'],
              properties: {
                percentage: { type: 'number', description: 'Completion percentage' },
                estimated_time_left: { type: 'number', description: 'Estimated time remaining in minutes' }
              }
            },
            due_date: { type: 'string', description: 'Due date for course completion' },
            days_until_due: { type: 'number', description: 'Number of days until due date' }
          }
        }
      },

      {
        key: 'course_overdue',
        name: 'Course Overdue Notification',
        category: 'learner',
        subject: 'Overdue: {{course.title}} - Action Required',
        mjml: `
<mjml>
  <mj-head>
    <mj-title>Course Overdue: {{course.title}}</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" />
      <mj-text line-height="1.6" color="#374151" />
      <mj-button background-color="#DC2626" border-radius="8px" font-weight="600" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F9FAFB">
    <mj-section background-color="#FFFFFF" border-radius="12px" padding="0">
      <!-- Header -->
      <mj-column>
        <mj-spacer height="32px" />
        <mj-text align="center" font-size="32px" font-weight="700" color="#DC2626" line-height="1.2">
          🚨 Course Overdue
        </mj-text>
        <mj-text align="center" font-size="18px" color="#6B7280" padding-top="8px">
          Immediate action required
        </mj-text>
        <mj-spacer height="32px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px">
          Hello {{user.name}},
        </mj-text>
        <mj-text font-size="16px">
          We need to bring to your attention that your assigned course has passed its due date. Please take immediate action to complete this training requirement.
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Overdue Course Card -->
    <mj-section background-color="#FEF2F2" padding="24px 32px" border="2px solid #DC2626">
      <mj-column>
        <mj-text font-size="20px" font-weight="600" color="#991B1B" padding-bottom="12px">
          ⚠️ {{course.title}}
        </mj-text>
        <mj-text font-size="16px" color="#B91C1C" padding-bottom="16px">
          {{course.description}}
        </mj-text>
        <mj-text font-size="14px" padding="4px 0">
          <strong>Current Progress:</strong> {{progress.percentage}}% complete
        </mj-text>
        <mj-text font-size="14px" padding="4px 0">
          <strong>Original Due Date:</strong> {{due_date}}
        </mj-text>
        <mj-text font-size="14px" padding="4px 0">
          <strong>Days Overdue:</strong> {{days_overdue}} days
        </mj-text>
        <mj-text font-size="14px" padding="4px 0">
          <strong>Time to Complete:</strong> {{progress.estimated_time_left}} minutes remaining
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px" padding-top="24px">
          <strong>Why immediate action is needed:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • Compliance requirements may be affected<br/>
          • Your professional development record needs updating<br/>
          • This may impact performance reviews<br/>
          • Delayed training affects team standards<br/>
          • Extended overdue status may require escalation
        </mj-text>

        <mj-text font-size="16px" padding-top="20px">
          <strong>Next steps:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          1. Complete the course as soon as possible<br/>
          2. Contact your administrator if you need an extension<br/>
          3. If technical issues prevent completion, report them immediately<br/>
          4. Schedule dedicated time to finish the remaining content
        </mj-text>

        <mj-button href="{{course.complete_url}}" align="center" background-color="#DC2626" color="#FFFFFF" font-size="16px" padding="24px 0">
          Complete Course Now
        </mj-button>

        <mj-text font-size="14px" color="#6B7280" align="center" padding-top="16px">
          Need help or an extension? Contact your administrator immediately at {{admin.contact_email}}
        </mj-text>

        <mj-text font-size="16px" padding-top="32px">
          Regards,<br/>
          <strong>The {{org.name}} Team</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#F9FAFB" padding="32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9CA3AF">
          This overdue notification was sent by {{org.name}} Learning Management System.
          <br/>Contact your administrator if you believe this is in error.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: `Overdue: {{course.title}} - Action Required

Hello {{user.name}},

We need to bring to your attention that your assigned course has passed its due date. Please take immediate action to complete this training requirement.

OVERDUE COURSE DETAILS:
Title: {{course.title}}
Description: {{course.description}}
Current Progress: {{progress.percentage}}% complete
Original Due Date: {{due_date}}
Days Overdue: {{days_overdue}} days
Time to Complete: {{progress.estimated_time_left}} minutes remaining

WHY IMMEDIATE ACTION IS NEEDED:
• Compliance requirements may be affected
• Your professional development record needs updating
• This may impact performance reviews
• Delayed training affects team standards
• Extended overdue status may require escalation

NEXT STEPS:
1. Complete the course as soon as possible
2. Contact your administrator if you need an extension
3. If technical issues prevent completion, report them immediately
4. Schedule dedicated time to finish the remaining content

Complete Course Now: {{course.complete_url}}

Need help or an extension? Contact your administrator immediately at {{admin.contact_email}}

Regards,
The {{org.name}} Team

This overdue notification was sent by {{org.name}} Learning Management System.
Contact your administrator if you believe this is in error.`,
        variablesSchema: {
          type: 'object',
          required: ['org', 'user', 'course', 'progress', 'due_date', 'days_overdue', 'admin'],
          properties: {
            org: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Organisation name' }
              }
            },
            user: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'User first name' }
              }
            },
            course: {
              type: 'object',
              required: ['title', 'description', 'complete_url'],
              properties: {
                title: { type: 'string', description: 'Course title' },
                description: { type: 'string', description: 'Course description' },
                complete_url: { type: 'string', description: 'URL to complete the course' }
              }
            },
            progress: {
              type: 'object',
              required: ['percentage', 'estimated_time_left'],
              properties: {
                percentage: { type: 'number', description: 'Completion percentage' },
                estimated_time_left: { type: 'number', description: 'Estimated time remaining in minutes' }
              }
            },
            due_date: { type: 'string', description: 'Original due date' },
            days_overdue: { type: 'number', description: 'Number of days overdue' },
            admin: {
              type: 'object',
              required: ['contact_email'],
              properties: {
                contact_email: { type: 'string', description: 'Administrator contact email' }
              }
            }
          }
        }
      },

      {
        key: 'training_expiring',
        name: 'Training Expiry Warning',
        category: 'learner',
        subject: 'Training Expiring Soon: {{course.title}} - Renewal Required',
        mjml: `
<mjml>
  <mj-head>
    <mj-title>Training Expiring: {{course.title}}</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" />
      <mj-text line-height="1.6" color="#374151" />
      <mj-button background-color="#F59E0B" border-radius="8px" font-weight="600" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F9FAFB">
    <mj-section background-color="#FFFFFF" border-radius="12px" padding="0">
      <!-- Header -->
      <mj-column>
        <mj-spacer height="32px" />
        <mj-text align="center" font-size="32px" font-weight="700" color="#F59E0B" line-height="1.2">
          ⏳ Training Expiring Soon
        </mj-text>
        <mj-text align="center" font-size="18px" color="#6B7280" padding-top="8px">
          Renewal action required
        </mj-text>
        <mj-spacer height="32px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px">
          Hello {{user.name}},
        </mj-text>
        <mj-text font-size="16px">
          We're writing to inform you that your training certification is approaching its expiry date. To maintain your qualifications and compliance status, renewal is required.
        </mj-text>

        <!-- Expiring Training Card -->
        <mj-section background-color="#FFFBEB" border-radius="8px" padding="24px" border="2px solid #F59E0B">
          <mj-column>
            <mj-text font-size="20px" font-weight="600" color="#92400E" padding-bottom="12px">
              🏆 {{course.title}}
            </mj-text>
            <mj-text font-size="16px" color="#D97706" padding-bottom="16px">
              {{course.description}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Original Completion:</strong> {{completion.date}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Current Status:</strong> {{completion.status}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Expiry Date:</strong> {{expiry.date}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Days Until Expiry:</strong> {{expiry.days_remaining}} days
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Validity Period:</strong> {{expiry.validity_period}}
            </mj-text>
          </mj-column>
        </mj-section>

        <mj-text font-size="16px" padding-top="24px">
          <strong>Why renewal is important:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • Maintain compliance with industry standards<br/>
          • Keep your professional qualifications current<br/>
          • Ensure continued access to work responsibilities<br/>
          • Stay updated with latest practices and regulations<br/>
          • Avoid gaps in your training record
        </mj-text>

        <mj-text font-size="16px" padding-top="20px">
          <strong>Renewal options:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • Complete the updated course materials<br/>
          • Pass the renewal assessment<br/>
          • Attend a refresher training session<br/>
          • Complete continuing professional development credits
        </mj-text>

        <mj-button href="{{renewal.start_url}}" align="center" background-color="#F59E0B" color="#FFFFFF" font-size="16px" padding="24px 0">
          Start Renewal Process
        </mj-button>

        <mj-text font-size="14px" color="#6B7280" align="center" padding-top="16px">
          Questions about renewal requirements? Contact your administrator at {{admin.contact_email}}
        </mj-text>

        <mj-text font-size="16px" padding-top="32px">
          Thank you for staying current with your training,<br/>
          <strong>The {{org.name}} Team</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#F9FAFB" padding="32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9CA3AF">
          This renewal reminder was sent by {{org.name}} Learning Management System.
          <br/>Renewal schedules are managed automatically based on completion dates.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: `Training Expiring Soon: {{course.title}} - Renewal Required

Hello {{user.name}},

We're writing to inform you that your training certification is approaching its expiry date. To maintain your qualifications and compliance status, renewal is required.

EXPIRING TRAINING DETAILS:
Title: {{course.title}}
Description: {{course.description}}
Original Completion: {{completion.date}}
Current Status: {{completion.status}}
Expiry Date: {{expiry.date}}
Days Until Expiry: {{expiry.days_remaining}} days
Validity Period: {{expiry.validity_period}}

WHY RENEWAL IS IMPORTANT:
• Maintain compliance with industry standards
• Keep your professional qualifications current
• Ensure continued access to work responsibilities
• Stay updated with latest practices and regulations
• Avoid gaps in your training record

RENEWAL OPTIONS:
• Complete the updated course materials
• Pass the renewal assessment
• Attend a refresher training session
• Complete continuing professional development credits

Start Renewal Process: {{renewal.start_url}}

Questions about renewal requirements? Contact your administrator at {{admin.contact_email}}

Thank you for staying current with your training,
The {{org.name}} Team

This renewal reminder was sent by {{org.name}} Learning Management System.
Renewal schedules are managed automatically based on completion dates.`,
        variablesSchema: {
          type: 'object',
          required: ['org', 'user', 'course', 'completion', 'expiry', 'renewal', 'admin'],
          properties: {
            org: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Organisation name' }
              }
            },
            user: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'User first name' }
              }
            },
            course: {
              type: 'object',
              required: ['title', 'description'],
              properties: {
                title: { type: 'string', description: 'Course title' },
                description: { type: 'string', description: 'Course description' }
              }
            },
            completion: {
              type: 'object',
              required: ['date', 'status'],
              properties: {
                date: { type: 'string', description: 'Original completion date' },
                status: { type: 'string', description: 'Current completion status' }
              }
            },
            expiry: {
              type: 'object',
              required: ['date', 'days_remaining', 'validity_period'],
              properties: {
                date: { type: 'string', description: 'Expiry date' },
                days_remaining: { type: 'number', description: 'Days until expiry' },
                validity_period: { type: 'string', description: 'Validity period description' }
              }
            },
            renewal: {
              type: 'object',
              required: ['start_url'],
              properties: {
                start_url: { type: 'string', description: 'URL to start renewal process' }
              }
            },
            admin: {
              type: 'object',
              required: ['contact_email'],
              properties: {
                contact_email: { type: 'string', description: 'Administrator contact email' }
              }
            }
          }
        }
      },

      {
        key: 'training_expired',
        name: 'Training Expired Notification',
        category: 'learner',
        subject: 'Training Expired: {{course.title}} - Immediate Renewal Required',
        mjml: `
<mjml>
  <mj-head>
    <mj-title>Training Expired: {{course.title}}</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" />
      <mj-text line-height="1.6" color="#374151" />
      <mj-button background-color="#DC2626" border-radius="8px" font-weight="600" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F9FAFB">
    <mj-section background-color="#FFFFFF" border-radius="12px" padding="0">
      <!-- Header -->
      <mj-column>
        <mj-spacer height="32px" />
        <mj-text align="center" font-size="32px" font-weight="700" color="#DC2626" line-height="1.2">
          🚨 Training Expired
        </mj-text>
        <mj-text align="center" font-size="18px" color="#6B7280" padding-top="8px">
          Immediate renewal required
        </mj-text>
        <mj-spacer height="32px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px">
          Hello {{user.name}},
        </mj-text>
        <mj-text font-size="16px">
          We must inform you that your training certification has expired. This affects your compliance status and may impact your ability to perform certain work tasks. Immediate renewal is required.
        </mj-text>

        <!-- Expired Training Card -->
        <mj-section background-color="#FEF2F2" border-radius="8px" padding="24px" border="2px solid #DC2626">
          <mj-column>
            <mj-text font-size="20px" font-weight="600" color="#991B1B" padding-bottom="12px">
              ⚠️ {{course.title}}
            </mj-text>
            <mj-text font-size="16px" color="#B91C1C" padding-bottom="16px">
              {{course.description}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Original Completion:</strong> {{completion.date}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Expiry Date:</strong> {{expiry.date}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Current Status:</strong> EXPIRED
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Days Expired:</strong> {{expiry.days_expired}} days
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Compliance Impact:</strong> {{compliance.impact_level}}
            </mj-text>
          </mj-column>
        </mj-section>

        <mj-text font-size="16px" padding-top="24px">
          <strong>Impact of expired training:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • Compliance requirements are no longer met<br/>
          • Professional qualifications are inactive<br/>
          • Work responsibilities may be restricted<br/>
          • Audit and regulatory issues may occur<br/>
          • Training record shows gap in certification
        </mj-text>

        <mj-text font-size="16px" padding-top="20px">
          <strong>Immediate actions required:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          1. Begin renewal training immediately<br/>
          2. Contact your administrator about work restrictions<br/>
          3. Schedule time to complete all renewal requirements<br/>
          4. Submit any required documentation promptly<br/>
          5. Notify relevant stakeholders of your status
        </mj-text>

        <mj-section background-color="#FEF2F2" border-radius="8px" padding="20px" border="1px solid #F87171">
          <mj-column>
            <mj-text font-size="16px" font-weight="600" color="#991B1B" padding-bottom="8px">
              🚨 Critical Notice
            </mj-text>
            <mj-text font-size="14px" color="#B91C1C">
              Until renewal is complete, you may not be authorised to perform certain job functions. Please prioritise this training and speak with your manager about any work impact.
            </mj-text>
          </mj-column>
        </mj-section>

        <mj-button href="{{renewal.urgent_url}}" align="center" background-color="#DC2626" color="#FFFFFF" font-size="16px" padding="24px 0">
          Begin Urgent Renewal
        </mj-button>

        <mj-text font-size="14px" color="#6B7280" align="center" padding-top="16px">
          For immediate assistance, contact your administrator at {{admin.contact_email}} or {{admin.phone}}
        </mj-text>

        <mj-text font-size="16px" padding-top="32px">
          Please treat this as urgent,<br/>
          <strong>The {{org.name}} Team</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#F9FAFB" padding="32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9CA3AF">
          This critical notification was sent by {{org.name}} Learning Management System.
          <br/>Training expiry affects compliance and work authorisation.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: `Training Expired: {{course.title}} - Immediate Renewal Required

Hello {{user.name}},

We must inform you that your training certification has expired. This affects your compliance status and may impact your ability to perform certain work tasks. Immediate renewal is required.

EXPIRED TRAINING DETAILS:
Title: {{course.title}}
Description: {{course.description}}
Original Completion: {{completion.date}}
Expiry Date: {{expiry.date}}
Current Status: EXPIRED
Days Expired: {{expiry.days_expired}} days
Compliance Impact: {{compliance.impact_level}}

IMPACT OF EXPIRED TRAINING:
• Compliance requirements are no longer met
• Professional qualifications are inactive
• Work responsibilities may be restricted
• Audit and regulatory issues may occur
• Training record shows gap in certification

IMMEDIATE ACTIONS REQUIRED:
1. Begin renewal training immediately
2. Contact your administrator about work restrictions
3. Schedule time to complete all renewal requirements
4. Submit any required documentation promptly
5. Notify relevant stakeholders of your status

CRITICAL NOTICE:
Until renewal is complete, you may not be authorised to perform certain job functions. Please prioritise this training and speak with your manager about any work impact.

Begin Urgent Renewal: {{renewal.urgent_url}}

For immediate assistance, contact your administrator at {{admin.contact_email}} or {{admin.phone}}

Please treat this as urgent,
The {{org.name}} Team

This critical notification was sent by {{org.name}} Learning Management System.
Training expiry affects compliance and work authorisation.`,
        variablesSchema: {
          type: 'object',
          required: ['org', 'user', 'course', 'completion', 'expiry', 'compliance', 'renewal', 'admin'],
          properties: {
            org: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Organisation name' }
              }
            },
            user: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'User first name' }
              }
            },
            course: {
              type: 'object',
              required: ['title', 'description'],
              properties: {
                title: { type: 'string', description: 'Course title' },
                description: { type: 'string', description: 'Course description' }
              }
            },
            completion: {
              type: 'object',
              required: ['date'],
              properties: {
                date: { type: 'string', description: 'Original completion date' }
              }
            },
            expiry: {
              type: 'object',
              required: ['date', 'days_expired'],
              properties: {
                date: { type: 'string', description: 'Expiry date' },
                days_expired: { type: 'number', description: 'Days since expiry' }
              }
            },
            compliance: {
              type: 'object',
              required: ['impact_level'],
              properties: {
                impact_level: { type: 'string', description: 'Level of compliance impact' }
              }
            },
            renewal: {
              type: 'object',
              required: ['urgent_url'],
              properties: {
                urgent_url: { type: 'string', description: 'URL for urgent renewal process' }
              }
            },
            admin: {
              type: 'object',
              required: ['contact_email'],
              properties: {
                contact_email: { type: 'string', description: 'Administrator contact email' },
                phone: { type: 'string', description: 'Administrator phone number' }
              }
            }
          }
        }
      },

      {
        key: 'course_completed',
        name: 'Course Completion Congratulations',
        category: 'learner',
        subject: 'Congratulations! {{course.title}} Completed Successfully',
        mjml: `
<mjml>
  <mj-head>
    <mj-title>Course Completed: {{course.title}}</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" />
      <mj-text line-height="1.6" color="#374151" />
      <mj-button background-color="#059669" border-radius="8px" font-weight="600" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F9FAFB">
    <mj-section background-color="#FFFFFF" border-radius="12px" padding="0">
      <!-- Header -->
      <mj-column>
        <mj-spacer height="32px" />
        <mj-text align="center" font-size="32px" font-weight="700" color="#059669" line-height="1.2">
          🎉 Congratulations!
        </mj-text>
        <mj-text align="center" font-size="18px" color="#6B7280" padding-top="8px">
          Course completed successfully
        </mj-text>
        <mj-spacer height="32px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px">
          Hello {{user.name}},
        </mj-text>
        <mj-text font-size="16px">
          Fantastic work! We're pleased to confirm that you have successfully completed your training course. This achievement demonstrates your commitment to professional development and continuous learning.
        </mj-text>

        <!-- Completion Achievement Card -->
        <mj-section background-color="#ECFDF5" border-radius="8px" padding="24px" border="2px solid #10B981">
          <mj-column>
            <mj-text font-size="20px" font-weight="600" color="#065F46" padding-bottom="12px" align="center">
              🏆 {{course.title}}
            </mj-text>
            <mj-text font-size="16px" color="#047857" padding-bottom="20px" align="center">
              Course Completed Successfully
            </mj-text>
            
            <!-- Completion Statistics -->
            <mj-table>
              <tr style="border-bottom: 1px solid #D1FAE5; padding: 8px 0;">
                <td style="padding: 8px; font-weight: 600; color: #065F46;">Final Score:</td>
                <td style="padding: 8px; color: #047857;">{{completion.score}}%</td>
              </tr>
              <tr style="border-bottom: 1px solid #D1FAE5; padding: 8px 0;">
                <td style="padding: 8px; font-weight: 600; color: #065F46;">Time Spent:</td>
                <td style="padding: 8px; color: #047857;">{{completion.time_spent}} minutes</td>
              </tr>
              <tr style="border-bottom: 1px solid #D1FAE5; padding: 8px 0;">
                <td style="padding: 8px; font-weight: 600; color: #065F46;">Completion Date:</td>
                <td style="padding: 8px; color: #047857;">{{completion.date}}</td>
              </tr>
              <tr style="border-bottom: 1px solid #D1FAE5; padding: 8px 0;">
                <td style="padding: 8px; font-weight: 600; color: #065F46;">Status:</td>
                <td style="padding: 8px; color: #047857; font-weight: 600;">{{completion.status}}</td>
              </tr>
              <tr style="padding: 8px 0;">
                <td style="padding: 8px; font-weight: 600; color: #065F46;">Certificate Valid Until:</td>
                <td style="padding: 8px; color: #047857;">{{certificate.valid_until}}</td>
              </tr>
            </mj-table>
          </mj-column>
        </mj-section>

        <mj-text font-size="16px" padding-top="24px">
          <strong>What this achievement means:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • You've enhanced your professional skills and knowledge<br/>
          • Your qualification is now active and recognised<br/>
          • You're in compliance with training requirements<br/>
          • Your learning record has been updated<br/>
          • You can apply these new skills in your role immediately
        </mj-text>

        <mj-text font-size="16px" padding-top="20px">
          <strong>Next steps:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • Download your completion certificate<br/>
          • Update your professional development portfolio<br/>
          • Share your achievement with your manager<br/>
          • Apply your new knowledge in practice<br/>
          • Consider advanced courses in this subject area
        </mj-text>

        <mj-button href="{{certificate.download_url}}" align="center" background-color="#059669" color="#FFFFFF" font-size="16px" padding="24px 0">
          Download Certificate
        </mj-button>

        <mj-text font-size="14px" color="#6B7280" align="center" padding-top="16px">
          Your certificate is also available in your learning dashboard under "Completed Courses"
        </mj-text>

        <mj-text font-size="16px" padding-top="32px">
          Well done on this accomplishment!<br/>
          <strong>The {{org.name}} Team</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#F9FAFB" padding="32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9CA3AF">
          This completion notification was sent by {{org.name}} Learning Management System.
          <br/>Your achievement has been recorded in your permanent learning record.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: `Congratulations! {{course.title}} Completed Successfully

Hello {{user.name}},

Fantastic work! We're pleased to confirm that you have successfully completed your training course. This achievement demonstrates your commitment to professional development and continuous learning.

COURSE COMPLETION DETAILS:
Title: {{course.title}}
Final Score: {{completion.score}}%
Time Spent: {{completion.time_spent}} minutes
Completion Date: {{completion.date}}
Status: {{completion.status}}
Certificate Valid Until: {{certificate.valid_until}}

WHAT THIS ACHIEVEMENT MEANS:
• You've enhanced your professional skills and knowledge
• Your qualification is now active and recognised
• You're in compliance with training requirements
• Your learning record has been updated
• You can apply these new skills in your role immediately

NEXT STEPS:
• Download your completion certificate
• Update your professional development portfolio
• Share your achievement with your manager
• Apply your new knowledge in practice
• Consider advanced courses in this subject area

Download Certificate: {{certificate.download_url}}

Your certificate is also available in your learning dashboard under "Completed Courses"

Well done on this accomplishment!
The {{org.name}} Team

This completion notification was sent by {{org.name}} Learning Management System.
Your achievement has been recorded in your permanent learning record.`,
        variablesSchema: {
          type: 'object',
          required: ['org', 'user', 'course', 'completion', 'certificate'],
          properties: {
            org: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Organisation name' }
              }
            },
            user: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'User first name' }
              }
            },
            course: {
              type: 'object',
              required: ['title'],
              properties: {
                title: { type: 'string', description: 'Course title' }
              }
            },
            completion: {
              type: 'object',
              required: ['score', 'time_spent', 'date', 'status'],
              properties: {
                score: { type: 'number', description: 'Final score percentage' },
                time_spent: { type: 'number', description: 'Time spent in minutes' },
                date: { type: 'string', description: 'Completion date' },
                status: { type: 'string', description: 'Completion status' }
              }
            },
            certificate: {
              type: 'object',
              required: ['download_url', 'valid_until'],
              properties: {
                download_url: { type: 'string', description: 'URL to download certificate' },
                valid_until: { type: 'string', description: 'Certificate validity date' }
              }
            }
          }
        }
      },

      {
        key: 'course_failed',
        name: 'Course Failed - Support Available',
        category: 'learner',
        subject: 'Course Result: {{course.title}} - Support Available',
        mjml: `
<mjml>
  <mj-head>
    <mj-title>Course Result: {{course.title}}</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" />
      <mj-text line-height="1.6" color="#374151" />
      <mj-button background-color="#3B82F6" border-radius="8px" font-weight="600" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F9FAFB">
    <mj-section background-color="#FFFFFF" border-radius="12px" padding="0">
      <!-- Header -->
      <mj-column>
        <mj-spacer height="32px" />
        <mj-text align="center" font-size="32px" font-weight="700" color="#3B82F6" line-height="1.2">
          📚 Course Results
        </mj-text>
        <mj-text align="center" font-size="18px" color="#6B7280" padding-top="8px">
          Let's work together on your next attempt
        </mj-text>
        <mj-spacer height="32px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px">
          Hello {{user.name}},
        </mj-text>
        <mj-text font-size="16px">
          Thank you for completing {{course.title}}. While you didn't achieve the passing score this time, this is simply part of the learning process. We're here to support you in achieving success on your next attempt.
        </mj-text>

        <!-- Attempt Results Card -->
        <mj-section background-color="#F0F9FF" border-radius="8px" padding="24px" border="2px solid #3B82F6">
          <mj-column>
            <mj-text font-size="20px" font-weight="600" color="#1E40AF" padding-bottom="12px" align="center">
              📊 {{course.title}}
            </mj-text>
            <mj-text font-size="16px" color="#2563EB" padding-bottom="20px" align="center">
              Attempt Results
            </mj-text>
            
            <!-- Results Table -->
            <mj-table>
              <tr style="border-bottom: 1px solid #DBEAFE; padding: 8px 0;">
                <td style="padding: 8px; font-weight: 600; color: #1E40AF;">Your Score:</td>
                <td style="padding: 8px; color: #2563EB;">{{attempt.score}}%</td>
              </tr>
              <tr style="border-bottom: 1px solid #DBEAFE; padding: 8px 0;">
                <td style="padding: 8px; font-weight: 600; color: #1E40AF;">Passing Score:</td>
                <td style="padding: 8px; color: #2563EB;">{{course.passing_score}}%</td>
              </tr>
              <tr style="border-bottom: 1px solid #DBEAFE; padding: 8px 0;">
                <td style="padding: 8px; font-weight: 600; color: #1E40AF;">Time Spent:</td>
                <td style="padding: 8px; color: #2563EB;">{{attempt.time_spent}} minutes</td>
              </tr>
              <tr style="border-bottom: 1px solid #DBEAFE; padding: 8px 0;">
                <td style="padding: 8px; font-weight: 600; color: #1E40AF;">Attempt Date:</td>
                <td style="padding: 8px; color: #2563EB;">{{attempt.date}}</td>
              </tr>
              <tr style="padding: 8px 0;">
                <td style="padding: 8px; font-weight: 600; color: #1E40AF;">Remaining Attempts:</td>
                <td style="padding: 8px; color: #2563EB;">{{attempt.remaining_attempts}}</td>
              </tr>
            </mj-table>
          </mj-column>
        </mj-section>

        <mj-text font-size="16px" padding-top="24px">
          <strong>Areas for improvement:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          Based on your results, consider reviewing these topics:<br/>
          {{#each improvement_areas}}
          • {{this}}<br/>
          {{/each}}
        </mj-text>

        <mj-text font-size="16px" padding-top="20px">
          <strong>Support available to you:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • Review course materials and resources<br/>
          • Access additional study guides and practice materials<br/>
          • Contact your administrator for one-on-one support<br/>
          • Join study groups or peer learning sessions<br/>
          • Take advantage of office hours or tutoring
        </mj-text>

        <mj-text font-size="16px" padding-top="20px">
          <strong>Next steps:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          1. Review your results and identify knowledge gaps<br/>
          2. Study the recommended improvement areas<br/>
          3. Use additional resources and support options<br/>
          4. Schedule your next attempt when you feel prepared<br/>
          5. Don't hesitate to ask for help from your administrator
        </mj-text>

        <mj-button href="{{course.retake_url}}" align="center" background-color="#3B82F6" color="#FFFFFF" font-size="16px" padding="24px 0">
          Review & Retake Course
        </mj-button>

        <mj-text font-size="14px" color="#6B7280" align="center" padding-top="16px">
          Need additional support? Contact your administrator at {{admin.contact_email}}
        </mj-text>

        <mj-text font-size="16px" padding-top="32px">
          We believe in your success,<br/>
          <strong>The {{org.name}} Team</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#F9FAFB" padding="32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9CA3AF">
          This result notification was sent by {{org.name}} Learning Management System.
          <br/>Remember: Learning is a journey, and we're here to support your success.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: `Course Result: {{course.title}} - Support Available

Hello {{user.name}},

Thank you for completing {{course.title}}. While you didn't achieve the passing score this time, this is simply part of the learning process. We're here to support you in achieving success on your next attempt.

ATTEMPT RESULTS:
Title: {{course.title}}
Your Score: {{attempt.score}}%
Passing Score: {{course.passing_score}}%
Time Spent: {{attempt.time_spent}} minutes
Attempt Date: {{attempt.date}}
Remaining Attempts: {{attempt.remaining_attempts}}

AREAS FOR IMPROVEMENT:
Based on your results, consider reviewing these topics:
{{#each improvement_areas}}
• {{this}}
{{/each}}

SUPPORT AVAILABLE TO YOU:
• Review course materials and resources
• Access additional study guides and practice materials
• Contact your administrator for one-on-one support
• Join study groups or peer learning sessions
• Take advantage of office hours or tutoring

NEXT STEPS:
1. Review your results and identify knowledge gaps
2. Study the recommended improvement areas
3. Use additional resources and support options
4. Schedule your next attempt when you feel prepared
5. Don't hesitate to ask for help from your administrator

Review & Retake Course: {{course.retake_url}}

Need additional support? Contact your administrator at {{admin.contact_email}}

We believe in your success,
The {{org.name}} Team

This result notification was sent by {{org.name}} Learning Management System.
Remember: Learning is a journey, and we're here to support your success.`,
        variablesSchema: {
          type: 'object',
          required: ['org', 'user', 'course', 'attempt', 'improvement_areas', 'admin'],
          properties: {
            org: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Organisation name' }
              }
            },
            user: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'User first name' }
              }
            },
            course: {
              type: 'object',
              required: ['title', 'passing_score', 'retake_url'],
              properties: {
                title: { type: 'string', description: 'Course title' },
                passing_score: { type: 'number', description: 'Required passing score percentage' },
                retake_url: { type: 'string', description: 'URL to retake the course' }
              }
            },
            attempt: {
              type: 'object',
              required: ['score', 'time_spent', 'date', 'remaining_attempts'],
              properties: {
                score: { type: 'number', description: 'Score achieved percentage' },
                time_spent: { type: 'number', description: 'Time spent in minutes' },
                date: { type: 'string', description: 'Attempt date' },
                remaining_attempts: { type: 'number', description: 'Number of remaining attempts' }
              }
            },
            improvement_areas: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of topics to review'
            },
            admin: {
              type: 'object',
              required: ['contact_email'],
              properties: {
                contact_email: { type: 'string', description: 'Administrator contact email' }
              }
            }
          }
        }
      },

      {
        key: 'password_reset',
        name: 'Password Reset Request',
        category: 'learner',
        subject: 'Password Reset Request for {{org.name}}',
        mjml: `
<mjml>
  <mj-head>
    <mj-title>Password Reset Request</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" />
      <mj-text line-height="1.6" color="#374151" />
      <mj-button background-color="#3B82F6" border-radius="8px" font-weight="600" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F9FAFB">
    <mj-section background-color="#FFFFFF" border-radius="12px" padding="0">
      <!-- Header -->
      <mj-column>
        <mj-spacer height="32px" />
        <mj-text align="center" font-size="32px" font-weight="700" color="#3B82F6" line-height="1.2">
          🔐 Password Reset
        </mj-text>
        <mj-text align="center" font-size="18px" color="#6B7280" padding-top="8px">
          Secure access to your account
        </mj-text>
        <mj-spacer height="32px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px">
          Hello {{user.name}},
        </mj-text>
        <mj-text font-size="16px">
          We received a request to reset the password for your {{org.name}} learning account. If you made this request, please follow the instructions below to create a new password.
        </mj-text>

        <!-- Reset Details Card -->
        <mj-section background-color="#F0F9FF" border-radius="8px" padding="24px" border="1px solid #3B82F6">
          <mj-column>
            <mj-text font-size="18px" font-weight="600" color="#1E40AF" padding-bottom="16px">
              🔑 Reset Request Details
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Account:</strong> {{user.email}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Organisation:</strong> {{org.name}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Request Time:</strong> {{reset.request_time}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>IP Address:</strong> {{reset.ip_address}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Valid Until:</strong> {{reset.expires_at}}
            </mj-text>
          </mj-column>
        </mj-section>

        <mj-text font-size="16px" padding-top="24px">
          <strong>To reset your password:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          1. Click the "Reset Password" button below<br/>
          2. You'll be taken to a secure password reset page<br/>
          3. Enter and confirm your new password<br/>
          4. Your new password will be active immediately<br/>
          5. Use your new password to log in to your account
        </mj-text>

        <mj-button href="{{reset.reset_url}}" align="center" background-color="#3B82F6" color="#FFFFFF" font-size="16px" padding="24px 0">
          Reset Password
        </mj-button>

        <mj-text font-size="14px" color="#6B7280" align="center" padding-top="16px">
          This link will expire in {{reset.expires_in_hours}} hours for security reasons
        </mj-text>

        <!-- Security Notice -->
        <mj-section background-color="#FEF2F2" border-radius="8px" padding="20px" border="1px solid #F87171">
          <mj-column>
            <mj-text font-size="16px" font-weight="600" color="#991B1B" padding-bottom="8px">
              🛡️ Security Notice
            </mj-text>
            <mj-text font-size="14px" color="#B91C1C" line-height="1.6">
              If you did not request this password reset, please ignore this email and your password will remain unchanged. For security concerns, contact your administrator immediately at {{admin.contact_email}}
            </mj-text>
          </mj-column>
        </mj-section>

        <mj-text font-size="16px" padding-top="24px">
          <strong>Tips for a strong password:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • Use at least 8 characters<br/>
          • Include uppercase and lowercase letters<br/>
          • Add numbers and special characters<br/>
          • Avoid personal information<br/>
          • Don't reuse old passwords
        </mj-text>

        <mj-text font-size="16px" padding-top="32px">
          Best regards,<br/>
          <strong>The {{org.name}} Team</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#F9FAFB" padding="32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9CA3AF">
          This password reset email was sent by {{org.name}} Learning Management System.
          <br/>This is an automated security message - please do not reply to this email.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: `Password Reset Request for {{org.name}}

Hello {{user.name}},

We received a request to reset the password for your {{org.name}} learning account. If you made this request, please follow the instructions below to create a new password.

RESET REQUEST DETAILS:
Account: {{user.email}}
Organisation: {{org.name}}
Request Time: {{reset.request_time}}
IP Address: {{reset.ip_address}}
Valid Until: {{reset.expires_at}}

TO RESET YOUR PASSWORD:
1. Click the link below or copy and paste it into your browser
2. You'll be taken to a secure password reset page
3. Enter and confirm your new password
4. Your new password will be active immediately
5. Use your new password to log in to your account

Reset Password: {{reset.reset_url}}

This link will expire in {{reset.expires_in_hours}} hours for security reasons.

SECURITY NOTICE:
If you did not request this password reset, please ignore this email and your password will remain unchanged. For security concerns, contact your administrator immediately at {{admin.contact_email}}

TIPS FOR A STRONG PASSWORD:
• Use at least 8 characters
• Include uppercase and lowercase letters
• Add numbers and special characters
• Avoid personal information
• Don't reuse old passwords

Best regards,
The {{org.name}} Team

This password reset email was sent by {{org.name}} Learning Management System.
This is an automated security message - please do not reply to this email.`,
        variablesSchema: {
          type: 'object',
          required: ['org', 'user', 'reset', 'admin'],
          properties: {
            org: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Organisation name' }
              }
            },
            user: {
              type: 'object',
              required: ['name', 'email'],
              properties: {
                name: { type: 'string', description: 'User first name' },
                email: { type: 'string', description: 'User email address' }
              }
            },
            reset: {
              type: 'object',
              required: ['reset_url', 'request_time', 'ip_address', 'expires_at', 'expires_in_hours'],
              properties: {
                reset_url: { type: 'string', description: 'Password reset URL' },
                request_time: { type: 'string', description: 'When the request was made' },
                ip_address: { type: 'string', description: 'IP address of the request' },
                expires_at: { type: 'string', description: 'When the reset link expires' },
                expires_in_hours: { type: 'number', description: 'Hours until expiry' }
              }
            },
            admin: {
              type: 'object',
              required: ['contact_email'],
              properties: {
                contact_email: { type: 'string', description: 'Administrator contact email' }
              }
            }
          }
        }
      },

      {
        key: 'weekly_digest',
        name: 'Weekly Learning Digest',
        category: 'learner',
        subject: 'Your Weekly Learning Summary - {{date.week_ending}}',
        mjml: `
<mjml>
  <mj-head>
    <mj-title>Weekly Learning Digest</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" />
      <mj-text line-height="1.6" color="#374151" />
      <mj-button background-color="#3B82F6" border-radius="8px" font-weight="600" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F9FAFB">
    <mj-section background-color="#FFFFFF" border-radius="12px" padding="0">
      <!-- Header -->
      <mj-column>
        <mj-spacer height="32px" />
        <mj-text align="center" font-size="32px" font-weight="700" color="#3B82F6" line-height="1.2">
          📊 Weekly Learning Summary
        </mj-text>
        <mj-text align="center" font-size="18px" color="#6B7280" padding-top="8px">
          Week ending {{date.week_ending}}
        </mj-text>
        <mj-spacer height="32px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px">
          Hello {{user.name}},
        </mj-text>
        <mj-text font-size="16px">
          Here's your personal learning summary for this week. We hope this overview helps you track your progress and plan your continued professional development.
        </mj-text>

        <!-- Weekly Stats Overview -->
        <mj-section background-color="#F0F9FF" border-radius="8px" padding="24px" border="1px solid #3B82F6">
          <mj-column>
            <mj-text font-size="18px" font-weight="600" color="#1E40AF" padding-bottom="16px" align="center">
              📈 This Week's Achievements
            </mj-text>
            
            <!-- Stats Grid -->
            <mj-table>
              <tr style="border-bottom: 1px solid #DBEAFE;">
                <td style="padding: 12px; width: 50%; text-align: center;">
                  <div style="font-size: 24px; font-weight: 700; color: #1E40AF;">{{stats.courses_completed}}</div>
                  <div style="font-size: 12px; color: #3B82F6; text-transform: uppercase;">Courses Completed</div>
                </td>
                <td style="padding: 12px; width: 50%; text-align: center;">
                  <div style="font-size: 24px; font-weight: 700; color: #1E40AF;">{{stats.hours_studied}}</div>
                  <div style="font-size: 12px; color: #3B82F6; text-transform: uppercase;">Hours Studied</div>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px; width: 50%; text-align: center;">
                  <div style="font-size: 24px; font-weight: 700; color: #1E40AF;">{{stats.average_score}}%</div>
                  <div style="font-size: 12px; color: #3B82F6; text-transform: uppercase;">Average Score</div>
                </td>
                <td style="padding: 12px; width: 50%; text-align: center;">
                  <div style="font-size: 24px; font-weight: 700; color: #1E40AF;">{{stats.certificates_earned}}</div>
                  <div style="font-size: 12px; color: #3B82F6; text-transform: uppercase;">Certificates Earned</div>
                </td>
              </tr>
            </mj-table>
          </mj-column>
        </mj-section>

        <!-- Recent Activity -->
        <mj-text font-size="18px" font-weight="600" color="#1F2937" padding-top="32px" padding-bottom="16px">
          🎯 Recent Activity
        </mj-text>

        {{#if activities.completed_courses}}
        <!-- Completed Courses -->
        <mj-section background-color="#ECFDF5" border-radius="6px" padding="16px" border="1px solid #10B981">
          <mj-column>
            <mj-text font-size="16px" font-weight="600" color="#065F46" padding-bottom="8px">
              ✅ Completed Courses
            </mj-text>
            {{#each activities.completed_courses}}
            <mj-text font-size="14px" color="#047857" padding="4px 0">
              • {{title}} ({{score}}% - {{completion_date}})
            </mj-text>
            {{/each}}
          </mj-column>
        </mj-section>
        {{/if}}

        {{#if activities.in_progress_courses}}
        <!-- In Progress Courses -->
        <mj-section background-color="#FFFBEB" border-radius="6px" padding="16px" border="1px solid #F59E0B">
          <mj-column>
            <mj-text font-size="16px" font-weight="600" color="#92400E" padding-bottom="8px">
              📚 Courses in Progress
            </mj-text>
            {{#each activities.in_progress_courses}}
            <mj-text font-size="14px" color="#D97706" padding="4px 0">
              • {{title}} ({{progress}}% complete - Due: {{due_date}})
            </mj-text>
            {{/each}}
          </mj-column>
        </mj-section>
        {{/if}}

        {{#if activities.overdue_courses}}
        <!-- Overdue Courses -->
        <mj-section background-color="#FEF2F2" border-radius="6px" padding="16px" border="1px solid #DC2626">
          <mj-column>
            <mj-text font-size="16px" font-weight="600" color="#991B1B" padding-bottom="8px">
              ⚠️ Attention Required
            </mj-text>
            {{#each activities.overdue_courses}}
            <mj-text font-size="14px" color="#B91C1C" padding="4px 0">
              • {{title}} ({{days_overdue}} days overdue)
            </mj-text>
            {{/each}}
          </mj-column>
        </mj-section>
        {{/if}}

        <!-- Upcoming Deadlines -->
        <mj-text font-size="18px" font-weight="600" color="#1F2937" padding-top="32px" padding-bottom="16px">
          📅 Upcoming This Week
        </mj-text>

        {{#if upcoming.assignments}}
        <mj-section background-color="#F8FAFC" border-radius="6px" padding="16px" border="1px solid #94A3B8">
          <mj-column>
            <mj-text font-size="16px" font-weight="600" color="#475569" padding-bottom="8px">
              📋 Course Deadlines
            </mj-text>
            {{#each upcoming.assignments}}
            <mj-text font-size="14px" color="#64748B" padding="4px 0">
              • {{title}} - Due {{due_date}} ({{days_remaining}} days)
            </mj-text>
            {{/each}}
          </mj-column>
        </mj-section>
        {{/if}}

        {{#if upcoming.renewals}}
        <mj-section background-color="#FEF3C7" border-radius="6px" padding="16px" border="1px solid #F59E0B">
          <mj-column>
            <mj-text font-size="16px" font-weight="600" color="#92400E" padding-bottom="8px">
              🔄 Training Renewals
            </mj-text>
            {{#each upcoming.renewals}}
            <mj-text font-size="14px" color="#D97706" padding="4px 0">
              • {{title}} expires {{expiry_date}} ({{days_until_expiry}} days)
            </mj-text>
            {{/each}}
          </mj-column>
        </mj-section>
        {{/if}}

        <!-- Learning Goals -->
        <mj-text font-size="18px" font-weight="600" color="#1F2937" padding-top="32px" padding-bottom="16px">
          🎯 Keep Up the Momentum
        </mj-text>

        <mj-text font-size="16px" line-height="1.8">
          {{#if goals.personal_message}}
          {{goals.personal_message}}
          {{else}}
          You're making excellent progress with your learning journey! Consider setting aside time this week to:
          • Complete any pending course assignments
          • Review materials for upcoming renewals
          • Explore new courses in your areas of interest
          • Apply recent learning to your current role
          {{/if}}
        </mj-text>

        <mj-button href="{{dashboard.url}}" align="center" background-color="#3B82F6" color="#FFFFFF" font-size="16px" padding="24px 0">
          View Learning Dashboard
        </mj-button>

        <mj-text font-size="14px" color="#6B7280" align="center" padding-top="16px">
          Want to adjust these weekly summaries? Update your preferences in your account settings.
        </mj-text>

        <mj-text font-size="16px" padding-top="32px">
          Happy learning!<br/>
          <strong>The {{org.name}} Team</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#F9FAFB" padding="32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9CA3AF">
          This weekly digest was sent by {{org.name}} Learning Management System.
          <br/>You can manage your email preferences in your account dashboard.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: `Your Weekly Learning Summary - {{date.week_ending}}

Hello {{user.name}},

Here's your personal learning summary for this week. We hope this overview helps you track your progress and plan your continued professional development.

THIS WEEK'S ACHIEVEMENTS:
• Courses Completed: {{stats.courses_completed}}
• Hours Studied: {{stats.hours_studied}}
• Average Score: {{stats.average_score}}%
• Certificates Earned: {{stats.certificates_earned}}

RECENT ACTIVITY:

{{#if activities.completed_courses}}
COMPLETED COURSES:
{{#each activities.completed_courses}}
• {{title}} ({{score}}% - {{completion_date}})
{{/each}}
{{/if}}

{{#if activities.in_progress_courses}}
COURSES IN PROGRESS:
{{#each activities.in_progress_courses}}
• {{title}} ({{progress}}% complete - Due: {{due_date}})
{{/each}}
{{/if}}

{{#if activities.overdue_courses}}
ATTENTION REQUIRED:
{{#each activities.overdue_courses}}
• {{title}} ({{days_overdue}} days overdue)
{{/each}}
{{/if}}

UPCOMING THIS WEEK:

{{#if upcoming.assignments}}
COURSE DEADLINES:
{{#each upcoming.assignments}}
• {{title}} - Due {{due_date}} ({{days_remaining}} days)
{{/each}}
{{/if}}

{{#if upcoming.renewals}}
TRAINING RENEWALS:
{{#each upcoming.renewals}}
• {{title}} expires {{expiry_date}} ({{days_until_expiry}} days)
{{/each}}
{{/if}}

KEEP UP THE MOMENTUM:
{{#if goals.personal_message}}
{{goals.personal_message}}
{{else}}
You're making excellent progress with your learning journey! Consider setting aside time this week to:
• Complete any pending course assignments
• Review materials for upcoming renewals
• Explore new courses in your areas of interest
• Apply recent learning to your current role
{{/if}}

View Learning Dashboard: {{dashboard.url}}

Want to adjust these weekly summaries? Update your preferences in your account settings.

Happy learning!
The {{org.name}} Team

This weekly digest was sent by {{org.name}} Learning Management System.
You can manage your email preferences in your account dashboard.`,
        variablesSchema: {
          type: 'object',
          required: ['org', 'user', 'date', 'stats', 'dashboard'],
          properties: {
            org: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Organisation name' }
              }
            },
            user: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'User first name' }
              }
            },
            date: {
              type: 'object',
              required: ['week_ending'],
              properties: {
                week_ending: { type: 'string', description: 'End date of the week' }
              }
            },
            stats: {
              type: 'object',
              required: ['courses_completed', 'hours_studied', 'average_score', 'certificates_earned'],
              properties: {
                courses_completed: { type: 'number', description: 'Number of courses completed this week' },
                hours_studied: { type: 'number', description: 'Total hours studied this week' },
                average_score: { type: 'number', description: 'Average score percentage' },
                certificates_earned: { type: 'number', description: 'Number of certificates earned' }
              }
            },
            activities: {
              type: 'object',
              properties: {
                completed_courses: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      score: { type: 'number' },
                      completion_date: { type: 'string' }
                    }
                  }
                },
                in_progress_courses: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      progress: { type: 'number' },
                      due_date: { type: 'string' }
                    }
                  }
                },
                overdue_courses: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      days_overdue: { type: 'number' }
                    }
                  }
                }
              }
            },
            upcoming: {
              type: 'object',
              properties: {
                assignments: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      due_date: { type: 'string' },
                      days_remaining: { type: 'number' }
                    }
                  }
                },
                renewals: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      expiry_date: { type: 'string' },
                      days_until_expiry: { type: 'number' }
                    }
                  }
                }
              }
            },
            goals: {
              type: 'object',
              properties: {
                personal_message: { type: 'string', description: 'Personalised message for the user' }
              }
            },
            dashboard: {
              type: 'object',
              required: ['url'],
              properties: {
                url: { type: 'string', description: 'URL to the user dashboard' }
              }
            }
          }
        }
      },

      {
        key: 'policy_ack_reminder',
        name: 'Policy Acknowledgement Reminder',
        category: 'learner',
        subject: 'Policy Acknowledgement Required: {{policy.title}}',
        mjml: `
<mjml>
  <mj-head>
    <mj-title>Policy Acknowledgement Required</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" />
      <mj-text line-height="1.6" color="#374151" />
      <mj-button background-color="#F59E0B" border-radius="8px" font-weight="600" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F9FAFB">
    <mj-section background-color="#FFFFFF" border-radius="12px" padding="0">
      <!-- Header -->
      <mj-column>
        <mj-spacer height="32px" />
        <mj-text align="center" font-size="32px" font-weight="700" color="#F59E0B" line-height="1.2">
          📋 Policy Acknowledgement
        </mj-text>
        <mj-text align="center" font-size="18px" color="#6B7280" padding-top="8px">
          Your attention is required
        </mj-text>
        <mj-spacer height="32px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#FFFFFF" padding="0 32px">
      <mj-column>
        <mj-text font-size="16px">
          Hello {{user.name}},
        </mj-text>
        <mj-text font-size="16px">
          This is a reminder that you need to review and acknowledge an important organisational policy. Your acknowledgement is required to maintain compliance and ensure you're aware of current procedures.
        </mj-text>

        <!-- Policy Details Card -->
        <mj-section background-color="#FFFBEB" border-radius="8px" padding="24px" border="2px solid #F59E0B">
          <mj-column>
            <mj-text font-size="20px" font-weight="600" color="#92400E" padding-bottom="12px">
              📄 {{policy.title}}
            </mj-text>
            <mj-text font-size="16px" color="#D97706" padding-bottom="16px">
              {{policy.description}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Policy Type:</strong> {{policy.type}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Effective Date:</strong> {{policy.effective_date}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Last Updated:</strong> {{policy.last_updated}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Acknowledgement Due:</strong> {{acknowledgement.due_date}}
            </mj-text>
            <mj-text font-size="14px" padding="4px 0">
              <strong>Days Remaining:</strong> {{acknowledgement.days_remaining}} days
            </mj-text>
          </mj-column>
        </mj-section>

        <mj-text font-size="16px" padding-top="24px">
          <strong>Why this acknowledgement is important:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          • Ensures you're aware of current organisational policies<br/>
          • Maintains compliance with regulatory requirements<br/>
          • Confirms your understanding of procedures and expectations<br/>
          • Protects both you and the organisation<br/>
          • Keeps your employment record up to date
        </mj-text>

        <mj-text font-size="16px" padding-top="20px">
          <strong>What you need to do:</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          1. Click the link below to review the policy<br/>
          2. Read through all sections carefully<br/>
          3. Ask questions if anything is unclear<br/>
          4. Complete the acknowledgement form<br/>
          5. Submit your acknowledgement before the due date
        </mj-text>

        {{#if policy.changes}}
        <!-- Policy Changes Section -->
        <mj-section background-color="#F0F9FF" border-radius="6px" padding="16px" border="1px solid #3B82F6">
          <mj-column>
            <mj-text font-size="16px" font-weight="600" color="#1E40AF" padding-bottom="8px">
              📝 Recent Changes
            </mj-text>
            <mj-text font-size="14px" color="#2563EB" line-height="1.6">
              This policy has been updated recently. Please pay particular attention to:
            </mj-text>
            {{#each policy.changes}}
            <mj-text font-size="14px" color="#3B82F6" padding="4px 0">
              • {{this}}
            </mj-text>
            {{/each}}
          </mj-column>
        </mj-section>
        {{/if}}

        <mj-button href="{{acknowledgement.review_url}}" align="center" background-color="#F59E0B" color="#FFFFFF" font-size="16px" padding="24px 0">
          Review & Acknowledge Policy
        </mj-button>

        <mj-text font-size="14px" color="#6B7280" align="center" padding-top="16px">
          Estimated reading time: {{policy.estimated_reading_time}} minutes
        </mj-text>

        <!-- Deadline Warning -->
        {{#if acknowledgement.is_urgent}}
        <mj-section background-color="#FEF2F2" border-radius="8px" padding="20px" border="1px solid #F87171">
          <mj-column>
            <mj-text font-size="16px" font-weight="600" color="#991B1B" padding-bottom="8px">
              ⚠️ Urgent: Action Required
            </mj-text>
            <mj-text font-size="14px" color="#B91C1C" line-height="1.6">
              This acknowledgement is due soon. Failure to acknowledge by the deadline may result in restricted access or escalation to management. Please prioritise this task.
            </mj-text>
          </mj-column>
        </mj-section>
        {{/if}}

        <mj-text font-size="16px" padding-top="24px">
          <strong>Need help?</strong>
        </mj-text>
        <mj-text font-size="16px" line-height="1.8">
          If you have questions about this policy or need assistance with the acknowledgement process, please contact:
          <br/>• Your direct manager
          <br/>• HR department at {{hr.contact_email}}
          <br/>• Administrative support at {{admin.contact_email}}
        </mj-text>

        <mj-text font-size="16px" padding-top="32px">
          Thank you for your attention to this matter,<br/>
          <strong>The {{org.name}} Team</strong>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#F9FAFB" padding="32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9CA3AF">
          This policy acknowledgement reminder was sent by {{org.name}}.
          <br/>Policy acknowledgements are required for compliance and governance purposes.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: `Policy Acknowledgement Required: {{policy.title}}

Hello {{user.name}},

This is a reminder that you need to review and acknowledge an important organisational policy. Your acknowledgement is required to maintain compliance and ensure you're aware of current procedures.

POLICY DETAILS:
Title: {{policy.title}}
Description: {{policy.description}}
Policy Type: {{policy.type}}
Effective Date: {{policy.effective_date}}
Last Updated: {{policy.last_updated}}
Acknowledgement Due: {{acknowledgement.due_date}}
Days Remaining: {{acknowledgement.days_remaining}} days

WHY THIS ACKNOWLEDGEMENT IS IMPORTANT:
• Ensures you're aware of current organisational policies
• Maintains compliance with regulatory requirements
• Confirms your understanding of procedures and expectations
• Protects both you and the organisation
• Keeps your employment record up to date

WHAT YOU NEED TO DO:
1. Review the policy using the link below
2. Read through all sections carefully
3. Ask questions if anything is unclear
4. Complete the acknowledgement form
5. Submit your acknowledgement before the due date

{{#if policy.changes}}
RECENT CHANGES:
This policy has been updated recently. Please pay particular attention to:
{{#each policy.changes}}
• {{this}}
{{/each}}
{{/if}}

Review & Acknowledge Policy: {{acknowledgement.review_url}}

Estimated reading time: {{policy.estimated_reading_time}} minutes

{{#if acknowledgement.is_urgent}}
URGENT: ACTION REQUIRED
This acknowledgement is due soon. Failure to acknowledge by the deadline may result in restricted access or escalation to management. Please prioritise this task.
{{/if}}

NEED HELP?
If you have questions about this policy or need assistance with the acknowledgement process, please contact:
• Your direct manager
• HR department at {{hr.contact_email}}
• Administrative support at {{admin.contact_email}}

Thank you for your attention to this matter,
The {{org.name}} Team

This policy acknowledgement reminder was sent by {{org.name}}.
Policy acknowledgements are required for compliance and governance purposes.`,
        variablesSchema: {
          type: 'object',
          required: ['org', 'user', 'policy', 'acknowledgement', 'hr', 'admin'],
          properties: {
            org: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'Organisation name' }
              }
            },
            user: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', description: 'User first name' }
              }
            },
            policy: {
              type: 'object',
              required: ['title', 'description', 'type', 'effective_date', 'last_updated', 'estimated_reading_time'],
              properties: {
                title: { type: 'string', description: 'Policy title' },
                description: { type: 'string', description: 'Policy description' },
                type: { type: 'string', description: 'Type of policy' },
                effective_date: { type: 'string', description: 'When policy became effective' },
                last_updated: { type: 'string', description: 'Last update date' },
                estimated_reading_time: { type: 'number', description: 'Estimated minutes to read' },
                changes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of recent changes'
                }
              }
            },
            acknowledgement: {
              type: 'object',
              required: ['due_date', 'days_remaining', 'review_url'],
              properties: {
                due_date: { type: 'string', description: 'Due date for acknowledgement' },
                days_remaining: { type: 'number', description: 'Days until due date' },
                review_url: { type: 'string', description: 'URL to review and acknowledge policy' },
                is_urgent: { type: 'boolean', description: 'Whether this is urgent (due soon)' }
              }
            },
            hr: {
              type: 'object',
              required: ['contact_email'],
              properties: {
                contact_email: { type: 'string', description: 'HR contact email' }
              }
            },
            admin: {
              type: 'object',
              required: ['contact_email'],
              properties: {
                contact_email: { type: 'string', description: 'Admin contact email' }
              }
            }
          }
        }
      }

      // ========================================================================
      // ADMIN TEMPLATES (if needed later - currently focused on learner templates)
      // ========================================================================
    ];
  }

  /**
   * Seed all missing platform email templates
   * 
   * @param options Seed options
   * @returns Seed results with counts and details
   */
  async seedPlatformTemplates(options: {
    overwriteExisting?: boolean;
    specificKeys?: string[];
  } = {}): Promise<{
    success: boolean;
    seeded: number;
    skipped: number;
    failed: number;
    errors: string[];
    details: Array<{
      key: string;
      action: 'created' | 'updated' | 'skipped' | 'failed';
      error?: string;
    }>;
  }> {
    console.log(`${this.LOG_PREFIX} Starting platform template seeding`);

    const results = {
      success: true,
      seeded: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
      details: [] as Array<{
        key: string;
        action: 'created' | 'updated' | 'skipped' | 'failed';
        error?: string;
      }>
    };

    try {
      const templateDefaults = this.getPlatformTemplateDefaults();
      
      // Filter to specific keys if requested
      const templatesToSeed = options.specificKeys 
        ? templateDefaults.filter(t => options.specificKeys!.includes(t.key))
        : templateDefaults;

      console.log(`${this.LOG_PREFIX} Processing ${templatesToSeed.length} templates`);

      for (const templateInput of templatesToSeed) {
        try {
          // Check if template already exists
          const existingTemplate = await storage.getEmailTemplateByKey(templateInput.key);

          if (existingTemplate && !options.overwriteExisting) {
            console.log(`${this.LOG_PREFIX} Template '${templateInput.key}' exists, skipping`);
            results.skipped++;
            results.details.push({
              key: templateInput.key,
              action: 'skipped'
            });
            continue;
          }

          if (existingTemplate && options.overwriteExisting) {
            // Update existing template
            console.log(`${this.LOG_PREFIX} Updating existing template '${templateInput.key}'`);
            
            await this.emailTemplateService.updateTemplate(templateInput.key, {
              name: templateInput.name,
              subject: templateInput.subject,
              mjml: templateInput.mjml,
              text: templateInput.text,
              category: templateInput.category,
              variablesSchema: templateInput.variablesSchema,
              isActive: true
            });

            results.seeded++;
            results.details.push({
              key: templateInput.key,
              action: 'updated'
            });

          } else {
            // Create new template
            console.log(`${this.LOG_PREFIX} Creating new template '${templateInput.key}'`);
            
            await this.emailTemplateService.createTemplate(templateInput);

            results.seeded++;
            results.details.push({
              key: templateInput.key,
              action: 'created'
            });
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`${this.LOG_PREFIX} Failed to seed template '${templateInput.key}':`, error);
          
          results.failed++;
          results.errors.push(`${templateInput.key}: ${errorMessage}`);
          results.details.push({
            key: templateInput.key,
            action: 'failed',
            error: errorMessage
          });
        }
      }

      // Update overall success status
      results.success = results.failed === 0;

      console.log(`${this.LOG_PREFIX} Seeding complete: ${results.seeded} seeded, ${results.skipped} skipped, ${results.failed} failed`);

      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${this.LOG_PREFIX} Critical error during seeding:`, error);
      
      return {
        success: false,
        seeded: results.seeded,
        skipped: results.skipped,
        failed: results.failed + 1,
        errors: [...results.errors, `Critical seeding error: ${errorMessage}`],
        details: results.details
      };
    }
  }

  /**
   * Check which platform templates are missing
   * 
   * @returns List of missing template keys
   */
  async getMissingTemplateKeys(): Promise<string[]> {
    try {
      const requiredKeys = this.getPlatformTemplateDefaults().map(t => t.key);
      const existingTemplates = await storage.getAllEmailTemplates();
      const existingKeys = existingTemplates.map(t => t.key);
      
      const missingKeys = requiredKeys.filter(key => !existingKeys.includes(key));
      
      console.log(`${this.LOG_PREFIX} Found ${missingKeys.length} missing template keys:`, missingKeys);
      return missingKeys;

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error checking missing templates:`, error);
      throw error;
    }
  }

  /**
   * Auto-seed missing templates (self-healing)
   * This method is called when templates are missing during normal operation
   * 
   * @returns Whether seeding was successful
   */
  async autoSeedMissingTemplates(): Promise<boolean> {
    try {
      console.log(`${this.LOG_PREFIX} Starting auto-seed for missing templates`);
      
      const missingKeys = await this.getMissingTemplateKeys();
      
      if (missingKeys.length === 0) {
        console.log(`${this.LOG_PREFIX} No missing templates found, auto-seed not needed`);
        return true;
      }

      console.log(`${this.LOG_PREFIX} Auto-seeding ${missingKeys.length} missing templates`);
      
      const results = await this.seedPlatformTemplates({
        overwriteExisting: false, // Never overwrite in auto-seed
        specificKeys: missingKeys
      });

      if (results.success) {
        console.log(`${this.LOG_PREFIX} Auto-seed successful: ${results.seeded} templates created`);
        return true;
      } else {
        console.error(`${this.LOG_PREFIX} Auto-seed failed:`, results.errors);
        return false;
      }

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Critical error during auto-seed:`, error);
      return false;
    }
  }

  /**
   * Seed missing template defaults with structured result format
   * 
   * This is the primary interface for the repair system. It ensures all required
   * template keys exist without overwriting existing templates.
   * 
   * @param requiredKeys Optional array of specific keys to check/seed. If not provided, checks all platform defaults
   * @returns Structured result with inserted, skipped, and count information
   */
  async seedDefaultsIfMissing(requiredKeys?: string[]): Promise<{
    ok: boolean;
    inserted: string[];
    skipped: string[];
    nowCount: number;
    errors?: string[];
  }> {
    console.log(`${this.LOG_PREFIX} Starting seedDefaultsIfMissing`);

    const result = {
      ok: true,
      inserted: [] as string[],
      skipped: [] as string[],
      nowCount: 0,
      errors: [] as string[]
    };

    try {
      // Get all platform template definitions
      const allTemplateDefaults = this.getPlatformTemplateDefaults();
      
      // Filter to specific keys if provided, otherwise use all
      const targetKeys = requiredKeys || allTemplateDefaults.map(t => t.key);
      const templatesToCheck = allTemplateDefaults.filter(t => targetKeys.includes(t.key));

      console.log(`${this.LOG_PREFIX} Checking ${templatesToCheck.length} template keys: ${targetKeys.join(', ')}`);

      // Check which templates are missing
      for (const templateDef of templatesToCheck) {
        try {
          const existingTemplate = await storage.getEmailTemplateByKey(templateDef.key);
          
          if (existingTemplate) {
            console.log(`${this.LOG_PREFIX} Template '${templateDef.key}' exists, skipping`);
            result.skipped.push(templateDef.key);
          } else {
            console.log(`${this.LOG_PREFIX} Template '${templateDef.key}' missing, creating`);
            
            // Create the missing template
            await this.emailTemplateService.createTemplate(templateDef);
            result.inserted.push(templateDef.key);
            
            console.log(`${this.LOG_PREFIX} Successfully created template '${templateDef.key}'`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`${this.LOG_PREFIX} Failed to process template '${templateDef.key}':`, error);
          
          result.errors!.push(`${templateDef.key}: ${errorMessage}`);
          result.ok = false;
        }
      }

      // Get final count of all templates
      try {
        const allTemplates = await storage.getAllEmailTemplates();
        result.nowCount = allTemplates.length;
      } catch (error) {
        console.warn(`${this.LOG_PREFIX} Could not get final template count:`, error);
        result.nowCount = result.inserted.length + result.skipped.length;
      }

      console.log(`${this.LOG_PREFIX} seedDefaultsIfMissing complete: inserted=${result.inserted.length}, skipped=${result.skipped.length}, total=${result.nowCount}`);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${this.LOG_PREFIX} Critical error in seedDefaultsIfMissing:`, error);
      
      return {
        ok: false,
        inserted: result.inserted,
        skipped: result.skipped,
        nowCount: result.nowCount,
        errors: [...(result.errors || []), `Critical error: ${errorMessage}`]
      };
    }
  }

  /**
   * Validate all seeded templates
   * 
   * @returns Validation results
   */
  async validateSeededTemplates(): Promise<{
    valid: boolean;
    templateCount: number;
    validationErrors: string[];
  }> {
    try {
      console.log(`${this.LOG_PREFIX} Validating seeded templates`);
      
      const allTemplates = await storage.getAllEmailTemplates();
      const requiredKeys = this.getPlatformTemplateDefaults().map(t => t.key);
      const validationErrors: string[] = [];

      // Check if all required templates exist
      for (const requiredKey of requiredKeys) {
        const template = allTemplates.find(t => t.key === requiredKey);
        if (!template) {
          validationErrors.push(`Missing required template: ${requiredKey}`);
          continue;
        }

        // Validate template has required fields
        if (!template.name) validationErrors.push(`Template ${requiredKey} missing name`);
        if (!template.subject) validationErrors.push(`Template ${requiredKey} missing subject`);
        if (!template.html) validationErrors.push(`Template ${requiredKey} missing HTML content`);
        if (!template.mjml) validationErrors.push(`Template ${requiredKey} missing MJML source`);
        if (!template.isActive) validationErrors.push(`Template ${requiredKey} is not active`);

        // Validate MJML can be compiled
        if (template.mjml) {
          try {
            await this.emailTemplateService.validateMjml(template.mjml, template.key);
          } catch (error) {
            validationErrors.push(`Template ${requiredKey} has invalid MJML: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      const isValid = validationErrors.length === 0;
      
      console.log(`${this.LOG_PREFIX} Template validation complete: ${isValid ? 'VALID' : 'INVALID'} (${validationErrors.length} errors)`);
      
      return {
        valid: isValid,
        templateCount: allTemplates.length,
        validationErrors
      };

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error during template validation:`, error);
      return {
        valid: false,
        templateCount: 0,
        validationErrors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}

// Export singleton instance
export const emailTemplateSeedService = new EmailTemplateSeedService();