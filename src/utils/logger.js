const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const fs = require('fs');
const config = require('../config/logger');

const { logDir, datePattern, zippedArchive, maxSize, maxFiles } = config;

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = createLogger({
  level: config.level,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, stack }) => `${timestamp} ${level}: ${stack || message}`)
      ),
    }),
    new transports.DailyRotateFile({
      level: 'error',
      filename: `${logDir}/error-%DATE%.log`,
      datePattern,
      zippedArchive,
      maxSize,
      maxFiles,
    }),
    new transports.DailyRotateFile({
      filename: `${logDir}/combined-%DATE%.log`,
      datePattern,
      zippedArchive,
      maxSize,
      maxFiles,
    }),
  ],
  exceptionHandlers: [
    new transports.DailyRotateFile({
      filename: `${logDir}/exceptions-%DATE%.log`,
      datePattern,
      zippedArchive,
      maxSize,
      maxFiles,
    }),
  ],
  rejectionHandlers: [
    new transports.DailyRotateFile({
      filename: `${logDir}/rejections-%DATE%.log`,
      datePattern,
      zippedArchive,
      maxSize,
      maxFiles,
    }),
  ],
  exitOnError: false,
});

if (process.env.NODE_ENV === 'production') {
  logger.remove(logger.transports.find(t => t.name === 'console'));
}

module.exports = logger;
