const express = require('express');
const validate = require('../middlewares/validate');
const { adminValidation } = require('../validations');
const { adminController } = require('../controllers');

const router = express.Router();

router.post('/register', validate(adminValidation.register), adminController.register);
router.post('/login', validate(adminValidation.login), adminController.login);

module.exports = router;
