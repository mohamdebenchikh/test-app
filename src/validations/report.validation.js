const { Joi } = require('celebrate');

const createReport = {
  body: Joi.object().keys({
    reported_id: Joi.string().guid().required(),
    report_type: Joi.string().valid('spam', 'inappropriate_content', 'harassment', 'other').required(),
    description: Joi.string().required(),
    related_id: Joi.string().guid().optional(),
    related_type: Joi.string().optional()
  })
};

const updateReport = {
  body: Joi.object().keys({
    status: Joi.string().valid('pending', 'resolved', 'dismissed').optional(),
    report_type: Joi.string().valid('spam', 'inappropriate_content', 'harassment', 'other').optional(),
    description: Joi.string().optional()
  })
};

module.exports = {
  createReport,
  updateReport
};