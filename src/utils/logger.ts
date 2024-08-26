import winston from 'winston';

// Define your custom formats
const formats = {
    main: winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    }),
    database: winston.format.printf(({ level, message, timestamp }) => {
      return `[DB] ${timestamp} ${level}: ${message}`;
    }),
    api: winston.format.printf(({ level, message, timestamp }) => {
      return `[API] ${timestamp} ${level}: ${message}`;
    })
  };

export const pathLogger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    defaultMeta: { service: 'user-service' },
    transports: [
      //
      // - Write all logs with importance level of `error` or less to `error.log`
      // - Write all logs with importance level of `info` or less to `combined.log`
      //
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: './logs/path.log' }),
    //   new winston.transports.Console(),
    ],
  });

  export const nodeLogger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    defaultMeta: { service: 'user-service' },
    transports: [
      //
      // - Write all logs with importance level of `error` or less to `error.log`
      // - Write all logs with importance level of `info` or less to `combined.log`
      //
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: './logs/nodes.log' }),
    //   new winston.transports.Console(),
    ],
  });
  
  // Create separate loggers for different parts of your application
export const mainLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      formats.main
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/main.log' })
    ]
  });

  export const instructionLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      formats.main
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/instruction.log' })
    ]
  });
  
  export const dbLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      formats.database
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/database.log' })
    ]
  });
  
  export const apiLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      formats.api
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/api.log' })
    ]
  });