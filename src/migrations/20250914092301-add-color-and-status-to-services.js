'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('services', 'color', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('services', 'status', {
      type: Sequelize.ENUM('active', 'inactive'),
      defaultValue: 'active',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('services', 'color');
    await queryInterface.removeColumn('services', 'status');
  }
};