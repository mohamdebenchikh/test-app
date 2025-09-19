/**
 * @fileoverview Client controller for handling client-specific operations.
 * @module controllers/client
 */

const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { userService } = require('../services');

/**
 * Browse clients with filtering and pagination
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const browseClients = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.cityId) filter.cityId = req.query.cityId;
  if (req.query.name) filter.name = req.query.name;

  const options = {
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || 10,
  };

  const result = await userService.queryClients(filter, options);
  res.send(result);
});

/**
 * Get client profile
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getClientProfile = catchAsync(async (req, res) => {
  const client = await userService.getClientProfile(req.params.clientId);
  res.send(client);
});

module.exports = {
  browseClients,
  getClientProfile
};