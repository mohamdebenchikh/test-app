/**
 * @fileoverview Defines the Notification model for Sequelize.
 * @module models/Notification
 */

/**
 * Defines the Notification model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The Notification model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class Notification
   * @classdesc The Notification model.
   * @property {string} id - The UUID of the notification.
   * @property {string} user_id - The UUID of the user receiving the notification.
   * @property {string} type - The type of notification.
   * @property {string} title - The title of the notification.
   * @property {string} message - The message content of the notification.
   * @property {object} data - Additional data related to the notification.
   * @property {boolean} read - Whether the notification has been read.
   * @property {string} related_id - The ID of the related entity (e.g., service request).
   * @property {string} related_type - The type of the related entity.
   */
  const Notification = sequelize.define(
    'Notification',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      data: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      related_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      related_type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: 'notifications',
    }
  );

  return Notification;
};