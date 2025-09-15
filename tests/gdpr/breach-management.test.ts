/**
 * GDPR Breach Management Tests
 * 
 * Comprehensive test suite for data breach detection, assessment, ICO notification,
 * data subject notification, and 72-hour deadline compliance.
 */

import { test, describe, beforeEach, afterEach, assert } from '../setup/test-setup.ts';
import { 
  testAuth, 
  testDb, 
  testDataGenerator, 
  globalTestSetup, 
  globalTestTeardown 
} from '../setup/test-setup.ts';
import { 
  GdprApiHelper, 
  GdprComplianceValidator,
  GdprTestScenarios 
} from '../setup/gdpr-test-helpers.ts';

describe('GDPR Breach Management and ICO Notification', () => {
  let testUsers: any = {};
  let testOrg: any;

  beforeEach(async () => {
    await globalTestSetup();
    
    // Create test organization
    const orgResult = await testDb.createTestOrganization('Breach Management Test Org');
    testOrg = orgResult.response.body;
    
    // Create test users
    const adminResult = await testAuth.createTestUser('admin', testOrg.id);
    const superAdminResult = await testAuth.createTestUser('superadmin');
    const dpoResult = await testAuth.createTestUser('admin', testOrg.id); // DPO role
    
    testUsers.admin = adminResult.userData;
    testUsers.superAdmin = superAdminResult.userData;
    testUsers.dpo = dpoResult.userData;
    
    // Authenticate users
    await testAuth.authenticate(testUsers.admin.email, testUsers.admin.password);
    await testAuth.authenticate(testUsers.superAdmin.email, testUsers.superAdmin.password);
    await testAuth.authenticate(testUsers.dpo.email, testUsers.dpo.password);
  });

  afterEach(async () => {
    await globalTestTeardown();
  });

  describe('Breach Detection and Reporting', () => {
    
    test('should create data breach incident reports', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      const breachData = testDataGenerator.generateDataBreach({
        title: 'Unauthorized Access to User Database',
        description: 'Suspicious login attempts detected from unknown IP addresses',
        severity: 'high',
        affectedDataTypes: ['identity', 'contact', 'authentication'],
        affectedIndividuals: 150,
        containmentMeasures: 'Disabled affected accounts, reset passwords, updated firewall rules',
        discoveredAt: new Date().toISOString(),
        reportedBy: testUsers.admin.id,
      });

      const response = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      
      assert.strictEqual(response.statusCode, 201, 'Should create breach report');
      assert.ok(response.body.id, 'Should return breach ID');
      assert.strictEqual(response.body.severity, 'high', 'Should store severity');
      assert.strictEqual(response.body.status, 'detected', 'Should start in detected status');
      
      // Validate compliance
      const validation = GdprComplianceValidator.validateDataBreach(response.body);
      assert.ok(validation.valid, `Breach report should be compliant: ${validation.errors.join(', ')}`);
    });

    test('should categorize breach severity correctly', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      const severityLevels = [
        { 
          severity: 'low', 
          description: 'Minor data exposure with minimal risk',
          expectedNotification: false 
        },
        { 
          severity: 'medium', 
          description: 'Moderate data exposure requiring assessment',
          expectedNotification: true 
        },
        { 
          severity: 'high', 
          description: 'Significant data exposure with high risk',
          expectedNotification: true 
        },
        { 
          severity: 'critical', 
          description: 'Severe data exposure requiring immediate action',
          expectedNotification: true 
        },
      ];
      
      for (const { severity, description, expectedNotification } of severityLevels) {
        const breachData = testDataGenerator.generateDataBreach({
          title: `${severity.toUpperCase()} Severity Breach Test`,
          description,
          severity,
          affectedIndividuals: severity === 'critical' ? 1000 : 50,
        });
        
        const response = await GdprApiHelper.reportBreach(adminHeaders, breachData);
        assert.strictEqual(response.body.severity, severity, `Should store ${severity} severity`);
        
        // Check ICO notification requirement
        assert.strictEqual(response.body.icoNotificationRequired, expectedNotification,
                          `${severity} breach should ${expectedNotification ? 'require' : 'not require'} ICO notification`);
      }
    });

    test('should calculate 72-hour ICO notification deadline', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      const breachData = testDataGenerator.generateDataBreach({
        severity: 'high',
        discoveredAt: new Date().toISOString(),
      });

      const response = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      const breach = response.body;
      
      // Check 72-hour deadline calculation
      const discoveryTime = new Date(breach.discoveredAt);
      const expectedDeadline = new Date(discoveryTime);
      expectedDeadline.setHours(expectedDeadline.getHours() + 72);
      
      const actualDeadline = new Date(breach.icoNotificationDeadline);
      const timeDiff = Math.abs(actualDeadline.getTime() - expectedDeadline.getTime());
      
      assert.ok(timeDiff < 60000, '72-hour deadline should be calculated accurately'); // Within 1 minute
      assert.ok(new Date() < actualDeadline, 'Deadline should be in the future for new breaches');
    });

    test('should track affected data subjects', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      const breachData = testDataGenerator.generateDataBreach({
        affectedDataTypes: ['identity', 'contact', 'financial'],
        affectedIndividuals: 75,
        affectedUserIds: ['user1', 'user2', 'user3'], // Sample user IDs
        riskAssessment: {
          likelihood: 'high',
          impact: 'significant',
          riskLevel: 'high',
        },
      });

      const response = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      
      assert.strictEqual(response.body.affectedIndividuals, 75, 'Should track number of affected individuals');
      assert.deepStrictEqual(response.body.affectedDataTypes, ['identity', 'contact', 'financial'],
                           'Should track affected data types');
      assert.ok(response.body.riskAssessment, 'Should include risk assessment');
    });
  });

  describe('Breach Assessment and Investigation', () => {
    
    test('should perform breach risk assessment', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create breach first
      const breachData = testDataGenerator.generateDataBreach({ severity: 'medium' });
      const createResponse = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      const breachId = createResponse.body.id;
      
      // Update with assessment
      const assessmentData = {
        status: 'assessed',
        riskAssessment: {
          likelihood: 'medium',
          impact: 'significant',
          riskLevel: 'medium',
          reasoning: 'Limited data exposure but includes sensitive personal information',
        },
        containmentMeasures: 'System access disabled, logs analyzed, affected users identified',
        investigationFindings: 'Unauthorized access through compromised admin account',
      };
      
      const assessResponse = await GdprApiHelper.updateBreachStatus(adminHeaders, breachId, 'assessed');
      assert.strictEqual(assessResponse.statusCode, 200, 'Should update breach to assessed status');
    });

    test('should track containment measures', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const breachData = testDataGenerator.generateDataBreach({
        containmentMeasures: 'Immediate system isolation and password reset',
        investigationStatus: 'ongoing',
      });
      
      const response = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      const breachId = response.body.id;
      
      // Add additional containment measures
      const updateResponse = await GdprApiHelper.updateBreachStatus(adminHeaders, breachId, 'contained');
      assert.strictEqual(updateResponse.statusCode, 200, 'Should update containment status');
    });

    test('should determine ICO notification requirements', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Test scenarios that require ICO notification
      const scenariosRequiringNotification = [
        {
          severity: 'high',
          riskLevel: 'high',
          affectedIndividuals: 100,
          description: 'High risk scenario'
        },
        {
          severity: 'medium',
          riskLevel: 'significant',
          affectedDataTypes: ['financial', 'health'],
          description: 'Special category data breach'
        },
        {
          severity: 'critical',
          riskLevel: 'very_high',
          affectedIndividuals: 1000,
          description: 'Large scale breach'
        }
      ];
      
      for (const scenario of scenariosRequiringNotification) {
        const breachData = testDataGenerator.generateDataBreach(scenario);
        const response = await GdprApiHelper.reportBreach(adminHeaders, breachData);
        
        assert.ok(response.body.icoNotificationRequired, 
                 `Scenario "${scenario.description}" should require ICO notification`);
      }
    });

    test('should determine data subject notification requirements', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // High risk breach requiring data subject notification
      const highRiskBreach = testDataGenerator.generateDataBreach({
        severity: 'high',
        riskLevel: 'high',
        affectedIndividuals: 200,
        riskAssessment: {
          likelihood: 'high',
          impact: 'severe',
          riskLevel: 'high',
        },
      });
      
      const response = await GdprApiHelper.reportBreach(adminHeaders, highRiskBreach);
      
      assert.ok(response.body.dataSubjectNotificationRequired, 
               'High risk breach should require data subject notification');
      assert.ok(response.body.dataSubjectNotificationDeadline, 
               'Should calculate data subject notification deadline');
    });
  });

  describe('ICO Notification Workflow', () => {
    
    test('should prepare ICO notification documents', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create breach requiring ICO notification
      const breachData = testDataGenerator.generateDataBreach({
        severity: 'high',
        icoNotificationRequired: true,
      });
      
      const createResponse = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      const breachId = createResponse.body.id;
      
      // Generate ICO notification documents
      const notificationResponse = await makeRequest({
        path: `/api/gdpr/data-breaches/${breachId}/ico-notification`,
        method: 'POST',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(notificationResponse.statusCode, 200, 'Should generate ICO notification');
      assert.ok(notificationResponse.body.notificationReference, 'Should provide notification reference');
      assert.ok(notificationResponse.body.submissionDeadline, 'Should include submission deadline');
      assert.ok(notificationResponse.body.requiredFields, 'Should list required notification fields');
    });

    test('should track ICO notification submission', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create and assess breach
      const breachData = testDataGenerator.generateDataBreach({ severity: 'high' });
      const createResponse = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      const breachId = createResponse.body.id;
      
      // Mark as ICO notified
      const notifyResponse = await GdprApiHelper.updateBreachStatus(adminHeaders, breachId, 'notified_ico');
      assert.strictEqual(notifyResponse.statusCode, 200, 'Should update to ICO notified status');
      
      // Verify notification tracking
      const getResponse = await GdprApiHelper.getBreaches(adminHeaders);
      const updatedBreach = getResponse.body.find((b: any) => b.id === breachId);
      
      assert.strictEqual(updatedBreach.status, 'notified_ico', 'Should update status to notified_ico');
      assert.ok(updatedBreach.icoNotifiedAt, 'Should record ICO notification timestamp');
    });

    test('should validate 72-hour deadline compliance', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create breach with backdated discovery time (for testing)
      const breachData = testDataGenerator.generateDataBreach({
        severity: 'high',
        discoveredAt: new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString(), // 73 hours ago
      });
      
      const response = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      const validation = GdprComplianceValidator.validateDataBreach(response.body);
      
      // Should flag as overdue
      const hasOverdueError = validation.errors.some(error => 
        error.includes('ICO notification deadline') && error.includes('violated'));
      
      if (response.body.icoNotificationRequired && !response.body.icoNotifiedAt) {
        assert.ok(hasOverdueError, 'Should flag overdue ICO notifications');
      }
    });

    test('should handle ICO response and follow-up', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create breach and notify ICO
      const breachData = testDataGenerator.generateDataBreach({ severity: 'high' });
      const createResponse = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      const breachId = createResponse.body.id;
      
      await GdprApiHelper.updateBreachStatus(adminHeaders, breachId, 'notified_ico');
      
      // Record ICO response
      const icoResponseData = {
        responseReceived: true,
        responseDate: new Date().toISOString(),
        icoReference: 'ICO-BR-2024-001',
        actionRequired: true,
        icoComments: 'Provide additional information about containment measures',
        followUpDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
      };
      
      const responseUpdateResult = await makeRequest({
        path: `/api/gdpr/data-breaches/${breachId}/ico-response`,
        method: 'POST',
        headers: adminHeaders,
        body: icoResponseData,
        expectedStatus: [200],
      });
      
      assert.strictEqual(responseUpdateResult.statusCode, 200, 'Should record ICO response');
      assert.ok(responseUpdateResult.body.icoReference, 'Should store ICO reference number');
    });
  });

  describe('Data Subject Notification', () => {
    
    test('should identify affected data subjects for notification', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create high-risk breach requiring data subject notification
      const breachData = testDataGenerator.generateDataBreach({
        severity: 'high',
        riskLevel: 'high',
        dataSubjectNotificationRequired: true,
        affectedUserIds: ['user1', 'user2', 'user3'],
      });
      
      const response = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      const breachId = response.body.id;
      
      // Get affected data subjects
      const subjectsResponse = await makeRequest({
        path: `/api/gdpr/data-breaches/${breachId}/affected-subjects`,
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(subjectsResponse.statusCode, 200, 'Should retrieve affected subjects');
      assert.ok(Array.isArray(subjectsResponse.body), 'Should return array of affected subjects');
      
      for (const subject of subjectsResponse.body) {
        assert.ok(subject.userId, 'Should have user ID');
        assert.ok(subject.contactMethod, 'Should specify contact method');
        assert.ok(subject.riskLevel, 'Should assess individual risk level');
      }
    });

    test('should prepare data subject notification communications', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const breachData = testDataGenerator.generateDataBreach({
        dataSubjectNotificationRequired: true,
        affectedIndividuals: 50,
      });
      
      const createResponse = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      const breachId = createResponse.body.id;
      
      // Generate notification communications
      const commResponse = await makeRequest({
        path: `/api/gdpr/data-breaches/${breachId}/subject-notifications`,
        method: 'POST',
        headers: adminHeaders,
        body: {
          notificationMethod: 'email',
          urgency: 'high',
          includeRemedialSteps: true,
        },
        expectedStatus: [200],
      });
      
      assert.strictEqual(commResponse.statusCode, 200, 'Should generate subject notifications');
      assert.ok(commResponse.body.emailTemplate, 'Should provide email template');
      assert.ok(commResponse.body.recipientCount, 'Should specify recipient count');
      assert.ok(commResponse.body.remedialSteps, 'Should include remedial steps');
    });

    test('should track notification delivery and responses', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const breachData = testDataGenerator.generateDataBreach({
        dataSubjectNotificationRequired: true,
      });
      
      const createResponse = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      const breachId = createResponse.body.id;
      
      // Record notification delivery
      const deliveryData = {
        notificationsSent: 45,
        notificationsDelivered: 43,
        notificationsFailed: 2,
        deliveryMethod: 'email',
        sentAt: new Date().toISOString(),
      };
      
      const deliveryResponse = await makeRequest({
        path: `/api/gdpr/data-breaches/${breachId}/notification-delivery`,
        method: 'POST',
        headers: adminHeaders,
        body: deliveryData,
        expectedStatus: [200],
      });
      
      assert.strictEqual(deliveryResponse.statusCode, 200, 'Should track notification delivery');
      assert.strictEqual(deliveryResponse.body.notificationsSent, 45, 'Should track sent count');
      assert.strictEqual(deliveryResponse.body.notificationsDelivered, 43, 'Should track delivered count');
    });
  });

  describe('Breach Workflow Integration', () => {
    
    test('should execute complete breach management workflow', async () => {
      const result = await GdprTestScenarios.testBreachWorkflow(testUsers.admin.email);
      
      assert.ok(result.success, `Breach workflow should complete: ${JSON.stringify(result.details)}`);
      assert.strictEqual(result.details.steps.length, 3, 'Should complete all workflow steps');
      
      const stepNames = result.details.steps.map((step: any) => step.step);
      assert.ok(stepNames.includes('report_breach'), 'Should report breach');
      assert.ok(stepNames.includes('assess_breach'), 'Should assess breach');
      assert.ok(stepNames.includes('notify_ico'), 'Should notify ICO');
    });

    test('should handle breach escalation procedures', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create critical breach
      const criticalBreach = testDataGenerator.generateDataBreach({
        severity: 'critical',
        affectedIndividuals: 5000,
        riskLevel: 'very_high',
      });
      
      const response = await GdprApiHelper.reportBreach(adminHeaders, criticalBreach);
      const breachId = response.body.id;
      
      // Should automatically escalate critical breaches
      assert.ok(response.body.escalated, 'Critical breaches should be escalated');
      assert.ok(response.body.escalationLevel, 'Should specify escalation level');
      
      // Check escalation notifications
      const escalationResponse = await makeRequest({
        path: `/api/gdpr/data-breaches/${breachId}/escalation`,
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.ok(escalationResponse.body.stakeholdersNotified, 'Should notify relevant stakeholders');
    });

    test('should coordinate breach response team', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const breachData = testDataGenerator.generateDataBreach({
        severity: 'high',
        responseTeam: {
          dpo: testUsers.dpo.id,
          technicalLead: testUsers.admin.id,
          legalCounsel: 'external-counsel-id',
          communications: 'comms-team-id',
        },
      });
      
      const response = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      
      assert.ok(response.body.responseTeam, 'Should assign response team');
      assert.ok(response.body.responseTeam.dpo, 'Should include DPO in response team');
      assert.ok(response.body.coordinationChannels, 'Should set up coordination channels');
    });
  });

  describe('Compliance and Audit', () => {
    
    test('should maintain comprehensive breach audit trail', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create and process breach
      const breachData = testDataGenerator.generateDataBreach({ severity: 'medium' });
      const createResponse = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      const breachId = createResponse.body.id;
      
      await GdprApiHelper.updateBreachStatus(adminHeaders, breachId, 'assessed');
      await GdprApiHelper.updateBreachStatus(adminHeaders, breachId, 'notified_ico');
      
      // Check comprehensive audit trail
      const auditResponse = await GdprApiHelper.getAuditLogs(adminHeaders, {
        resource: 'data_breach',
        resourceId: breachId,
      });
      
      assert.ok(auditResponse.body.length >= 3, 'Should have audit records for all status changes');
      
      const actions = auditResponse.body.map((log: any) => log.action);
      assert.ok(actions.includes('breach_detected'), 'Should audit breach detection');
      assert.ok(actions.includes('breach_assessed'), 'Should audit breach assessment');
      assert.ok(actions.includes('breach_reported_ico'), 'Should audit ICO notification');
    });

    test('should generate breach compliance reports', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const reportResponse = await makeRequest({
        path: '/api/gdpr/reports/breach-compliance',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(reportResponse.statusCode, 200, 'Should generate breach compliance report');
      
      const report = reportResponse.body;
      assert.ok(typeof report.totalBreaches === 'number', 'Should include total breaches count');
      assert.ok(typeof report.icoNotificationCompliance === 'number', 'Should include ICO compliance rate');
      assert.ok(typeof report.averageResponseTime === 'number', 'Should include average response time');
      assert.ok(Array.isArray(report.breachesByCategory), 'Should categorize breaches');
      assert.ok(Array.isArray(report.complianceViolations), 'Should identify violations');
    });

    test('should validate regulatory timeline compliance', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Check timeline compliance for all breaches
      const complianceResponse = await makeRequest({
        path: '/api/gdpr/breach-compliance/timeline-analysis',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(complianceResponse.statusCode, 200, 'Should analyze timeline compliance');
      
      const analysis = complianceResponse.body;
      assert.ok(typeof analysis.icoNotificationCompliance === 'number', 
               'Should calculate ICO notification compliance percentage');
      assert.ok(typeof analysis.subjectNotificationCompliance === 'number', 
               'Should calculate subject notification compliance percentage');
      assert.ok(Array.isArray(analysis.violations), 'Should identify timeline violations');
    });
  });

  describe('Integration and Automation', () => {
    
    test('should integrate with monitoring systems', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Simulate automated breach detection
      const automatedDetection = {
        source: 'security_monitoring',
        alertId: 'SEC-2024-001',
        detectionMethod: 'anomaly_detection',
        confidence: 0.95,
        affectedSystems: ['user_database', 'authentication_service'],
        initialAssessment: {
          severity: 'medium',
          riskLevel: 'medium',
          automatedContainment: true,
        },
      };
      
      const response = await makeRequest({
        path: '/api/gdpr/data-breaches/automated-detection',
        method: 'POST',
        headers: adminHeaders,
        body: automatedDetection,
        expectedStatus: [201],
      });
      
      assert.strictEqual(response.statusCode, 201, 'Should handle automated breach detection');
      assert.ok(response.body.breachId, 'Should create breach record from automated detection');
      assert.strictEqual(response.body.source, 'security_monitoring', 'Should record detection source');
    });

    test('should automate notification workflows', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create high-severity breach
      const breachData = testDataGenerator.generateDataBreach({
        severity: 'high',
        automatedResponse: true,
      });
      
      const response = await GdprApiHelper.reportBreach(adminHeaders, breachData);
      const breachId = response.body.id;
      
      // Check if automated workflows triggered
      const workflowResponse = await makeRequest({
        path: `/api/gdpr/data-breaches/${breachId}/automated-workflows`,
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(workflowResponse.statusCode, 200, 'Should check automated workflows');
      assert.ok(Array.isArray(workflowResponse.body.triggeredWorkflows), 
               'Should list triggered workflows');
      
      // Verify automated actions
      const workflows = workflowResponse.body.triggeredWorkflows;
      const hasNotificationWorkflow = workflows.some((w: any) => w.type === 'stakeholder_notification');
      const hasAssessmentWorkflow = workflows.some((w: any) => w.type === 'risk_assessment');
      
      assert.ok(hasNotificationWorkflow, 'Should trigger stakeholder notification workflow');
      assert.ok(hasAssessmentWorkflow, 'Should trigger risk assessment workflow');
    });
  });
});