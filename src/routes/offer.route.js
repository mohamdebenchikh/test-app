const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { offerController } = require('../controllers');
const validate = require('../middlewares/validate');
const { offerValidation } = require('../validations');

const router = express.Router();

// Provider routes
router
    .route('/')
    .post(
        authenticate,
        authorize(['provider']),
        validate(offerValidation.createOffer),
        offerController.createOffer
    )
    .get(
        authenticate,
        authorize(['provider']),
        validate(offerValidation.getProviderOffers),
        offerController.getProviderOffers
    );

router
    .route('/:offerId')
    .get(
        authenticate,
        validate(offerValidation.getOffer),
        offerController.getOffer
    )
    .patch(
        authenticate,
        authorize(['provider']),
        validate(offerValidation.updateOffer),
        offerController.updateOffer
    )
    .delete(
        authenticate,
        authorize(['provider']),
        validate(offerValidation.deleteOffer),
        offerController.deleteOffer
    );

// Client routes for managing offers
router
    .route('/:offerId/accept')
    .patch(
        authenticate,
        authorize(['client']),
        validate(offerValidation.acceptOffer),
        offerController.acceptOffer
    );

router
    .route('/:offerId/reject')
    .patch(
        authenticate,
        authorize(['client']),
        validate(offerValidation.rejectOffer),
        offerController.rejectOffer
    );

// Route to get offers for a specific service request
router
    .route('/service-request/:serviceRequestId')
    .get(
        authenticate,
        validate(offerValidation.getOffersByServiceRequest),
        offerController.getOffersByServiceRequest
    );

module.exports = router;