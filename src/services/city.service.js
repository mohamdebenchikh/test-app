const { City } = require('../models');

/**
 * Get all cities
 * @returns {Promise<City[]>}
 */
const getCities = async () => {
  return City.findAll();
};

module.exports = {
  getCities,
};
