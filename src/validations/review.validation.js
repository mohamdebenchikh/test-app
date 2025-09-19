const { Joi } = require('celebrate');

const createReview = {
  body: Joi.object().keys({
    stars: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().optional().allow(null, ''),
    provider_id: Joi.string().guid().required()
  })
};

const updateReview = {
  body: Joi.object().keys({
    stars: Joi.number().integer().min(1).max(5).optional(),
    comment: Joi.string().optional().allow(null, '')
  })
};

module.exports = {
  createReview,
  updateReview
};