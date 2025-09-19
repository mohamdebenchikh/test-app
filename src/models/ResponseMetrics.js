/**
 * @fileoverview Defines the ResponseMetrics model for Sequelize.
 * @module models/ResponseMetrics
 */

/**
 * Defines the ResponseMetrics model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The ResponseMetrics model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class ResponseMetrics
   * @classdesc The ResponseMetrics model for tracking provider response times.
   * @property {string} id - The UUID of the response metric record.
   * @property {string} provider_id - The UUID of the provider user.
   * @property {string} conversation_id - The UUID of the conversation.
   * @property {string} initial_message_id - The UUID of the initial client message.
   * @property {string} response_message_id - The UUID of the provider's response message (nullable).
   * @property {number} response_time_minutes - The response time in minutes (nullable).
   * @property {boolean} responded_within_24h - Whether the provider responded within 24 hours.
   */
  const ResponseMetrics = sequelize.define(
    'ResponseMetrics',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      provider_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        validate: {
          async isProvider(value) {
            const user = await sequelize.models.User.findByPk(value);
            if (!user) {
              throw new Error('Provider user not found');
            }
            if (user.role !== 'provider') {
              throw new Error('Response metrics can only be created for providers');
            }
          }
        }
      },
      conversation_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Conversations',
          key: 'id',
        },
      },
      initial_message_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Messages',
          key: 'id',
        },
      },
      response_message_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Messages',
          key: 'id',
        },
      },
      response_time_minutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 0
        }
      },
      responded_within_24h: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
    },
    {
      tableName: 'response_metrics',
      timestamps: true,
      indexes: [
        {
          fields: ['provider_id'],
        },
        {
          fields: ['createdAt'],
        },
        {
          fields: ['provider_id', 'createdAt'],
        },
        {
          fields: ['conversation_id'],
        },
      ],
      hooks: {
        beforeCreate: async (responseMetric, options) => {
          // Validate that the provider_id belongs to a user with role 'provider'
          const user = await sequelize.models.User.findByPk(responseMetric.provider_id);
          if (!user) {
            throw new Error('Provider user not found');
          }
          if (user.role !== 'provider') {
            throw new Error('Response metrics can only be created for providers');
          }
        },
        beforeUpdate: async (responseMetric, options) => {
          // Validate provider role if provider_id is being updated
          if (responseMetric.changed('provider_id')) {
            const user = await sequelize.models.User.findByPk(responseMetric.provider_id);
            if (!user) {
              throw new Error('Provider user not found');
            }
            if (user.role !== 'provider') {
              throw new Error('Response metrics can only be updated for providers');
            }
          }
        }
      }
    }
  );

  return ResponseMetrics;
};