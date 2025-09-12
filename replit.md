# Overview

This is a white-label Learning Management System (LMS) web application built with a full-stack TypeScript architecture. The platform supports multi-tenant organizations with role-based access control (SuperAdmin, Admin, User), SCORM course delivery, and automated certificate generation. The system is designed as a SaaS platform where multiple organizations can operate independently while sharing the same infrastructure.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The client uses **React with TypeScript** and follows a component-based architecture:

- **UI Framework**: DaisyUI components are used exclusively for all interface elements (navbars, forms, modals, etc.)
- **Routing**: Wouter for lightweight client-side routing with role-based route protection
- **State Management**: TanStack Query for server state management and caching
- **Styling**: Tailwind CSS with custom CSS variables for theming support
- **Build Tool**: Vite for fast development and optimized production builds

The frontend is organized into role-specific layouts (SuperAdminLayout, AdminLayout, UserLayout) with dedicated page components for each user role's interface.

### Email Templates UI

- **SuperAdmin Templates Page**: Complete default template management with editing, preview, and testing capabilities
- **Admin Templates Page**: Organization-level template override management with fallback to system defaults
- **Navigation Integration**: Properly integrated into role-specific navigation menus with permissions

## Backend Architecture

The server uses **Express.js with TypeScript** in an ESM environment:

- **Database ORM**: Drizzle ORM with PostgreSQL for type-safe database operations
- **Authentication**: Replit Auth with OpenID Connect integration using Passport.js
- **Session Management**: Express sessions stored in PostgreSQL
- **API Design**: RESTful endpoints with role-based access control middleware
- **File Uploads**: Integration with object storage services through custom ObjectStorageService

## Database Design

**PostgreSQL** database with Drizzle ORM providing:

- **Multi-tenant Data Isolation**: Each organization's data is properly segmented
- **Role-based Schema**: Users, organisations, courses, assignments, completions, certificates
- **Session Storage**: Dedicated sessions table for authentication persistence
- **Enum Types**: Strongly typed status fields (user_role, course_status, completion_status)

Key relationships enforce data integrity while supporting the multi-tenant architecture where organizations only access their own data.

## Authentication & Authorization

**Replit Auth** provides:

- **OpenID Connect Integration**: Secure authentication flow
- **Session-based Authentication**: Server-side session management with PostgreSQL storage
- **Role-based Access Control**: Three distinct user roles with different permission levels
- **Multi-tenant Security**: Users can only access data within their organization scope

## SCORM Integration

Custom **ScormService** handles:

- **Package Validation**: Validates SCORM package structure and standards compliance
- **Content Extraction**: Parses imsmanifest.xml and extracts course metadata
- **Progress Tracking**: Processes completion data and applies passmark logic
- **Score Calculation**: Handles pass/fail determination based on course requirements

## Email & Notifications

**EmailService** architecture supports:

- **Assignment Notifications**: Automated emails when courses are assigned
- **Reminder System**: Scheduled reminders for approaching due dates
- **Completion Notifications**: Success/failure notifications with score reporting
- **Welcome Emails**: User onboarding with temporary password delivery

## Certificate Generation

**CertificateService** provides:

- **Template System**: Customizable certificate templates per organization
- **Dynamic Content**: Placeholder replacement for user data, course info, and scores
- **PDF Generation**: HTML-to-PDF conversion for downloadable certificates
- **Access Control**: Role-based permissions for certificate downloads

# External Dependencies

## Database & Storage
- **Neon Database**: PostgreSQL hosting with serverless connection pooling
- **Google Cloud Storage**: Object storage for SCORM packages and generated certificates
- **Replit Object Storage**: File upload and management through sidecar service

## Authentication & Security
- **Replit Auth**: OpenID Connect provider for secure user authentication
- **Passport.js**: Authentication middleware with OpenID Connect strategy

## Email Services
- **SendGrid**: Email delivery service for notifications and user communications

## UI & Styling
- **DaisyUI**: Complete UI component library built on Tailwind CSS
- **Radix UI**: Accessible component primitives for complex interactions
- **Font Awesome**: Icon library for interface elements
- **Google Fonts**: Typography with DM Sans, Fira Code, and other web fonts

## File Management
- **Uppy**: File upload interface with progress tracking and S3 integration
- **SCORM Processing**: Custom service for educational content package handling

## Development & Build Tools
- **Vite**: Frontend build tool with HMR and optimized production builds
- **Drizzle Kit**: Database migration and schema management
- **TypeScript**: Type safety across the entire application stack
- **ESBuild**: Fast JavaScript bundling for server-side code

The architecture emphasizes type safety, multi-tenancy, and role-based access control while maintaining separation of concerns between frontend and backend systems.