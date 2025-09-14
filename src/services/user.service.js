/**
 * @fileoverview Services for user management.
 * @module services/user
 */

const httpStatus = require('http-status');
const { User, Service } = require('../models');
const { hashPassword, comparePassword } = require('../utils/password');
const ApiError = require('../utils/ApiError');

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
const getUserById = async (id) => {
    return User.findByPk(id);
};

const updateUserById = async (userId, updateBody) => {
    const user = await getUserById(userId);
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
    }
    Object.assign(user, updateBody);
    await user.save();
    return user;
};

const updateUserPassword = async (userId, body) => {
    const user = await getUserById(userId);
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    if (!(await comparePassword(body.oldPassword, user.password))) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect password');
    }
    const hashedPassword = await hashPassword(body.newPassword);
    await updateUserById(userId, { password: hashedPassword });
};

const deleteUserById = async (userId) => {
    const user = await getUserById(userId);
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    await user.destroy();
    return user;
};

module.exports = {
  createUser,
  getUserByEmail,
  addServiceToUser,
  getUserById,
  updateUserById,
  updateUserPassword,
  deleteUserById,
};
