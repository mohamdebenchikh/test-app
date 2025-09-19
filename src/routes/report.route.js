const express = require('express');
const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { reportValidation } = require('../validations');
const { 
  createReportHandler, 
  getUserReports, 
  getReport, 
  updateReport: updateReportHandler, 
  deleteReport,
  getAllReportsHandler
} = require('../controllers/report.controller');

const router = express.Router();

router.route('/')
  .post(authenticate, validate(reportValidation.createReport), createReportHandler)
  .get(authenticate, getAllReportsHandler);

router.route('/user/:userId')
  .get(authenticate, getUserReports);

router.route('/:reportId')
  .get(authenticate, getReport)
  .patch(authenticate, validate(reportValidation.updateReport), updateReportHandler)
  .delete(authenticate, deleteReport);

module.exports = router;