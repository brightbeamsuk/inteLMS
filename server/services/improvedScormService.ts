import { Course } from "@shared/schema";
import { ObjectStorageService } from "../objectStorage";
// @ts-ignore - yauzl doesn't have types
import * as yauzl from "yauzl";
import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";

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

export interface ImprovedScormPackageInfo {
  title: string;
  description?: string;
  duration?: number;
  version: string;
  launchUrl: string; // Full URL path like /scos/courseId/path/to/file.html
  launchFile: string; // Relative file path
  courseId: string;
  manifestXml?: string; // Store raw manifest for debugging
  diagnostics?: {
    extractedFiles: string[];
    manifestLocation: string;
    resourcesFound: number;
    errors: string[];
  };
}

export interface ScormExtractionError extends Error {
  code: string;
  details: {
    path?: string;
    manifestContent?: string;
    extractedFiles?: string[];
    attemptedLaunchFile?: string;
  };
}

export class ImprovedScormService {
  private extractedPackages = new Map<string, ImprovedScormPackageInfo>();
  private extractionLocks = new Map<string, Promise<ImprovedScormPackageInfo>>();

  async processScormPackage(packageUrl: string, courseId: string): Promise<ImprovedScormPackageInfo> {
    console.log(`📦 Processing SCORM package for course ${courseId}: ${packageUrl}`);
    
    // Check cache first
    const cacheKey = `${packageUrl}-${courseId}`;
    if (this.extractedPackages.has(cacheKey)) {
      return this.extractedPackages.get(cacheKey)!;
    }

    // Check if extraction is in progress
    if (this.extractionLocks.has(cacheKey)) {
      return await this.extractionLocks.get(cacheKey)!;
    }

    // Start extraction
    const extractionPromise = this.performExtraction(packageUrl, courseId);
    this.extractionLocks.set(cacheKey, extractionPromise);

    try {
      const result = await extractionPromise;
      this.extractedPackages.set(cacheKey, result);
      return result;
    } finally {
      this.extractionLocks.delete(cacheKey);
    }
  }

  private async performExtraction(packageUrl: string, courseId: string): Promise<ImprovedScormPackageInfo> {
    const extractDir = path.join(process.cwd(), 'public', 'scos', courseId);
    await mkdirp.mkdirp(extractDir);

    const diagnostics = {
      extractedFiles: [] as string[],
      manifestLocation: '',
      resourcesFound: 0,
      errors: [] as string[]
    };

    try {
      // Download package
      const zipPath = await this.downloadPackage(packageUrl, extractDir);
      
      // Extract zip
      await this.extractZipFile(zipPath, extractDir, diagnostics);
      
      // Find and parse manifest
      const manifestResult = await this.findAndParseManifest(extractDir, diagnostics);
      
      // Verify launch file exists
      const verificationResult = await this.verifyLaunchFile(extractDir, manifestResult, diagnostics, courseId);
      
      // Clean up zip file
      try {
        await fs.promises.unlink(zipPath);
      } catch (e) {
        // Ignore cleanup errors
      }

      return {
        title: manifestResult.title,
        description: manifestResult.description,
        version: manifestResult.version,
        launchUrl: verificationResult.launchUrl,
        launchFile: verificationResult.launchFile,
        courseId,
        manifestXml: manifestResult.manifestXml,
        diagnostics
      };

    } catch (error: any) {
      diagnostics.errors.push(`Extraction failed: ${error.message}`);
      
      // Create detailed error
      const scormError: ScormExtractionError = new Error(`SCORM extraction failed: ${error.message}`) as ScormExtractionError;
      scormError.code = error.code || 'SCORM_EXTRACTION_ERROR';
      scormError.details = {
        path: extractDir,
        extractedFiles: diagnostics.extractedFiles,
        attemptedLaunchFile: error.attemptedLaunchFile
      };

      throw scormError;
    }
  }

