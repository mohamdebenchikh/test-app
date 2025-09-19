const { Report, User } = require('../models');
const httpStatus = require('http-status').default;
const ApiError = require('../utils/ApiError');

/**
 * Create a report
 * @param {Object} reportBody
 * @returns {Promise<Report>}
 */
const createReport = async (reportBody) => {
  try {
    // Check if both users exist
    const reporter = await User.findByPk(reportBody.reporter_id);
    const reported = await User.findByPk(reportBody.reported_id);
    
    if (!reporter || !reported) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Reporter or reported user not found');
    }
    
    // Prevent users from reporting themselves
    if (reporter.id === reported.id) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Users cannot report themselves');
    }
    
    // Create the report
    const report = await Report.create(reportBody);
    
    return report;
  } catch (error) {
    console.error('Error creating report:', error);
    throw error;
  }
};

/**
 * Get reports by reported user id
 * @param {string} reportedId
 * @returns {Promise<Report[]>}
 */
const getReportsByReportedId = async (reportedId) => {
  return Report.findAll({
    where: { reported_id: reportedId },
    include: [{
      model: User,
      as: 'reporter',
      attributes: ['id', 'name', 'avatar']
    }],
    order: [['createdAt', 'DESC']]
  });
};

/**
 * Get report by id
 * @param {string} reportId
 * @returns {Promise<Report>}
 */
const getReportById = async (reportId) => {
  return Report.findByPk(reportId, {
    include: [
      {
        model: User,
        as: 'reporter',
        attributes: ['id', 'name', 'avatar']
      },
      {
        model: User,
        as: 'reported',
        attributes: ['id', 'name', 'avatar']
      }
    ]
  });
};

/**
 * Update report by id
 * @param {string} reportId
 * @param {Object} updateBody
 * @returns {Promise<Report>}
 */
const updateReportById = async (reportId, updateBody) => {
  const report = await getReportById(reportId);
  if (!report) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Report not found');
  }
  Object.assign(report, updateBody);
  await report.save();
  return report;
};

/**
 * Delete report by id
 * @param {string} reportId
 * @returns {Promise<Report>}
 */
const deleteReportById = async (reportId) => {
  const report = await getReportById(reportId);
  if (!report) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Report not found');
  }
  await report.destroy();
  return report;
};

/**
 * Get all reports with optional filters
 * @param {Object} filter - Filter options
 * @param {string} filter.status - Filter by status
 * @param {string} filter.report_type - Filter by report type
 * @returns {Promise<Report[]>}
 */
const getAllReports = async (filter = {}) => {
  const whereClause = {};
  
  if (filter.status) {
    whereClause.status = filter.status;
  }
  
  if (filter.report_type) {
    whereClause.report_type = filter.report_type;
  }
  
  return Report.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'reporter',
        attributes: ['id', 'name', 'avatar']
      },
      {
        model: User,
        as: 'reported',
        attributes: ['id', 'name', 'avatar']
      }
    ],
    order: [['createdAt', 'DESC']]
  });
};

module.exports = {
  createReport,
  getReportsByReportedId,
  getReportById,
  updateReportById,
  deleteReportById,
  getAllReports
};