import { createWriteStream } from 'fs';
import { createReadStream, statSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';

const output = createWriteStream('azure-deploy.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

archive.pipe(output);

// Add directories and files
archive.directory('dist/', 'dist');
archive.directory('node_modules/', 'node_modules');
archive.file('package.json', { name: 'package.json' });
archive.file('package-lock.json', { name: 'package-lock.json' });

await archive.finalize();

console.log('✅ azure-deploy.zip created successfully');
console.log('Size:', Math.round(archive.pointer() / 1024 / 1024), 'MB');
