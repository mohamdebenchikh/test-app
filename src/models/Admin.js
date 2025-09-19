/**
 * @fileoverview Defines the Admin model for Sequelize.
 * @module models/Admin
 */

const { Op } = require('sequelize');
const { comparePassword } = require('../utils/password');

/**
 * Defines the Admin model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The Admin model.
 */

module.exports = (sequelize, DataTypes) => {
  /**
   * @class Admin
   * @classdesc The Admin model.
   * @property {string} id - The UUID of the admin.
   * @property {string} name - The name of the admin.
   * @property {string} email - The email of the admin.
   * @property {string} password - The hashed password of the admin.
   */
  const Admin = sequelize.define(
    "Admin",
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
    },
    {
      timestamps: true,
      tableName: "admins",
    }
  );

  /**
   * Check if email is taken
   * @param {string} email - The admin's email
   * @param {UUID} [excludeAdminId] - The id of the admin to be excluded
   * @returns {Promise<boolean>}
   */
  Admin.isEmailTaken = async function (email, excludeAdminId) {
    const admin = await this.findOne({ where: { email, id: { [Op.ne]: excludeAdminId } } });
    return !!admin;
  };

  /**
   * Check if password matches the admin's password
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  Admin.prototype.isPasswordMatch = async function (password) {
    const admin = this;
    return comparePassword(password, admin.password);
  };

  return Admin;
};
