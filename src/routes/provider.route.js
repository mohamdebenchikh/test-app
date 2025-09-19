const express = require('express');
const { providerController } = require('../controllers');
const validate = require('../middlewares/validate');
const { userValidation } = require('../validations');

const router = express.Router();

router.route('/')
  .get(validate(userValidation.browseProviders), providerController.browseProviders);

router.route('/:providerId')
  .get(providerController.getProviderProfile);

module.exports = router;