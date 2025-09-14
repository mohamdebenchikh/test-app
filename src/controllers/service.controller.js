const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { serviceService } = require('../services');

const getServices = catchAsync(async (req, res) => {
  const services = await serviceService.getServices();
  res.send(services);
});

module.exports = {
  getServices,
};
