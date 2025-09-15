# UK GDPR Compliance Deployment & Operations Guide

**Production Deployment and Operational Procedures for inteLMS UK GDPR Compliance System**

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup & Migration](#database-setup-migration)
4. [Feature Flag Configuration](#feature-flag-configuration)
5. [Third-Party Integration Setup](#third-party-integration-setup)
6. [Security Configuration](#security-configuration)
7. [Testing & Verification](#testing-verification)
8. [Production Deployment](#production-deployment)
9. [Monitoring & Alerting](#monitoring-alerting)
10. [Operational Procedures](#operational-procedures)
11. [Maintenance & Updates](#maintenance-updates)
12. [Troubleshooting Guide](#troubleshooting-guide)

## Pre-Deployment Checklist

### Legal & Compliance Requirements
- [ ] **Legal Review Complete**: Privacy policies and terms of service reviewed by legal counsel
- [ ] **DPO Designation**: Data Protection Officer appointed and contact information available
- [ ] **Processing Lawful Basis**: All processing activities have documented lawful basis under Article 6
- [ ] **Privacy Impact Assessment**: DPIA completed for high-risk processing activities
- [ ] **Staff Training**: All admin users trained on GDPR compliance procedures
- [ ] **Vendor Agreements**: Data processing agreements in place for all third-party services
- [ ] **Incident Response Plan**: Data breach response procedures documented and tested

### Technical Requirements
- [ ] **System Requirements**: Production infrastructure meets performance and security requirements
- [ ] **Database Backup**: Backup and disaster recovery procedures configured and tested
- [ ] **Security Hardening**: Server security, network configuration, and access controls implemented  
- [ ] **SSL/TLS Certificates**: Valid SSL certificates installed for all domains
- [ ] **Monitoring Setup**: System monitoring, logging, and alerting configured
- [ ] **Performance Testing**: Load testing completed under expected user volumes
- [ ] **Penetration Testing**: Security testing completed with GDPR-specific scenarios

### Organizational Readiness
- [ ] **Admin Training**: All organization administrators trained on GDPR features
- [ ] **Process Documentation**: Internal procedures documented for GDPR compliance
- [ ] **Contact Information**: Privacy contact information and DPO details ready
- [ ] **Communication Plan**: User communication strategy for GDPR features launch
- [ ] **Support Procedures**: Help desk procedures for privacy-related inquiries

## Environment Configuration

### Required Environment Variables

**Core GDPR Configuration:**
```bash
# Primary GDPR Feature Flag - MUST BE SET FOR PRODUCTION
GDPR_COMPLIANCE_ENABLED=true

# Privacy Policy Version Management
GDPR_POLICY_VERSION=2.0
GDPR_POLICY_LAST_UPDATED=2025-09-15T00:00:00Z

# Environment Configuration
NODE_ENV=production
```

**Database Configuration:**
```bash
# Primary Database
DATABASE_URL=postgresql://user:password@host:5432/intelms_prod

# Optional: Separate Audit Database (Recommended for High-Volume Deployments)
GDPR_AUDIT_DATABASE_URL=postgresql://user:password@audit-host:5432/intelms_audit

# Database Connection Pool Configuration
DB_POOL_SIZE=20
DB_CONNECTION_TIMEOUT=30000
DB_IDLE_TIMEOUT=10000
```

**Security & Encryption:**
```bash
# Data Encryption Keys (256-bit AES keys, base64 encoded)
DATA_ENCRYPTION_KEY=base64-encoded-256-bit-encryption-key
BACKUP_ENCRYPTION_KEY=base64-encoded-backup-encryption-key

# Audit Log Signing (RSA Private Key for Audit Integrity)
AUDIT_SIGNING_KEY=-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----

# Session Security
SESSION_SECRET=secure-random-session-secret-minimum-32-characters
```

**GDPR-Specific Configuration:**
```bash
# Data Retention Policies
DEFAULT_RETENTION_PERIOD_DAYS=2555  # 7 years default
AUDIT_LOG_RETENTION_DAYS=3653       # 10 years for audit logs
USER_DATA_GRACE_PERIOD_DAYS=30      # Grace period before secure deletion

# Compliance SLA Configuration  
USER_RIGHTS_RESPONSE_DAYS=30         # GDPR Article 12 - 30 days maximum
BREACH_NOTIFICATION_HOURS=72         # GDPR Article 33 - 72 hours to ICO
DATA_PORTABILITY_FORMAT=json         # Default format for data exports

# Age Verification (UK GDPR Article 8)
CHILD_AGE_THRESHOLD=13               # UK threshold for parental consent
PARENTAL_CONSENT_VERIFICATION=true   # Enable parental consent workflows
```

**Integration Configuration:**
```bash
# ICO Integration (UK GDPR Breach Reporting)
ICO_NOTIFICATION_ENDPOINT=https://ico.org.uk/for-organisations/report-a-breach
ICO_ORGANISATION_REGISTRATION=your-ico-registration-number
ICO_NOTIFICATION_EMAIL=privacy@your-organisation.co.uk

# Email Configuration (GDPR-Compliant SMTP)
SMTP_HOST=mail.your-organisation.co.uk
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=gdpr-notifications@your-organisation.co.uk
SMTP_PASSWORD=secure-smtp-password
SMTP_FROM=privacy@your-organisation.co.uk

# Optional: Multi-Provider Email Configuration
SENDGRID_API_KEY=your-sendgrid-key
BREVO_API_KEY=your-brevo-key
```

**Cookie & Consent Configuration:**
```bash
# Cookie Consent Settings
COOKIE_CONSENT_EXPIRY_DAYS=365       # 1 year consent validity
COOKIE_BANNER_POSITION=bottom        # Banner position
ESSENTIAL_COOKIES_ONLY=false         # Development: false, High-Security: true

# Marketing & Analytics Consent
MARKETING_CONSENT_DEFAULT=denied     # PECR compliance - opt-in required
ANALYTICS_CONSENT_DEFAULT=denied     # Default deny for analytics cookies
```

### Development vs Production Configuration

**Development Environment (.env.development):**
```bash
GDPR_COMPLIANCE_ENABLED=true
NODE_ENV=development
GDPR_POLICY_VERSION=2.0-dev

# Development Database
DATABASE_URL=postgresql://localhost:5432/intelms_dev

# Relaxed Settings for Development
USER_RIGHTS_RESPONSE_DAYS=30
BREACH_NOTIFICATION_HOURS=72
AUDIT_LOG_RETENTION_DAYS=90

# Development SMTP (Use MailHog or similar)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

**Production Environment (.env.production):**
```bash
GDPR_COMPLIANCE_ENABLED=true
NODE_ENV=production
GDPR_POLICY_VERSION=2.0

# Production Database with Connection Pooling
DATABASE_URL=postgresql://prod-user:secure-password@prod-db:5432/intelms_prod?sslmode=require&pool_max=20

# Strict Compliance Settings
USER_RIGHTS_RESPONSE_DAYS=30
BREACH_NOTIFICATION_HOURS=72
AUDIT_LOG_RETENTION_DAYS=3653

# Production SMTP with Authentication
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=notifications@your-domain.com
SMTP_PASSWORD=secure-production-password
```

## Database Setup & Migration

### Initial GDPR Schema Deployment

**1. Verify Database Connection:**
```bash
# Test database connectivity
npm run db:test-connection

# Expected output:
# ✅ Database connection successful
# ✅ GDPR tables accessible
# ✅ Audit logging functional
```

**2. Deploy GDPR Database Schema:**
```bash
# Apply all GDPR database migrations
npm run db:push

# Force push if needed (CAUTION: May cause data loss)
npm run db:push --force

# Verify schema deployment
npm run db:verify-schema
```

**3. Seed Initial GDPR Configuration:**
```bash
# Seed default GDPR policies and configurations
npm run seed:gdpr-base

# Seed default email templates for GDPR compliance
npm run seed:gdpr-templates

# Seed default retention policies
npm run seed:retention-policies

# Verify seeding success
npm run verify:gdpr-seed
```

**4. Create Database Indexes for Performance:**
```bash
# Create optimized indexes for GDPR queries
npm run db:create-gdpr-indexes

# Verify index creation
npm run db:verify-indexes
```

### Database Backup & Recovery

**Production Backup Configuration:**
```bash
#!/bin/bash
# backup-gdpr.sh - GDPR-Compliant Database Backup

# Backup main database
pg_dump $DATABASE_URL | gpg --symmetric --cipher-algo AES256 > backup_$(date +%Y%m%d_%H%M%S).sql.gpg

# Backup audit logs separately (regulatory compliance)
pg_dump $DATABASE_URL -t gdpr_audit_logs -t compliance_audit_logs | gpg --symmetric --cipher-algo AES256 > audit_backup_$(date +%Y%m%d_%H%M%S).sql.gpg

# Verify backup integrity
echo "Backup integrity check..."
gpg --decrypt backup_$(date +%Y%m%d_%H%M%S).sql.gpg | head -10
```

**Recovery Procedures:**
```bash
#!/bin/bash
# restore-gdpr.sh - GDPR-Compliant Database Restore

# Decrypt and restore main database
gpg --decrypt backup_20250915_120000.sql.gpg | psql $DATABASE_URL

# Restore audit logs
gpg --decrypt audit_backup_20250915_120000.sql.gpg | psql $DATABASE_URL

# Verify GDPR compliance after restore
npm run verify:gdpr-compliance
```

## Feature Flag Configuration

### Production Feature Flag Activation

**1. Gradual GDPR Rollout Strategy:**
```bash
# Phase 1: Enable for SuperAdmin testing
GDPR_COMPLIANCE_ENABLED=true
GDPR_SUPERADMIN_ONLY=true
GDPR_BETA_TESTING=true

# Phase 2: Enable for selected organizations
GDPR_COMPLIANCE_ENABLED=true
GDPR_PILOT_ORGANIZATIONS=org1-uuid,org2-uuid
GDPR_BETA_TESTING=true

# Phase 3: Full production rollout
GDPR_COMPLIANCE_ENABLED=true
GDPR_SUPERADMIN_ONLY=false
GDPR_BETA_TESTING=false
```

**2. Organization-Level Feature Control:**
```typescript
// Example organization-specific GDPR configuration
const orgGdprConfig = {
  organisationId: 'your-org-uuid',
  gdprEnabled: true,
  features: {
    consentManagement: true,
    cookieManagement: true,
    userRights: true,
    dataRetention: true,
    breachManagement: true,
    ageVerification: true,
    internationalTransfers: false, // Disable if UK-only
    ropaManagement: true
  },
  settings: {
    retentionPeriod: 2555, // 7 years
    consentExpiry: 365,    // 1 year
    childAgeThreshold: 13  // UK standard
  }
};
```

**3. Feature Flag Verification:**
```bash
# Verify GDPR features are properly enabled
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/config/gdpr

# Expected response:
# {
#   "enabled": true,
#   "features": {
#     "consentManagement": true,
#     "userRights": true,
#     ...
#   }
# }
```

## Third-Party Integration Setup

### Stripe GDPR Compliance Configuration

**1. Stripe Account Configuration:**
```bash
# Stripe API Configuration
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_GDPR_COMPLIANT=true

# Configure Stripe for UK GDPR
STRIPE_DEFAULT_COUNTRY=GB
STRIPE_DATA_RETENTION_DAYS=2555  # 7 years
STRIPE_PERSONAL_DATA_DELETION=true
```

**2. Stripe Webhook Configuration:**
```javascript
// Configure Stripe webhooks for GDPR compliance
const stripeWebhooks = [
  'customer.created',
  'customer.updated', 
  'customer.deleted',
  'payment_intent.succeeded',
  'invoice.payment_succeeded'
];

// GDPR-compliant Stripe integration
await stripe.webhookEndpoints.create({
  url: 'https://your-domain.com/api/stripe/webhook',
  enabled_events: stripeWebhooks,
  metadata: {
    gdpr_compliant: 'true',
    data_retention_days: '2555'
  }
});
```

### Email Provider GDPR Setup

**1. SendGrid Configuration:**
```bash
# SendGrid API Configuration
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDGRID_GDPR_COMPLIANT=true

# Configure SendGrid for UK GDPR
SENDGRID_IP_WARMUP=true
SENDGRID_UNSUBSCRIBE_GROUPS=true
SENDGRID_SUPPRESSION_MANAGEMENT=true
```

**2. Brevo (formerly Sendinblue) Configuration:**
```bash
# Brevo API Configuration
BREVO_API_KEY=your_brevo_api_key
BREVO_GDPR_COMPLIANT=true

# Configure Brevo for GDPR
BREVO_DOUBLE_OPTIN=true
BREVO_UNSUBSCRIBE_TRACKING=true
BREVO_CONTACT_DELETION=true
```

**3. SMTP Configuration for Privacy:**
```bash
# Secure SMTP Configuration
SMTP_HOST=mail.your-domain.co.uk
SMTP_PORT=587
SMTP_SECURE=true
SMTP_TLS_REJECT_UNAUTHORIZED=true
SMTP_TLS_MIN_VERSION=TLSv1.2

# Privacy-focused email settings
EMAIL_TRACKING_PIXELS=false
EMAIL_LINK_TRACKING=false
EMAIL_OPEN_TRACKING=false  # Disable for privacy
```

### Analytics GDPR Configuration

**1. Google Analytics GDPR Setup:**
```javascript
// Google Analytics 4 GDPR Configuration
gtag('consent', 'default', {
  'ad_storage': 'denied',
  'analytics_storage': 'denied',
  'functionality_storage': 'denied',
  'personalization_storage': 'denied',
  'security_storage': 'granted'
});

// IP Anonymization (Required for GDPR)
gtag('config', 'GA_MEASUREMENT_ID', {
  'anonymize_ip': true,
  'allow_google_signals': false,
  'allow_ad_personalization_signals': false
});
```

**2. Privacy-Focused Analytics Alternative:**
```bash
# Self-hosted analytics configuration
ANALYTICS_PROVIDER=matomo  # or plausible
MATOMO_URL=https://analytics.your-domain.co.uk
MATOMO_SITE_ID=1
MATOMO_RESPECT_DNT=true
MATOMO_COOKIE_CONSENT=true
```

## Security Configuration

### Data Encryption Setup

**1. Generate Encryption Keys:**
```bash
#!/bin/bash
# generate-gdpr-keys.sh - Generate GDPR Encryption Keys

# Generate 256-bit AES key for data encryption
openssl rand -base64 32 > data-encryption-key.txt

# Generate RSA key pair for audit log signing
openssl genrsa -out audit-signing-key.pem 2048
openssl rsa -in audit-signing-key.pem -pubout -out audit-verification-key.pem

# Generate session secret
openssl rand -hex 64 > session-secret.txt

echo "GDPR encryption keys generated successfully"
echo "Store these keys securely and never commit to version control"
```

**2. Key Management Configuration:**
```bash
# Key Storage (Use secure key management service in production)
DATA_ENCRYPTION_KEY=$(cat data-encryption-key.txt)
AUDIT_SIGNING_KEY=$(cat audit-signing-key.pem)
SESSION_SECRET=$(cat session-secret.txt)

# Key Rotation Schedule
ENCRYPTION_KEY_ROTATION_DAYS=90
AUDIT_KEY_ROTATION_DAYS=365
SESSION_SECRET_ROTATION_DAYS=30
```

### Access Control Configuration

**1. Role-Based Access Control:**
```bash
# GDPR Admin Roles Configuration
GDPR_ADMIN_ROLES=admin,superadmin
GDPR_DPO_ROLE=dpo
GDPR_AUDIT_ROLE=auditor

# Organization Isolation
GDPR_ORG_ISOLATION=strict
GDPR_CROSS_ORG_ACCESS=false
GDPR_SUPERADMIN_OVERRIDE=true
```

**2. API Rate Limiting for Privacy Endpoints:**
```bash
# Rate limiting for GDPR endpoints
GDPR_RATE_LIMIT_REQUESTS=100
GDPR_RATE_LIMIT_WINDOW=3600  # 1 hour
GDPR_RATE_LIMIT_SKIP_SUCCESSFUL=true

# User Rights Request Rate Limiting
USER_RIGHTS_RATE_LIMIT=5     # 5 requests per day per user
USER_RIGHTS_RATE_WINDOW=86400 # 24 hours
```

## Testing & Verification

### Pre-Deployment Testing

**1. Run Complete GDPR Test Suite:**
```bash
# Run all GDPR compliance tests
npm run test:gdpr

# Run with coverage reporting
npm run test:gdpr --coverage

# Run critical tests only
npm run test:gdpr --priority critical

# Expected output:
# ✅ All 10 GDPR test suites passed
# ✅ 95%+ test coverage achieved
# ✅ Critical compliance tests passed
```

**2. Integration Testing:**
```bash
# Test third-party integrations
npm run test:integration:stripe
npm run test:integration:email
npm run test:integration:analytics

# Test database performance under load
npm run test:performance:gdpr

# Test security configurations
npm run test:security:gdpr
```

**3. Manual Testing Checklist:**
```bash
# User Registration with Consent
- [ ] Cookie consent banner displays correctly
- [ ] Registration form includes privacy consent
- [ ] Consent is properly recorded with evidence
- [ ] User receives privacy notice email

# User Rights Workflows  
- [ ] DSAR request can be submitted
- [ ] Data export generates complete user data
- [ ] Account deletion works with 30-day grace period
- [ ] Data rectification workflow functions

# Admin Functions
- [ ] GDPR dashboard loads with correct metrics
- [ ] Breach management workflow functional
- [ ] User rights admin panel accessible
- [ ] Data retention policies configurable
```

### Production Smoke Tests

**1. GDPR Feature Verification:**
```bash
#!/bin/bash
# gdpr-smoke-test.sh - Quick Production Verification

echo "Testing GDPR compliance features..."

# Test GDPR configuration endpoint
curl -f http://localhost:5000/api/config/gdpr || exit 1

# Test user rights endpoint (requires auth)
curl -f -H "Authorization: Bearer $TEST_TOKEN" \
  http://localhost:5000/api/gdpr/user-rights || exit 1

# Test consent management
curl -f -H "Authorization: Bearer $TEST_TOKEN" \
  http://localhost:5000/api/gdpr/consent || exit 1

# Test cookie management
curl -f http://localhost:5000/api/gdpr/cookies || exit 1

echo "✅ GDPR smoke tests passed"
```

## Production Deployment

### Deployment Sequence

**1. Pre-Deployment Steps:**
```bash
# 1. Backup current production database
npm run backup:production

# 2. Run final tests on staging
npm run test:staging:complete

# 3. Verify all environment variables
npm run verify:env:production

# 4. Create deployment rollback plan
npm run create:rollback-plan
```

**2. Deployment Execution:**
```bash
#!/bin/bash
# deploy-gdpr.sh - Production GDPR Deployment

set -e  # Exit on any error

echo "Starting GDPR compliance deployment..."

# 1. Deploy application code
git pull origin main
npm ci --production

# 2. Apply database migrations
npm run db:migrate:production

# 3. Seed GDPR configuration
npm run seed:gdpr:production

# 4. Verify deployment
npm run verify:gdpr:production

# 5. Restart application services
pm2 restart all

# 6. Run post-deployment tests
npm run test:post-deployment

echo "✅ GDPR deployment completed successfully"
```

**3. Post-Deployment Verification:**
```bash
# Wait for application to stabilize
sleep 30

# Verify GDPR features are working
npm run verify:gdpr:functional

# Check system health
npm run health:check:gdpr

# Verify monitoring and alerting
npm run verify:monitoring:gdpr

# Send deployment notification
npm run notify:deployment:success
```

### Rollback Procedures

**1. Emergency Rollback:**
```bash
#!/bin/bash
# rollback-gdpr.sh - Emergency GDPR Rollback

echo "EMERGENCY: Rolling back GDPR deployment..."

# 1. Restore previous application version
git checkout $PREVIOUS_COMMIT
pm2 restart all

# 2. Restore database backup (if schema changed)
npm run restore:database:previous

# 3. Disable GDPR features temporarily
export GDPR_COMPLIANCE_ENABLED=false
pm2 restart all

# 4. Verify rollback success
npm run verify:rollback:success

echo "✅ GDPR rollback completed"
```

## Monitoring & Alerting

### Production Monitoring Setup

**1. GDPR Compliance Metrics:**
```javascript
// Key metrics to monitor
const gdprMetrics = {
  // User Rights SLA Compliance
  userRightsSLA: {
    threshold: 95,  // 95% within 30 days
    alert: 'email,slack'
  },
  
  // Breach Notification Timing
  breachNotificationSLA: {
    threshold: 72,  // Hours to ICO notification
    alert: 'immediate,phone,email'
  },
  
  // Data Retention Compliance
  retentionCompliance: {
    threshold: 99,  // 99% compliance rate
    alert: 'email'
  },
  
  // Consent Rates
  consentRate: {
    threshold: 85,  // 85% consent rate
    alert: 'weekly-report'
  }
};
```

**2. Automated Health Checks:**
```bash
#!/bin/bash
# gdpr-health-check.sh - Automated GDPR Health Monitoring

# Check GDPR feature availability
gdpr_status=$(curl -s http://localhost:5000/api/config/gdpr | jq -r '.enabled')
if [ "$gdpr_status" != "true" ]; then
  echo "ALERT: GDPR features are disabled" | mail -s "GDPR Alert" alerts@company.com
fi

# Check user rights request queue
pending_requests=$(curl -s -H "Authorization: Bearer $MONITOR_TOKEN" \
  http://localhost:5000/api/gdpr/user-rights/pending | jq '. | length')
if [ "$pending_requests" -gt 10 ]; then
  echo "ALERT: $pending_requests user rights requests pending" | mail -s "GDPR Queue Alert" alerts@company.com
fi

# Check data retention processing
retention_errors=$(curl -s -H "Authorization: Bearer $MONITOR_TOKEN" \
  http://localhost:5000/api/gdpr/retention/errors | jq '.count')
if [ "$retention_errors" -gt 0 ]; then
  echo "ALERT: $retention_errors data retention errors" | mail -s "GDPR Retention Alert" alerts@company.com
fi
```

**3. Log Monitoring Configuration:**
```bash
# Logwatch configuration for GDPR events
# /etc/logwatch/conf/services/gdpr.conf

LogFile = /var/log/intelms/gdpr.log
Title = "GDPR Compliance Events"

# Monitor for critical GDPR events
*gdpr_breach_detected*
*user_rights_overdue*
*retention_processing_failed*
*consent_collection_failed*
*audit_integrity_violation*
```

### Alerting Configuration

**1. Critical Alerts (Immediate Response):**
```yaml
# alerting-gdpr.yaml - GDPR Alert Configuration

critical_alerts:
  - name: "Data Breach Detected"
    condition: "gdpr_breach_detected = true"
    notify: ["email", "sms", "slack"]
    escalation: "immediate"
    
  - name: "Audit Log Integrity Violation"  
    condition: "audit_integrity_check = failed"
    notify: ["email", "sms", "phone"]
    escalation: "immediate"
    
  - name: "User Rights SLA Violation"
    condition: "user_rights_overdue > 0"
    notify: ["email", "slack"]
    escalation: "daily"

warning_alerts:
  - name: "Low Consent Rate"
    condition: "consent_rate < 85"
    notify: ["email"]
    escalation: "weekly"
    
  - name: "Data Retention Processing Delays"
    condition: "retention_processing_delayed > 24h"
    notify: ["email"]
    escalation: "daily"
```

**2. Compliance Dashboard Monitoring:**
```bash
# Dashboard health check
curl -f http://localhost:5000/admin/gdpr-dashboard/health
```

## Operational Procedures

### Daily Operations

**1. Morning GDPR Compliance Check:**
```bash
#!/bin/bash
# morning-gdpr-check.sh - Daily GDPR Compliance Review

echo "=== Daily GDPR Compliance Check ==="
date

# 1. Check overnight retention processing
echo "Data Retention Processing:"
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/gdpr/retention/summary/24h | jq .

# 2. Review pending user rights requests
echo "User Rights Requests:"
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/gdpr/user-rights/pending | jq '. | length'

# 3. Check for any breach incidents
echo "Breach Incidents (24h):"
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/gdpr/breaches?last=24h | jq '. | length'

# 4. Verify system health
echo "System Health:"
curl -s http://localhost:5000/health/gdpr | jq .
```

**2. User Rights Request Processing:**
```bash
# Process daily user rights requests
npm run gdpr:process-user-rights

# Generate daily compliance report
npm run gdpr:daily-report

# Update consent management metrics
npm run gdpr:update-metrics
```

### Weekly Operations

**1. Weekly Compliance Review:**
```bash
#!/bin/bash
# weekly-gdpr-review.sh - Weekly GDPR Compliance Assessment

echo "=== Weekly GDPR Compliance Review ==="

# 1. Generate weekly compliance report
npm run gdpr:weekly-report

# 2. Review consent trends
npm run gdpr:consent-analysis:weekly

# 3. Check data retention compliance
npm run gdpr:retention-compliance:weekly

# 4. Review user rights fulfillment metrics
npm run gdpr:user-rights-metrics:weekly

# 5. Validate audit log integrity
npm run gdpr:audit-integrity:verify

# 6. Generate management dashboard
npm run gdpr:management-dashboard
```

**2. System Maintenance:**
```bash
# Update privacy policy version if needed
# npm run gdpr:update-policy-version 2.1

# Rotate encryption keys (quarterly)
# npm run gdpr:rotate-encryption-keys

# Update GDPR configuration
# npm run gdpr:update-config
```

### Monthly Operations

**1. Comprehensive Compliance Audit:**
```bash
#!/bin/bash
# monthly-gdpr-audit.sh - Monthly GDPR Comprehensive Review

echo "=== Monthly GDPR Compliance Audit ==="

# 1. Full compliance assessment
npm run gdpr:compliance-assessment:full

# 2. Privacy policy review
npm run gdpr:policy-review:monthly

# 3. Vendor compliance review
npm run gdpr:vendor-compliance:review

# 4. Staff training assessment
npm run gdpr:training-assessment

# 5. Risk assessment update
npm run gdpr:risk-assessment:update

# 6. Generate monthly compliance report
npm run gdpr:monthly-report

# Email report to management and DPO
npm run gdpr:email-monthly-report
```

**2. System Optimization:**
```bash
# Optimize GDPR database performance
npm run gdpr:optimize-database

# Archive old audit logs
npm run gdpr:archive-audit-logs

# Update retention policies
npm run gdpr:update-retention-policies

# Performance testing
npm run gdpr:performance-test:monthly
```

## Maintenance & Updates

### Regular Maintenance Schedule

**1. Daily Automated Tasks:**
- Data retention scanning and processing
- User rights request SLA monitoring  
- Breach incident monitoring
- Audit log integrity verification
- Consent metrics updates
- System health checks

**2. Weekly Manual Tasks:**
- Review user rights request queue
- Validate consent collection rates
- Check third-party service compliance
- Update privacy policy if needed
- Review system performance metrics

**3. Monthly Manual Tasks:**
- Comprehensive compliance audit
- Staff training assessment
- Vendor compliance review  
- Risk assessment updates
- Privacy policy comprehensive review
- Performance optimization

**4. Quarterly Tasks:**
- Encryption key rotation
- Full security assessment
- Legal compliance review
- External audit preparation
- Disaster recovery testing
- Business continuity validation

### Update Procedures

**1. GDPR Feature Updates:**
```bash
# Test GDPR updates in staging
npm run test:staging:gdpr

# Deploy GDPR feature updates
npm run deploy:gdpr:update

# Verify update success
npm run verify:gdpr:update

# Update documentation
npm run docs:gdpr:update
```

**2. Regulatory Compliance Updates:**
```bash
# Update for new ICO guidance
npm run gdpr:update-ico-guidance

# Update privacy policy for new regulations
npm run gdpr:update-privacy-policy

# Update retention policies
npm run gdpr:update-retention-policies

# Notify users of policy changes
npm run gdpr:notify-policy-changes
```

### Database Maintenance

**1. Audit Log Management:**
```bash
#!/bin/bash
# audit-log-maintenance.sh - GDPR Audit Log Maintenance

# Archive old audit logs (keep 10 years online, archive rest)
npm run gdpr:archive-audit-logs --older-than=10years

# Verify audit log integrity
npm run gdpr:verify-audit-integrity

# Optimize audit log queries
npm run gdpr:optimize-audit-indexes

# Generate audit log statistics
npm run gdpr:audit-statistics
```

**2. Data Retention Maintenance:**
```bash
#!/bin/bash
# retention-maintenance.sh - Data Retention Maintenance

# Run comprehensive retention scan
npm run gdpr:retention-scan:comprehensive

# Process secure deletion queue
npm run gdpr:process-secure-deletion

# Generate retention compliance report
npm run gdpr:retention-compliance-report

# Update retention policy effectiveness
npm run gdpr:update-retention-effectiveness
```

## Troubleshooting Guide

### Common Issues & Solutions

**1. GDPR Features Not Loading:**
```bash
# Check GDPR feature flag
echo $GDPR_COMPLIANCE_ENABLED
# Should output: true

# Verify database schema
npm run db:verify-gdpr-schema

# Check application logs
tail -f /var/log/intelms/application.log | grep -i gdpr

# Solution: Ensure GDPR_COMPLIANCE_ENABLED=true and restart application
```

**2. User Rights Requests Not Processing:**
```bash
# Check user rights request queue
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/gdpr/user-rights/queue

# Check for processing errors
npm run gdpr:check-user-rights-errors

# Solution: Check admin permissions and SLA monitoring
```

**3. Data Retention Not Running:**
```bash
# Check retention service status
npm run gdpr:check-retention-service

# View retention processing logs
tail -f /var/log/intelms/retention.log

# Solution: Verify retention policies and database connectivity
```

**4. Consent Management Issues:**
```bash
# Check consent collection rates
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/gdpr/consent/metrics

# Verify cookie consent banner
curl http://localhost:5000/api/gdpr/cookies

# Solution: Check privacy policy version and consent configuration
```

### Performance Issues

**1. GDPR Dashboard Loading Slowly:**
```bash
# Check database query performance
npm run gdpr:analyze-dashboard-performance

# Optimize GDPR database indexes
npm run db:optimize-gdpr-indexes

# Review compliance metrics caching
npm run gdpr:check-metrics-cache
```

**2. Large Data Export Timeouts:**
```bash
# Check data export processing
npm run gdpr:check-export-performance

# Increase timeout for large exports
export USER_RIGHTS_EXPORT_TIMEOUT=300000

# Use background processing for large exports
npm run gdpr:enable-background-exports
```

### Security Issues

**1. Audit Log Integrity Failures:**
```bash
# CRITICAL: Immediately investigate audit log integrity failure
npm run gdpr:investigate-audit-integrity

# Verify cryptographic signatures
npm run gdpr:verify-audit-signatures

# Generate incident report
npm run gdpr:generate-incident-report

# Solution: Check audit signing key and investigate potential tampering
```

**2. Breach Detection Alerts:**
```bash
# IMMEDIATE ACTION REQUIRED
# 1. Contain the potential breach
npm run security:breach-containment

# 2. Assess the scope and severity
npm run gdpr:breach-assessment

# 3. Notify ICO within 72 hours
npm run gdpr:notify-ico-breach

# 4. Document all actions
npm run gdpr:document-breach-response
```

### Emergency Procedures

**1. GDPR System Failure:**
```bash
#!/bin/bash
# gdpr-emergency-response.sh - Emergency GDPR System Response

echo "GDPR EMERGENCY RESPONSE ACTIVATED"

# 1. Assess system status
npm run gdpr:emergency-status-check

# 2. Enable emergency mode (minimal GDPR features)
export GDPR_EMERGENCY_MODE=true
pm2 restart all

# 3. Notify stakeholders
npm run gdpr:notify-emergency

# 4. Document incident
npm run gdpr:document-emergency

echo "Emergency response completed - manual intervention required"
```

**2. Data Breach Response:**
```bash
#!/bin/bash
# breach-emergency-response.sh - Data Breach Emergency Response

echo "DATA BREACH EMERGENCY RESPONSE"

# 1. Immediate containment
npm run security:immediate-containment

# 2. Evidence preservation  
npm run security:preserve-evidence

# 3. Impact assessment
npm run gdpr:breach-impact-assessment

# 4. Regulatory notification (within 72 hours)
npm run gdpr:notify-authorities

# 5. Data subject notification (if high risk)
npm run gdpr:notify-data-subjects

echo "Breach response initiated - continue with incident response plan"
```

---

## Support & Escalation

### Contact Information

**Technical Support:**
- **Email**: gdpr-technical@company.com
- **Emergency Phone**: +44 (0) 20 XXXX XXXX
- **Response Time**: 4 hours for GDPR-related issues

**Data Protection Officer:**
- **Email**: dpo@company.com  
- **Phone**: +44 (0) 20 XXXX XXXX
- **Response Time**: Same day for compliance issues

**Legal Support:**
- **Email**: legal-privacy@company.com
- **Emergency Contact**: +44 (0) 20 XXXX XXXX
- **Available**: 24/7 for breach response

### Escalation Matrix

| Issue Severity | Response Time | Escalation Path |
|---------------|---------------|-----------------|
| **Critical** (Data Breach, Audit Failure) | Immediate | DPO → Legal → CEO |
| **High** (SLA Violation, User Rights) | 4 hours | Technical Lead → DPO |
| **Medium** (Performance, Configuration) | 24 hours | Technical Support |
| **Low** (Enhancement, Training) | 72 hours | Technical Support |

---

*This deployment and operations guide ensures complete UK GDPR compliance readiness for production environments. For additional support or clarification, contact the Data Protection Officer or technical support team.*