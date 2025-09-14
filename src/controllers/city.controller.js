const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { cityService } = require('../services');

const getCities = catchAsync(async (req, res) => {
  const cities = await cityService.getCities();
  res.send(cities);
});

module.exports = {
  getCities,
};
