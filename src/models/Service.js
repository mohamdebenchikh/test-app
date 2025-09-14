/**
 * @fileoverview Defines the Service model for Sequelize.
 * @module models/Service
 */

/**
 * Defines the Service model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The Service model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class Service
   * @classdesc The Service model.
   * @property {string} id - The UUID of the service.
   * @property {string} image - The URL of the service image.
   * @property {string} icon - The URL of the service icon.
   * @property {boolean} is_featured - Whether the service is featured.
   * @property {boolean} is_popular - Whether the service is popular.
   * @property {string} color - The color associated with the service.
   * @property {string} status - The status of the service ('active' or 'inactive').
   */
  const Service = sequelize.define(
    'Service',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      icon: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      is_featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_popular: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      color: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
      },
    },
    {
      timestamps: true,
      tableName: 'services',
    }
  );

  return Service;
};