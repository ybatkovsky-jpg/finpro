/**
 * Structured Logger for FinPro
 * - Production: JSON format
 * - Development: human-readable with colors
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
};

const RESET = '\x1b[0m';

const isProduction = process.env.NODE_ENV === 'production';

function getMinLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (envLevel && envLevel in LEVEL_PRIORITY) return envLevel;
  return isProduction ? 'info' : 'debug';
}

const minLevel = getMinLevel();

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatNumber(num: number): string {
  return num.toString().padStart(2, '0');
}

function formatTimestampHuman(): string {
  const now = new Date();
  return `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}:${formatNumber(now.getSeconds())}.${now.getMilliseconds().toString().padStart(3, '0')}`;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const timestamp = formatTimestamp();

  if (isProduction) {
    // JSON format for production
    const entry: LogEntry = { timestamp, level, message };
    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }
    const output = JSON.stringify(entry);

    if (level === 'error') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  } else {
    // Human-readable format for development
    const color = COLORS[level];
    const levelTag = level.toUpperCase().padEnd(5);
    const timeStr = formatTimestampHuman();
    let line = `${color}${levelTag}${RESET} [${timeStr}] ${message}`;

    if (context && Object.keys(context).length > 0) {
      line += ` ${JSON.stringify(context)}`;
    }

    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
};
