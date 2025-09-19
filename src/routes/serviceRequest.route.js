const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { serviceRequestController } = require('../controllers');
const validate = require('../middlewares/validate');
const { serviceRequestValidation } = require('../validations');

const router = express.Router();

router
  .route('/')
  .post(
    authenticate,
    authorize(['client']),
    validate(serviceRequestValidation.createServiceRequest),
    serviceRequestController.createServiceRequest
  )
  .get(authenticate, authorize(['client']), serviceRequestController.getServiceRequests);

router
  .route('/:serviceRequestId')
  .get(authenticate, serviceRequestController.getServiceRequest)
  .patch(
    authenticate,
    authorize(['client']),
    validate(serviceRequestValidation.updateServiceRequest),
    serviceRequestController.updateServiceRequest
  )
  .delete(authenticate, authorize(['client']), serviceRequestController.deleteServiceRequest);

module.exports = router;