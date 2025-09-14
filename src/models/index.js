/**
 * @fileoverview Initializes Sequelize, loads all models, and sets up their associations.
 * @module models
 */

const { Sequelize, DataTypes } = require("sequelize");
const dbConfig = require("../config/database");

const env = process.env.NODE_ENV || "development";
const config = dbConfig[env];

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config
);

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Database connected [${env}]`);
  } catch (error) {
    console.error("❌ Database connection error:", error);
  }
})();

/**
 * The database object, containing the Sequelize instance, the sequelize object, and all the models.
 * @exports models
 * @type {object}
 * @property {object} Sequelize - The Sequelize class.
 * @property {object} sequelize - The Sequelize instance.
 * @property {object} User - The User model.
 * @property {object} City - The City model.
 * @property {object} Service - The Service model.
 * @property {object} ServiceTranslation - The ServiceTranslation model.
 * @property {object} ProviderService - The ProviderService model.
 */
const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.User = require("./User")(sequelize, DataTypes);
db.City = require("./City")(sequelize, DataTypes);
db.Service = require("./Service")(sequelize, DataTypes);
db.ServiceTranslation = require("./ServiceTranslation")(sequelize, DataTypes);
db.ProviderService = require("./ProviderService")(sequelize, DataTypes);

// Associations
db.User.belongsTo(db.City, { foreignKey: 'city_id' });
db.City.hasMany(db.User, { foreignKey: 'city_id' });

db.Service.hasMany(db.ServiceTranslation, { foreignKey: 'service_id' });
db.ServiceTranslation.belongsTo(db.Service, { foreignKey: 'service_id' });

db.User.belongsToMany(db.Service, { through: db.ProviderService, foreignKey: 'user_id' });
db.Service.belongsToMany(db.User, { through: db.ProviderService, foreignKey: 'service_id' });

module.exports = db;
