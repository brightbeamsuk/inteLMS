import * as fs from 'fs';
import * as path from 'path';
import { existsSync, readdirSync } from 'fs';
import { ObjectStorageService } from './objectStorage';
import * as mkdirp from 'mkdirp';
// @ts-ignore - yauzl doesn't have types
import * as yauzl from "yauzl";

// Comprehensive SCORM package diagnosis function
export async function performScormDiagnosis(courseId: string, packageUrl: string): Promise<any> {
  const extractDir = path.join(process.cwd(), 'public', 'scos', courseId);
  
  const diagnosis: any = {
    ok: false,
    reason: '',
    scormRoot: '',
    manifestFound: false,
    defaultOrganisationId: '',
    chosenItemId: '',
    identifierref: '',
    resourceHref: '',
    xmlBaseManifest: '',
    xmlBaseResources: '',
    resolvedLaunchDiskPath: '',
    resolvedLaunchWebUrl: '',
    existsOnDisk: false,
    sampleTree: []
  };

  try {
    // Ensure extraction directory exists
    await mkdirp.mkdirp(extractDir);

    // Download and extract package if not already done
    const zipPath = await downloadPackageForDiagnosis(packageUrl, extractDir);
    await extractZipForDiagnosis(zipPath, extractDir);

    // Build sample tree (limit to ~50 entries)
    diagnosis.sampleTree = await buildSampleTree(extractDir, 50);

    // A. Find manifest recursively
    const manifestPath = await findManifestRecursively(extractDir);
    if (!manifestPath) {
      diagnosis.reason = 'No imsmanifest.xml found in SCORM package';
      return diagnosis;
    }

    diagnosis.manifestFound = true;
    diagnosis.scormRoot = path.dirname(manifestPath);

    // B. Parse manifest content
    const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
    
    // Extract XML base from manifest
    const manifestBaseMatch = manifestContent.match(/<manifest[^>]*xml:base\s*=\s*["']([^"']+)["']/i);
    diagnosis.xmlBaseManifest = manifestBaseMatch ? manifestBaseMatch[1] : '';

    // Extract XML base from resources section
    const resourcesBaseMatch = manifestContent.match(/<resources[^>]*xml:base\s*=\s*["']([^"']+)["']/i);
    diagnosis.xmlBaseResources = resourcesBaseMatch ? resourcesBaseMatch[1] : '';

    // Find default organization
    const defaultOrgMatch = manifestContent.match(/<organizations[^>]*default\s*=\s*["']([^"']+)["']/i);
    let defaultOrgId = defaultOrgMatch ? defaultOrgMatch[1] : '';

    if (!defaultOrgId) {
      // Use first organization
      const firstOrgMatch = manifestContent.match(/<organization[^>]*identifier\s*=\s*["']([^"']+)["']/i);
      defaultOrgId = firstOrgMatch ? firstOrgMatch[1] : '';
    }

    if (!defaultOrgId) {
      diagnosis.reason = 'No organizations found in manifest';
      return diagnosis;
    }

    diagnosis.defaultOrganisationId = defaultOrgId;

    // C. Find organization content and first item with identifierref
    const orgPattern = new RegExp(`<organization[^>]*identifier\\s*=\\s*["']${defaultOrgId}["'][^>]*>([\\s\\S]*?)</organization>`, 'i');
    const orgMatch = manifestContent.match(orgPattern);
    
    if (!orgMatch) {
      diagnosis.reason = `Organization '${defaultOrgId}' not found in manifest`;
      return diagnosis;
    }

    const orgContent = orgMatch[1];
    
    // Find first item with identifierref
    const itemMatch = orgContent.match(/<item[^>]*identifier\s*=\s*["']([^"']+)["'][^>]*identifierref\s*=\s*["']([^"']+)["']/i);
    if (!itemMatch) {
      diagnosis.reason = `No item with identifierref found in organization '${defaultOrgId}'`;
      return diagnosis;
    }

    diagnosis.chosenItemId = itemMatch[1];
    diagnosis.identifierref = itemMatch[2];

    // D. Find resource with matching identifier
    const resourcePattern = new RegExp(`<resource[^>]*identifier\\s*=\\s*["']${diagnosis.identifierref}["'][^>]*>`, 'i');
    const resourceMatch = manifestContent.match(resourcePattern);
    
    if (!resourceMatch) {
      diagnosis.reason = `Resource with identifier '${diagnosis.identifierref}' not found`;
      return diagnosis;
    }

    // Extract href (prefer adlcp:href over href)
    const adlcpHrefMatch = resourceMatch[0].match(/adlcp:href\s*=\s*["']([^"']+)["']/i);
    const hrefMatch = resourceMatch[0].match(/href\s*=\s*["']([^"']+)["']/i);
    
    diagnosis.resourceHref = adlcpHrefMatch ? adlcpHrefMatch[1] : (hrefMatch ? hrefMatch[1] : '');

    if (!diagnosis.resourceHref) {
      diagnosis.reason = `No href found in resource '${diagnosis.identifierref}'`;
      return diagnosis;
    }

    // E. Build resolved launch path
    let resolvedPath = diagnosis.resourceHref;
    
    // Prepend base paths
    if (diagnosis.xmlBaseResources) {
      resolvedPath = path.posix.join(diagnosis.xmlBaseResources, resolvedPath);
    }
    if (diagnosis.xmlBaseManifest) {
      resolvedPath = path.posix.join(diagnosis.xmlBaseManifest, resolvedPath);
    }

    diagnosis.resolvedLaunchDiskPath = path.join(diagnosis.scormRoot, resolvedPath);
    diagnosis.resolvedLaunchWebUrl = `/scos/${courseId}/${resolvedPath.replace(/\\/g, '/')}`;

    // F. Check if file exists on disk
    diagnosis.existsOnDisk = existsSync(diagnosis.resolvedLaunchDiskPath);

    if (!diagnosis.existsOnDisk) {
      // Try fallbacks in the same directory
      const resourceDir = path.dirname(diagnosis.resolvedLaunchDiskPath);
      const fallbacks = ['index_lms.html', 'story.html', 'index.html'];
      
      let found = false;
      for (const fallback of fallbacks) {
        const fallbackPath = path.join(resourceDir, fallback);
        if (existsSync(fallbackPath)) {
          diagnosis.resolvedLaunchDiskPath = fallbackPath;
          diagnosis.resolvedLaunchWebUrl = `/scos/${courseId}/${path.relative(path.join(extractDir), fallbackPath).replace(/\\/g, '/')}`;
          diagnosis.existsOnDisk = true;
          diagnosis.reason = `Using fallback file: ${fallback} (original ${diagnosis.resourceHref} not found)`;
          found = true;
          break;
        }
      }

      if (!found) {
        const availableFiles = existsSync(resourceDir) ? readdirSync(resourceDir) : [];
        diagnosis.reason = `Launch file not found: ${resolvedPath}. Available files in directory: ${availableFiles.join(', ')}`;
        return diagnosis;
      }
    }

    diagnosis.ok = true;
    diagnosis.reason = diagnosis.reason || 'SCORM package successfully analyzed';
    
    return diagnosis;

  } catch (error: any) {
    diagnosis.reason = `Analysis failed: ${error.message}`;
    return diagnosis;
  }
}

