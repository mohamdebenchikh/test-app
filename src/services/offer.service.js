const { Offer, ServiceRequest, User, Service, City } = require('../models');
const httpStatus = require('http-status').default;
const ApiError = require('../utils/ApiError');
const { createOfferNotification } = require('./notification.service');

/**
 * Create an offer
 * @param {Object} offerBody
 * @returns {Promise<Offer>}
 */
const createOffer = async (offerBody) => {
  // Verify that the service request exists
  const serviceRequest = await ServiceRequest.findByPk(offerBody.service_request_id, {
    include: [
      { model: User, as: 'client', attributes: ['id', 'name', 'email'] }
    ]
  });
  if (!serviceRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service request not found');
  }

  // Verify that the provider exists and is a provider
  const provider = await User.findByPk(offerBody.provider_id);
  if (!provider) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Provider not found');
  }
  if (provider.role !== 'provider') {
    throw new ApiError(httpStatus.FORBIDDEN, 'User is not a provider');
  }

  // Check if provider already has an offer for this service request
  const existingOffer = await Offer.findOne({
    where: {
      service_request_id: offerBody.service_request_id,
      provider_id: offerBody.provider_id
    }
  });
  if (existingOffer) {
    throw new ApiError(httpStatus.CONFLICT, 'Provider already has an offer for this service request');
  }

  // Prevent provider from making offer on their own service request
  if (serviceRequest.client_id === offerBody.provider_id) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Cannot make offer on your own service request');
  }

  // Create the offer
  const offer = await Offer.create(offerBody);

  // Create notification for the client
  await createOfferNotification(offer, serviceRequest, provider);

  return offer;
};

/**
 * Get offers for a service request
 * @param {string} serviceRequestId
 * @param {Object} options - Query options
 * @returns {Promise<Offer[]>}
 */
const getOffersByServiceRequestId = async (serviceRequestId, options = {}) => {
  const { limit = 10, offset = 0, status } = options;
  
  const whereClause = { service_request_id: serviceRequestId };
  if (status) {
    whereClause.status = status;
  }
  
  return Offer.findAll({
    where: whereClause,
    include: [
      { 
        model: User, 
        as: 'provider', 
        attributes: ['id', 'name', 'email', 'avatar', 'bio'] 
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });
};

/**
 * Get offers by provider
 * @param {string} providerId
 * @param {Object} options - Query options
 * @returns {Promise<Offer[]>}
 */
const getOffersByProviderId = async (providerId, options = {}) => {
  const { limit = 10, offset = 0, status } = options;
  
  const whereClause = { provider_id: providerId };
  if (status) {
    whereClause.status = status;
  }
  
  return Offer.findAll({
    where: whereClause,
    include: [
      { 
        model: ServiceRequest, 
        as: 'serviceRequest',
        include: [
          { model: User, as: 'client', attributes: ['id', 'name', 'email'] },
          { model: Service, attributes: ['id', 'image', 'icon'] },
          { model: City, attributes: ['id', 'name_en', 'name_ar', 'name_fr'] }
        ]
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });
};

/**
 * Get offer by id
 * @param {string} offerId
 * @returns {Promise<Offer>}
 */
const getOfferById = async (offerId) => {
  return Offer.findByPk(offerId, {
    include: [
      { 
        model: User, 
        as: 'provider', 
        attributes: ['id', 'name', 'email', 'avatar', 'bio'] 
      },
      { 
        model: ServiceRequest, 
        as: 'serviceRequest',
        include: [
          { model: User, as: 'client', attributes: ['id', 'name', 'email'] }
        ]
      }
    ]
  });
};

/**
 * Accept an offer
 * @param {string} offerId
 * @param {string} clientId
 * @returns {Promise<Offer>}
 */
const acceptOffer = async (offerId, clientId) => {
  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Offer not found');
  }

  // Verify that the client owns the service request
  if (offer.serviceRequest.client_id !== clientId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to accept this offer');
  }

  // Check if offer is still pending
  if (offer.status !== 'pending') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Offer is no longer pending');
  }

  // Accept the offer
  offer.status = 'accepted';
  await offer.save();

  // Reject all other offers for this service request
  await Offer.update(
    { status: 'rejected' },
    { 
      where: { 
        service_request_id: offer.service_request_id,
        id: { [require('sequelize').Op.ne]: offerId },
        status: 'pending'
      } 
    }
  );

  return offer;
};

/**
 * Reject an offer
 * @param {string} offerId
 * @param {string} clientId
 * @returns {Promise<Offer>}
 */
const rejectOffer = async (offerId, clientId) => {
  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Offer not found');
  }

  // Verify that the client owns the service request
  if (offer.serviceRequest.client_id !== clientId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to reject this offer');
  }

  // Check if offer is still pending
  if (offer.status !== 'pending') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Offer is no longer pending');
  }

  // Reject the offer
  offer.status = 'rejected';
  await offer.save();

  return offer;
};

/**
 * Update an offer (only if still pending)
 * @param {string} offerId
 * @param {string} providerId
 * @param {Object} updateBody
 * @returns {Promise<Offer>}
 */
const updateOffer = async (offerId, providerId, updateBody) => {
  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Offer not found');
  }

  // Verify that the provider owns the offer
  if (offer.provider_id !== providerId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to update this offer');
  }

  // Check if offer is still pending
  if (offer.status !== 'pending') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot update offer that is no longer pending');
  }

  // Update allowed fields only
  const allowedFields = ['price', 'description', 'estimated_completion', 'expires_at'];
  const updateData = {};
  
  allowedFields.forEach(field => {
    if (updateBody[field] !== undefined) {
      updateData[field] = updateBody[field];
    }
  });

  Object.assign(offer, updateData);
  await offer.save();

  return offer;
};

/**
 * Delete an offer (only if still pending)
 * @param {string} offerId
 * @param {string} providerId
 * @returns {Promise<void>}
 */
const deleteOffer = async (offerId, providerId) => {
  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Offer not found');
  }

  // Verify that the provider owns the offer
  if (offer.provider_id !== providerId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to delete this offer');
  }

  // Check if offer is still pending
  if (offer.status !== 'pending') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete offer that is no longer pending');
  }

  await offer.destroy();
};

module.exports = {
  createOffer,
  getOffersByServiceRequestId,
  getOffersByProviderId,
  getOfferById,
  acceptOffer,
  rejectOffer,
  updateOffer,
  deleteOffer
};