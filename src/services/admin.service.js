const { Admin } = require('../models');
const httpStatus = require('http-status').default;
const ApiError = require('../utils/ApiError');
const { hashPassword } = require('../utils/password');

const createAdmin = async (adminBody) => {
  if (await Admin.isEmailTaken(adminBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  // Hash the password before storing
  const hashedPassword = await hashPassword(adminBody.password);
  const admin = await Admin.create({ ...adminBody, password: hashedPassword });
  return admin;
};

const getAdminById = async (id) => {
  return Admin.findByPk(id);
};

const getAdminByEmail = async (email) => {
  return Admin.findOne({ where: { email } });
};

module.exports = {
  createAdmin,
  getAdminById,
  getAdminByEmail,
};
