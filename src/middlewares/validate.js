const { celebrate } = require("celebrate");

// General validation middleware
function validate(schema,options = {}) {
  return celebrate(schema, {
    abortEarly: false, // return all errors, not just the first
    stripUnknown: true, // remove extra fields not in schema
    allowUnknown: false, // be explicit
    ...options
  });
}

module.exports = validate;
