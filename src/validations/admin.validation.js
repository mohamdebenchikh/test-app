const { Joi } = require('celebrate');

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
  }),
};

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

module.exports = {
  register,
  login,
};
