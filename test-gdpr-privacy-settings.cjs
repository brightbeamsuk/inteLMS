/**
 * Basic tests for GDPR Privacy Settings module
 * Tests feature flag behavior and RBAC enforcement
 * 
 * Run with: node test-gdpr-privacy-settings.js
 */

const http = require('http');

// Test configuration
const TEST_HOST = 'localhost';
const TEST_PORT = 5000;
const BASE_URL = `http://${TEST_HOST}:${TEST_PORT}`;

// Test utilities
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testGdprFeatureFlag() {
  console.log('\n🧪 Testing GDPR Feature Flag Behavior...');
  
  try {
    // Test GET route when GDPR disabled
    const getResponse = await makeRequest({
      hostname: TEST_HOST,
      port: TEST_PORT,
      path: '/api/gdpr/privacy-settings',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (process.env.GDPR_COMPLIANCE_ENABLED !== 'true') {
      if (getResponse.statusCode === 404) {
        console.log('✅ GET /api/gdpr/privacy-settings returns 404 when GDPR disabled');
      } else {
        console.log(`❌ GET /api/gdpr/privacy-settings returned ${getResponse.statusCode}, expected 404 when GDPR disabled`);
      }
    } else {
      if (getResponse.statusCode === 401 || getResponse.statusCode === 403) {
        console.log('✅ GET /api/gdpr/privacy-settings properly enforces authentication when GDPR enabled');
      } else {
        console.log(`❌ GET /api/gdpr/privacy-settings returned ${getResponse.statusCode}, expected 401/403 when not authenticated`);
      }
    }
    
    // Test POST route when GDPR disabled
    const postResponse = await makeRequest({
      hostname: TEST_HOST,
      port: TEST_PORT,
      path: '/api/gdpr/privacy-settings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dataRetentionPeriod: 2555,
        cookieSettings: {},
        privacyContacts: {},
        internationalTransfers: {},
        settings: {}
      })
    });
    
    if (process.env.GDPR_COMPLIANCE_ENABLED !== 'true') {
      if (postResponse.statusCode === 404) {
        console.log('✅ POST /api/gdpr/privacy-settings returns 404 when GDPR disabled');
      } else {
        console.log(`❌ POST /api/gdpr/privacy-settings returned ${postResponse.statusCode}, expected 404 when GDPR disabled`);
      }
    } else {
      if (postResponse.statusCode === 401 || postResponse.statusCode === 403) {
        console.log('✅ POST /api/gdpr/privacy-settings properly enforces authentication when GDPR enabled');
      } else {
        console.log(`❌ POST /api/gdpr/privacy-settings returned ${postResponse.statusCode}, expected 401/403 when not authenticated`);
      }
    }
    
    // Test PATCH route when GDPR disabled
    const patchResponse = await makeRequest({
      hostname: TEST_HOST,
      port: TEST_PORT,
      path: '/api/gdpr/privacy-settings',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dataRetentionPeriod: 1000
      })
    });
    
    if (process.env.GDPR_COMPLIANCE_ENABLED !== 'true') {
      if (patchResponse.statusCode === 404) {
        console.log('✅ PATCH /api/gdpr/privacy-settings returns 404 when GDPR disabled');
      } else {
        console.log(`❌ PATCH /api/gdpr/privacy-settings returned ${patchResponse.statusCode}, expected 404 when GDPR disabled`);
      }
    } else {
      if (patchResponse.statusCode === 401 || patchResponse.statusCode === 403) {
        console.log('✅ PATCH /api/gdpr/privacy-settings properly enforces authentication when GDPR enabled');
      } else {
        console.log(`❌ PATCH /api/gdpr/privacy-settings returned ${patchResponse.statusCode}, expected 401/403 when not authenticated`);
      }
    }
    
    // Test DELETE route when GDPR disabled
    const deleteResponse = await makeRequest({
      hostname: TEST_HOST,
      port: TEST_PORT,
      path: '/api/gdpr/privacy-settings',
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (process.env.GDPR_COMPLIANCE_ENABLED !== 'true') {
      if (deleteResponse.statusCode === 404) {
        console.log('✅ DELETE /api/gdpr/privacy-settings returns 404 when GDPR disabled');
      } else {
        console.log(`❌ DELETE /api/gdpr/privacy-settings returned ${deleteResponse.statusCode}, expected 404 when GDPR disabled`);
      }
    } else {
      if (deleteResponse.statusCode === 401 || deleteResponse.statusCode === 403) {
        console.log('✅ DELETE /api/gdpr/privacy-settings properly enforces authentication when GDPR enabled');
      } else {
        console.log(`❌ DELETE /api/gdpr/privacy-settings returned ${deleteResponse.statusCode}, expected 401/403 when not authenticated`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Feature flag test failed: ${error.message}`);
  }
}

async function testRbacEnforcement() {
  console.log('\n🔒 Testing RBAC Enforcement...');
  
  // Skip RBAC tests if GDPR is disabled
  if (process.env.GDPR_COMPLIANCE_ENABLED !== 'true') {
    console.log('ℹ️  Skipping RBAC tests - GDPR is disabled');
    return;
  }
  
  try {
    // Test unauthenticated access
    const unauthResponse = await makeRequest({
      hostname: TEST_HOST,
      port: TEST_PORT,
      path: '/api/gdpr/privacy-settings',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (unauthResponse.statusCode === 401) {
      console.log('✅ Unauthenticated requests receive 401');
    } else {
      console.log(`❌ Unauthenticated request returned ${unauthResponse.statusCode}, expected 401`);
    }
    
    // Additional RBAC tests would require setting up authenticated sessions
    // which is beyond the scope of basic testing
    console.log('ℹ️  Additional RBAC tests require authenticated sessions (admin/superadmin vs regular user)');
    
  } catch (error) {
    console.log(`❌ RBAC test failed: ${error.message}`);
  }
}

async function testApiEndpointExists() {
  console.log('\n🌐 Testing API Endpoint Availability...');
  
  try {
    // Test basic connectivity to the API
    const healthResponse = await makeRequest({
      hostname: TEST_HOST,
      port: TEST_PORT,
      path: '/api/health',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`ℹ️  API server connectivity: ${healthResponse.statusCode === 404 ? 'Connected (404 expected for /health)' : `Status ${healthResponse.statusCode}`}`);
    
  } catch (error) {
    console.log(`❌ Cannot connect to API server at ${BASE_URL}: ${error.message}`);
    console.log('ℹ️  Make sure the server is running with: npm run dev');
    return false;
  }
  
  return true;
}

async function runTests() {
  console.log('🧪 GDPR Privacy Settings Module Tests');
  console.log('=====================================');
  console.log(`Target: ${BASE_URL}`);
  console.log(`GDPR_COMPLIANCE_ENABLED: ${process.env.GDPR_COMPLIANCE_ENABLED || 'false'}`);
  
  // Check server connectivity first
  const serverAvailable = await testApiEndpointExists();
  if (!serverAvailable) {
    return;
  }
  
  // Run tests
  await testGdprFeatureFlag();
  await testRbacEnforcement();
  
  console.log('\n✅ Tests completed!');
  console.log('\nNote: These are basic connectivity and feature flag tests.');
  console.log('Full integration tests would require test database and authentication setup.');
}

// Run tests
runTests().catch(console.error);