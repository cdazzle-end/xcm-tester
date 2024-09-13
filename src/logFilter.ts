import util from 'util';

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;

// Function to filter unwanted messages
function shouldFilter(chunk: string): boolean {
  return chunk.includes('API/INIT') || chunk.includes('RPC methods not decorated');
}

// Monkey-patch process.stdout.write
const newStdoutWrite = function(
  this: NodeJS.WriteStream,
  chunk: Uint8Array | string,
  encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
  callback?: (error?: Error | null) => void
): boolean {
  const stringChunk = chunk.toString();
  if (!shouldFilter(stringChunk)) {
    return originalStdoutWrite.call(this, chunk, encodingOrCallback as any, callback as any);
  }
  // If it's filtered, we still need to handle the callback
  if (typeof encodingOrCallback === 'function') {
    encodingOrCallback();
  } else if (callback) {
    callback();
  }
  return true;
} as typeof process.stdout.write;

process.stdout.write = newStdoutWrite;

// Monkey-patch console.log and console.info
console.log = function (...args: any[]): void {
  const msg = util.format(...args);
  if (!shouldFilter(msg)) {
    originalConsoleLog.apply(console, args);
  }
};

console.info = function (...args: any[]): void {
  const msg = util.format(...args);
  if (!shouldFilter(msg)) {
    originalConsoleInfo.apply(console, args);
  }
};

// Optionally, if you want to keep error logs unfiltered:
// console.error remains unchanged