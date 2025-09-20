const Joi = require('joi');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');

const envVarsSchema = Joi.object()
  .keys({
    LOG_LEVEL: Joi.string()
      .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
      .default('info'),
    LOG_DIR: Joi.string().default(logDir),
    LOG_DATE_PATTERN: Joi.string().default('YYYY-MM-DD'),
    LOG_ZIPPED_ARCHIVE: Joi.boolean().default(true),
    LOG_MAX_SIZE: Joi.string().default('20m'),
    LOG_MAX_FILES: Joi.string().default('14d'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const loggerConfig = {
  level: envVars.LOG_LEVEL,
  logDir: envVars.LOG_DIR,
  datePattern: envVars.LOG_DATE_PATTERN,
  zippedArchive: envVars.LOG_ZIPPED_ARCHIVE,
  maxSize: envVars.LOG_MAX_SIZE,
  maxFiles: envVars.LOG_MAX_FILES,
};

module.exports = loggerConfig;
