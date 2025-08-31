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
  private extractionLocks = new Map<string, Promise<any>>();

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

  private async validateZipFile(zipPath: string): Promise<boolean> {
    try {
      // Check if file exists and has some content
      const stats = await fs.promises.stat(zipPath);
      if (stats.size === 0) {
        console.log('❌ Zip file is empty');
        return false;
      }
      
      // Try to open the zip file to verify it's valid
      return new Promise((resolve) => {
        (yauzl as any).open(zipPath, { lazyEntries: true }, (err: Error | null, zipfile?: YauzlZipFile) => {
          if (err || !zipfile) {
            console.log(`❌ Invalid zip file: ${err?.message}`);
            resolve(false);
            return;
          }
          
          // If we can open it, it's probably valid
          resolve(true);
        });
      });
    } catch (error) {
      console.log(`❌ Error validating zip file: ${error}`);
      return false;
    }
  }

  private async extractZipFile(zipPath: string, extractDir: string): Promise<void> {
    // Validate the zip file first
    const isValid = await this.validateZipFile(zipPath);
    if (!isValid) {
      throw new Error('Invalid or corrupted zip file');
    }
    
    return new Promise((resolve, reject) => {
      let hasError = false;
      
      (yauzl as any).open(zipPath, { lazyEntries: true }, (err: Error | null, zipfile?: YauzlZipFile) => {
        if (err || !zipfile) {
          reject(err || new Error('Failed to open zip file'));
          return;
        }
        
        zipfile.readEntry();
        
        zipfile.on("entry", (entry: YauzlEntry) => {
          if (hasError) return;
          
          if (/\/$/.test(entry.fileName)) {
            // Directory entry
            zipfile.readEntry();
          } else {
            // File entry
            zipfile.openReadStream(entry, (err: Error | null, readStream?: NodeJS.ReadableStream) => {
              if (hasError) return;
              
              if (err || !readStream) {
                hasError = true;
                reject(err || new Error('Failed to open read stream'));
                return;
              }
              
              const filePath = path.join(extractDir, entry.fileName);
              const dirPath = path.dirname(filePath);
              
              // Ensure directory exists
              mkdirp.mkdirp(dirPath).then(() => {
                if (hasError) return;
                
                const writeStream = fs.createWriteStream(filePath);
                readStream.pipe(writeStream);
                
                writeStream.on('close', () => {
                  if (!hasError) {
                    zipfile.readEntry();
                  }
                });
                
                writeStream.on('error', (writeErr) => {
                  if (!hasError) {
                    hasError = true;
                    reject(writeErr);
                  }
                });
                
                readStream.on('error', (readErr) => {
                  if (!hasError) {
                    hasError = true;
                    reject(readErr);
                  }
                });
              }).catch((mkdirErr) => {
                if (!hasError) {
                  hasError = true;
                  reject(mkdirErr);
                }
              });
            });
          }
        });
        
        zipfile.on("end", () => {
          if (!hasError) {
            resolve();
          }
        });
        
        zipfile.on("error", (zipErr) => {
          if (!hasError) {
            hasError = true;
            reject(zipErr);
          }
        });
      });
    });
  }

  async extractPackage(packageUrl: string): Promise<{ path: string; manifest: any; launchFile: string }> {
    // Check if already extracted
    if (this.extractedPackages.has(packageUrl)) {
      return this.extractedPackages.get(packageUrl)!;
    }

    // Check if extraction is already in progress for this package
    if (this.extractionLocks.has(packageUrl)) {
      console.log(`⏳ Waiting for ongoing extraction of: ${packageUrl}`);
      return await this.extractionLocks.get(packageUrl)!;
    }

    // Create extraction promise and store it in locks
    const extractionPromise = this.performExtraction(packageUrl);
    this.extractionLocks.set(packageUrl, extractionPromise);

    try {
      const result = await extractionPromise;
      return result;
    } finally {
      // Always clean up the lock when done
      this.extractionLocks.delete(packageUrl);
    }
  }

  private async performExtraction(packageUrl: string): Promise<{ path: string; manifest: any; launchFile: string }> {
    const extractDir = path.join(process.cwd(), 'temp', 'scorm', Buffer.from(packageUrl).toString('base64').slice(0, 20));
    await mkdirp.mkdirp(extractDir);

    try {
      console.log(`📦 Downloading SCORM package from: ${packageUrl}`);
      
      // Download the SCORM package using ObjectStorageService for proper private file access
      const objectStorageService = new ObjectStorageService();
      const zipPath = path.join(extractDir, 'package.zip');
      
      try {
        // Try to handle as a private object storage file first
        const normalizedPath = objectStorageService.normalizeObjectEntityPath(packageUrl);
        const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
        
        // Stream the file content to local storage
        const stream = objectFile.createReadStream();
        const writeStream = fs.createWriteStream(zipPath);
        
        await new Promise((resolve, reject) => {
          stream.on('error', reject);
          writeStream.on('error', reject);
          writeStream.on('finish', resolve);
          stream.pipe(writeStream);
        });
        
        console.log(`✅ Downloaded SCORM package using object storage service`);
      } catch (objectStorageError) {
        console.log(`⚠️ Object storage download failed, trying direct fetch: ${objectStorageError}`);
        
        // Fallback to direct fetch for public URLs or other cases
        const response = await fetch(packageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download SCORM package: ${response.statusText}`);
        }
        
        const buffer = await response.arrayBuffer();
        await fs.promises.writeFile(zipPath, Buffer.from(buffer));
        console.log(`✅ Downloaded SCORM package using direct fetch`);
      }
      
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
      
      // Clean up any corrupted cached data
      this.extractedPackages.delete(packageUrl);
      
      // Clean up the extraction directory if it exists
      try {
        if (fs.existsSync(extractDir)) {
          await fs.promises.rmdir(extractDir, { recursive: true });
        }
      } catch (cleanupError) {
        console.error('Error cleaning up extraction directory:', cleanupError);
      }
      
      // Re-throw the error instead of caching an error result
      throw new Error(`Failed to extract SCORM package: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getExtractedPackagePath(packageUrl: string): Promise<string | null> {
    const extracted = this.extractedPackages.get(packageUrl);
    return extracted ? extracted.path : null;
  }

  // Method to clear cache for a specific package (useful for retries)
  clearPackageCache(packageUrl: string): void {
    console.log(`🗑️ Clearing cache for package: ${packageUrl}`);
    this.extractedPackages.delete(packageUrl);
    this.extractionLocks.delete(packageUrl);
  }

  // Method to clear all cached packages (useful for cleanup)
  clearAllCache(): void {
    console.log('🗑️ Clearing all SCORM package cache');
    this.extractedPackages.clear();
    this.extractionLocks.clear();
  }

  private rewriteAssetPaths(content: string, encodedPackageUrl: string): string {
    // Rewrite relative paths to include packageUrl parameter
    return content
      .replace(/src\s*=\s*["'](?!https?:\/\/)(?!\/api\/scorm\/)([^"']+)["']/gi, 
        `src="/api/scorm/$1?packageUrl=${encodedPackageUrl}"`)
      .replace(/href\s*=\s*["'](?!https?:\/\/)(?!\/api\/scorm\/)([^"']+)["']/gi, 
        `href="/api/scorm/$1?packageUrl=${encodedPackageUrl}"`)
      .replace(/url\s*\(\s*["']?(?!https?:\/\/)(?!\/api\/scorm\/)([^"')]+)["']?\s*\)/gi, 
        `url("/api/scorm/$1?packageUrl=${encodedPackageUrl}")`);
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

      const encodedPackageUrl = encodeURIComponent(packageUrl);
      const iframeSrc = `/api/scorm/content?packageUrl=${encodedPackageUrl}&file=${extracted.launchFile}`;
      
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
            .scorm-content { 
              flex: 1; 
              overflow: hidden; 
              background: white; 
              position: relative;
            }
            .scorm-iframe {
              width: 100%;
              height: 100%;
              border: none;
              background: white;
            }
          </style>
        </head>
        <body>
          <div class="scorm-container">
            <div class="scorm-header">
              🎓 ${extracted.manifest?.metadata?.title || 'SCORM Course'} - Interactive Learning Platform
            </div>
            <div class="scorm-content">
              <iframe 
                src="${iframeSrc}" 
                class="scorm-iframe"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                loading="eager">
              </iframe>
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