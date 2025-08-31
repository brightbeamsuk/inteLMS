import { storage } from "../storage";
import type { User, Organisation, Course, Assignment } from "@shared/schema";

export interface EmailService {
  sendAssignmentEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation): Promise<boolean>;
  sendReminderEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation, daysUntilDue: number): Promise<boolean>;
  sendCompletionEmail(user: User, course: Course, completion: any, organisation: Organisation): Promise<boolean>;
  sendWelcomeEmail(user: User, organisation: Organisation, password: string): Promise<boolean>;
}

export class SimpleEmailService implements EmailService {
  async sendAssignmentEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation): Promise<boolean> {
    // In a real implementation, this would send an actual email
    console.log(`📧 Assignment Email sent to ${user.email}:`);
    console.log(`Subject: New Course Assignment - ${course.title}`);
    console.log(`Course: ${course.title}`);
    console.log(`Organisation: ${organisation.displayName}`);
    console.log(`Due Date: ${assignment.dueDate}`);
    return true;
  }

  async sendReminderEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation, daysUntilDue: number): Promise<boolean> {
    console.log(`📧 Reminder Email sent to ${user.email}:`);
    console.log(`Subject: Course Due Reminder - ${course.title}`);
    console.log(`Course: ${course.title}`);
    console.log(`Organisation: ${organisation.displayName}`);
    console.log(`Days until due: ${daysUntilDue}`);
    return true;
  }

  async sendCompletionEmail(user: User, course: Course, completion: any, organisation: Organisation): Promise<boolean> {
    console.log(`📧 Completion Email sent to ${user.email}:`);
    console.log(`Subject: Course Completed - ${course.title}`);
    console.log(`Course: ${course.title}`);
    console.log(`Organisation: ${organisation.displayName}`);
    console.log(`Score: ${completion.score}%`);
    console.log(`Status: ${completion.status}`);
    return true;
  }

  async sendWelcomeEmail(user: User, organisation: Organisation, password: string): Promise<boolean> {
    console.log(`📧 Welcome Email sent to ${user.email}:`);
    console.log(`Subject: Welcome to ${organisation.displayName} LMS`);
    console.log(`Organisation: ${organisation.displayName}`);
    console.log(`Login Email: ${user.email}`);
    console.log(`Temporary Password: ${password}`);
    return true;
  }
}

export const emailService = new SimpleEmailService();
