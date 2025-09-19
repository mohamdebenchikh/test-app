'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('response_metrics', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      provider_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Conversations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      initial_message_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Messages',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      response_message_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Messages',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      response_time_minutes: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      responded_within_24h: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
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

    // Add indexes for efficient querying
    await queryInterface.addIndex('response_metrics', ['provider_id']);
    await queryInterface.addIndex('response_metrics', ['createdAt']);
    await queryInterface.addIndex('response_metrics', ['provider_id', 'createdAt']);
    await queryInterface.addIndex('response_metrics', ['conversation_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('response_metrics');
  }
};