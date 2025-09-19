'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'average_response_time_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Cached average response time in minutes'
    });

    await queryInterface.addColumn('users', 'response_rate_percentage', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Cached response rate as percentage'
    });

    await queryInterface.addColumn('users', 'metrics_last_updated', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When metrics were last calculated'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'average_response_time_minutes');
    await queryInterface.removeColumn('users', 'response_rate_percentage');
    await queryInterface.removeColumn('users', 'metrics_last_updated');
  }
};