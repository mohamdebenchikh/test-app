const { ServiceRequest, User, Service, City } = require('../models');
const httpStatus = require('http-status').default;
const ApiError = require('../utils/ApiError');
const { createServiceRequestNotifications } = require('./notification.service');

/**
 * Create a service request
 * @param {Object} serviceRequestBody
 * @returns {Promise<ServiceRequest>}
 */
const createServiceRequest = async (serviceRequestBody) => {
  // Verify that the client exists and is a client
  const client = await User.findByPk(serviceRequestBody.client_id);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  if (client.role !== 'client') {
    throw new ApiError(httpStatus.FORBIDDEN, 'User is not a client');
  }

  // Verify that the service exists
  const service = await Service.findByPk(serviceRequestBody.service_id);
  if (!service) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service not found');
  }

  // Verify that the city exists
  const city = await City.findByPk(serviceRequestBody.city_id);
  if (!city) {
    throw new ApiError(httpStatus.NOT_FOUND, 'City not found');
  }

  // Create the service request
  const serviceRequest = await ServiceRequest.create(serviceRequestBody);
  
  // Create notifications for providers in the same city with the same service
  await createServiceRequestNotifications(serviceRequest);
  
  return serviceRequest;
};

/**
 * Query for service requests
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryServiceRequests = async (filter, options) => {
  const serviceRequests = await ServiceRequest.findAll({
    where: filter,
    limit: options.limit,
    offset: options.page ? (options.page - 1) * options.limit : 0,
    order: options.sortBy ? [[options.sortBy, 'ASC']] : [['createdAt', 'ASC']]
  });
  return serviceRequests;
};

/**
 * Get service request by id
 * @param {ObjectId} id
 * @returns {Promise<ServiceRequest>}
 */
const getServiceRequestById = async (id) => {
  return ServiceRequest.findByPk(id, {
    include: [
      { model: User, as: 'client', attributes: ['id', 'name', 'email', 'avatar'] },
      { model: Service, attributes: ['id', 'image', 'icon'] },
      { model: City, attributes: ['id', 'name_en', 'name_ar', 'name_fr'] }
    ]
  });
};

/**
 * Get service requests by client id
 * @param {string} clientId
 * @returns {Promise<ServiceRequest[]>}
 */
const getServiceRequestsByClientId = async (clientId) => {
  return ServiceRequest.findAll({
    where: { client_id: clientId },
    include: [
      { model: User, as: 'client', attributes: ['id', 'name', 'email', 'avatar'] },
      { model: Service, attributes: ['id', 'image', 'icon'] },
      { model: City, attributes: ['id', 'name_en', 'name_ar', 'name_fr'] }
    ]
  });
};

/**
 * Update service request by id
 * @param {ObjectId} serviceRequestId
 * @param {Object} updateBody
 * @returns {Promise<ServiceRequest>}
 */
const updateServiceRequestById = async (serviceRequestId, updateBody) => {
  const serviceRequest = await getServiceRequestById(serviceRequestId);
  if (!serviceRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service request not found');
  }
  
  // Verify that the service exists if being updated
  if (updateBody.service_id) {
    const service = await Service.findByPk(updateBody.service_id);
    if (!service) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Service not found');
    }
  }

  // Verify that the city exists if being updated
  if (updateBody.city_id) {
    const city = await City.findByPk(updateBody.city_id);
    if (!city) {
      throw new ApiError(httpStatus.NOT_FOUND, 'City not found');
    }
  }

  Object.assign(serviceRequest, updateBody);
  await serviceRequest.save();
  return serviceRequest;
};

/**
 * Delete service request by id
 * @param {ObjectId} serviceRequestId
 * @returns {Promise<ServiceRequest>}
 */
const deleteServiceRequestById = async (serviceRequestId) => {
  const serviceRequest = await getServiceRequestById(serviceRequestId);
  if (!serviceRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service request not found');
  }
  await serviceRequest.destroy();
  return serviceRequest;
};

module.exports = {
  createServiceRequest,
  queryServiceRequests,
  getServiceRequestById,
  getServiceRequestsByClientId,
  updateServiceRequestById,
  deleteServiceRequestById,
};