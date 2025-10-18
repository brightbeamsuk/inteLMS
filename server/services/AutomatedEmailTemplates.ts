import mjml2html from "mjml";

/**
 * Automated Email Templates Service
 * 
 * Hardcoded email templates that automatically trigger on system events.
 * Uses organization's email provider settings (or system defaults) to send notifications.
 */

export interface EmailTemplateData {
  subject: string;
  html: string;
  text: string;
}

export interface CourseAssignedData {
  userName: string;
  courseName: string;
  dueDate?: string;
  orgName: string;
  courseUrl?: string;
}

export interface CourseCompletedData {
  userName: string;
  userEmail: string;
  courseName: string;
  score: number;
  status: 'PASS' | 'FAIL';
  completedDate: string;
  adminName?: string;
  orgName: string;
}

export interface DueDatePassedData {
  userName: string;
  courseName: string;
  dueDate: string;
  orgName: string;
  courseUrl?: string;
}

/**
 * Automated Email Templates
 * Each template uses MJML for responsive email design
 */
export class AutomatedEmailTemplates {
  
  /**
   * USER: Course Assigned Notification
   */
  static courseAssigned(data: CourseAssignedData): EmailTemplateData {
    const { userName, courseName, dueDate, orgName, courseUrl } = data;
    
    const mjml = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="Arial, sans-serif" />
            <mj-text color="#333333" line-height="1.6" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="bold" color="#2563eb" align="center">
                New Course Assigned
              </mj-text>
              
              <mj-divider border-color="#e5e7eb" padding="20px 0" />
              
              <mj-text font-size="16px">
                Hi ${userName},
              </mj-text>
              
              <mj-text font-size="16px">
                You have been assigned a new course: <strong>${courseName}</strong>
              </mj-text>
              
              ${dueDate ? `
              <mj-text font-size="16px" color="#dc2626">
                <strong>Due Date:</strong> ${dueDate}
              </mj-text>
              ` : ''}
              
              ${courseUrl ? `
              <mj-button background-color="#2563eb" color="#ffffff" href="${courseUrl}" padding="20px 0">
                Start Course
              </mj-button>
              ` : ''}
              
              <mj-text font-size="14px" color="#6b7280" padding-top="20px">
                ${orgName}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
    
    const { html } = mjml2html(mjml);
    
    return {
      subject: `New Course Assigned: ${courseName}`,
      html,
      text: `Hi ${userName},\n\nYou have been assigned a new course: ${courseName}\n${dueDate ? `Due Date: ${dueDate}\n` : ''}\n${courseUrl ? `Access your course: ${courseUrl}\n` : ''}\n\n${orgName}`
    };
  }

  /**
   * USER: Course Completed Notification
   */
  static userCourseCompleted(data: CourseCompletedData): EmailTemplateData {
    const { userName, courseName, score, status, completedDate, orgName } = data;
    const isPassed = status === 'PASS';
    const statusColor = isPassed ? '#10b981' : '#dc2626';
    const statusText = isPassed ? 'Completed Successfully' : 'Not Passed';
    
    const mjml = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="Arial, sans-serif" />
            <mj-text color="#333333" line-height="1.6" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="bold" color="${statusColor}" align="center">
                Course ${statusText}
              </mj-text>
              
              <mj-divider border-color="#e5e7eb" padding="20px 0" />
              
              <mj-text font-size="16px">
                Hi ${userName},
              </mj-text>
              
              <mj-text font-size="16px">
                ${isPassed 
                  ? `Congratulations! You have successfully completed: <strong>${courseName}</strong>` 
                  : `You have completed: <strong>${courseName}</strong>, but did not achieve the passing score.`
                }
              </mj-text>
              
              <mj-text font-size="18px" font-weight="bold" color="${statusColor}" align="center" padding="20px 0">
                Score: ${score}%
              </mj-text>
              
              <mj-text font-size="16px">
                <strong>Completed:</strong> ${completedDate}
              </mj-text>
              
              ${!isPassed ? `
              <mj-text font-size="16px" color="#dc2626">
                Please contact your administrator if you need to retake this course.
              </mj-text>
              ` : ''}
              
              <mj-text font-size="14px" color="#6b7280" padding-top="20px">
                ${orgName}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
    
    const { html } = mjml2html(mjml);
    
    return {
      subject: isPassed ? `Course Completed: ${courseName}` : `Course Not Passed: ${courseName}`,
      html,
      text: `Hi ${userName},\n\n${isPassed ? 'Congratulations! ' : ''}You have completed: ${courseName}\n\nScore: ${score}%\nStatus: ${statusText}\nCompleted: ${completedDate}\n${!isPassed ? '\nPlease contact your administrator if you need to retake this course.\n' : ''}\n${orgName}`
    };
  }

