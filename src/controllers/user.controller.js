/**
 * @fileoverview User controller for handling profile management.
 * @module controllers/user
 */

const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { userService } = require('../services');

const updateProfile = catchAsync(async (req, res) => {
  const user = await userService.updateUserById(req.user.id, req.body);
  res.send(user);
});

const uploadAvatar = catchAsync(async (req, res) => {
    const user = await userService.updateUserById(req.user.id, { avatar: req.file.path });
    res.send(user);
});

const changePassword = catchAsync(async (req, res) => {
    await userService.updateUserPassword(req.user.id, req.body);
    res.status(httpStatus.NO_CONTENT).send();
});

const deleteAccount = catchAsync(async (req, res) => {
    await userService.deleteUserById(req.user.id);
    res.status(httpStatus.NO_CONTENT).send();
});

const getProfile = catchAsync(async (req, res) => {
    const user = await userService.getUserById(req.user.id);
    res.send(user);
});


module.exports = {
    updateProfile,
    uploadAvatar,
    changePassword,
    deleteAccount,
    getProfile,
};
