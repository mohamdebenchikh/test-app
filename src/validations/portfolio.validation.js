const { Joi } = require('celebrate');

const uploadPortfolioImage = {
  body: Joi.object().keys({
    description: Joi.string().max(1000).allow('', null).optional()
  }),
};

const updateImageOrder = {
  body: Joi.object().keys({
    imageOrders: Joi.array().items(
      Joi.object().keys({
        id: Joi.string().uuid().required(),
        display_order: Joi.number().integer().min(0).required()
      })
    ).min(1).required()
  }),
};

const updateImageDescription = {
  params: Joi.object().keys({
    imageId: Joi.string().uuid().required()
  }),
  body: Joi.object().keys({
    description: Joi.string().max(1000).allow('', null)
  }),
};

const getPublicPortfolio = {
  params: Joi.object().keys({
    userId: Joi.string().uuid().required()
  }),
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).max(50).default(10),
    offset: Joi.number().integer().min(0).default(0)
  }),
};

const getPrivatePortfolio = {
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).max(50).default(10),
    offset: Joi.number().integer().min(0).default(0)
  }),
};

const deletePortfolioImage = {
  params: Joi.object().keys({
    imageId: Joi.string().uuid().required()
  }),
};

module.exports = {
  uploadPortfolioImage,
  updateImageOrder,
  updateImageDescription,
  getPublicPortfolio,
  getPrivatePortfolio,
  deletePortfolioImage,
};