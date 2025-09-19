const { createBlock, getBlocksByBlockerId, getBlockById, deleteBlockById, isUserBlocked, getAllBlocks } = require('../services/block.service');
const catchAsync = require('../utils/catchAsync');

/**
 * Block a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createBlockHandler = catchAsync(async (req, res) => {
  const blockBody = {
    ...req.body,
    blocker_id: req.user.sub // Get blocker ID from authenticated user (sub field in JWT)
  };
  
  const block = await createBlock(blockBody);
  res.status(201).send(block);
});

/**
 * Get blocked users for a blocker
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserBlocks = catchAsync(async (req, res) => {
  const blocks = await getBlocksByBlockerId(req.params.userId);
  res.send(blocks);
});

/**
 * Get a specific block by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBlock = catchAsync(async (req, res) => {
  const block = await getBlockById(req.params.blockId);
  res.send(block);
});

/**
 * Unblock a user (delete block)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteBlock = catchAsync(async (req, res) => {
  await deleteBlockById(req.params.blockId);
  res.status(204).send();
});

/**
 * Check if a user is blocked
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const checkIfBlocked = catchAsync(async (req, res) => {
  const { blockerId, blockedId } = req.query;
  const isBlocked = await isUserBlocked(blockerId, blockedId);
  res.send({ isBlocked });
});

/**
 * Get all blocks (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllBlocksHandler = catchAsync(async (req, res) => {
  const blocks = await getAllBlocks(req.query);
  res.send(blocks);
});

module.exports = {
  createBlockHandler,
  getUserBlocks,
  getBlock,
  deleteBlock,
  checkIfBlocked,
  getAllBlocksHandler
};