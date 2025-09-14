const { createLogger, format, transports } = require("winston");
const path = require("path");

const logger = createLogger({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info'),

    format: format.combine(
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    transports: [
        // Console output
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf(
                    ({ level, message, timestamp, stack }) =>
                        `${timestamp} ${level}: ${stack || message}`
                )
            ),
        }),

        // Save errors in file
        new transports.File({
            filename: path.join(__dirname, "../../logs/error.log"),
            level: "error",
        }),

        // Save all logs in file
        new transports.File({
            filename: path.join(__dirname, "../../logs/combined.log"),
        }),
    ],
});

// In production, log only warnings and errors to console
if (process.env.NODE_ENV === "production") {
    logger.remove(logger.transports.Console);
}

module.exports = logger;
