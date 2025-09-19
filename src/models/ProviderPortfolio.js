/**
 * @fileoverview Defines the ProviderPortfolio model for Sequelize.
 * @module models/ProviderPortfolio
 */

/**
 * Defines the ProviderPortfolio model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The ProviderPortfolio model.
 */
module.exports = (sequelize, DataTypes) => {
  /**
   * @class ProviderPortfolio
   * @classdesc The ProviderPortfolio model for storing provider portfolio images.
   * @property {string} id - The UUID of the portfolio entry.
   * @property {string} provider_id - The UUID of the provider user.
   * @property {string} image_url - The full-size image URL/path.
   * @property {string} thumbnail_url - The thumbnail image URL/path (150x150).
   * @property {string} medium_url - The medium-size image URL/path (400x400).
   * @property {string} description - Optional image description/caption.
   * @property {number} display_order - For image ordering (drag-and-drop).
   * @property {number} file_size - Original file size in bytes.
   * @property {string} mime_type - Image MIME type.
   * @property {string} original_filename - Original uploaded filename.
   */
  const ProviderPortfolio = sequelize.define(
    'ProviderPortfolio',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      provider_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        validate: {
          async isProvider(value) {
            const user = await sequelize.models.User.findByPk(value);
            if (!user) {
              throw new Error('Provider user not found');
            }
            if (user.role !== 'provider') {
              throw new Error('Portfolio can only be created for providers');
            }
          }
        }
      },
      image_url: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: 'Image URL cannot be empty'
          }
        }
      },
      thumbnail_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      medium_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: {
            args: [0, 1000],
            msg: 'Description must be less than 1000 characters'
          }
        }
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: {
            args: [0],
            msg: 'Display order must be non-negative'
          }
        }
      },
      file_size: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: {
            args: [1],
            msg: 'File size must be greater than 0'
          }
        }
      },
      mime_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          isIn: {
            args: [['image/jpeg', 'image/jpg', 'image/png', 'image/webp']],
            msg: 'MIME type must be a valid image type (JPEG, PNG, WebP)'
          }
        }
      },
      original_filename: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: 'Original filename cannot be empty'
          }
        }
      },
    },
    {
      tableName: 'provider_portfolios',
      timestamps: true,
      indexes: [
        {
          fields: ['provider_id'],
        },
        {
          fields: ['provider_id', 'display_order'],
        },
        {
          fields: ['createdAt'],
        },
      ],
      hooks: {
        beforeCreate: async (portfolioItem, options) => {
          // Validate that the provider_id belongs to a user with role 'provider'
          const user = await sequelize.models.User.findByPk(portfolioItem.provider_id);
          if (!user) {
            throw new Error('Provider user not found');
          }
          if (user.role !== 'provider') {
            throw new Error('Portfolio can only be created for providers');
          }

          // Auto-set display_order if not provided
          if (portfolioItem.display_order === 0 || portfolioItem.display_order === null) {
            const maxOrder = await ProviderPortfolio.max('display_order', {
              where: { provider_id: portfolioItem.provider_id }
            });
            portfolioItem.display_order = (maxOrder || 0) + 1;
          }
        },
        beforeUpdate: async (portfolioItem, options) => {
          // Validate provider role if provider_id is being updated
          if (portfolioItem.changed('provider_id')) {
            const user = await sequelize.models.User.findByPk(portfolioItem.provider_id);
            if (!user) {
              throw new Error('Provider user not found');
            }
            if (user.role !== 'provider') {
              throw new Error('Portfolio can only be updated for providers');
            }
          }
        }
      }
    }
  );

  /**
   * Get portfolio images for a provider with ordering
   * @param {string} providerId - The provider's user ID
   * @param {object} options - Query options
   * @returns {Promise<Array>} Array of portfolio items
   */
  ProviderPortfolio.getProviderPortfolio = async function(providerId, options = {}) {
    const { limit, offset, includePrivate = false } = options;
    
    const queryOptions = {
      where: { provider_id: providerId },
      order: [['display_order', 'ASC'], ['createdAt', 'ASC']],
    };

    if (limit) queryOptions.limit = limit;
    if (offset) queryOptions.offset = offset;

    return await this.findAll(queryOptions);
  };

  /**
   * Update display order for multiple portfolio items
   * @param {string} providerId - The provider's user ID
   * @param {Array} orderUpdates - Array of {id, display_order} objects
   * @returns {Promise<boolean>} Success status
   */
  ProviderPortfolio.updateDisplayOrder = async function(providerId, orderUpdates) {
    const transaction = await sequelize.transaction();
    
    try {
      for (const update of orderUpdates) {
        const [affectedRows] = await this.update(
          { display_order: update.display_order },
          { 
            where: { 
              id: update.id, 
              provider_id: providerId 
            },
            transaction 
          }
        );
        
        // If no rows were affected, the item doesn't exist or doesn't belong to the provider
        if (affectedRows === 0) {
          throw new Error(`Portfolio item ${update.id} not found or does not belong to provider`);
        }
      }
      
      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  /**
   * Get portfolio count for a provider
   * @param {string} providerId - The provider's user ID
   * @returns {Promise<number>} Number of portfolio items
   */
  ProviderPortfolio.getPortfolioCount = async function(providerId) {
    return await this.count({
      where: { provider_id: providerId }
    });
  };

  return ProviderPortfolio;
};