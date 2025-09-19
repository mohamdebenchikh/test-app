const { Joi } = require('celebrate');

const updateProfile = {
  body: Joi.object().keys({
    name: Joi.string(),
    bio: Joi.string(),
    phone_number: Joi.string(),
    gender: Joi.string().valid('male', 'female', 'other'),
    birthdate: Joi.date(),
    available_days: Joi.object(),
    language: Joi.string().valid('en', 'ar', 'fr'),
    city_id: Joi.string().uuid(),
  }),
};

const changePassword = {
  body: Joi.object().keys({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().required(),
  }),
};

const deleteUser = {
  body: Joi.object().keys({
    password: Joi.string().required(),
  }),
};

const browseProviders = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    serviceId: Joi.string().uuid(),
    cityId: Joi.string().uuid(),
    name: Joi.string(),
    online_status: Joi.string().valid('online', 'offline', 'away', 'dnd'),
    last_seen: Joi.string().pattern(/^\d+[hmd]$/), // e.g., "1h", "24h", "7d"
    active_within: Joi.string().pattern(/^\d+[hmd]$/), // e.g., "1h", "24h", "7d"
  }),
};

const browseClients = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    cityId: Joi.string().uuid(),
    name: Joi.string(),
  }),
};

module.exports = {
  updateProfile,
  changePassword,
  deleteUser,
  browseProviders,
  browseClients,
};