const { User, Service, ProviderService, sequelize } = require('../models');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');

const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  const user = await User.create(userBody);
  return user;
};

const getUserById = async (id) => {
  return User.findByPk(id);
};

const getUserByEmail = async (email) => {
  return User.findOne({ where: { email } });
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
  if (!user || !(await user.isPasswordMatch(body.oldPassword))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect old password');
  }
  await updateUserById(userId, { password: body.newPassword });
};

const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await user.destroy();
  return user;
};

const updateProviderServices = async (userId, serviceIds) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (user.role !== 'provider') {
    throw new ApiError(httpStatus.FORBIDDEN, 'User is not a provider');
  }

  const services = await Service.findAll({ where: { id: serviceIds } });
  if (services.length !== serviceIds.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'One or more services not found');
  }

  const t = await sequelize.transaction();
  try {
    await ProviderService.destroy({ where: { user_id: userId }, transaction: t });
    const providerServices = serviceIds.map((serviceId) => ({
      user_id: userId,
      service_id: serviceId,
    }));
    await ProviderService.bulkCreate(providerServices, { transaction: t });
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update services');
  }
};

module.exports = {
  createUser,
  getUserById,
  getUserByEmail,
  updateUserById,
  updateUserPassword,
  deleteUserById,
  updateProviderServices,
};
