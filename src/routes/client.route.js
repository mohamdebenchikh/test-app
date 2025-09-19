const express = require('express');
const { clientController } = require('../controllers');
const validate = require('../middlewares/validate');
const { userValidation } = require('../validations');

const router = express.Router();

router.route('/')
  .get(validate(userValidation.browseClients), clientController.browseClients);

router.route('/:clientId')
  .get(clientController.getClientProfile);

module.exports = router;