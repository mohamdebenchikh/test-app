/**
 * @fileoverview Defines the ProviderService model for Sequelize.
 * @module models/ProviderService
 */

/**
 * Defines the ProviderService model. This model represents the join table between Users (providers) and Services.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The ProviderService model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class ProviderService
   * @classdesc The ProviderService model.
   * @property {string} id - The UUID of the provider service record.
   * @property {string} user_id - The ID of the user (provider).
   * @property {string} service_id - The ID of the service.
   */
  const ProviderService = sequelize.define(
    'ProviderService',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
    },
    {
      timestamps: true,
      tableName: 'provider_services',
    }
  );

  return ProviderService;
};
