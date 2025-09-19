const { Block, User } = require('../models');
const httpStatus = require('http-status').default;
const ApiError = require('../utils/ApiError');

/**
 * Block a user
 * @param {Object} blockBody
 * @returns {Promise<Block>}
 */
const createBlock = async (blockBody) => {
  try {
    // Check if both users exist
    const blocker = await User.findByPk(blockBody.blocker_id);
    const blocked = await User.findByPk(blockBody.blocked_id);
    
    if (!blocker || !blocked) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Blocker or blocked user not found');
    }
    
    // Prevent users from blocking themselves
    if (blocker.id === blocked.id) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Users cannot block themselves');
    }
    
    // Check if the block already exists
    const existingBlock = await Block.findOne({
      where: {
        blocker_id: blockBody.blocker_id,
        blocked_id: blockBody.blocked_id
      }
    });
    
    if (existingBlock) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User is already blocked');
    }
    
    // Create the block
    const block = await Block.create(blockBody);
    
    return block;
  } catch (error) {
    console.error('Error creating block:', error);
    throw error;
  }
};

/**
 * Get blocks by blocker user id
 * @param {string} blockerId
 * @returns {Promise<Block[]>}
 */
const getBlocksByBlockerId = async (blockerId) => {
  return Block.findAll({
    where: { blocker_id: blockerId },
    include: [{
      model: User,
      as: 'blocked',
      attributes: ['id', 'name', 'avatar']
    }],
    order: [['createdAt', 'DESC']]
  });
};

/**
 * Get block by id
 * @param {string} blockId
 * @returns {Promise<Block>}
 */
const getBlockById = async (blockId) => {
  return Block.findByPk(blockId, {
    include: [
      {
        model: User,
        as: 'blocker',
        attributes: ['id', 'name', 'avatar']
      },
      {
        model: User,
        as: 'blocked',
        attributes: ['id', 'name', 'avatar']
      }
    ]
  });
};

/**
 * Delete block by id (unblock)
 * @param {string} blockId
 * @returns {Promise<Block>}
 */
const deleteBlockById = async (blockId) => {
  const block = await getBlockById(blockId);
  if (!block) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Block not found');
  }
  await block.destroy();
  return block;
};

/**
 * Check if a user is blocked by another user
 * @param {string} blockerId
 * @param {string} blockedId
 * @returns {Promise<boolean>}
 */
const isUserBlocked = async (blockerId, blockedId) => {
  const block = await Block.findOne({
    where: {
      blocker_id: blockerId,
      blocked_id: blockedId
    }
  });
  return !!block;
};

/**
 * Get all blocks with optional filters
 * @param {Object} filter - Filter options
 * @returns {Promise<Block[]>}
 */
const getAllBlocks = async (filter = {}) => {
  const whereClause = {};
  
  if (filter.blocker_id) {
    whereClause.blocker_id = filter.blocker_id;
  }
  
  if (filter.blocked_id) {
    whereClause.blocked_id = filter.blocked_id;
  }
  
  return Block.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'blocker',
        attributes: ['id', 'name', 'avatar']
      },
      {
        model: User,
        as: 'blocked',
        attributes: ['id', 'name', 'avatar']
      }
    ],
    order: [['createdAt', 'DESC']]
  });
};

module.exports = {
  createBlock,
  getBlocksByBlockerId,
  getBlockById,
  deleteBlockById,
  isUserBlocked,
  getAllBlocks
};