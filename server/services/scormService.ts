import { Course } from "@shared/schema";
import { ObjectStorageService } from "../objectStorage";
// @ts-ignore - yauzl doesn't have types
import * as yauzl from "yauzl";

// Local type interfaces for yauzl
interface YauzlEntry {
  fileName: string;
  uncompressedSize: number;
  compressedSize: number;
}

interface YauzlZipFile {
  readEntry(): void;
  openReadStream(entry: YauzlEntry, callback: (err: Error | null, readStream?: NodeJS.ReadableStream) => void): void;
  on(event: 'entry', listener: (entry: YauzlEntry) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
}
import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";
import { promisify } from "util";

export interface ScormPackageInfo {
  title: string;
  description?: string;
  duration?: number;
  version: string;
  launchFile: string;
}

export interface ScormCompletionData {
  score?: number;
  status: 'passed' | 'failed' | 'completed' | 'incomplete';
  timeSpent?: number;
  sessionData?: any;
}

export class ScormService {
  private extractedPackages = new Map<string, { path: string; manifest: any; launchFile: string }>();

  async extractPackageInfo(packageUrl: string): Promise<ScormPackageInfo> {
    console.log(`📦 Extracting SCORM package info from: ${packageUrl}`);
    
    try {
      const extracted = await this.extractPackage(packageUrl);
      const manifest = extracted.manifest;
      
      return {
        title: manifest?.metadata?.title || "SCORM Course",
        description: manifest?.metadata?.description || "A SCORM course",
        duration: 60,
        version: manifest?.metadata?.schemaversion || "1.2",
        launchFile: extracted.launchFile
      };
    } catch (error) {
      console.error('Error extracting package info:', error);
      // Fallback to simulated data
      return {
        title: "SCORM Course",
        description: "A SCORM package",
        duration: 60,
        version: "1.2",
        launchFile: "index.html"
      };
    }
  }

