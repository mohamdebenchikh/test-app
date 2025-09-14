/**
 * @fileoverview Defines the City model for Sequelize.
 * @module models/City
 */

/**
 * Defines the City model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The City model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class City
   * @classdesc The City model.
   * @property {string} id - The UUID of the city.
   * @property {string} name_en - The English name of the city.
   * @property {string} name_ar - The Arabic name of the city.
   * @property {string} name_fr - The French name of the city.
   * @property {number} lng - The longitude of the city.
   * @property {number} lat - The latitude of the city.
   */
  const City = sequelize.define(
    'City',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name_en: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name_ar: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name_fr: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lng: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      lat: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: 'cities',
    }
  );

  return City;
};