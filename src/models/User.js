/**
 * @fileoverview Defines the User model for Sequelize.
 * @module models/User
 */

/**
 * Defines the User model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The User model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class User
   * @classdesc The User model.
   * @property {string} id - The UUID of the user.
   * @property {string} name - The name of the user.
   * @property {string} email - The email of the user.
   * @property {string} password - The hashed password of the user.
   * @property {string} avatar - The URL of the user's avatar.
   * @property {string} bio - The biography of the user.
   * @property {string} phone_number - The phone number of the user.
   * @property {string} role - The role of the user ('client' or 'provider').
   * @property {string} gender - The gender of the user ('male', 'female', 'other').
   * @property {Date} birthdate - The birthdate of the user.
   * @property {boolean} verify - Whether the user's email is verified.
   * @property {Date} last_seen - The last time the user was active.
   * @property {object} available_days - The days the user is available (for providers).
   * @property {string} language - The preferred language of the user.
   * @property {boolean} active_status - Whether the user's account is active.
   * @property {string} city_id - The ID of the city the user resides in.
   */
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      avatar: {
          type: DataTypes.STRING,
          allowNull: true,
      },
      bio: {
          type: DataTypes.TEXT,
          allowNull: true,
      },
      phone_number: {
          type: DataTypes.STRING,
          allowNull: true,
      },
      role: {
          type: DataTypes.ENUM('client', 'provider'),
          allowNull: false,
      },
      gender: {
          type: DataTypes.ENUM('male', 'female', 'other'),
          allowNull: true,
      },
      birthdate: {
          type: DataTypes.DATE,
          allowNull: true,
      },
      verify: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
      },
      last_seen: {
          type: DataTypes.DATE,
          allowNull: true,
      },
      available_days: {
          type: DataTypes.JSON,
          allowNull: true,
      },
      language: {
          type: DataTypes.ENUM('en', 'ar', 'fr'),
          defaultValue: 'en',
      },
      active_status: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
      },
      city_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: "users",
    }
  );

  return User;
};
