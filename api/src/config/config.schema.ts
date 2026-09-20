import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Application Port
  PORT: Joi.number().default(3000),

  // Database Connection Settings
  DB_HOST: Joi.string().required().messages({
    'any.required': 'DB_HOST is a required environment variable (e.g., localhost or mysql)',
  }),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required().messages({
    'any.required': 'DB_USERNAME is a required environment variable',
  }),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_DATABASE: Joi.string().required().messages({
    'any.required': 'DB_DATABASE is a required environment variable (e.g., message_db)',
  }),

  // Environment Mode
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
}).unknown(true); // Allow other system environment variables
