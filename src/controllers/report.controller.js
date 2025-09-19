const { createReport, getReportsByReportedId, getReportById, updateReportById, deleteReportById, getAllReports } = require('../services/report.service');
const catchAsync = require('../utils/catchAsync');

/**
 * Create a new report
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createReportHandler = catchAsync(async (req, res) => {
  const reportBody = {
    ...req.body,
    reporter_id: req.user.sub // Get reporter ID from authenticated user (sub field in JWT)
  };
  
  const report = await createReport(reportBody);
  res.status(201).send(report);
});

/**
 * Get reports for a reported user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserReports = catchAsync(async (req, res) => {
  const reports = await getReportsByReportedId(req.params.userId);
  res.send(reports);
});

/**
 * Get a specific report by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getReport = catchAsync(async (req, res) => {
  const report = await getReportById(req.params.reportId);
  res.send(report);
});

/**
 * Update a report
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateReport = catchAsync(async (req, res) => {
  const report = await updateReportById(req.params.reportId, req.body);
  res.send(report);
});

/**
 * Delete a report
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteReport = catchAsync(async (req, res) => {
  await deleteReportById(req.params.reportId);
  res.status(204).send();
});

/**
 * Get all reports (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllReportsHandler = catchAsync(async (req, res) => {
  const reports = await getAllReports(req.query);
  res.send(reports);
});

module.exports = {
  createReportHandler,
  getUserReports,
  getReport,
  updateReport,
  deleteReport,
  getAllReportsHandler
};