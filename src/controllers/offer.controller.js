/**
 * @fileoverview Offer controller for handling offer management.
 * @module controllers/offer
 */

const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { offerService } = require('../services');

const createOffer = catchAsync(async (req, res) => {
  // Add the provider_id from the authenticated user
  const offerData = { ...req.body, provider_id: req.user.sub };
  const offer = await offerService.createOffer(offerData);
  res.status(httpStatus.CREATED).send(offer);
});

const getOffersByServiceRequest = catchAsync(async (req, res) => {
  const offers = await offerService.getOffersByServiceRequestId(
    req.params.serviceRequestId,
    req.query
  );
  res.send(offers);
});

const getProviderOffers = catchAsync(async (req, res) => {
  const offers = await offerService.getOffersByProviderId(req.user.sub, req.query);
  res.send(offers);
});

const getOffer = catchAsync(async (req, res) => {
  const offer = await offerService.getOfferById(req.params.offerId);
  if (!offer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Offer not found');
  }
  res.send(offer);
});

const updateOffer = catchAsync(async (req, res) => {
  const offer = await offerService.updateOffer(req.params.offerId, req.user.sub, req.body);
  res.send(offer);
});

const deleteOffer = catchAsync(async (req, res) => {
  await offerService.deleteOffer(req.params.offerId, req.user.sub);
  res.status(httpStatus.NO_CONTENT).send();
});

const acceptOffer = catchAsync(async (req, res) => {
  const offer = await offerService.acceptOffer(req.params.offerId, req.user.sub);
  res.send(offer);
});

const rejectOffer = catchAsync(async (req, res) => {
  const offer = await offerService.rejectOffer(req.params.offerId, req.user.sub);
  res.send(offer);
});

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