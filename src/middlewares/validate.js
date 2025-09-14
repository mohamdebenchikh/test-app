/**
 * @fileoverview Validation middleware using Joi and Celebrate.
 * @module middlewares/validate
 */

const { celebrate } = require("celebrate");

/**
 * Creates a validation middleware using the provided Joi schema.
 * @function validate
 * @param {object} schema - The Joi validation schema.
 * @param {object} [options={}] - Options for Celebrate.
 * @returns {function} - The validation middleware.
 */
function validate(schema,options = {}) {
  return celebrate(schema, {
    abortEarly: false, // return all errors, not just the first
    stripUnknown: true, // remove extra fields not in schema
    allowUnknown: false, // be explicit
    ...options
  });
}

module.exports = validate;
