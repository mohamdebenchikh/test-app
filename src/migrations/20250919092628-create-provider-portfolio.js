'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('provider_portfolios', {
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
      image_url: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Full-size image URL/path'
      },
      thumbnail_url: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Thumbnail image URL/path (150x150)'
      },
      medium_url: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Medium-size image URL/path (400x400)'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional image description/caption'
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'For image ordering (drag-and-drop)'
      },
      file_size: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Original file size in bytes'
      },
      mime_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Image MIME type (image/jpeg, image/png, etc.)'
      },
      original_filename: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Original uploaded filename'
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
    await queryInterface.addIndex('provider_portfolios', ['provider_id']);
    await queryInterface.addIndex('provider_portfolios', ['provider_id', 'display_order']);
    await queryInterface.addIndex('provider_portfolios', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('provider_portfolios');
  }
};
