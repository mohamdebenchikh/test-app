const express = require('express');
const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { blockValidation } = require('../validations');
const { 
  createBlockHandler, 
  getUserBlocks, 
  getBlock, 
  deleteBlock,
  checkIfBlocked,
  getAllBlocksHandler
} = require('../controllers/block.controller');

const router = express.Router();

router.route('/')
  .post(authenticate, validate(blockValidation.createBlock), createBlockHandler)
  .get(authenticate, getAllBlocksHandler);

router.route('/user/:userId')
  .get(authenticate, getUserBlocks);

router.route('/check')
  .get(authenticate, checkIfBlocked);

router.route('/:blockId')
  .get(authenticate, getBlock)
  .delete(authenticate, deleteBlock);

module.exports = router;