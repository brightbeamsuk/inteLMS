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

### **6. Welcome Email** ✅ ACTIVE
- **Template Method:** `AutomatedEmailTemplates.welcomeEmail()`
- **Recipient:** New user
- **Trigger:** When user account is created
- **Includes:** 
  - Temporary password (highlighted)
  - Login URL
  - Warning about password change requirement
- **Integration Points:**
  - ✅ User creation in routes.ts (line 16619-16630)
  - ✅ Name fallback: Full name → First name → Email
- **Status:** ✅ FULLY INTEGRATED - Sends automatically on user creation

### **7. Password Reset** 🔜 READY
- **Template Method:** `AutomatedEmailTemplates.passwordReset()`
- **Recipient:** User requesting password reset
- **Trigger:** When user initiates password reset
- **Includes:**
  - Reset link with expiry time
  - Security warning
- **Integration Points:**
  - ⏳ Password reset route (awaiting implementation)
- **Status:** Template ready, awaiting password reset route creation

### **8. Course Reminder** 🔜 READY
- **Template Method:** `AutomatedEmailTemplates.courseReminder()`
- **Recipient:** User with upcoming course deadline
- **Trigger:** X days before due date (e.g., 7 days, 3 days, 1 day)
- **Includes:**
  - Days remaining (color-coded by urgency)
  - Due date
  - "Continue Course" button
- **Integration Points:**
  - ⏳ Scheduled job/cron to check assignments (awaiting implementation)
- **Status:** Template ready, awaiting scheduled job creation

### **9. Certificate Issued** ✅ ACTIVE
- **Template Method:** `AutomatedEmailTemplates.certificateIssued()`
- **Recipient:** User who received certificate
- **Trigger:** When certificate is generated (after passing course)
- **Includes:**
  - Issue date
  - "Download Certificate" button
- **Integration Points:**
  - ✅ Certificate generation route (line 8739-8769)
  - ✅ Name fallback: Full name → First name → Email
- **Status:** ✅ FULLY INTEGRATED - Sends automatically after certificate generation

### **10. New Admin Added** ✅ ACTIVE
- **Template Method:** `AutomatedEmailTemplates.newAdminAdded()`
- **Recipient:** Existing admin(s) in organization
- **Trigger:** When a new admin is added to the organization
- **Includes:**
  - New admin's name and email
  - Who added them
- **Integration Points:**
  - ✅ EmailNotificationService.notifyNewAdminAdded() (line 107-178)
  - ✅ Name fallback: Full name → First name → Email
- **Status:** ✅ FULLY INTEGRATED - Sends to existing admins when new admin added

### **11. Plan/Subscription Updated** ✅ ACTIVE
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
  - ✅ EmailNotificationService.notifyPlanUpdated() (line 388-472)
  - ✅ Automatic change type detection (upgraded/downgraded/changed)
- **Status:** ✅ FULLY INTEGRATED - Sends when plan changes via SuperAdmin

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

## Implementation Status

### **✅ Completed Integrations (4/6):**

1. **✅ Welcome Email**
   - Integrated in user creation routes (routes.ts line 16619-16630)
   - Includes temporary password display
   - Name fallback logic implemented (Full name → First name → Email)
   - Tested and production-ready

2. **✅ Certificate Issued**
   - Integrated in certificate generation (routes.ts line 8739-8769)
   - Certificate download URL included
   - Name fallback logic implemented
   - Tested and production-ready

3. **✅ New Admin Added**
   - Integrated via EmailNotificationService (line 107-178)
   - Sends to existing admins (excludes newly added admin)
   - Name fallback logic implemented
   - Tested and production-ready

4. **✅ Plan/Subscription Updated**
   - Integrated via EmailNotificationService (line 388-472)
   - Automatic change type detection (upgraded/downgraded/changed)
   - Sends to all organization admins
   - Tested and production-ready

### **⏳ Pending Implementation (2/6):**

1. **Password Reset System** (Template Ready)
   - Create `/api/auth/reset-password` endpoint
   - Generate secure reset tokens with expiry
   - Store tokens in database
   - Trigger email with reset link

2. **Course Reminder Scheduler** (Template Ready)
   - Create scheduled job (daily cron)
   - Query assignments with upcoming due dates
   - Send reminders at intervals (7 days, 3 days, 1 day before)
   - Configure reminder timing in admin settings

---

## Testing Checklist

- [x] Welcome email sends with correct temporary password
- [x] Welcome email handles users without names (fallback to email)
- [ ] Password reset link works and expires correctly *(awaiting route implementation)*
- [ ] Course reminders send at correct intervals *(awaiting scheduled job)*
- [x] Certificate emails send after certificate generation
- [x] Certificate emails handle users without names (fallback to email)
- [x] New admin notifications send to all existing admins
- [x] New admin notifications exclude the newly added admin
- [x] Plan update emails send when subscription changes
- [x] Plan update emails detect change type correctly
- [x] All emails use preRenderedContent with MJML templates
- [x] Name fallback logic prevents "undefined" display
- [x] Organization email settings are respected (via EmailOrchestrator)
- [x] System defaults used when org settings not configured

---

## File Locations

- **Templates:** `server/services/AutomatedEmailTemplates.ts`
- **Orchestrator:** `server/services/EmailOrchestrator.ts`
- **Routes:** `server/routes.ts`
- **Email Logs:** SuperAdmin → Email Logs (UI)

---

**Last Updated:** October 2025
