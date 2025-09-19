const { Joi } = require('celebrate');

const createOffer = {
  body: Joi.object().keys({
    service_request_id: Joi.string().uuid().required(),
    price: Joi.number().positive().required(),
    description: Joi.string().max(1000).optional(),
    estimated_completion: Joi.date().greater('now').optional(),
    expires_at: Joi.date().greater('now').optional(),
  }),
};

const getOffersByServiceRequest = {
  params: Joi.object().keys({
    serviceRequestId: Joi.string().uuid().required(),
  }),
  query: Joi.object().keys({
    status: Joi.string().valid('pending', 'accepted', 'rejected').optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
  }),
};

const getProviderOffers = {
  query: Joi.object().keys({
    status: Joi.string().valid('pending', 'accepted', 'rejected').optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
  }),
};

const getOffer = {
  params: Joi.object().keys({
    offerId: Joi.string().uuid().required(),
  }),
};

const updateOffer = {
  params: Joi.object().keys({
    offerId: Joi.string().uuid().required(),
  }),
  body: Joi.object().keys({
    price: Joi.number().positive().optional(),
    description: Joi.string().max(1000).optional(),
    estimated_completion: Joi.date().greater('now').optional(),
    expires_at: Joi.date().greater('now').optional(),
  }).min(1),
};

const deleteOffer = {
  params: Joi.object().keys({
    offerId: Joi.string().uuid().required(),
  }),
};

const acceptOffer = {
  params: Joi.object().keys({
    offerId: Joi.string().uuid().required(),
  }),
};

const rejectOffer = {
  params: Joi.object().keys({
    offerId: Joi.string().uuid().required(),
  }),
};

module.exports = {
  createOffer,
  getOffersByServiceRequest,
  getProviderOffers,
  getOffer,
  updateOffer,
  deleteOffer,
  acceptOffer,
  rejectOffer,
};