  private async downloadPackage(packageUrl: string, extractDir: string): Promise<string> {
    const zipPath = path.join(extractDir, 'package.zip');
    
    try {
      const objectStorageService = new ObjectStorageService();
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(packageUrl);
      const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
      
      const stream = objectFile.createReadStream();
      const writeStream = fs.createWriteStream(zipPath);
      
      await new Promise<void>((resolve, reject) => {
        stream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        stream.pipe(writeStream);
      });
      
      console.log(`✅ Downloaded via object storage`);
      return zipPath;
    } catch (objectStorageError) {
      console.log(`⚠️ Object storage failed, trying direct fetch`);
      
      const response = await fetch(packageUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      await fs.promises.writeFile(zipPath, Buffer.from(buffer));
      
      console.log(`✅ Downloaded via direct fetch`);
      return zipPath;
    }
  }

  private async extractZipFile(zipPath: string, extractDir: string, diagnostics: any): Promise<void> {
    return new Promise((resolve, reject) => {
      (yauzl as any).open(zipPath, { lazyEntries: true }, (err: Error | null, zipfile?: YauzlZipFile) => {
        if (err || !zipfile) {
          reject(new Error(`Invalid zip file: ${err?.message || 'Unknown error'}`));
          return;
        }
        
        let filesExtracted = 0;
        zipfile.readEntry();
        
        zipfile.on("entry", (entry: YauzlEntry) => {
          diagnostics.extractedFiles.push(entry.fileName);
          
          if (/\/$/.test(entry.fileName)) {
            // Directory
            zipfile.readEntry();
          } else {
            // File
            zipfile.openReadStream(entry, (err: Error | null, readStream?: NodeJS.ReadableStream) => {
              if (err || !readStream) {
                reject(new Error(`Failed to read ${entry.fileName}: ${err?.message}`));
                return;
              }
              
              const filePath = path.join(extractDir, entry.fileName);
              const dirPath = path.dirname(filePath);
              
              mkdirp.mkdirp(dirPath).then(() => {
                const writeStream = fs.createWriteStream(filePath);
                readStream.pipe(writeStream);
                
                writeStream.on('close', () => {
                  filesExtracted++;
                  zipfile.readEntry();
                });
                
                writeStream.on('error', (writeErr) => {
                  reject(new Error(`Failed to write ${entry.fileName}: ${writeErr.message}`));
                });
              }).catch(reject);
            });
          }
        });
        
        zipfile.on("end", () => {
          console.log(`✅ Extracted ${filesExtracted} files`);
          resolve();
        });
        
        zipfile.on("error", reject);
      });
    });
  }

  private async findAndParseManifest(extractDir: string, diagnostics: any): Promise<{
    title: string;
    description?: string;
    version: string;
    launchFile: string;
    manifestXml: string;
    contentRoot: string;
  }> {
    // Look for imsmanifest.xml at various depths
    const possiblePaths = [
      path.join(extractDir, 'imsmanifest.xml'),
      ...diagnostics.extractedFiles
        .filter((f: string) => f.toLowerCase().endsWith('imsmanifest.xml'))
        .map((f: string) => path.join(extractDir, f))
    ];

    let manifestPath = '';
    let manifestContent = '';

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        manifestPath = p;
        manifestContent = await fs.promises.readFile(p, 'utf-8');
        break;
      }
    }

    if (!manifestPath) {
      throw new Error(`No imsmanifest.xml found. Searched paths: ${possiblePaths.join(', ')}`);
    }

    diagnostics.manifestLocation = path.relative(extractDir, manifestPath);
    const contentRoot = path.dirname(path.relative(extractDir, manifestPath));

    console.log(`📄 Found manifest at: ${diagnostics.manifestLocation}`);
    
    // Parse manifest XML for launch file and metadata
    const result = this.parseManifestXml(manifestContent, contentRoot);
    