  /**
   * USER: Due Date Passed Notification
   */
  static dueDatePassed(data: DueDatePassedData): EmailTemplateData {
    const { userName, courseName, dueDate, orgName, courseUrl } = data;
    
    const mjml = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="Arial, sans-serif" />
            <mj-text color="#333333" line-height="1.6" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="bold" color="#dc2626" align="center">
                Course Overdue
              </mj-text>
              
              <mj-divider border-color="#e5e7eb" padding="20px 0" />
              
              <mj-text font-size="16px">
                Hi ${userName},
              </mj-text>
              
              <mj-text font-size="16px" color="#dc2626">
                The due date for <strong>${courseName}</strong> has passed.
              </mj-text>
              
              <mj-text font-size="16px">
                <strong>Due Date:</strong> ${dueDate}
              </mj-text>
              
              <mj-text font-size="16px">
                Please complete this course as soon as possible.
              </mj-text>
              
              ${courseUrl ? `
              <mj-button background-color="#dc2626" color="#ffffff" href="${courseUrl}" padding="20px 0">
                Complete Course Now
              </mj-button>
              ` : ''}
              
              <mj-text font-size="14px" color="#6b7280" padding-top="20px">
                ${orgName}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
    
    const { html } = mjml2html(mjml);
    
    return {
      subject: `Course Overdue: ${courseName}`,
      html,
      text: `Hi ${userName},\n\nThe due date for ${courseName} has passed.\n\nDue Date: ${dueDate}\n\nPlease complete this course as soon as possible.\n${courseUrl ? `\nComplete course: ${courseUrl}\n` : ''}\n${orgName}`
    };
  }

  /**
   * ADMIN: Candidate Completed Course
   */
  static adminCandidateCompleted(data: CourseCompletedData): EmailTemplateData {
    const { userName, userEmail, courseName, score, status, completedDate, adminName, orgName } = data;
    const isPassed = status === 'PASS';
    const statusColor = isPassed ? '#10b981' : '#dc2626';
    
    const mjml = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="Arial, sans-serif" />
            <mj-text color="#333333" line-height="1.6" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="bold" color="${statusColor}" align="center">
                Candidate ${isPassed ? 'Completed' : 'Failed'} Course
              </mj-text>
              
              <mj-divider border-color="#e5e7eb" padding="20px 0" />
              
              <mj-text font-size="16px">
                ${adminName ? `Hi ${adminName},` : 'Hi,'}
              </mj-text>
              
              <mj-text font-size="16px">
                <strong>${userName}</strong> (${userEmail}) has ${isPassed ? 'completed' : 'failed'} the course: <strong>${courseName}</strong>
              </mj-text>
              
              <mj-text font-size="18px" font-weight="bold" color="${statusColor}" align="center" padding="20px 0">
                Score: ${score}% - ${status}
              </mj-text>
              
              <mj-text font-size="16px">
                <strong>Completed:</strong> ${completedDate}
              </mj-text>
              
              ${!isPassed ? `
              <mj-text font-size="16px" color="#dc2626">
                The candidate did not achieve the passing score and may need to retake the course.
              </mj-text>
              ` : ''}
              
              <mj-text font-size="14px" color="#6b7280" padding-top="20px">
                ${orgName}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
    
    const { html } = mjml2html(mjml);
    
    return {
      subject: `${userName} ${isPassed ? 'Completed' : 'Failed'}: ${courseName}`,
      html,
      text: `${adminName ? `Hi ${adminName},` : 'Hi,'}\n\n${userName} (${userEmail}) has ${isPassed ? 'completed' : 'failed'} the course: ${courseName}\n\nScore: ${score}% - ${status}\nCompleted: ${completedDate}\n${!isPassed ? '\nThe candidate did not achieve the passing score and may need to retake the course.\n' : ''}\n${orgName}`
    };
  }

