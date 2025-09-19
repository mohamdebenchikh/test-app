'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'online_status', {
      type: Sequelize.ENUM('online', 'offline', 'away', 'dnd'),
      defaultValue: 'offline',
      allowNull: false,
    });

    await queryInterface.addColumn('users', 'last_activity', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'show_online_status', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    });

    await queryInterface.addColumn('users', 'custom_status_message', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    // Add indexes for performance optimization
    await queryInterface.addIndex('users', ['online_status'], {
      name: 'idx_users_online_status'
    });

    await queryInterface.addIndex('users', ['last_activity'], {
      name: 'idx_users_last_activity'
    });

    await queryInterface.addIndex('users', ['city_id', 'online_status'], {
      name: 'idx_users_city_online_status'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first
    await queryInterface.removeIndex('users', 'idx_users_online_status');
    await queryInterface.removeIndex('users', 'idx_users_last_activity');
    await queryInterface.removeIndex('users', 'idx_users_city_online_status');

    // Remove columns
    await queryInterface.removeColumn('users', 'online_status');
    await queryInterface.removeColumn('users', 'last_activity');
    await queryInterface.removeColumn('users', 'show_online_status');
    await queryInterface.removeColumn('users', 'custom_status_message');
  }
};