    return {
      ...result,
      manifestXml: manifestContent,
      contentRoot
    };
  }

  private parseManifestXml(manifestContent: string, contentRoot: string): {
    title: string;
    description?: string;
    version: string;
    launchFile: string;
  } {
    // Extract title
    const titleMatch = manifestContent.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'SCORM Course';

    // Extract description  
    const descMatch = manifestContent.match(/<description[^>]*>([^<]+)<\/description>/i);
    const description = descMatch ? descMatch[1].trim() : undefined;

    // Extract version
    const versionMatch = manifestContent.match(/schemaversion\s*=\s*["']([^"']+)["']/i) ||
                        manifestContent.match(/<schemaversion[^>]*>([^<]+)<\/schemaversion>/i);
    const version = versionMatch ? versionMatch[1] : '1.2';

    // Find default organization and item
    const defaultOrgMatch = manifestContent.match(/default\s*=\s*["']([^"']+)["']/);
    const defaultOrg = defaultOrgMatch ? defaultOrgMatch[1] : '';

    // Find the first item with identifierref
    let identifierRef = '';
    
    if (defaultOrg) {
      // Look for specific organization
      const orgPattern = new RegExp(`<organization[^>]*identifier\\s*=\\s*["']${defaultOrg}["'][^>]*>([\\s\\S]*?)<\/organization>`, 'i');
      const orgMatch = manifestContent.match(orgPattern);
      if (orgMatch) {
        const itemMatch = orgMatch[1].match(/identifierref\s*=\s*["']([^"']+)["']/);
        if (itemMatch) {
          identifierRef = itemMatch[1];
        }
      }
    }
    
    if (!identifierRef) {
      // Fallback: find any identifierref
      const itemMatch = manifestContent.match(/identifierref\s*=\s*["']([^"']+)["']/);
      if (itemMatch) {
        identifierRef = itemMatch[1];
      }
    }

    if (!identifierRef) {
      throw new Error('No identifierref found in manifest items');
    }

    console.log(`🔍 Found identifierref: ${identifierRef}`);

    // Find resource with matching identifier
    const resourcePattern = new RegExp(`<resource[^>]*identifier\\s*=\\s*["']${identifierRef}["'][^>]*>`, 'i');
    const resourceMatch = manifestContent.match(resourcePattern);
    
    if (!resourceMatch) {
      throw new Error(`Resource with identifier '${identifierRef}' not found`);
    }

    // Extract href from resource
    const hrefMatch = resourceMatch[0].match(/(?:adlcp:)?href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) {
      throw new Error(`No href found in resource '${identifierRef}'`);
    }

    let launchFile = hrefMatch[1];
    
    // Combine with content root if manifest was in subdirectory
    if (contentRoot && contentRoot !== '.') {
      launchFile = path.posix.join(contentRoot, launchFile);
    }

    console.log(`🚀 Parsed launch file: ${launchFile}`);

    return {
      title,
      description,
      version,
      launchFile
    };
  }

  private async verifyLaunchFile(extractDir: string, manifestResult: any, diagnostics: any, courseId: string): Promise<{
    launchUrl: string;
    launchFile: string;
  }> {
    const { launchFile } = manifestResult;
    const fullPath = path.join(extractDir, launchFile);
    
    if (!fs.existsSync(fullPath)) {
      const error = new Error(`Launch file not found: ${launchFile}`) as any;
      error.code = 'LAUNCH_FILE_NOT_FOUND';
      error.attemptedLaunchFile = launchFile;
      
      // Try to find alternatives
      const alternatives = [
        'index.html', 'index.htm', 'start.html', 'start.htm', 
        'launch.html', 'course.html', 'main.html', 'index_lms.html'
      ];
      
      const foundAlternatives = alternatives.filter(alt => 
        fs.existsSync(path.join(extractDir, alt))
      );
      
      if (foundAlternatives.length > 0) {
        error.message += `\nFound alternatives: ${foundAlternatives.join(', ')}`;
        error.details = { foundAlternatives };
      }
      
      error.message += `\nExtracted files (first 20): ${diagnostics.extractedFiles.slice(0, 20).join(', ')}`;
      
      throw error;
    }

    // URL encode the launch file path for web serving
    const encodedLaunchFile = launchFile.split('/').map(encodeURIComponent).join('/');
    const launchUrl = `/scos/${courseId}/${encodedLaunchFile}`;
    
    console.log(`✅ Launch file verified: ${fullPath}`);
    console.log(`🌐 Launch URL: ${launchUrl}`);
    
    return {
      launchUrl,
      launchFile
    };
  }

  clearPackageCache(packageUrl: string, courseId?: string): void {
    if (courseId) {
      this.extractedPackages.delete(`${packageUrl}-${courseId}`);
    } else {
      // Clear all entries for this package URL
      for (const [key] of this.extractedPackages) {
        if (key.startsWith(packageUrl)) {
          this.extractedPackages.delete(key);
        }
      }
    }
  }

  async getPackageInfo(packageUrl: string, courseId: string): Promise<ImprovedScormPackageInfo> {
    return await this.processScormPackage(packageUrl, courseId);
  }
}