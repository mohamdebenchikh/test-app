/**
 * @fileoverview Defines the ServiceTranslation model for Sequelize.
 * @module models/ServiceTranslation
 */

/**
 * Defines the ServiceTranslation model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The ServiceTranslation model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class ServiceTranslation
   * @classdesc The ServiceTranslation model.
   * @property {string} id - The UUID of the service translation.
   * @property {string} language - The language of the translation ('en', 'ar', 'fr').
   * @property {string} title - The translated title of the service.
   * @property {string} description - The translated description of the service.
   * @property {string} service_id - The ID of the service this translation belongs to.
   */
  const ServiceTranslation = sequelize.define(
    'ServiceTranslation',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      language: {
        type: DataTypes.ENUM('en', 'ar', 'fr'),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      timestamps: true,
      tableName: 'service_translations',
    }
  );

  return ServiceTranslation;
};
