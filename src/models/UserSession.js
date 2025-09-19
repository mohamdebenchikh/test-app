/**
 * @fileoverview Defines the UserSession model for Sequelize.
 * @module models/UserSession
 */

/**
 * Defines the UserSession model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The UserSession model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class UserSession
   * @classdesc The UserSession model for tracking active user sessions.
   * @property {string} id - The UUID of the session.
   * @property {string} user_id - The UUID of the user.
   * @property {string} socket_id - The Socket.IO socket ID.
   * @property {string} device_type - The type of device ('web', 'mobile', 'desktop').
   * @property {string} ip_address - The IP address of the connection.
   * @property {string} user_agent - The user agent string.
   * @property {Date} connected_at - When the session was established.
   * @property {Date} last_ping - The last activity timestamp.
   * @property {boolean} is_active - Whether the session is currently active.
   */
  const UserSession = sequelize.define(
    'UserSession',
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
      socket_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      device_type: {
        type: DataTypes.ENUM('web', 'mobile', 'desktop'),
        allowNull: false,
        defaultValue: 'web',
      },
      ip_address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      connected_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      last_ping: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
    },
    {
      timestamps: true,
      tableName: 'user_sessions',
    }
  );

  /**
   * Define associations
   */
  UserSession.associate = (models) => {
    UserSession.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  /**
   * Check if a session is still active (within last 5 minutes)
   * @returns {boolean}
   */
  UserSession.prototype.isStillActive = function() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.last_ping > fiveMinutesAgo && this.is_active;
  };

  /**
   * Update the last ping timestamp
   * @returns {Promise<UserSession>}
   */
  UserSession.prototype.updatePing = async function() {
    this.last_ping = new Date();
    return this.save();
  };

  return UserSession;
};