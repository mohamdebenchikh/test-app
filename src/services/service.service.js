const { Service } = require('../models');

/**
 * Get all services
 * @returns {Promise<Service[]>}
 */
const getServices = async () => {
  return Service.findAll();
};

module.exports = {
  getServices,
};
