#!/usr/bin/env tsx

/**
 * GDPR Test Suite Runner
 * 
 * Comprehensive test runner for all GDPR compliance tests with reporting,
 * compliance verification, and CI integration support.
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Test suite configuration
const TEST_SUITES = [
  {
    name: 'Consent Management',
    file: 'gdpr/consent-management.test.ts',
    category: 'core',
    priority: 'high',
    description: 'Tests consent collection, modification, withdrawal, and PECR compliance'
  },
  {
    name: 'User Rights',
    file: 'gdpr/user-rights.test.ts',
    category: 'core',
    priority: 'high',
    description: 'Tests DSAR, rectification, erasure, restriction, portability with SLA validation'
  },
  {
    name: 'Cookie Consent',
    file: 'gdpr/cookie-consent.test.ts',
    category: 'compliance',
    priority: 'high',
    description: 'Tests cookie consent and PECR compliance with granular preferences'
  },
  {
    name: 'Data Retention',
    file: 'gdpr/data-retention.test.ts',
    category: 'lifecycle',
    priority: 'high',
    description: 'Tests data retention policies, automated deletion, and secure erase'
  },
  {
    name: 'Breach Management',
    file: 'gdpr/breach-management.test.ts',
    category: 'incident',
    priority: 'critical',
    description: 'Tests breach detection, ICO notification, and 72-hour deadline compliance'
  },
  {
    name: 'Age Verification',
    file: 'gdpr/age-verification.test.ts',
    category: 'protection',
    priority: 'medium',
    description: 'Tests age verification and parental consent for UK Article 8 compliance'
  },
  {
    name: 'Audit Integrity',
    file: 'gdpr/audit-integrity.test.ts',
    category: 'security',
    priority: 'critical',
    description: 'Tests audit system integrity and tamper-proof chain validation'
  },
  {
    name: 'Integration Compliance',
    file: 'gdpr/integration-compliance.test.ts',
    category: 'compliance',
    priority: 'high',
    description: 'Tests third-party service compliance, data sharing agreements, and vendor accountability'
  },
  {
    name: 'API Endpoints',
    file: 'gdpr/api-endpoints.test.ts',
    category: 'core',
    priority: 'high',
    description: 'Tests GDPR API endpoints, RBAC validation, feature flags, and multi-tenant isolation'
  },
  {
    name: 'Frontend Components',
    file: 'gdpr/frontend-components.test.ts',
    category: 'compliance',
    priority: 'medium',
    description: 'Tests GDPR UI components, accessibility compliance, and user experience workflows'
  }
];

// Test execution options
interface TestOptions {
  verbose?: boolean;
  coverage?: boolean;
  parallel?: boolean;
  category?: string;
  priority?: string;
  generateReport?: boolean;
  outputFormat?: 'console' | 'json' | 'html';
  timeout?: number;
  checkCompliance?: boolean;
  complianceThreshold?: number;
}

// Test result interface
interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: number;
  errors: string[];
  status: 'pass' | 'fail' | 'error';
}

// Test runner class
class GdprTestRunner {
  private results: TestResult[] = [];
  private startTime: number = Date.now();
  
  constructor(private options: TestOptions = {}) {}

  async runAllTests(): Promise<void> {
    console.log('🧪 GDPR Compliance Test Suite');
    console.log('============================');
    console.log(`Starting comprehensive GDPR testing at ${new Date().toISOString()}`);
    console.log(`GDPR_COMPLIANCE_ENABLED: ${process.env.GDPR_COMPLIANCE_ENABLED || 'false'}`);
    console.log('');

    // Ensure GDPR is enabled for testing
    process.env.GDPR_COMPLIANCE_ENABLED = 'true';
    process.env.NODE_ENV = 'test';

    // Filter test suites based on options
    const suitesToRun = this.filterTestSuites();
    
    console.log(`Running ${suitesToRun.length} test suites:`);
    suitesToRun.forEach(suite => {
      console.log(`  📋 ${suite.name} (${suite.category}/${suite.priority})`);
    });
    console.log('');

    // Run tests
    if (this.options.parallel) {
      await this.runTestsInParallel(suitesToRun);
    } else {
      await this.runTestsSequentially(suitesToRun);
    }

    // Generate reports
    await this.generateTestReport();
    
    // Check compliance if requested
    if (this.options.checkCompliance) {
      await this.checkComplianceThreshold();
    }
    
    // Exit with appropriate code
    const hasFailures = this.results.some(r => r.status === 'fail' || r.status === 'error');
    process.exit(hasFailures ? 1 : 0);
  }

  private filterTestSuites() {
    let suites = [...TEST_SUITES];
    
    if (this.options.category) {
      suites = suites.filter(s => s.category === this.options.category);
    }
    
    if (this.options.priority) {
      suites = suites.filter(s => s.priority === this.options.priority);
    }
    
    return suites;
  }

  private async runTestsSequentially(suites: typeof TEST_SUITES): Promise<void> {
    for (const suite of suites) {
      await this.runTestSuite(suite);
    }
  }

  private async runTestsInParallel(suites: typeof TEST_SUITES): Promise<void> {
    const promises = suites.map(suite => this.runTestSuite(suite));
    await Promise.all(promises);
  }

  private async runTestSuite(suite: typeof TEST_SUITES[0]): Promise<void> {
    console.log(`🔍 Running ${suite.name}...`);
    const startTime = Date.now();
    
    try {
      const result = await this.executeTestFile(suite.file);
      const duration = Date.now() - startTime;
      
      this.results.push({
        suite: suite.name,
        ...result,
        duration,
        status: result.failed > 0 ? 'fail' : 'pass'
      });
      
      const status = result.failed > 0 ? '❌' : '✅';
      console.log(`${status} ${suite.name}: ${result.passed} passed, ${result.failed} failed (${duration}ms)`);
      
      if (result.errors.length > 0 && this.options.verbose) {
        result.errors.forEach(error => console.log(`   Error: ${error}`));
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        suite: suite.name,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration,
        errors: [error.message],
        status: 'error'
      });
      
      console.log(`💥 ${suite.name}: Test execution error (${duration}ms)`);
      if (this.options.verbose) {
        console.log(`   Error: ${error.message}`);
      }
    }
  }

  private executeTestFile(testFile: string): Promise<TestResult> {
    return new Promise((resolve, reject) => {
      const args = ['--test'];
      if (this.options.timeout) args.push(`--test-timeout=${this.options.timeout}`);
      
      args.push(testFile);
      
      const child = spawn('tsx', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test', GDPR_COMPLIANCE_ENABLED: 'true' }
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(this.parseTestOutput(stdout));
        } else {
          reject(new Error(stderr || `Test failed with exit code ${code}`));
        }
      });
      
      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private parseTestOutput(output: string): TestResult {
    // Parse Node.js test runner output with proper regex patterns
    const lines = output.split('\n');
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    // Updated patterns for Node.js test runner output
    const passPattern = /^(\s*)✓(.+)|^(\s*)ok \d+/;
    const failPattern = /^(\s*)✗(.+)|^(\s*)not ok \d+/;
    const skipPattern = /^(\s*)⚪(.+)|^(\s*)# SKIP/;
    const summaryPattern = /tests? (\d+), pass (\d+), fail (\d+), cancelled (\d+), skipped (\d+), todo (\d+)/i;
    
    // First, try to parse summary line for accurate counts
    for (const line of lines) {
      const summaryMatch = line.match(summaryPattern);
      if (summaryMatch) {
        const [, total, passCount, failCount, cancelledCount, skipCount, todoCount] = summaryMatch;
        passed = parseInt(passCount, 10);
        failed = parseInt(failCount, 10) + parseInt(cancelledCount, 10);
        skipped = parseInt(skipCount, 10) + parseInt(todoCount, 10);
        break;
      }
    }
    
    // If no summary found, fall back to line-by-line parsing
    if (passed === 0 && failed === 0 && skipped === 0) {
      for (const line of lines) {
        if (passPattern.test(line)) {
          passed++;
        } else if (failPattern.test(line)) {
          failed++;
          errors.push(line.trim());
        } else if (skipPattern.test(line)) {
          skipped++;
        }
      }
    }
    
    // Collect error details from failed tests
    if (failed > 0 && errors.length === 0) {
      const errorLines = lines.filter(line => 
        line.includes('AssertionError') || 
        line.includes('Error:') || 
        failPattern.test(line)
      );
      errors.push(...errorLines.map(line => line.trim()));
    }
    
    return { passed, failed, skipped, errors };
  }

  private async generateTestReport(): Promise<void> {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);
    
    const successRate = totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(1) : '0.0';
    
    // Console summary
    console.log('\n📊 GDPR Test Results Summary');
    console.log('===========================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${totalPassed} (${successRate}%)`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Skipped: ${totalSkipped}`);
    console.log(`Duration: ${totalDuration}ms`);
    console.log(`Test Suites: ${this.results.length}`);
    
    // Detailed results
    console.log('\n📋 Detailed Results:');
    this.results.forEach(result => {
      const status = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '💥';
      console.log(`${status} ${result.suite}: ${result.passed}/${result.passed + result.failed} (${result.duration}ms)`);
    });
    
    // Compliance summary
    console.log('\n🛡️  GDPR Compliance Status:');
    const criticalFailures = this.results.filter(r => 
      (r.status === 'fail' || r.status === 'error') && 
      TEST_SUITES.find(s => s.name === r.suite)?.priority === 'critical'
    );
    
    if (criticalFailures.length === 0) {
      console.log('✅ All critical GDPR compliance tests passed');
    } else {
      console.log('❌ Critical GDPR compliance failures detected:');
      criticalFailures.forEach(f => console.log(`   - ${f.suite}`));
    }
    
    // Generate report files if requested
    if (this.options.generateReport) {
      await this.generateReportFiles();
    }
  }

  private async generateReportFiles(): Promise<void> {
    const reportsDir = 'test-reports';
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // JSON report
    const jsonReport = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      summary: {
        total: this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0),
        passed: this.results.reduce((sum, r) => sum + r.passed, 0),
        failed: this.results.reduce((sum, r) => sum + r.failed, 0),
        skipped: this.results.reduce((sum, r) => sum + r.skipped, 0),
      },
      results: this.results,
      compliance: {
        gdprEnabled: process.env.GDPR_COMPLIANCE_ENABLED === 'true',
        criticalTestsPassed: this.results.filter(r => 
          r.status === 'pass' && 
          TEST_SUITES.find(s => s.name === r.suite)?.priority === 'critical'
        ).length,
        overallCompliance: this.calculateComplianceScore(),
      }
    };
    
    writeFileSync(
      join(reportsDir, `gdpr-test-report-${timestamp}.json`),
      JSON.stringify(jsonReport, null, 2)
    );
    
    // HTML report (basic)
    if (this.options.outputFormat === 'html') {
      const htmlReport = this.generateHtmlReport(jsonReport);
      writeFileSync(
        join(reportsDir, `gdpr-test-report-${timestamp}.html`),
        htmlReport
      );
    }
    
    console.log(`\n📄 Reports generated in ${reportsDir}/`);
  }

  private calculateComplianceScore(): number {
    const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed, 0);
    const passedTests = this.results.reduce((sum, r) => sum + r.passed, 0);
    
    if (totalTests === 0) return 0;
    
    // Weight critical tests more heavily
    const criticalWeight = 2;
    const normalWeight = 1;
    
    let weightedTotal = 0;
    let weightedPassed = 0;
    
    this.results.forEach(result => {
      const suite = TEST_SUITES.find(s => s.name === result.suite);
      const weight = suite?.priority === 'critical' ? criticalWeight : normalWeight;
      
      weightedTotal += (result.passed + result.failed) * weight;
      weightedPassed += result.passed * weight;
    });
    
    return weightedTotal > 0 ? (weightedPassed / weightedTotal * 100) : 0;
  }

  private async checkComplianceThreshold(): Promise<void> {
    const threshold = this.options.complianceThreshold || 95;
    const reportsDir = 'test-reports';
    
    try {
      // Find the latest report file
      if (!existsSync(reportsDir)) {
        console.error('::error::No test reports directory found');
        process.exit(1);
      }
      
      const files = readdirSync(reportsDir).filter(f => 
        f.startsWith('gdpr-test-report-') && f.endsWith('.json')
      );
      
      if (files.length === 0) {
        console.error('::error::No GDPR test report found');
        process.exit(1);
      }
      
      // Get the latest report (files are timestamped)
      const latestReport = files.sort().pop();
      const reportPath = join(reportsDir, latestReport!);
      const reportData = JSON.parse(readFileSync(reportPath, 'utf8'));
      
      const complianceScore = reportData.compliance?.overallCompliance || 0;
      const criticalTestsPassed = reportData.compliance?.criticalTestsPassed || 0;
      const criticalTestsTotal = TEST_SUITES.filter(s => s.priority === 'critical').length;
      
      console.log(`\n🛡️ GDPR Compliance Check`);
      console.log(`========================`);
      console.log(`Compliance Score: ${complianceScore.toFixed(1)}%`);
      console.log(`Critical Tests: ${criticalTestsPassed}/${criticalTestsTotal} passed`);
      console.log(`Threshold: ${threshold}%`);
      
      // GitHub Actions output
      console.log(`::notice::GDPR compliance score: ${complianceScore.toFixed(1)}%`);
      
      if (complianceScore < threshold) {
        console.error(`::error::GDPR compliance score (${complianceScore.toFixed(1)}%) is below required threshold (${threshold}%)`);
        process.exit(1);
      }
      
      if (criticalTestsPassed < criticalTestsTotal) {
        console.error(`::error::Critical GDPR tests failed: ${criticalTestsPassed}/${criticalTestsTotal} passed`);
        process.exit(1);
      }
      
      console.log(`✅ Compliance check passed: ${complianceScore.toFixed(1)}% (>= ${threshold}%)`);
      
    } catch (error) {
      console.error(`::error::Compliance check failed: ${error.message}`);
      process.exit(1);
    }
  }

  private generateHtmlReport(data: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>GDPR Compliance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; justify-content: space-around; margin: 20px 0; }
        .metric { text-align: center; padding: 10px; }
        .metric h3 { margin: 0; font-size: 2em; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .test-suite { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
        .test-suite.pass { border-left: 5px solid #28a745; }
        .test-suite.fail { border-left: 5px solid #dc3545; }
        .test-suite.error { border-left: 5px solid #dc3545; background: #fff5f5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ GDPR Compliance Test Report</h1>
        <p>Generated: ${data.timestamp}</p>
        <p>Duration: ${data.duration}ms</p>
        <p>Compliance Score: ${data.compliance.overallCompliance.toFixed(1)}%</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3 class="passed">${data.summary.passed}</h3>
            <p>Passed</p>
        </div>
        <div class="metric">
            <h3 class="failed">${data.summary.failed}</h3>
            <p>Failed</p>
        </div>
        <div class="metric">
            <h3 class="skipped">${data.summary.skipped}</h3>
            <p>Skipped</p>
        </div>
        <div class="metric">
            <h3>${data.summary.total}</h3>
            <p>Total</p>
        </div>
    </div>
    
    <h2>Test Suite Results</h2>
    ${data.results.map((result: TestResult) => `
        <div class="test-suite ${result.status}">
            <h3>${result.suite}</h3>
            <p>Passed: ${result.passed}, Failed: ${result.failed}, Duration: ${result.duration}ms</p>
            ${result.errors.length > 0 ? `<p><strong>Errors:</strong><br>${result.errors.join('<br>')}</p>` : ''}
        </div>
    `).join('')}
    
</body>
</html>`;
  }
}

// CLI argument parsing
function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  const options: TestOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--parallel':
      case '-p':
        options.parallel = true;
        break;
      case '--coverage':
      case '-c':
        options.coverage = true;
        break;
      case '--category':
        options.category = args[++i];
        break;
      case '--priority':
        options.priority = args[++i];
        break;
      case '--report':
      case '-r':
        options.generateReport = true;
        break;
      case '--format':
        options.outputFormat = args[++i] as 'console' | 'json' | 'html';
        break;
      case '--timeout':
        options.timeout = parseInt(args[++i]);
        break;
      case '--check-compliance':
        options.checkCompliance = true;
        break;
      case '--compliance-threshold':
        options.complianceThreshold = parseFloat(args[++i]);
        break;
      case '--help':
      case '-h':
        console.log(`
GDPR Test Suite Runner

Usage: tsx tests/run-all-tests.ts [options]

Options:
  -v, --verbose                  Verbose output
  -p, --parallel                 Run tests in parallel
  -c, --coverage                 Generate coverage report
  --category <cat>               Run tests from specific category (core, compliance, lifecycle, incident, protection, security)
  --priority <pri>               Run tests of specific priority (critical, high, medium, low)
  -r, --report                   Generate test reports
  --format <fmt>                 Output format (console, json, html)
  --timeout <ms>                 Test timeout in milliseconds
  --check-compliance             Check compliance threshold after running tests
  --compliance-threshold <num>   Compliance threshold percentage (default: 95)
  -h, --help                     Show this help

Examples:
  tsx tests/run-all-tests.ts                                    # Run all tests
  tsx tests/run-all-tests.ts --category core                    # Run core tests only
  tsx tests/run-all-tests.ts --priority critical                # Run critical tests only
  tsx tests/run-all-tests.ts --parallel --report                # Run in parallel with reports
  tsx tests/run-all-tests.ts --report --check-compliance        # Run with compliance check
        `);
        process.exit(0);
        break;
    }
  }
  
  return options;
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  const runner = new GdprTestRunner(options);
  runner.runAllTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { GdprTestRunner, TestOptions, TestResult };