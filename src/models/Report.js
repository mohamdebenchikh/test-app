/**
 * @fileoverview Defines the Report model for Sequelize.
 * @module models/Report
 */

/**
 * Defines the Report model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The Report model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class Report
   * @classdesc The Report model.
   * @property {string} id - The UUID of the report.
   * @property {string} reporter_id - The UUID of the user who submitted the report.
   * @property {string} reported_id - The UUID of the user being reported.
   * @property {string} report_type - The type of report (e.g., spam, inappropriate_content, harassment).
   * @property {string} description - The detailed description of the report.
   * @property {string} related_id - The ID of the related entity (e.g., service request, review).
   * @property {string} related_type - The type of the related entity (e.g., service_request, review).
   * @property {string} status - The status of the report (pending, resolved, dismissed).
   */
  const Report = sequelize.define(
    'Report',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      reporter_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      reported_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      report_type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [['spam', 'inappropriate_content', 'harassment', 'other']],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      related_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      related_type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'pending',
        validate: {
          isIn: [['pending', 'resolved', 'dismissed']],
        },
      },
    },
    {
      timestamps: true,
      tableName: 'reports',
    }
  );

  return Report;
};