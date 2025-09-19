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

// Remove the immediate connection attempt
// We'll connect when needed instead

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
 * @property {object} Token - The Token model.
 * @property {object} ServiceRequest - The ServiceRequest model.
 * @property {object} Notification - The Notification model.
 * @property {object} Review - The Review model.
 * @property {object} Report - The Report model.
 * @property {object} Block - The Block model.
 * @property {object} ProviderPortfolio - The ProviderPortfolio model.
 */
const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.User = require("./User")(sequelize, DataTypes);
db.City = require("./City")(sequelize, DataTypes);
db.Service = require("./Service")(sequelize, DataTypes);
db.ServiceTranslation = require("./ServiceTranslation")(sequelize, DataTypes);
db.ProviderService = require("./ProviderService")(sequelize, DataTypes);
db.Token = require("./Token")(sequelize, DataTypes);
db.ServiceRequest = require("./ServiceRequest")(sequelize, DataTypes);
db.Notification = require("./Notification")(sequelize, DataTypes);
db.Review = require("./Review")(sequelize, DataTypes);
db.Report = require("./Report")(sequelize, DataTypes);
db.Block = require("./Block")(sequelize, DataTypes);
db.Conversation = require("./conversation")(sequelize, DataTypes);
db.Message = require("./message")(sequelize, DataTypes);
db.Offer = require("./Offer")(sequelize, DataTypes);
db.UserSession = require("./UserSession")(sequelize, DataTypes);
db.ResponseMetrics = require("./ResponseMetrics")(sequelize, DataTypes);
db.ProviderPortfolio = require("./ProviderPortfolio")(sequelize, DataTypes);

// Associations
db.Token.belongsTo(db.User, { foreignKey: 'user_id' });
db.User.hasMany(db.Token, { foreignKey: 'user_id' });

db.User.belongsTo(db.City, { foreignKey: 'city_id' });
db.City.hasMany(db.User, { foreignKey: 'city_id' });

db.Service.hasMany(db.ServiceTranslation, { foreignKey: 'service_id' });
db.ServiceTranslation.belongsTo(db.Service, { foreignKey: 'service_id' });

db.User.belongsToMany(db.Service, { through: db.ProviderService, foreignKey: 'user_id' });
db.Service.belongsToMany(db.User, { through: db.ProviderService, foreignKey: 'service_id' });

// ServiceRequest associations
db.ServiceRequest.belongsTo(db.User, { foreignKey: 'client_id', as: 'client' });
db.User.hasMany(db.ServiceRequest, { foreignKey: 'client_id', as: 'serviceRequests' });

db.ServiceRequest.belongsTo(db.Service, { foreignKey: 'service_id' });
db.Service.hasMany(db.ServiceRequest, { foreignKey: 'service_id' });

db.ServiceRequest.belongsTo(db.City, { foreignKey: 'city_id' });
db.City.hasMany(db.ServiceRequest, { foreignKey: 'city_id' });

// Review associations
db.Review.belongsTo(db.User, { foreignKey: 'client_id', as: 'client' });
db.Review.belongsTo(db.User, { foreignKey: 'provider_id', as: 'provider' });
db.User.hasMany(db.Review, { foreignKey: 'client_id', as: 'clientReviews' });
db.User.hasMany(db.Review, { foreignKey: 'provider_id', as: 'providerReviews' });

// Report associations
db.Report.belongsTo(db.User, { foreignKey: 'reporter_id', as: 'reporter' });
db.Report.belongsTo(db.User, { foreignKey: 'reported_id', as: 'reported' });
db.User.hasMany(db.Report, { foreignKey: 'reporter_id', as: 'reportsFiled' });
db.User.hasMany(db.Report, { foreignKey: 'reported_id', as: 'reportsReceived' });

// Block associations
db.Block.belongsTo(db.User, { foreignKey: 'blocker_id', as: 'blocker' });
db.Block.belongsTo(db.User, { foreignKey: 'blocked_id', as: 'blocked' });
db.User.hasMany(db.Block, { foreignKey: 'blocker_id', as: 'blocksGiven' });
db.User.hasMany(db.Block, { foreignKey: 'blocked_id', as: 'blocksReceived' });

// Conversation associations
db.Conversation.belongsTo(db.User, { foreignKey: 'userOneId', as: 'userOne' });
db.Conversation.belongsTo(db.User, { foreignKey: 'userTwoId', as: 'userTwo' });
db.User.hasMany(db.Conversation, { foreignKey: 'userOneId', as: 'conversationsAsUserOne' });
db.User.hasMany(db.Conversation, { foreignKey: 'userTwoId', as: 'conversationsAsUserTwo' });

// Message associations
db.Message.belongsTo(db.Conversation, { foreignKey: 'conversationId', as: 'conversation' });
db.Conversation.hasMany(db.Message, { foreignKey: 'conversationId', as: 'messages' });

db.Message.belongsTo(db.User, { foreignKey: 'senderId', as: 'sender' });
db.User.hasMany(db.Message, { foreignKey: 'senderId', as: 'sentMessages' });

// Offer associations
db.Offer.belongsTo(db.ServiceRequest, { foreignKey: 'service_request_id', as: 'serviceRequest' });
db.ServiceRequest.hasMany(db.Offer, { foreignKey: 'service_request_id', as: 'offers' });

db.Offer.belongsTo(db.User, { foreignKey: 'provider_id', as: 'provider' });
db.User.hasMany(db.Offer, { foreignKey: 'provider_id', as: 'offers' });

// UserSession associations
db.UserSession.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
db.User.hasMany(db.UserSession, { foreignKey: 'user_id', as: 'sessions' });

// ResponseMetrics associations
db.ResponseMetrics.belongsTo(db.User, { foreignKey: 'provider_id', as: 'provider' });
db.User.hasMany(db.ResponseMetrics, { foreignKey: 'provider_id', as: 'responseMetrics' });

db.ResponseMetrics.belongsTo(db.Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
db.Conversation.hasMany(db.ResponseMetrics, { foreignKey: 'conversation_id', as: 'responseMetrics' });

db.ResponseMetrics.belongsTo(db.Message, { foreignKey: 'initial_message_id', as: 'initialMessage' });
db.ResponseMetrics.belongsTo(db.Message, { foreignKey: 'response_message_id', as: 'responseMessage' });

// ProviderPortfolio associations
db.ProviderPortfolio.belongsTo(db.User, { foreignKey: 'provider_id', as: 'provider' });
db.User.hasMany(db.ProviderPortfolio, { foreignKey: 'provider_id', as: 'portfolioImages' });

module.exports = db;