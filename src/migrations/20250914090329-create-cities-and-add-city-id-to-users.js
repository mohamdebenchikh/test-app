'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cities', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name_en: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      name_ar: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      name_fr: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      lng: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      lat: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addColumn('users', 'city_id', {
      type: Sequelize.UUID,
      references: {
        model: 'cities',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'city_id');
    await queryInterface.dropTable('cities');
  }
};