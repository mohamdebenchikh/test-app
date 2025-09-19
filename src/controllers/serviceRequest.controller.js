/**
 * @fileoverview ServiceRequest controller for handling service request management.
 * @module controllers/serviceRequest
 */

const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { serviceRequestService } = require('../services');

const createServiceRequest = catchAsync(async (req, res) => {
  // Add the client_id from the authenticated user
  const serviceRequestData = { ...req.body, client_id: req.user.sub };
  const serviceRequest = await serviceRequestService.createServiceRequest(serviceRequestData);
  res.status(httpStatus.CREATED).send(serviceRequest);
});

const getServiceRequests = catchAsync(async (req, res) => {
  const serviceRequests = await serviceRequestService.getServiceRequestsByClientId(req.user.sub);
  res.send(serviceRequests);
});

const getServiceRequest = catchAsync(async (req, res) => {
  const serviceRequest = await serviceRequestService.getServiceRequestById(req.params.serviceRequestId);
  if (!serviceRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service request not found');
  }
  res.send(serviceRequest);
});

const updateServiceRequest = catchAsync(async (req, res) => {
  const serviceRequest = await serviceRequestService.updateServiceRequestById(req.params.serviceRequestId, req.body);
  res.send(serviceRequest);
});

const deleteServiceRequest = catchAsync(async (req, res) => {
  await serviceRequestService.deleteServiceRequestById(req.params.serviceRequestId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createServiceRequest,
  getServiceRequests,
  getServiceRequest,
  updateServiceRequest,
  deleteServiceRequest,
};