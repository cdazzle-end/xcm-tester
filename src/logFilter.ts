
/**
 * This file is used to filter out unecessary messages from the polkadot.js APIs
 * 
 * Imported at the top of the main file, will filter out messages that contain 'API/INIT' or 'RPC methods not decorated' or any other messages specified in the shouldFilter function
 */

import util from 'util';

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

function shouldFilter(chunk: string): boolean {
  return chunk.includes('API/INIT') || 
    chunk.includes('RPC methods not decorated') || 
    chunk.includes('REGISTRY: Unknown signed extensions') ||
    chunk.includes('RPC methods not decorated') ||
    chunk.includes('has multiple versions, ensure that there is only one installed') ||
    chunk.includes('Either remove and explicitly install matching versions or dedupe using your package manager') ||
    chunk.includes('The following conflicting packages were found:') ||
    chunk.includes('node_modules/.pnpm/@polkadot');
}

function createFilteredWrite(originalWrite: typeof process.stdout.write) {
  return function(
    this: NodeJS.WriteStream,
    chunk: Uint8Array | string,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void
  ): boolean {
    const stringChunk = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk;
    if (!shouldFilter(stringChunk.toString())) {
      return originalWrite.apply(this, arguments as any);
    }
    if (typeof encodingOrCallback === 'function') {
      encodingOrCallback();
    } else if (callback) {
      callback();
    }
    return true;
  };
}

// Monkey-patch process.stdout.write and process.stderr.write
process.stdout.write = createFilteredWrite(originalStdoutWrite) as any;
process.stderr.write = createFilteredWrite(originalStderrWrite) as any;

// Monkey-patch console methods
function createFilteredConsoleMethod(originalMethod: typeof console.log) {
  return function(this: Console, ...args: any[]): void {
    const msg = util.format(...args);
    if (!shouldFilter(msg)) {
      originalMethod.apply(this, args);
    }
  };
}

console.log = createFilteredConsoleMethod(originalConsoleLog);
console.info = createFilteredConsoleMethod(originalConsoleInfo);
console.warn = createFilteredConsoleMethod(originalConsoleWarn);
console.error = createFilteredConsoleMethod(originalConsoleError);