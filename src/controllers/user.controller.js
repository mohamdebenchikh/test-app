/**
 * @fileoverview User controller for handling profile management.
 * @module controllers/user
 */

const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { userService } = require('../services');

const updateUser = catchAsync(async (req, res) => {
  const user = await userService.updateUserById(req.user.sub, req.body);
  res.send(user);
});

const updateAvatar = catchAsync(async (req, res) => {
    if (!req.file) {
        throw new ApiError(httpStatus.default.BAD_REQUEST, 'No file uploaded');
    }
    const user = await userService.updateAvatar(req.user.sub, req.file.path);
    res.send(user);
});

const changePassword = catchAsync(async (req, res) => {
    await userService.updateUserPassword(req.user.sub, req.body);
    res.status(httpStatus.default.NO_CONTENT).send();
});

const deleteUser = catchAsync(async (req, res) => {
    console.log('deleteUser called with user ID:', req.user.sub);
    await userService.deleteUserById(req.user.sub, req.body.password);
    res.status(httpStatus.default.NO_CONTENT).send();
});

const getUser = catchAsync(async (req, res) => {
    const user = await userService.getUserById(req.user.sub);
    res.send(user);
});

const updateProviderServices = catchAsync(async (req, res) => {
  const user = await userService.updateProviderServices(req.user.sub, req.body.serviceIds);
  res.send(user);
});

const getProviderProfile = catchAsync(async (req, res) => {
  const provider = await userService.getProviderProfile(req.params.id);
  res.send(provider);
});

const getClientProfile = catchAsync(async (req, res) => {
  const client = await userService.getClientProfile(req.params.id);
  res.send(client);
});

module.exports = {
    updateUser,
    updateAvatar,
    changePassword,
    deleteUser,
    getUser,
    updateProviderServices,
    getProviderProfile,
    getClientProfile
};