/**
 * @fileoverview Defines validation schemas for authentication routes.
 * @module validations/auth
 */

const { Joi } = require('celebrate');

/**
 * The validation schema for user registration.
 * @type {object}
 */
const register = {
  body: Joi.object().keys({
    email: Joi.string().required().email().messages({
      'string.base': 'validation.email.base',
      'string.empty': 'validation.email.empty',
      'string.email': 'validation.email.invalid',
      'any.required': 'validation.email.required',
    }),
    password: Joi.string().required().messages({
      'string.base': 'validation.password.base',
      'string.empty': 'validation.password.empty',
      'any.required': 'validation.password.required',
    }),
    name: Joi.string().required().messages({
      'string.base': 'validation.name.base',
      'string.empty': 'validation.name.empty',
      'any.required': 'validation.name.required',
    }),
    role: Joi.string().required().valid('client', 'provider').messages({
      'string.base': 'validation.role.base',
      'string.empty': 'validation.role.empty',
      'any.only': 'validation.role.invalid',
      'any.required': 'validation.role.required',
    }),
  }),
};

/**
 * The validation schema for user login.
 * @type {object}
 */
const login = {
  body: Joi.object().keys({
    email: Joi.string().required().email().messages({
      'string.base': 'validation.email.base',
      'string.empty': 'validation.email.empty',
      'string.email': 'validation.email.invalid',
      'any.required': 'validation.email.required',
    }),
    password: Joi.string().required().messages({
      'string.base': 'validation.password.base',
      'string.empty': 'validation.password.empty',
      'any.required': 'validation.password.required',
    }),
  }),
};

const forgotPassword = {
    body: Joi.object().keys({
        email: Joi.string().email().required(),
    }),
};

const resetPassword = {
    query: Joi.object().keys({
        token: Joi.string().required(),
    }),
    body: Joi.object().keys({
        password: Joi.string().required(),
    }),
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
};
