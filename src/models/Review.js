/**
 * @fileoverview Defines the Review model for Sequelize.
 * @module models/Review
 */

/**
 * Defines the Review model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The Review model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class Review
   * @classdesc The Review model.
   * @property {string} id - The UUID of the review.
   * @property {number} stars - The rating from 1 to 5.
   * @property {string} comment - The review comment.
   * @property {string} client_id - The UUID of the client user.
   * @property {string} provider_id - The UUID of the provider user.
   */
  const Review = sequelize.define(
    'Review',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      stars: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 5,
        },
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      client_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      provider_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
    },
    {
      timestamps: true,
      tableName: 'reviews',
    }
  );

  return Review;
};