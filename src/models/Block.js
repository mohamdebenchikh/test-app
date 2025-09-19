/**
 * @fileoverview Defines the Block model for Sequelize.
 * @module models/Block
 */

/**
 * Defines the Block model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The Block model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class Block
   * @classdesc The Block model.
   * @property {string} id - The UUID of the block.
   * @property {string} blocker_id - The UUID of the user who is blocking.
   * @property {string} blocked_id - The UUID of the user being blocked.
   */
  const Block = sequelize.define(
    'Block',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      blocker_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      blocked_id: {
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
      tableName: 'blocks',
      // Prevent duplicate blocks
      indexes: [
        {
          unique: true,
          fields: ['blocker_id', 'blocked_id']
        }
      ]
    }
  );

  return Block;
};