  /**
   * ADMIN: New User Added (Admin added a user to their organization)
   */
  static adminNewUserAdded(data: {
    adminName?: string;
    userName: string;
    userEmail: string;
    orgName: string;
  }): EmailTemplateData {
    const { adminName, userName, userEmail, orgName } = data;
    
    const mjml = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="Arial, sans-serif" />
            <mj-text color="#333333" line-height="1.6" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="bold" color="#2563eb" align="center">
                New User Added
              </mj-text>
              
              <mj-divider border-color="#e5e7eb" padding="20px 0" />
              
              <mj-text font-size="16px">
                ${adminName ? `Hi ${adminName},` : 'Hi,'}
              </mj-text>
              
              <mj-text font-size="16px">
                A new user has been added to your organization:
              </mj-text>
              
              <mj-text font-size="16px" padding="10px 0">
                <strong>Name:</strong> ${userName}<br/>
                <strong>Email:</strong> ${userEmail}
              </mj-text>
              
              <mj-text font-size="14px" color="#6b7280" padding-top="20px">
                ${orgName}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
    
    const { html } = mjml2html(mjml);
    
    return {
      subject: `New User Added: ${userName}`,
      html,
      text: `${adminName ? `Hi ${adminName},` : 'Hi,'}\n\nA new user has been added to your organization:\n\nName: ${userName}\nEmail: ${userEmail}\n\n${orgName}`
    };
  }

  /**
   * USER: Welcome Email (with temporary password)
   */
  static welcomeEmail(data: {
    userName: string;
    userEmail: string;
    temporaryPassword: string;
    orgName: string;
    loginUrl: string;
  }): EmailTemplateData {
    const { userName, userEmail, temporaryPassword, orgName, loginUrl } = data;
    
    const mjml = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="Arial, sans-serif" />
            <mj-text color="#333333" line-height="1.6" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="bold" color="#2563eb" align="center">
                Welcome to ${orgName}
              </mj-text>
              
              <mj-divider border-color="#e5e7eb" padding="20px 0" />
              
              <mj-text font-size="16px">
                Hi ${userName},
              </mj-text>
              
              <mj-text font-size="16px">
                Welcome! Your account has been created and you're ready to start your training journey.
              </mj-text>
              
              <mj-text font-size="16px" padding="10px 0">
                <strong>Email:</strong> ${userEmail}
              </mj-text>
              
              <mj-section background-color="#f9fafb" padding="20px" border-radius="8px">
                <mj-column>
                  <mj-text font-size="14px" color="#6b7280" align="center">
                    Your Temporary Password
                  </mj-text>
                  <mj-text font-size="20px" font-weight="bold" color="#2563eb" align="center" padding="10px 0">
                    ${temporaryPassword}
                  </mj-text>
                  <mj-text font-size="12px" color="#dc2626" align="center">
                    You will be required to change this password on first login
                  </mj-text>
                </mj-column>
              </mj-section>
              
              <mj-button background-color="#2563eb" color="#ffffff" href="${loginUrl}" padding="20px 0">
                Log In Now
              </mj-button>
              
              <mj-text font-size="14px" color="#6b7280" padding-top="20px">
                ${orgName}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
    
    const { html } = mjml2html(mjml);
    
    return {
      subject: `Welcome to ${orgName} - Your Account is Ready`,
      html,
      text: `Hi ${userName},\n\nWelcome! Your account has been created.\n\nEmail: ${userEmail}\nTemporary Password: ${temporaryPassword}\n\nYou will be required to change this password on first login.\n\nLog in: ${loginUrl}\n\n${orgName}`
    };
  }

  /**
   * USER: Password Reset
   */
  static passwordReset(data: {
    userName: string;
    resetLink: string;
    expiryTime: string;
    orgName: string;
  }): EmailTemplateData {
    const { userName, resetLink, expiryTime, orgName } = data;
    
    const mjml = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="Arial, sans-serif" />
            <mj-text color="#333333" line-height="1.6" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="bold" color="#2563eb" align="center">
                Password Reset Request
              </mj-text>
              
              <mj-divider border-color="#e5e7eb" padding="20px 0" />
              
              <mj-text font-size="16px">
                Hi ${userName},
              </mj-text>
              
              <mj-text font-size="16px">
                We received a request to reset your password. Click the button below to create a new password:
              </mj-text>
              
              <mj-button background-color="#2563eb" color="#ffffff" href="${resetLink}" padding="20px 0">
                Reset Password
              </mj-button>
              
              <mj-text font-size="14px" color="#dc2626" padding="10px 0">
                This link will expire in ${expiryTime}.
              </mj-text>
              
              <mj-text font-size="14px" color="#6b7280">
                If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
              </mj-text>
              
              <mj-text font-size="14px" color="#6b7280" padding-top="20px">
                ${orgName}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
    
    const { html } = mjml2html(mjml);
    
    return {
      subject: `Password Reset Request - ${orgName}`,
      html,
      text: `Hi ${userName},\n\nWe received a request to reset your password.\n\nReset your password: ${resetLink}\n\nThis link will expire in ${expiryTime}.\n\nIf you didn't request this, please ignore this email.\n\n${orgName}`
    };
  }

