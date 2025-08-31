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

export interface ScormItem {
  id: string;
  title: string;
  identifierref: string;
  launchUrl?: string;
  resourceHref: string;
}

export interface ScormOrganization {
  id: string;
  title: string;
  items: ScormItem[];
}

export interface EnhancedScormPackageInfo {
  title: string;
  description?: string;
  version: string;
  launchUrl: string; // Primary launch URL
  launchFile: string; // Relative file path
  courseId: string;
  scormRoot: string; // Folder containing imsmanifest.xml
  organizations: ScormOrganization[];
  defaultOrganization: string;
  manifestXml: string; // Store raw manifest for debugging
  diagnostics: {
    extractedFiles: string[];
    manifestLocation: string;
    scormRootLocation: string;
    resourcesFound: number;
    organizationsFound: number;
    itemsFound: number;
    errors: string[];
    warnings: string[];
  };
}

export interface ScormExtractionError extends Error {
  code: string;
  details: {
    path?: string;
    manifestContent?: string;
    extractedFiles?: string[];
    attemptedLaunchFile?: string;
    scormRoot?: string;
    availableFiles?: string[];
  };
}

export class EnhancedScormService {
  private extractedPackages = new Map<string, EnhancedScormPackageInfo>();
  private extractionLocks = new Map<string, Promise<EnhancedScormPackageInfo>>();

