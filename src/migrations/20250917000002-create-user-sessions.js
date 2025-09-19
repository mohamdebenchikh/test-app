'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      socket_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      device_type: {
        type: Sequelize.ENUM('web', 'mobile', 'desktop'),
        allowNull: false,
        defaultValue: 'web',
      },
      ip_address: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      connected_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      last_ping: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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

    // Add indexes for performance optimization
    await queryInterface.addIndex('user_sessions', ['user_id'], {
      name: 'idx_user_sessions_user_id'
    });

    await queryInterface.addIndex('user_sessions', ['socket_id'], {
      name: 'idx_user_sessions_socket_id'
    });

    await queryInterface.addIndex('user_sessions', ['is_active'], {
      name: 'idx_user_sessions_is_active'
    });

    await queryInterface.addIndex('user_sessions', ['last_ping'], {
      name: 'idx_user_sessions_last_ping'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_sessions');
  }
};