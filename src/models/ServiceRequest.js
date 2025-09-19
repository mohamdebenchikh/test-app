/**
 * @fileoverview Defines the ServiceRequest model for Sequelize.
 * @module models/ServiceRequest
 */

/**
 * Defines the ServiceRequest model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The ServiceRequest model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class ServiceRequest
   * @classdesc The ServiceRequest model.
   * @property {string} id - The UUID of the service request.
   * @property {string} title - The title of the service request.
   * @property {string} description - The description of the service request.
   * @property {number} start_price - The starting price/budget for the service request.
   * @property {Date} due_date - The due date for the service request.
   * @property {string} client_id - The UUID of the client who created the request.
   * @property {string} service_id - The UUID of the service being requested.
   * @property {string} city_id - The UUID of the city where the service is needed.
   */
  const ServiceRequest = sequelize.define(
    'ServiceRequest',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      start_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      due_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      client_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      service_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'services',
          key: 'id',
        },
      },
      city_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'cities',
          key: 'id',
        },
      },
    },
    {
      timestamps: true,
      tableName: 'service_requests',
    }
  );

  return ServiceRequest;
};