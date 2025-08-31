import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";
import { nanoid } from "nanoid";
// @ts-ignore - yauzl doesn't have types
import * as yauzl from "yauzl";
import { ObjectStorageService } from "../objectStorage";

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

export interface ScormPackageValidation {
  packageId: string;
  manifestFound: boolean;
  launchFileFound: boolean;
  launchFileCanOpen: boolean;
  launchFilePath: string;
  errors: string[];
  status: 'valid' | 'draft' | 'error';
}

export interface ScormPackageInfo {
  packageId: string;
  title: string;
  description?: string;
  version: string;
  launchFilePath: string;
  rootPath: string;
  validation: ScormPackageValidation;
}

export class ScormPreviewService {
  private readonly dataPath = path.join(process.cwd(), 'temp', 'scorm-packages');
  
  constructor() {
    // Ensure data directory exists
    mkdirp.mkdirpSync(this.dataPath);
  }

  /**
   * Process uploaded SCORM package and return package info with validation
   */
  async processUpload(packageUrl: string): Promise<ScormPackageInfo> {
    const packageId = nanoid();
    const packagePath = path.join(this.dataPath, packageId);
    
    console.log(`📦 Processing SCORM upload with package ID: ${packageId}`);
    
    try {
      // Create package directory
      await mkdirp.mkdirp(packagePath);
      
      // Download the package
      const zipPath = await this.downloadPackage(packageUrl, packagePath);
      
      // Extract the package
      await this.extractPackage(zipPath, packagePath);
      
      // Clean up zip file
      await fs.promises.unlink(zipPath);
      
      // Find and validate the package
      const validation = await this.validatePackage(packageId, packagePath);
      
      // Parse manifest for metadata
      const metadata = await this.parseManifestMetadata(packagePath, validation.launchFilePath);
      
      const packageInfo: ScormPackageInfo = {
        packageId,
        title: metadata.title || `SCORM Package ${packageId}`,
        description: metadata.description,
        version: metadata.version || '1.2',
        launchFilePath: validation.launchFilePath,
        rootPath: packagePath,
        validation
      };
      
      console.log(`✅ SCORM package processed successfully: ${packageId}`);
      return packageInfo;
      
    } catch (error) {
      console.error(`❌ Error processing SCORM package: ${error}`);
      
      // Clean up on error
      try {
        if (fs.existsSync(packagePath)) {
          await fs.promises.rmdir(packagePath, { recursive: true });
        }
      } catch (cleanupError) {
        console.error('Error cleaning up failed package:', cleanupError);
      }
      
      throw error;
    }
  }

