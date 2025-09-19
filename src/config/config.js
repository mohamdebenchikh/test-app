const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: path.join(__dirname, '../../.env.test') });
} else {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(3000),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30).description('minutes after which access tokens expire'),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which reset password token expires'),
    SMTP_HOST: Joi.string().description('server that will send the emails'),
    SMTP_PORT: Joi.number().description('port to connect to the email server'),
    SMTP_USERNAME: Joi.string().description('username for email server'),
    SMTP_PASSWORD: Joi.string().description('password for email server'),
    EMAIL_FROM: Joi.string().description('the from field in the emails sent by the app'),
    
    // Portfolio configuration
    STORAGE_TYPE: Joi.string().valid('local', 's3').default('local').description('Storage backend type'),
    STORAGE_LOCAL_PATH: Joi.string().default('uploads/portfolio').description('Local storage path for portfolio images'),
    STORAGE_S3_BUCKET: Joi.when('STORAGE_TYPE', {
      is: 's3',
      then: Joi.string().required().description('S3 bucket name for portfolio storage'),
      otherwise: Joi.string().optional()
    }),
    STORAGE_S3_REGION: Joi.when('STORAGE_TYPE', {
      is: 's3',
      then: Joi.string().required().description('S3 region'),
      otherwise: Joi.string().optional()
    }),
    AWS_ACCESS_KEY_ID: Joi.when('STORAGE_TYPE', {
      is: 's3',
      then: Joi.string().required().description('AWS access key ID'),
      otherwise: Joi.string().optional()
    }),
    AWS_SECRET_ACCESS_KEY: Joi.when('STORAGE_TYPE', {
      is: 's3',
      then: Joi.string().required().description('AWS secret access key'),
      otherwise: Joi.string().optional()
    }),
    PORTFOLIO_MAX_IMAGES: Joi.number().default(10).description('Maximum number of images per provider portfolio'),
    PORTFOLIO_MAX_FILE_SIZE: Joi.number().default(5242880).description('Maximum file size in bytes (default 5MB)'),
    PORTFOLIO_ALLOWED_TYPES: Joi.string().default('jpeg,jpg,png,webp').description('Comma-separated list of allowed file types'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM,
  },
  portfolio: {
    storage: {
      type: envVars.STORAGE_TYPE,
      local: {
        path: envVars.STORAGE_LOCAL_PATH,
      },
      s3: {
        bucket: envVars.STORAGE_S3_BUCKET,
        region: envVars.STORAGE_S3_REGION,
        accessKeyId: envVars.AWS_ACCESS_KEY_ID,
        secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
      },
    },
    limits: {
      maxImages: envVars.PORTFOLIO_MAX_IMAGES,
      maxFileSize: envVars.PORTFOLIO_MAX_FILE_SIZE,
      allowedTypes: envVars.PORTFOLIO_ALLOWED_TYPES.split(',').map(type => type.trim()),
    },
  },
};
