/**
 * @fileoverview Defines the Offer model for Sequelize.
 * @module models/Offer
 */

/**
 * Defines the Offer model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The Offer model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class Offer
   * @classdesc The Offer model for provider offers on service requests.
   * @property {string} id - The UUID of the offer.
   * @property {string} service_request_id - The ID of the service request.
   * @property {string} provider_id - The ID of the provider making the offer.
   * @property {number} price - The offered price.
   * @property {string} description - Description of the offer.
   * @property {string} status - The status of the offer ('pending', 'accepted', 'rejected').
   * @property {Date} estimated_completion - Estimated completion date.
   * @property {Date} expires_at - When the offer expires.
   */
  const Offer = sequelize.define(
    'Offer',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      service_request_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'service_requests',
          key: 'id'
        }
      },
      provider_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0
        }
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
        defaultValue: 'pending',
        allowNull: false,
      },
      estimated_completion: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: 'offers',
      indexes: [
        {
          unique: true,
          fields: ['service_request_id', 'provider_id'],
          name: 'unique_provider_per_service_request'
        }
      ]
    }
  );

  return Offer;
};