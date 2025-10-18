# Automated Email Templates Guide

## Overview
All automated emails are hardcoded as MJML templates in `server/services/AutomatedEmailTemplates.ts`. They automatically trigger on specific system events and use the organization's email provider settings (or system defaults as fallback).

---

## Complete List of Automated Emails (11 Total)

### **1. Course Assigned** ✅ ACTIVE
- **Template Method:** `AutomatedEmailTemplates.courseAssigned()`
- **Recipient:** User (learner)
- **Trigger:** When a course is assigned to a user
- **Includes:** Course name, due date (if set), "Start Course" button
- **Trigger Event:** `COURSE_ASSIGNED`

### **2. Course Completed (User Notification)** ✅ ACTIVE
- **Template Method:** `AutomatedEmailTemplates.userCourseCompleted()`
- **Recipient:** User (learner)
- **Trigger:** When user completes a course (pass or fail)
- **Includes:** Pass/fail status, score percentage, completion date
- **Trigger Event:** `COURSE_COMPLETED` / `COURSE_FAILED`

### **3. Due Date Passed** ✅ ACTIVE
- **Template Method:** `AutomatedEmailTemplates.dueDatePassed()`
- **Recipient:** User (learner)
- **Trigger:** When course due date passes without completion
- **Includes:** Course name, overdue notice, "Complete Now" button
- **Trigger Event:** Scheduled job (needs implementation)

### **4. Admin: Candidate Completed** ✅ ACTIVE
- **Template Method:** `AutomatedEmailTemplates.adminCandidateCompleted()`
- **Recipient:** Admin(s) of the organization
- **Trigger:** When a learner completes a course
- **Includes:** Learner name/email, course name, score, pass/fail status
- **Trigger Event:** `COURSE_COMPLETED` / `COURSE_FAILED`

### **5. Admin: New User Added** ✅ ACTIVE
- **Template Method:** `AutomatedEmailTemplates.adminNewUserAdded()`
- **Recipient:** Admin(s) of the organization
- **Trigger:** When a new user is added to the organization
- **Includes:** New user's name and email
- **Trigger Event:** `USER_FAST_ADD`

---

## **NEW TEMPLATES ADDED**

### **6. Welcome Email** 🆕 READY
- **Template Method:** `AutomatedEmailTemplates.welcomeEmail()`
- **Recipient:** New user
- **Trigger:** When user account is created
- **Includes:** 
  - Temporary password (highlighted)
  - Login URL
  - Warning about password change requirement
- **Integration Points:**
  - User creation in routes.ts
  - Organization admin creation
  - Bulk user import
- **Status:** Template ready, needs trigger integration

### **7. Password Reset** 🆕 READY
- **Template Method:** `AutomatedEmailTemplates.passwordReset()`
- **Recipient:** User requesting password reset
- **Trigger:** When user initiates password reset
- **Includes:**
  - Reset link with expiry time
  - Security warning
- **Integration Points:**
  - Password reset route (needs creation)
- **Status:** Template ready, needs password reset route

### **8. Course Reminder** 🆕 READY
- **Template Method:** `AutomatedEmailTemplates.courseReminder()`
- **Recipient:** User with upcoming course deadline
- **Trigger:** X days before due date (e.g., 7 days, 3 days, 1 day)
- **Includes:**
  - Days remaining (color-coded by urgency)
  - Due date
  - "Continue Course" button
- **Integration Points:**
  - Scheduled job/cron to check assignments
- **Status:** Template ready, needs scheduled job

### **9. Certificate Issued** 🆕 READY
- **Template Method:** `AutomatedEmailTemplates.certificateIssued()`
- **Recipient:** User who received certificate
- **Trigger:** When certificate is generated (after passing course)
- **Includes:**
  - Issue date
  - "Download Certificate" button
- **Integration Points:**
  - Certificate generation in certificateService.ts
- **Status:** Template ready, needs trigger in certificate service

### **10. New Admin Added** 🆕 READY
- **Template Method:** `AutomatedEmailTemplates.newAdminAdded()`
- **Recipient:** Existing admin(s) in organization
- **Trigger:** When a new admin is added to the organization
- **Includes:**
  - New admin's name and email
  - Who added them
- **Integration Points:**
  - Admin user creation route
- **Status:** Template ready, needs trigger integration

### **11. Plan/Subscription Updated** 🆕 READY
- **Template Method:** `AutomatedEmailTemplates.planUpdated()`
- **Recipient:** Admin(s) of organization
- **Trigger:** When organization's subscription plan changes
- **Includes:**
  - Previous plan (if applicable)
  - New plan name
  - Change type (upgraded/downgraded/changed)
  - Effective date
  - Who made the change
- **Integration Points:**
  - Plan assignment/update route
  - Stripe webhook handlers
- **Status:** Template ready, needs trigger integration

---

## Email Template Structure

All templates follow this structure:

```typescript
interface EmailTemplateData {
  subject: string;  // Email subject line
  html: string;     // MJML-compiled HTML email
  text: string;     // Plain text fallback
}
```

## Design Features

✅ **Responsive Design:** MJML ensures emails look great on all devices
✅ **Brand Colors:** 
  - Primary: #2563eb (blue)
  - Success: #10b981 (green)
  - Warning: #f59e0b (orange)
  - Danger: #dc2626 (red)
✅ **Consistent Layout:** All emails use same header/footer structure
✅ **Clear CTAs:** Button-based calls-to-action where applicable

---

## Next Steps for Full Integration

### **Immediate Actions Needed:**

1. **Welcome Email Integration**
   - Add trigger to user creation routes
   - Include temporary password in context
   - Test with new user signup

2. **Password Reset System**
   - Create `/api/auth/reset-password` endpoint
   - Generate secure reset tokens
   - Store tokens with expiry
   - Trigger email with reset link

3. **Course Reminder Scheduler**
   - Create scheduled job (daily check)
   - Query assignments with upcoming due dates
   - Send reminders at configured intervals (7 days, 3 days, 1 day)

4. **Certificate Email**
   - Add trigger in `certificateService.ts`
   - Include certificate download URL
   - Trigger after successful certificate generation

5. **New Admin Notification**
   - Add trigger when admin users are created
   - Send to existing admins in organization
   - Include who added the new admin

6. **Plan Update Notification**
   - Add trigger in plan assignment route
   - Add trigger in Stripe webhook handler
   - Include change details and effective date

---

## Testing Checklist

- [ ] Welcome email sends with correct temporary password
- [ ] Password reset link works and expires correctly
- [ ] Course reminders send at correct intervals
- [ ] Certificate emails send after certificate generation
- [ ] Admin notifications send to all existing admins
- [ ] Plan update emails send when subscription changes
- [ ] All emails render correctly on mobile devices
- [ ] Plain text fallbacks work
- [ ] Organization email settings are respected
- [ ] System defaults used when org settings not configured

---

## File Locations

- **Templates:** `server/services/AutomatedEmailTemplates.ts`
- **Orchestrator:** `server/services/EmailOrchestrator.ts`
- **Routes:** `server/routes.ts`
- **Email Logs:** SuperAdmin → Email Logs (UI)

---

**Last Updated:** October 2025