  async processScormPackage(packageUrl: string, courseId: string): Promise<EnhancedScormPackageInfo> {
    console.log(`📦 [Enhanced] Processing SCORM package for course ${courseId}: ${packageUrl}`);
    
    // Check cache first
    const cacheKey = `${packageUrl}-${courseId}`;
    if (this.extractedPackages.has(cacheKey)) {
      console.log(`⚡ Using cached SCORM package: ${courseId}`);
      return this.extractedPackages.get(cacheKey)!;
    }

    // Check if extraction is in progress
    if (this.extractionLocks.has(cacheKey)) {
      console.log(`⏳ Waiting for ongoing extraction: ${courseId}`);
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

  private async performExtraction(packageUrl: string, courseId: string): Promise<EnhancedScormPackageInfo> {
    const extractDir = path.join(process.cwd(), 'public', 'scos', courseId);
    await mkdirp.mkdirp(extractDir);

    const diagnostics = {
      extractedFiles: [] as string[],
      manifestLocation: '',
      scormRootLocation: '',
      resourcesFound: 0,
      organizationsFound: 0,
      itemsFound: 0,
      errors: [] as string[],
      warnings: [] as string[]
    };

    try {
      // A. Download and extract package
      const zipPath = await this.downloadPackage(packageUrl, extractDir);
      await this.extractZipFile(zipPath, extractDir, diagnostics);
      
      // B. Find manifest recursively and determine SCORM root
      const { manifestPath, scormRoot } = await this.findManifestRecursively(extractDir, diagnostics);
      
      // C. Parse manifest for organizations and items
      const manifestResult = await this.parseManifestComprehensively(manifestPath, scormRoot, diagnostics);
      
      // D. Build and verify launch paths for all items
      const processedOrganizations = await this.processOrganizations(
        manifestResult.organizations, 
        scormRoot, 
        diagnostics,
        courseId
      );
      
      // E. Determine primary launch URL (first item of default org)
      const primaryLaunchUrl = this.determinePrimaryLaunchUrl(
        processedOrganizations, 
        manifestResult.defaultOrganization,
        diagnostics
      );

      // Clean up zip file
      try {
        await fs.promises.unlink(zipPath);
      } catch (e) {
        // Ignore cleanup errors
      }

      const result: EnhancedScormPackageInfo = {
        title: manifestResult.title,
        description: manifestResult.description,
        version: manifestResult.version,
        launchUrl: primaryLaunchUrl.url,
        launchFile: primaryLaunchUrl.file,
        courseId,
        scormRoot: path.relative(extractDir, scormRoot),
        organizations: processedOrganizations,
        defaultOrganization: manifestResult.defaultOrganization,
        manifestXml: manifestResult.manifestXml,
        diagnostics
      };

      console.log(`✅ [Enhanced] SCORM package processed successfully`);
      console.log(`📁 SCORM Root: ${result.scormRoot}`);
      console.log(`🏢 Organizations: ${result.organizations.length}`);
      console.log(`🎯 Primary Launch URL: ${result.launchUrl}`);

      return result;

    } catch (error: any) {
      diagnostics.errors.push(`Extraction failed: ${error.message}`);
      
      const scormError: ScormExtractionError = new Error(`Enhanced SCORM extraction failed: ${error.message}`) as ScormExtractionError;
      scormError.code = error.code || 'ENHANCED_SCORM_EXTRACTION_ERROR';
      scormError.details = {
        path: extractDir,
        extractedFiles: diagnostics.extractedFiles.slice(0, 50), // Limit for readability
        attemptedLaunchFile: error.attemptedLaunchFile,
        scormRoot: diagnostics.scormRootLocation,
        availableFiles: await this.listAvailableFiles(extractDir).catch(() => [])
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

  private async findManifestRecursively(extractDir: string, diagnostics: any): Promise<{
    manifestPath: string;
    scormRoot: string;
  }> {
    // Search recursively for imsmanifest.xml
    const findManifestRecursive = async (dir: string): Promise<string[]> => {
      const results: string[] = [];
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          const subResults = await findManifestRecursive(fullPath);
          results.push(...subResults);
        } else if (item.name.toLowerCase() === 'imsmanifest.xml') {
          results.push(fullPath);
        }
      }
      
      return results;
    };

    const manifestPaths = await findManifestRecursive(extractDir);
    
    if (manifestPaths.length === 0) {
      const error = new Error('No imsmanifest.xml found in SCORM package') as any;
      error.code = 'MANIFEST_NOT_FOUND';
      throw error;
    }

    if (manifestPaths.length > 1) {
      diagnostics.warnings.push(`Multiple manifest files found: ${manifestPaths.join(', ')}. Using the first one.`);
    }

    const manifestPath = manifestPaths[0];
    const scormRoot = path.dirname(manifestPath);
    
    diagnostics.manifestLocation = path.relative(extractDir, manifestPath);
    diagnostics.scormRootLocation = path.relative(extractDir, scormRoot);
    
    console.log(`📄 Found manifest at: ${diagnostics.manifestLocation}`);
    console.log(`📁 SCORM root at: ${diagnostics.scormRootLocation}`);
    
    return { manifestPath, scormRoot };
  }

  private async parseManifestComprehensively(manifestPath: string, scormRoot: string, diagnostics: any): Promise<{
    title: string;
    description?: string;
    version: string;
    organizations: any[];
    defaultOrganization: string;
    manifestXml: string;
  }> {
    const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
    
    // Extract basic metadata
    const titleMatch = manifestContent.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'SCORM Course';

    const descMatch = manifestContent.match(/<description[^>]*>([^<]+)<\/description>/i);
    const description = descMatch ? descMatch[1].trim() : undefined;

    const versionMatch = manifestContent.match(/schemaversion\s*=\s*["']([^"']+)["']/i) ||
                        manifestContent.match(/<schemaversion[^>]*>([^<]+)<\/schemaversion>/i);
    const version = versionMatch ? versionMatch[1] : '1.2';

    // Find default organization
    const defaultOrgMatch = manifestContent.match(/<organizations[^>]+default\s*=\s*["']([^"']+)["']/i);
    let defaultOrganization = defaultOrgMatch ? defaultOrgMatch[1] : '';

    // Parse all organizations
    const orgRegex = /<organization[^>]*identifier\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/organization>/gi;
    const organizations: any[] = [];
    let orgMatch;

    while ((orgMatch = orgRegex.exec(manifestContent)) !== null) {
      const orgId = orgMatch[1];
      const orgContent = orgMatch[2];
      
      const orgTitleMatch = orgContent.match(/<title[^>]*>([^<]+)<\/title>/i);
      const orgTitle = orgTitleMatch ? orgTitleMatch[1].trim() : orgId;

      // Parse items in this organization
      const items = this.parseItemsFromOrganization(orgContent, manifestContent);
      
      organizations.push({
        id: orgId,
        title: orgTitle,
        items
      });
    }

    if (!defaultOrganization && organizations.length > 0) {
      defaultOrganization = organizations[0].id;
      diagnostics.warnings.push('No default organization specified, using first organization');
    }

    diagnostics.organizationsFound = organizations.length;
    diagnostics.itemsFound = organizations.reduce((total, org) => total + org.items.length, 0);

    console.log(`🏢 Found ${organizations.length} organizations with ${diagnostics.itemsFound} items total`);

    return {
      title,
      description,
      version,
      organizations,
      defaultOrganization,
      manifestXml: manifestContent
    };
  }

  private parseItemsFromOrganization(orgContent: string, fullManifest: string): ScormItem[] {
    const itemRegex = /<item[^>]*identifier\s*=\s*["']([^"']+)["'][^>]*(?:identifierref\s*=\s*["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/item>/gi;
    const items: ScormItem[] = [];
    let itemMatch;

    while ((itemMatch = itemRegex.exec(orgContent)) !== null) {
      const itemId = itemMatch[1];
      const identifierref = itemMatch[2];
      const itemContent = itemMatch[3];
      
      if (!identifierref) continue; // Skip non-launchable items

      const itemTitleMatch = itemContent.match(/<title[^>]*>([^<]+)<\/title>/i);
      const itemTitle = itemTitleMatch ? itemTitleMatch[1].trim() : itemId;

      // Find the resource href for this identifierref
      const resourceHref = this.findResourceHref(fullManifest, identifierref);

      items.push({
        id: itemId,
        title: itemTitle,
        identifierref,
        resourceHref
      });
    }

    return items;
  }

  private findResourceHref(manifestContent: string, identifierref: string): string {
    const resourcePattern = new RegExp(`<resource[^>]*identifier\\s*=\\s*["']${identifierref}["'][^>]*>`, 'i');
    const resourceMatch = manifestContent.match(resourcePattern);
    
    if (!resourceMatch) {
      return '';
    }

    const hrefMatch = resourceMatch[0].match(/(?:adlcp:)?href\s*=\s*["']([^"']+)["']/i);
    return hrefMatch ? hrefMatch[1] : '';
  }

  private async processOrganizations(
    organizations: any[], 
    scormRoot: string, 
    diagnostics: any,
    courseId: string
  ): Promise<ScormOrganization[]> {
    const processedOrgs: ScormOrganization[] = [];

    for (const org of organizations) {
      const processedItems: ScormItem[] = [];

      for (const item of org.items) {
        try {
          const verificationResult = await this.verifyAndBuildLaunchUrl(
            scormRoot, 
            item.resourceHref, 
            courseId, 
            diagnostics
          );

          processedItems.push({
            ...item,
            launchUrl: verificationResult.launchUrl
          });
        } catch (error: any) {
          diagnostics.errors.push(`Failed to process item ${item.id}: ${error.message}`);
          processedItems.push(item); // Keep item but without launchUrl
        }
      }

      processedOrgs.push({
        id: org.id,
        title: org.title,
        items: processedItems
      });
    }

    return processedOrgs;
  }

  private async verifyAndBuildLaunchUrl(
    scormRoot: string, 
    resourceHref: string, 
    courseId: string, 
    diagnostics: any
  ): Promise<{ launchUrl: string; launchFile: string }> {
    if (!resourceHref) {
      throw new Error('No href specified in resource');
    }

    // Try the exact file first
    let launchFile = resourceHref;
    let fullPath = path.join(scormRoot, launchFile);
    
    if (fs.existsSync(fullPath)) {
      const encodedLaunchFile = launchFile.split('/').map(encodeURIComponent).join('/');
      const launchUrl = `/scos/${courseId}/${encodedLaunchFile}`;
      return { launchUrl, launchFile };
    }

    // Try fallback files in the same directory as the original href
    const fallbackFiles = [
      'index_lms.html',
      'story.html', 
      'index.html',
      'start.html',
      'launch.html',
      'course.html'
    ];

    const hrefDir = path.dirname(resourceHref);
    const baseDir = hrefDir === '.' ? scormRoot : path.join(scormRoot, hrefDir);

    for (const fallback of fallbackFiles) {
      const fallbackPath = path.join(baseDir, fallback);
      if (fs.existsSync(fallbackPath)) {
        const relativePath = path.relative(scormRoot, fallbackPath);
        const encodedPath = relativePath.split(path.sep).map(encodeURIComponent).join('/');
        const launchUrl = `/scos/${courseId}/${encodedPath}`;
        
        diagnostics.warnings.push(`Using fallback file: ${relativePath} instead of ${resourceHref}`);
        return { launchUrl, launchFile: relativePath };
      }
    }

    // List available files for diagnostics
    const availableFiles = await this.listFilesInDirectory(baseDir);
    const error = new Error(`Launch file not found: ${resourceHref}`) as any;
    error.code = 'LAUNCH_FILE_NOT_FOUND';
    error.attemptedLaunchFile = resourceHref;
    error.details = { availableFiles: availableFiles.slice(0, 10) };
    
    throw error;
  }

  private determinePrimaryLaunchUrl(
    organizations: ScormOrganization[],
    defaultOrganization: string,
    diagnostics: any
  ): { url: string; file: string } {
    // Find the default organization
    let targetOrg = organizations.find(org => org.id === defaultOrganization);
    
    if (!targetOrg && organizations.length > 0) {
      targetOrg = organizations[0];
      diagnostics.warnings.push(`Default organization '${defaultOrganization}' not found, using first organization`);
    }

    if (!targetOrg || targetOrg.items.length === 0) {
      throw new Error('No launchable items found in any organization');
    }

    // Find first item with a launch URL
    const launchableItem = targetOrg.items.find(item => item.launchUrl);
    
    if (!launchableItem) {
      throw new Error(`No launchable items found in organization '${targetOrg.title}'`);
    }

    return {
      url: launchableItem.launchUrl!,
      file: launchableItem.resourceHref
    };
  }

  private async listAvailableFiles(directory: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(directory, { recursive: true });
      return files.slice(0, 20); // Limit for readability
    } catch {
      return [];
    }
  }

  private async listFilesInDirectory(directory: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(directory);
      return files.filter(file => {
        const filePath = path.join(directory, file);
        return fs.statSync(filePath).isFile();
      });
    } catch {
      return [];
    }
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

  async getPackageInfo(packageUrl: string, courseId: string): Promise<EnhancedScormPackageInfo> {
    return await this.processScormPackage(packageUrl, courseId);
  }

  // Get specific item launch URL (for multi-SCO support)
  async getItemLaunchUrl(packageUrl: string, courseId: string, organizationId: string, itemId: string): Promise<string | null> {
    const packageInfo = await this.processScormPackage(packageUrl, courseId);
    
    const org = packageInfo.organizations.find(o => o.id === organizationId);
    if (!org) return null;
    
    const item = org.items.find(i => i.id === itemId);
    if (!item) return null;
    
    return item.launchUrl || null;
  }
}