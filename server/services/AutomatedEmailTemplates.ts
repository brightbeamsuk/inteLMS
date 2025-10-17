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
}
