const { Joi } = require('celebrate');

const createServiceRequest = {
  body: Joi.object().keys({
    title: Joi.string().required(),
    description: Joi.string().required(),
    start_price: Joi.number().positive().required(),
    due_date: Joi.date().greater('now').required(),
    service_id: Joi.string().uuid().required(),
    city_id: Joi.string().uuid().required(),
  }),
};

const updateServiceRequest = {
  body: Joi.object().keys({
    title: Joi.string(),
    description: Joi.string(),
    start_price: Joi.number().positive(),
    due_date: Joi.date().greater('now'),
    service_id: Joi.string().uuid(),
    city_id: Joi.string().uuid(),
  }),
};

module.exports = {
  createServiceRequest,
  updateServiceRequest,
};