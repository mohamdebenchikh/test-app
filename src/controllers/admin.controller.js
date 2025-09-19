const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { adminService, tokenService, authService } = require('../services');

const register = catchAsync(async (req, res) => {
  const admin = await adminService.createAdmin(req.body);
  const tokens = await tokenService.generateAdminAuthTokens(admin);
  res.status(httpStatus.CREATED).send({ admin, tokens });
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const admin = await authService.loginAdminWithEmailAndPassword(email, password);
  const tokens = await tokenService.generateAdminAuthTokens(admin);
  res.send({ admin, tokens });
});

module.exports = {
  register,
  login,
};