  /**
   * USER: Course Reminder (X days before due date)
   */
  static courseReminder(data: {
    userName: string;
    courseName: string;
    dueDate: string;
    daysRemaining: number;
    orgName: string;
    courseUrl?: string;
  }): EmailTemplateData {
    const { userName, courseName, dueDate, daysRemaining, orgName, courseUrl } = data;
    const urgencyColor = daysRemaining <= 3 ? '#dc2626' : '#f59e0b';
    
    const mjml = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="Arial, sans-serif" />
            <mj-text color="#333333" line-height="1.6" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="bold" color="${urgencyColor}" align="center">
                Course Reminder
              </mj-text>
              
              <mj-divider border-color="#e5e7eb" padding="20px 0" />
              
              <mj-text font-size="16px">
                Hi ${userName},
              </mj-text>
              
              <mj-text font-size="16px">
                This is a friendly reminder that your course <strong>${courseName}</strong> is due soon.
              </mj-text>
              
              <mj-section background-color="#fef3c7" padding="20px" border-radius="8px">
                <mj-column>
                  <mj-text font-size="18px" font-weight="bold" color="${urgencyColor}" align="center">
                    ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining
                  </mj-text>
                  <mj-text font-size="14px" align="center" padding="5px 0">
                    Due: ${dueDate}
                  </mj-text>
                </mj-column>
              </mj-section>
              
              ${courseUrl ? `
              <mj-button background-color="${urgencyColor}" color="#ffffff" href="${courseUrl}" padding="20px 0">
                Continue Course
              </mj-button>
              ` : ''}
              
              <mj-text font-size="14px" color="#6b7280" padding-top="20px">
                ${orgName}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
    
    const { html } = mjml2html(mjml);
    
    return {
      subject: `Reminder: ${courseName} - Due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
      html,
      text: `Hi ${userName},\n\nThis is a reminder that your course "${courseName}" is due soon.\n\nDue Date: ${dueDate}\nDays Remaining: ${daysRemaining}\n${courseUrl ? `\nContinue course: ${courseUrl}\n` : ''}\n${orgName}`
    };
  }

  /**
   * USER: Certificate Issued
   */
  static certificateIssued(data: {
    userName: string;
    courseName: string;
    issueDate: string;
    certificateUrl: string;
    orgName: string;
  }): EmailTemplateData {
    const { userName, courseName, issueDate, certificateUrl, orgName } = data;
    
    const mjml = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="Arial, sans-serif" />
            <mj-text color="#333333" line-height="1.6" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="bold" color="#10b981" align="center">
                🎓 Certificate Issued
              </mj-text>
              
              <mj-divider border-color="#e5e7eb" padding="20px 0" />
              
              <mj-text font-size="16px">
                Hi ${userName},
              </mj-text>
              
              <mj-text font-size="16px">
                Congratulations! Your certificate for <strong>${courseName}</strong> has been issued.
              </mj-text>
              
              <mj-text font-size="16px" padding="10px 0">
                <strong>Issue Date:</strong> ${issueDate}
              </mj-text>
              
              <mj-button background-color="#10b981" color="#ffffff" href="${certificateUrl}" padding="20px 0">
                Download Certificate
              </mj-button>
              
              <mj-text font-size="14px" color="#6b7280">
                You can access your certificate at any time from your dashboard.
              </mj-text>
              
              <mj-text font-size="14px" color="#6b7280" padding-top="20px">
                ${orgName}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
    
    const { html } = mjml2html(mjml);
    
    return {
      subject: `Certificate Issued: ${courseName}`,
      html,
      text: `Hi ${userName},\n\nCongratulations! Your certificate for "${courseName}" has been issued.\n\nIssue Date: ${issueDate}\n\nDownload: ${certificateUrl}\n\n${orgName}`
    };
  }

  /**
   * ADMIN: New Admin Added (notification to existing admins)
   */
  static newAdminAdded(data: {
    existingAdminName?: string;
    newAdminName: string;
    newAdminEmail: string;
    addedBy: string;
    orgName: string;
  }): EmailTemplateData {
    const { existingAdminName, newAdminName, newAdminEmail, addedBy, orgName } = data;
    
    const mjml = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="Arial, sans-serif" />
            <mj-text color="#333333" line-height="1.6" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="bold" color="#2563eb" align="center">
                New Admin Added
              </mj-text>
              
              <mj-divider border-color="#e5e7eb" padding="20px 0" />
              
              <mj-text font-size="16px">
                ${existingAdminName ? `Hi ${existingAdminName},` : 'Hi,'}
              </mj-text>
              
              <mj-text font-size="16px">
                A new administrator has been added to your organization by ${addedBy}.
              </mj-text>
              
              <mj-section background-color="#f9fafb" padding="15px" border-radius="8px">
                <mj-column>
                  <mj-text font-size="16px">
                    <strong>Name:</strong> ${newAdminName}<br/>
                    <strong>Email:</strong> ${newAdminEmail}
                  </mj-text>
                </mj-column>
              </mj-section>
              
              <mj-text font-size="14px" color="#6b7280" padding-top="20px">
                ${orgName}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
    
    const { html } = mjml2html(mjml);
    
    return {
      subject: `New Administrator Added: ${newAdminName}`,
      html,
      text: `${existingAdminName ? `Hi ${existingAdminName},` : 'Hi,'}\n\nA new administrator has been added to your organization by ${addedBy}.\n\nName: ${newAdminName}\nEmail: ${newAdminEmail}\n\n${orgName}`
    };
  }

  /**
   * ADMIN: Plan/Subscription Updated
   */
  static planUpdated(data: {
    adminName?: string;
    orgName: string;
    planName: string;
    previousPlan?: string;
    changeType: 'upgraded' | 'downgraded' | 'changed';
    effectiveDate: string;
    updatedBy: string;
  }): EmailTemplateData {
    const { adminName, orgName, planName, previousPlan, changeType, effectiveDate, updatedBy } = data;
    const changeColor = changeType === 'upgraded' ? '#10b981' : changeType === 'downgraded' ? '#f59e0b' : '#2563eb';
    
    const mjml = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="Arial, sans-serif" />
            <mj-text color="#333333" line-height="1.6" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="bold" color="${changeColor}" align="center">
                Subscription ${changeType === 'upgraded' ? 'Upgraded' : changeType === 'downgraded' ? 'Downgraded' : 'Updated'}
              </mj-text>
              
              <mj-divider border-color="#e5e7eb" padding="20px 0" />
              
              <mj-text font-size="16px">
                ${adminName ? `Hi ${adminName},` : 'Hi,'}
              </mj-text>
              
              <mj-text font-size="16px">
                Your organization's subscription has been ${changeType}.
              </mj-text>
              
              <mj-section background-color="#f9fafb" padding="15px" border-radius="8px">
                <mj-column>
                  ${previousPlan ? `
                  <mj-text font-size="14px" color="#6b7280">
                    Previous Plan: ${previousPlan}
                  </mj-text>
                  ` : ''}
                  <mj-text font-size="16px" font-weight="bold" color="${changeColor}">
                    New Plan: ${planName}
                  </mj-text>
                  <mj-text font-size="14px" color="#6b7280">
                    Effective: ${effectiveDate}
                  </mj-text>
                  <mj-text font-size="14px" color="#6b7280">
                    Updated by: ${updatedBy}
                  </mj-text>
                </mj-column>
              </mj-section>
              
              <mj-text font-size="14px" color="#6b7280" padding-top="20px">
                ${orgName}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
    
    const { html } = mjml2html(mjml);
    
    return {
      subject: `Subscription ${changeType === 'upgraded' ? 'Upgraded' : changeType === 'downgraded' ? 'Downgraded' : 'Updated'}: ${planName}`,
      html,
      text: `${adminName ? `Hi ${adminName},` : 'Hi,'}\n\nYour organization's subscription has been ${changeType}.\n\n${previousPlan ? `Previous Plan: ${previousPlan}\n` : ''}New Plan: ${planName}\nEffective: ${effectiveDate}\nUpdated by: ${updatedBy}\n\n${orgName}`
    };
  }
}
