// Temporary script to generate certificates for demo completions
import fetch from 'node-fetch';

const completionIds = [
  '71fb757f-8720-4874-907e-cb1a5e6df5d2', // Charlie Brown
  'f56a9d96-3040-4e99-9512-0259e3df1fdd', // Diana Smith  
  '6d1ad85c-2d18-4560-bae8-e9e938de2d1c', // Ethan Davis
  '52909783-b0e2-4eb0-bbd6-c9cbce033d3a', // George Taylor
  '1f147b8d-6b87-4728-9a7b-80ea7fbefe4e'  // Benny Wakefield
];

async function generateCertificates() {
  console.log('🚀 Starting certificate generation for 5 demo completions...');
  
  for (const completionId of completionIds) {
    try {
      console.log(`📜 Generating certificate for completion: ${completionId}`);
      
      const response = await fetch('http://localhost:5000/api/certificates/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: This won't work without session cookie, but let's see what happens
        },
        body: JSON.stringify({ completionId })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ Certificate generated successfully: ${result.certificateId}`);
      } else {
        console.log(`❌ Failed to generate certificate: ${result.message}`);
      }
    } catch (error) {
      console.log(`❌ Error generating certificate for ${completionId}:`, error.message);
    }
  }
  
  console.log('🏁 Certificate generation process completed');
}

generateCertificates();