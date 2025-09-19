/**
 * @fileoverview Provider controller for handling provider-specific operations.
 * @module controllers/provider
 */

const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { userService } = require('../services');

/**
 * Browse providers with filtering and pagination
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const browseProviders = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.serviceId) filter.serviceId = req.query.serviceId;
  if (req.query.cityId) filter.cityId = req.query.cityId;
  if (req.query.name) filter.name = req.query.name;
  
  // Add presence filters
  if (req.query.online_status) filter.online_status = req.query.online_status;
  if (req.query.last_seen) filter.last_seen = req.query.last_seen;
  if (req.query.active_within) filter.active_within = req.query.active_within;

  const options = {
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || 10,
  };

  const result = await userService.queryProviders(filter, options);
  res.send(result);
});

/**
 * Get provider profile
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getProviderProfile = catchAsync(async (req, res) => {
  const provider = await userService.getProviderProfile(req.params.providerId);
  res.send(provider);
});

module.exports = {
  browseProviders,
  getProviderProfile
};