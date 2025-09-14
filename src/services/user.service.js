const { User, Service } = require('../models');
const { hashPassword } = require('../utils/password');

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (userBody) => {
  const { service_ids, ...restOfBody } = userBody;
  const hashedPassword = await hashPassword(restOfBody.password);
  const user = await User.create({ ...restOfBody, password: hashedPassword });

  if (service_ids && service_ids.length > 0) {
    const services = await Service.findAll({ where: { id: service_ids } });
    await user.addServices(services);
  }

  return user;
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email) => {
  return User.findOne({ where: { email } });
};

/**
 * Add a service to a user
 * @param {string} userId
 * @param {string} serviceId
 * @returns {Promise<void>}
 */
const addServiceToUser = async (userId, serviceId) => {
    const user = await User.findByPk(userId);
    const service = await Service.findByPk(serviceId);
    await user.addService(service);
};

module.exports = {
  createUser,
  getUserByEmail,
  addServiceToUser,
};