async function downloadPackageForDiagnosis(packageUrl: string, extractDir: string): Promise<string> {
  const zipPath = path.join(extractDir, 'package.zip');
  
  // Skip download if file already exists
  if (existsSync(zipPath)) {
    return zipPath;
  }

  try {
    const objectStorageService = new ObjectStorageService();
    const normalizedPath = objectStorageService.normalizeObjectEntityPath(packageUrl);
    const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
    
    const stream = objectFile.createReadStream();
    const writeStream = require('fs').createWriteStream(zipPath);
    
    await new Promise<void>((resolve, reject) => {
      stream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
      stream.pipe(writeStream);
    });
    
    return zipPath;
  } catch (objectStorageError) {
    // Try direct fetch as fallback
    const response = await fetch(packageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    await require('fs/promises').writeFile(zipPath, Buffer.from(buffer));
    
    return zipPath;
  }
}

async function extractZipForDiagnosis(zipPath: string, extractDir: string): Promise<void> {
  // Skip extraction if already done
  const manifestPath = path.join(extractDir, 'imsmanifest.xml');
  if (existsSync(manifestPath)) {
    return;
  }

  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err: any, zipfile: any) => {
      if (err) {
        reject(new Error(`Invalid zip file: ${err.message}`));
        return;
      }
      
      zipfile.readEntry();
      
      zipfile.on("entry", (entry: any) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory
          zipfile.readEntry();
        } else {
          // File
          zipfile.openReadStream(entry, (err: any, readStream: any) => {
            if (err) {
              reject(err);
              return;
            }
            
            const filePath = path.join(extractDir, entry.fileName);
            const dirPath = path.dirname(filePath);
            
            mkdirp.mkdirp(dirPath).then(() => {
              const writeStream = require('fs').createWriteStream(filePath);
              readStream.pipe(writeStream);
              
              writeStream.on('close', () => {
                zipfile.readEntry();
              });
              
              writeStream.on('error', reject);
            }).catch(reject);
          });
        }
      });
      
      zipfile.on("end", resolve);
      zipfile.on("error", reject);
    });
  });
}

async function findManifestRecursively(dir: string): Promise<string | null> {
  const findRecursive = async (currentDir: string): Promise<string[]> => {
    const results: string[] = [];
    const items = readdirSync(currentDir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      if (item.isDirectory()) {
        const subResults = await findRecursive(fullPath);
        results.push(...subResults);
      } else if (item.name.toLowerCase() === 'imsmanifest.xml') {
        results.push(fullPath);
      }
    }
    
    return results;
  };

  const manifestPaths = await findRecursive(dir);
  return manifestPaths.length > 0 ? manifestPaths[0] : null;
}

async function buildSampleTree(dir: string, maxEntries: number): Promise<string[]> {
  const tree: string[] = [];
  
  const addToTree = (currentDir: string, prefix: string = '', depth: number = 0) => {
    if (tree.length >= maxEntries || depth > 5) return;
    
    try {
      const items = readdirSync(currentDir, { withFileTypes: true });
      
      for (const item of items.slice(0, Math.max(1, Math.floor((maxEntries - tree.length) / Math.max(1, items.length))))) {
        if (tree.length >= maxEntries) break;
        
        const relativePath = path.relative(dir, path.join(currentDir, item.name));
        if (item.isDirectory()) {
          tree.push(`${relativePath}/`);
          addToTree(path.join(currentDir, item.name), `${prefix}  `, depth + 1);
        } else {
          tree.push(relativePath);
        }
      }
    } catch (e) {
      // Skip directories that can't be read
    }
  };

  addToTree(dir);
  return tree.slice(0, maxEntries);
}