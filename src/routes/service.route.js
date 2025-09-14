const express = require('express');
const { serviceController } = require('../controllers');

const router = express.Router();

router.get('/', serviceController.getServices);

module.exports = router;
