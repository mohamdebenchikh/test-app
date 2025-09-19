const { Joi } = require('celebrate');

const createBlock = {
  body: Joi.object().keys({
    blocked_id: Joi.string().guid().required()
  })
};

module.exports = {
  createBlock
};