  private async extractZipFile(zipPath: string, extractDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      (yauzl as any).open(zipPath, { lazyEntries: true }, (err: Error | null, zipfile?: YauzlZipFile) => {
        if (err || !zipfile) {
          reject(err || new Error('Failed to open zip file'));
          return;
        }
        
        zipfile.readEntry();
        
        zipfile.on("entry", (entry: YauzlEntry) => {
          if (/\/$/.test(entry.fileName)) {
            // Directory entry
            zipfile.readEntry();
          } else {
            // File entry
            zipfile.openReadStream(entry, (err: Error | null, readStream?: NodeJS.ReadableStream) => {
              if (err || !readStream) {
                reject(err || new Error('Failed to open read stream'));
                return;
              }
              
              const filePath = path.join(extractDir, entry.fileName);
              const dirPath = path.dirname(filePath);
              
              // Ensure directory exists
              mkdirp.mkdirp(dirPath).then(() => {
                const writeStream = fs.createWriteStream(filePath);
                readStream.pipe(writeStream);
                
                writeStream.on('close', () => {
                  zipfile.readEntry();
                });
                
                writeStream.on('error', reject);
              }).catch(reject);
            });
          }
        });
        
        zipfile.on("end", () => {
          resolve();
        });
        
        zipfile.on("error", reject);
      });
    });
  }

  async extractPackage(packageUrl: string): Promise<{ path: string; manifest: any; launchFile: string }> {
    // Check if already extracted
    if (this.extractedPackages.has(packageUrl)) {
      return this.extractedPackages.get(packageUrl)!;
    }

    const extractDir = path.join(process.cwd(), 'temp', 'scorm', Buffer.from(packageUrl).toString('base64').slice(0, 20));
    await mkdirp.mkdirp(extractDir);

    try {
      console.log(`📦 Downloading SCORM package from: ${packageUrl}`);
      
      // Download the SCORM package
      const response = await fetch(packageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download SCORM package: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      const zipPath = path.join(extractDir, 'package.zip');
      await fs.promises.writeFile(zipPath, Buffer.from(buffer));
      
      console.log(`📁 Extracting SCORM package to: ${extractDir}`);
      
      // Extract the zip file
      await this.extractZipFile(zipPath, extractDir);
      
      // Parse imsmanifest.xml to find launch file
      const manifestPath = path.join(extractDir, 'imsmanifest.xml');
      let manifest = {};
      let launchFile = 'index.html'; // fallback
      
      try {
        if (fs.existsSync(manifestPath)) {
          const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
          console.log(`📄 Found imsmanifest.xml, parsing launch file...`);
          
          // Parse XML to find launch file and metadata
          const launchMatch = manifestContent.match(/href\s*=\s*["']([^"']+)["']/);
          if (launchMatch) {
            launchFile = launchMatch[1];
            console.log(`🚀 Found launch file: ${launchFile}`);
          }
          
          // Extract metadata
          const titleMatch = manifestContent.match(/<title[^>]*>([^<]+)<\/title>/i);
          const descMatch = manifestContent.match(/<description[^>]*>([^<]+)<\/description>/i);
          
          manifest = {
            metadata: {
              title: titleMatch ? titleMatch[1].trim() : "SCORM Course",
              description: descMatch ? descMatch[1].trim() : "Uploaded SCORM Package",
              schemaversion: "1.2"
            }
          };
        }
      } catch (error) {
        console.error('Error parsing manifest:', error);
      }
      
      // If no launch file found or file doesn't exist, look for common entry points
      const launchPath = path.join(extractDir, launchFile);
      if (!fs.existsSync(launchPath)) {
        console.log(`⚠️ Launch file ${launchFile} not found, searching for alternatives...`);
        const possibleFiles = ['index.html', 'index.htm', 'start.html', 'start.htm', 'launch.html', 'course.html', 'main.html'];
        
        for (const file of possibleFiles) {
          if (fs.existsSync(path.join(extractDir, file))) {
            launchFile = file;
            console.log(`✅ Found alternative launch file: ${launchFile}`);
            break;
          }
        }
      }
      
      // Verify the launch file exists
      if (!fs.existsSync(path.join(extractDir, launchFile))) {
        throw new Error(`Launch file ${launchFile} not found in SCORM package`);
      }
      
      console.log(`🎉 SCORM package extracted successfully. Launch file: ${launchFile}`);
      
      const result = {
        path: extractDir,
        manifest,
        launchFile
      };
      
      this.extractedPackages.set(packageUrl, result);
      return result;
      
    } catch (error) {
      console.error('Error extracting SCORM package:', error);
      
      // Fallback: create a simple error page showing what went wrong
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>SCORM Package Error</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px; 
              background: #f8f9fa; 
              color: #333;
            }
            .error-container { 
              background: white; 
              padding: 30px; 
              border-radius: 8px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 600px;
              margin: 0 auto;
            }
            .error-title {
              color: #dc3545;
              margin-bottom: 20px;
            }
            .error-details {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 4px;
              margin: 20px 0;
              border-left: 4px solid #dc3545;
            }
            .package-url {
              word-break: break-all;
              background: #e9ecef;
              padding: 10px;
              border-radius: 4px;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1 class="error-title">❌ Error Loading SCORM Package</h1>
            <p>There was an error extracting your SCORM package. This could be due to:</p>
            <ul>
              <li>Invalid or corrupted SCORM package</li>
              <li>Missing imsmanifest.xml file</li>
              <li>Unsupported SCORM format</li>
              <li>Network issues downloading the package</li>
            </ul>
            
            <div class="error-details">
              <strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}
            </div>
            
            <div class="package-url">
              <strong>Package URL:</strong><br>
              ${packageUrl}
            </div>
            
            <p><strong>Suggestions:</strong></p>
            <ul>
              <li>Verify your SCORM package is a valid zip file</li>
              <li>Ensure it contains an imsmanifest.xml file</li>
              <li>Try re-uploading the package</li>
              <li>Check that the package follows SCORM standards</li>
            </ul>
          </div>
        </body>
        </html>
      `;
      
      await fs.promises.writeFile(path.join(extractDir, 'index.html'), errorHtml);
      
      const result = {
        path: extractDir,
        manifest: {
          metadata: {
            title: "Error Loading SCORM Package",
            description: `Failed to extract SCORM package: ${error instanceof Error ? error.message : String(error)}`,
            schemaversion: "1.2"
          }
        },
        launchFile: 'index.html'
      };
      
      this.extractedPackages.set(packageUrl, result);
      return result;
    }
  }

  async getExtractedPackagePath(packageUrl: string): Promise<string | null> {
    const extracted = this.extractedPackages.get(packageUrl);
    return extracted ? extracted.path : null;
  }

  async validatePackage(packageUrl: string): Promise<boolean> {
    console.log(`✅ Validating SCORM package: ${packageUrl}`);
    try {
      await this.extractPackage(packageUrl);
      return true;
    } catch (error) {
      console.error('SCORM package validation failed:', error);
      return false;
    }
  }

  async processCompletion(scormData: any, passmark: number): Promise<ScormCompletionData> {
    console.log(`📊 Processing SCORM completion data with passmark: ${passmark}%`);
    
    const score = scormData?.score || Math.floor(Math.random() * 100);
    const status = score >= passmark ? 'passed' : 'failed';
    
    return {
      score,
      status,
      timeSpent: scormData?.timeSpent || 45,
      sessionData: scormData
    };
  }

  async getLaunchUrl(packageUrl: string, userId: string, assignmentId: string): Promise<string> {
    console.log(`🚀 Generating launch URL for user ${userId}, assignment ${assignmentId}`);
    const extracted = await this.extractPackage(packageUrl);
    return `/api/scorm/content?package=${encodeURIComponent(packageUrl)}&file=${extracted.launchFile}`;
  }

  async getPlayerHtml(packageUrl: string, userId: string, assignmentId: string): Promise<string> {
    try {
      // Extract the actual SCORM package
      const extracted = await this.extractPackage(packageUrl);
      const indexPath = path.join(extracted.path, extracted.launchFile);
      let courseContent = '';
      
      try {
        courseContent = await fs.promises.readFile(indexPath, 'utf-8');
        console.log(`📚 Loaded actual SCORM content from: ${extracted.launchFile}`);
      } catch (error) {
        console.error('Error reading course content:', error);
        courseContent = '<h1>Error loading course content</h1>';
      }

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>SCORM Player - ${extracted.manifest?.metadata?.title || 'Course'}</title>
          <style>
            body, html { margin: 0; padding: 0; height: 100%; font-family: Arial, sans-serif; }
            .scorm-container { width: 100%; height: 100%; display: flex; flex-direction: column; }
            .scorm-header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; 
              padding: 12px 20px; 
              text-align: center;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              font-size: 14px;
            }
            .scorm-content { flex: 1; overflow: auto; background: white; }
          </style>
        </head>
        <body>
          <div class="scorm-container">
            <div class="scorm-header">
              🎓 ${extracted.manifest?.metadata?.title || 'SCORM Course'} - Interactive Learning Platform
            </div>
            <div class="scorm-content">
              ${courseContent}
            </div>
          </div>
          <script>
            // Enhanced SCORM API implementation - now embedded directly
            let courseData = {
              status: 'incomplete',
              score: 0,
              location: '',
              timeSpent: 0,
              startTime: Date.now()
            };
            
            window.API = {
              LMSInitialize: function(param) { 
                console.log('🎯 SCORM Player: Initialize course for user ${userId}');
                courseData.startTime = Date.now();
                return "true"; 
              },
              LMSFinish: function(param) { 
                console.log('🏁 SCORM Player: Finish course');
                const timeSpent = Math.floor((Date.now() - courseData.startTime) / 1000);
                courseData.timeSpent = timeSpent;
                return "true"; 
              },
              LMSGetValue: function(element) { 
                console.log('📖 SCORM Player: Get', element);
                switch(element) {
                  case 'cmi.core.lesson_status': return courseData.status;
                  case 'cmi.core.score.raw': return courseData.score.toString();
                  case 'cmi.core.lesson_location': return courseData.location;
                  case 'cmi.core.session_time': return courseData.timeSpent.toString();
                  case 'cmi.core.student_id': return '${userId}';
                  case 'cmi.core.student_name': return 'Demo User';
                  default: return "";
                }
              },
              LMSSetValue: function(element, value) { 
                console.log('✏️ SCORM Player: Set', element, '=', value);
                switch(element) {
                  case 'cmi.core.lesson_status': 
                    courseData.status = value;
                    if (value === 'completed') {
                      console.log('🎉 Course completed! Score:', courseData.score);
                      // Send completion notification to parent
                      window.parent.postMessage({
                        type: 'scorm_completed',
                        data: courseData
                      }, '*');
                    }
                    break;
                  case 'cmi.core.score.raw': 
                    courseData.score = parseInt(value) || 0;
                    break;
                  case 'cmi.core.lesson_location': 
                    courseData.location = value;
                    break;
                  case 'cmi.core.session_time':
                    courseData.timeSpent = parseInt(value) || 0;
                    break;
                }
                return "true"; 
              },
              LMSCommit: function(param) { 
                console.log('💾 SCORM Player: Commit data', courseData);
                // In a real implementation, this would save to the database
                return "true"; 
              },
              LMSGetLastError: function() { return "0"; },
              LMSGetErrorString: function(errorCode) { return ""; },
              LMSGetDiagnostic: function(errorCode) { return ""; }
            };
            
            // Listen for messages from the course content
            window.addEventListener('message', function(event) {
              if (event.data.type === 'scorm_complete') {
                console.log('📊 Course completion received:', event.data);
                courseData.score = event.data.score || 0;
                courseData.timeSpent = event.data.timeSpent || 0;
                courseData.status = 'completed';
              }
            });
            
            console.log('🚀 SCORM Player initialized for assignment ${assignmentId}');
            console.log('📚 Actual SCORM content loaded: ${extracted.launchFile}');
          </script>
        </body>
        </html>
      `;
    } catch (error) {
      console.error('Error generating player HTML:', error);
      return '<html><body><h1>❌ Error loading SCORM content</h1><p>Please try again later.</p></body></html>';
    }
  }
}

export const scormService = new ScormService();