  /**
   * Download package from object storage or URL
   */
  private async downloadPackage(packageUrl: string, packagePath: string): Promise<string> {
    const zipPath = path.join(packagePath, 'package.zip');
    const objectStorageService = new ObjectStorageService();
    
    try {
      // Try object storage first
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(packageUrl);
      const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
      
      const stream = objectFile.createReadStream();
      const writeStream = fs.createWriteStream(zipPath);
      
      await new Promise((resolve, reject) => {
        stream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        stream.pipe(writeStream);
      });
      
      console.log('✅ Downloaded via object storage');
      
    } catch (objectStorageError) {
      console.log('⚠️ Object storage failed, trying direct fetch');
      
      // Fallback to direct fetch
      const response = await fetch(packageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download package: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      await fs.promises.writeFile(zipPath, Buffer.from(buffer));
      console.log('✅ Downloaded via direct fetch');
    }
    
    return zipPath;
  }

  /**
   * Extract zip package maintaining folder structure
   */
  private async extractPackage(zipPath: string, extractPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err: Error | null, zipfile?: YauzlZipFile) => {
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
            zipfile.openReadStream(entry, async (err: Error | null, readStream?: NodeJS.ReadableStream) => {
              if (err || !readStream) {
                reject(err || new Error('Failed to open read stream'));
                return;
              }
              
              const filePath = path.join(extractPath, entry.fileName);
              const dirPath = path.dirname(filePath);
              
              try {
                await mkdirp.mkdirp(dirPath);
                const writeStream = fs.createWriteStream(filePath);
                readStream.pipe(writeStream);
                
                writeStream.on('close', () => {
                  zipfile.readEntry();
                });
                
                writeStream.on('error', reject);
              } catch (mkdirError) {
                reject(mkdirError);
              }
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

  /**
   * Find manifest file anywhere in the package and determine launch file
   */
  private async findManifest(packagePath: string): Promise<{ manifestPath: string | null; rootPath: string }> {
    const findManifestRecursive = async (dir: string): Promise<string | null> => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      // Check for manifest in current directory
      for (const entry of entries) {
        if (entry.isFile() && entry.name.toLowerCase() === 'imsmanifest.xml') {
          return path.join(dir, entry.name);
        }
      }
      
      // Check subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const found = await findManifestRecursive(path.join(dir, entry.name));
          if (found) return found;
        }
      }
      
      return null;
    };

    const manifestPath = await findManifestRecursive(packagePath);
    
    // Determine if everything is in a single top folder
    let rootPath = packagePath;
    if (manifestPath) {
      const manifestDir = path.dirname(manifestPath);
      const relativePath = path.relative(packagePath, manifestDir);
      
      // If manifest is not at the root level, check if it's in a single top folder
      if (relativePath) {
        const topFolder = relativePath.split(path.sep)[0];
        const topFolderPath = path.join(packagePath, topFolder);
        
        // Check if all content is in this top folder
        const rootEntries = await fs.promises.readdir(packagePath);
        if (rootEntries.length === 1 && rootEntries[0] === topFolder) {
          rootPath = topFolderPath;
          console.log(`📁 Detected single-folder package, using root: ${topFolder}`);
        }
      }
    }
    
    return { manifestPath, rootPath };
  }

  /**
   * Validate package structure and files
   */
  async validatePackage(packageId: string, packagePath: string): Promise<ScormPackageValidation> {
    const validation: ScormPackageValidation = {
      packageId,
      manifestFound: false,
      launchFileFound: false,
      launchFileCanOpen: false,
      launchFilePath: '',
      errors: [],
      status: 'error'
    };

    try {
      // Find manifest
      const { manifestPath, rootPath } = await this.findManifest(packagePath);
      
      if (!manifestPath) {
        validation.errors.push('imsmanifest.xml not found');
        validation.status = 'draft';
        return validation;
      }
      
      validation.manifestFound = true;
      
      // Parse manifest to find launch file
      const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
      const launchMatch = manifestContent.match(/href\s*=\s*["']([^"']+)["']/);
      
      if (!launchMatch) {
        validation.errors.push('Launch file not specified in manifest');
        validation.launchFilePath = 'index.html'; // Fallback
      } else {
        validation.launchFilePath = launchMatch[1];
      }
      
      // Check if launch file exists
      const launchFilePath = path.join(rootPath, validation.launchFilePath);
      if (fs.existsSync(launchFilePath)) {
        validation.launchFileFound = true;
        
        // Check if launch file can be opened/read
        try {
          await fs.promises.access(launchFilePath, fs.constants.R_OK);
          const content = await fs.promises.readFile(launchFilePath, 'utf-8');
          if (content.length > 0) {
            validation.launchFileCanOpen = true;
            validation.status = 'valid';
          } else {
            validation.errors.push('Launch file is empty');
            validation.status = 'draft';
          }
        } catch (accessError) {
          validation.errors.push('Launch file cannot be read');
          validation.status = 'draft';
        }
      } else {
        validation.errors.push(`Launch file not found: ${validation.launchFilePath}`);
        validation.status = 'draft';
      }
      
    } catch (error) {
      validation.errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      validation.status = 'error';
    }

    return validation;
  }

  /**
   * Parse manifest for metadata
   */
  private async parseManifestMetadata(packagePath: string, launchFilePath: string): Promise<{ title?: string; description?: string; version?: string }> {
    try {
      const { manifestPath } = await this.findManifest(packagePath);
      if (!manifestPath) return {};
      
      const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
      
      const titleMatch = manifestContent.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descMatch = manifestContent.match(/<description[^>]*>([^<]+)<\/description>/i);
      const versionMatch = manifestContent.match(/schemaversion\s*=\s*["']([^"']+)["']/i);
      
      return {
        title: titleMatch ? titleMatch[1].trim() : undefined,
        description: descMatch ? descMatch[1].trim() : undefined,
        version: versionMatch ? versionMatch[1].trim() : '1.2'
      };
    } catch (error) {
      console.error('Error parsing manifest metadata:', error);
      return {};
    }
  }

  /**
   * Get package info by ID
   */
  async getPackageInfo(packageId: string): Promise<ScormPackageInfo | null> {
    const packagePath = path.join(this.dataPath, packageId);
    
    if (!fs.existsSync(packagePath)) {
      return null;
    }
    
    try {
      const validation = await this.validatePackage(packageId, packagePath);
      const metadata = await this.parseManifestMetadata(packagePath, validation.launchFilePath);
      
      return {
        packageId,
        title: metadata.title || `SCORM Package ${packageId}`,
        description: metadata.description,
        version: metadata.version || '1.2',
        launchFilePath: validation.launchFilePath,
        rootPath: packagePath,
        validation
      };
    } catch (error) {
      console.error(`Error getting package info for ${packageId}:`, error);
      return null;
    }
  }

  /**
   * Serve file from package
   */
  async servePackageFile(packageId: string, filePath: string): Promise<{ content: Buffer; contentType: string } | null> {
    const packagePath = path.join(this.dataPath, packageId);
    
    if (!fs.existsSync(packagePath)) {
      return null;
    }
    
    const { rootPath } = await this.findManifest(packagePath);
    const fullFilePath = path.join(rootPath, filePath);
    
    // Security check - ensure file is within package directory
    if (!fullFilePath.startsWith(rootPath)) {
      console.warn(`Security violation: Attempted to access file outside package: ${filePath}`);
      return null;
    }
    
    if (!fs.existsSync(fullFilePath)) {
      return null;
    }
    
    try {
      const content = await fs.promises.readFile(fullFilePath);
      const contentType = this.getContentType(filePath);
      
      return { content, contentType };
    } catch (error) {
      console.error(`Error reading file ${filePath} from package ${packageId}:`, error);
      return null;
    }
  }

  /**
   * Create test "Hello" page for diagnostics
   */
  createTestPage(packageId: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>SCORM Test Page</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      padding: 40px; 
      text-align: center; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: 0;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }
    .test-container {
      background: rgba(255,255,255,0.1);
      padding: 40px;
      border-radius: 12px;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
    }
    .success { color: #4CAF50; }
    .package-id { font-family: monospace; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="test-container">
    <h1>✅ SCORM Preview Test Successful</h1>
    <p>Hello! The SCORM preview system is working correctly.</p>
    <p><strong>Package ID:</strong> <span class="package-id">${packageId}</span></p>
    <p>If you can see this page, the preview routing and file serving is functioning properly.</p>
    <p class="success">🎉 Test passed - the preview system is ready!</p>
    <small>Generated at ${new Date().toISOString()}</small>
  </div>
  <script>
    console.log('SCORM Test page loaded successfully for package: ${packageId}');
  </script>
</body>
</html>`;
  }

  /**
   * Get content type for file extension
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Delete package
   */
  async deletePackage(packageId: string): Promise<boolean> {
    const packagePath = path.join(this.dataPath, packageId);
    
    if (!fs.existsSync(packagePath)) {
      return false;
    }
    
    try {
      await fs.promises.rmdir(packagePath, { recursive: true });
      console.log(`🗑️ Deleted SCORM package: ${packageId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting package ${packageId}:`, error);
      return false;
    }
  }
}