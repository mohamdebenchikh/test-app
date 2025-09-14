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

module.exports = {
  updateProfile,
  changePassword,
};
