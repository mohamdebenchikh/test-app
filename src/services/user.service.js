/**
 * @fileoverview Services for user management.
 * @module services/user
 */

const { User, Service } = require('../models');
const { hashPassword } = require('../utils/password');

/**
 * Creates a new user.
 * @function createUser
 * @param {object} userBody - The user's data.
 * @returns {Promise<User>} The created user.
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
 * Gets a user by their email address.
 * @function getUserByEmail
 * @param {string} email - The user's email.
 * @returns {Promise<User|null>} The user, or null if not found.
 */
const getUserByEmail = async (email) => {
  return User.findOne({ where: { email } });
};

/**
 * Adds a service to a user's profile.
 * @function addServiceToUser
 * @param {string} userId - The ID of the user.
 * @param {string} serviceId - The ID of the service to add.
 * @returns {Promise<void>}
 */
const addServiceToUser = async (userId, serviceId) => {
    const user = await User.findByPk(userId);
    const service = await Service.findByPk(serviceId);
    await user.addService(service);
};

/**
 * @exports services/user
 * @type {object}
 * @property {function} createUser - Creates a new user.
 * @property {function} getUserByEmail - Gets a user by their email address.
 * @property {function} addServiceToUser - Adds a service to a user's profile.
 */
module.exports = {
  createUser,
  getUserByEmail,
  addServiceToUser,
};
