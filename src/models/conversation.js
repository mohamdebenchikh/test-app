'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Conversation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Conversation.belongsTo(models.User, {
        as: 'userOne',
        foreignKey: 'userOneId',
      });
      Conversation.belongsTo(models.User, {
        as: 'userTwo',
        foreignKey: 'userTwoId',
      });
      Conversation.hasMany(models.Message, {
        foreignKey: 'conversationId',
        as: 'messages',
      });
    }
  }
  Conversation.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userOneId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userTwoId: {
      type: DataTypes.UUID,
      allowNull: false,
    }
  }, {
    sequelize,
    modelName: 'Conversation',
  });
  return Conversation;
};