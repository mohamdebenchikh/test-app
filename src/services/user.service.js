const { User, Service, ProviderService, ProviderPortfolio, sequelize, Token, City } = require('../models');
const { Op } = require('sequelize');
const httpStatus = require('http-status').default;
const ApiError = require('../utils/ApiError');
const { hashPassword } = require('../utils/password');
const PortfolioService = require('./portfolio.service');

const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  // Hash the password before storing
  const hashedPassword = await hashPassword(userBody.password);
  const user = await User.create({ ...userBody, password: hashedPassword });
  return user;
};

const getUserById = async (id) => {
  return User.findByPk(id);
};

const getUserByEmail = async (email) => {
  return User.findOne({ where: { email } });
};

const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  Object.assign(user, updateBody);
  await user.save();
  return user;
};

const updateUserPassword = async (userId, body) => {
  const user = await getUserById(userId);
  if (!user || !(await user.isPasswordMatch(body.oldPassword))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect old password');
  }
  // Hash the new password before updating
  const hashedNewPassword = await hashPassword(body.newPassword);
  await updateUserById(userId, { password: hashedNewPassword });
};

const updateAvatar = async (userId, avatarPath) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  user.avatar = avatarPath;
  await user.save();
  return user;
};

const deleteUserById = async (userId, password) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  // Verify password before deleting
  if (!(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect password');
  }
  
  console.log('Deactivating user with ID:', userId);
  
  // Soft delete: set active to false instead of deleting
  user.active = false;
  await user.save();
  
  return user;
};

const updateProviderServices = async (userId, serviceIds) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (user.role !== 'provider') {
    throw new ApiError(httpStatus.FORBIDDEN, 'User is not a provider');
  }

  const services = await Service.findAll({ where: { id: serviceIds } });
  if (services.length !== serviceIds.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'One or more services not found');
  }

  const t = await sequelize.transaction();
  try {
    await ProviderService.destroy({ where: { user_id: userId }, transaction: t });
    const providerServices = serviceIds.map((serviceId) => ({
      user_id: userId,
      service_id: serviceId,
    }));
    await ProviderService.bulkCreate(providerServices, { transaction: t });
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update services');
  }
};

/**
 * Helper function to convert time string to Date object
 * @param {string} timeString - Time string like '1h', '24h', '7d'
 * @returns {Date}
 */
const getTimeAgoDate = (timeString) => {
  const now = new Date();
  const value = parseInt(timeString);
  const unit = timeString.slice(-1);

  switch (unit) {
    case 'h':
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    case 'd':
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    case 'm':
      return new Date(now.getTime() - value * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24h
  }
};

/**
 * Query for providers with filtering and pagination
 * @param {Object} filter - Filter object
 * @param {Object} options - Query options (page, limit, sortBy, sortType)
 * @returns {Promise<QueryResult>}
 */
const queryProviders = async (filter, options) => {
  const { page = 1, limit = 10 } = options;
  const offset = (page - 1) * limit;

  // Build the where clause
  const whereClause = {
    role: 'provider',
    active: true
  };

  // Add name filter if provided
  if (filter.name) {
    // Use like for SQLite (case-insensitive in SQLite by default)
    // Use iLike for PostgreSQL
    const { sequelize } = require('../models');
    const likeOperator = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
    whereClause.name = {
      [likeOperator]: `%${filter.name}%`
    };
  }

  // Add city filter if provided
  if (filter.cityId) {
    whereClause.city_id = filter.cityId;
  }

  // Add presence filters
  if (filter.online_status) {
    whereClause.online_status = filter.online_status;
  }

  if (filter.last_seen) {
    const timeAgo = getTimeAgoDate(filter.last_seen);
    whereClause.last_activity = {
      [Op.gte]: timeAgo
    };
  }

  if (filter.active_within) {
    const timeAgo = getTimeAgoDate(filter.active_within);
    whereClause[Op.or] = [
      { last_activity: { [Op.gte]: timeAgo } },
      { online_status: 'online' }
    ];
  }

  // Build the query options
  const queryOptions = {
    where: whereClause,
    offset,
    limit,
    include: [
      {
        model: City,
        as: 'City',
        attributes: ['id', 'name_en', 'name_ar', 'name_fr']
      }
    ],
    order: [
      // Prioritize online users first, then by last activity
      ['online_status', 'DESC'],
      ['last_activity', 'DESC'],
      ['createdAt', 'DESC']
    ]
  };

  // Add service filter if provided
  if (filter.serviceId) {
    queryOptions.include.push({
      model: Service,
      as: 'Services',
      where: { id: filter.serviceId },
      through: { attributes: [] }, // Don't include ProviderService attributes
      required: true
    });
  }

  const { count, rows } = await User.findAndCountAll(queryOptions);

  // Add average rating, presence info, and portfolio preview to each provider
  const portfolioService = new PortfolioService();
  for (const provider of rows) {
    provider.dataValues.averageRating = await provider.getAverageRating();
    provider.dataValues.presence = provider.getPresenceInfo();
    provider.dataValues.last_seen_text = provider.getLastSeenText();
    provider.dataValues.is_online = provider.isOnline();
    
    // Add portfolio preview (first 3 images) for browse functionality
    try {
      const portfolioResult = await portfolioService.getProviderPortfolio(provider.id, { 
        includePrivate: false, 
        limit: 3 
      });
      
      if (portfolioResult.success && portfolioResult.data.portfolio.length > 0) {
        provider.dataValues.portfolioPreview = portfolioResult.data.portfolio;
        provider.dataValues.hasPortfolio = true;
        provider.dataValues.portfolioUrls = generatePortfolioUrls(provider.id, 'browse');
      } else {
        provider.dataValues.portfolioPreview = [];
        provider.dataValues.hasPortfolio = false;
        provider.dataValues.portfolioPlaceholder = getPortfolioPlaceholder('browse');
        provider.dataValues.portfolioUrls = generatePortfolioUrls(provider.id, 'browse');
      }
    } catch (error) {
      // If portfolio service fails, set empty portfolio preview
      console.warn(`Failed to load portfolio preview for provider ${provider.id}:`, error.message);
      provider.dataValues.portfolioPreview = [];
      provider.dataValues.hasPortfolio = false;
      provider.dataValues.portfolioPlaceholder = getPortfolioPlaceholder('default');
      provider.dataValues.portfolioUrls = generatePortfolioUrls(provider.id, 'browse');
    }
  }

  return {
    results: rows,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
    totalResults: count,
  };
};

/**
 * Query for clients with filtering and pagination
 * @param {Object} filter - Filter object
 * @param {Object} options - Query options (page, limit, sortBy, sortType)
 * @returns {Promise<QueryResult>}
 */
const queryClients = async (filter, options) => {
  const { page = 1, limit = 10 } = options;
  const offset = (page - 1) * limit;

  // Build the where clause
  const whereClause = {
    role: 'client',
    active: true
  };

  // Add name filter if provided
  if (filter.name) {
    // Use like for SQLite (case-insensitive in SQLite by default)
    // Use iLike for PostgreSQL
    const { sequelize } = require('../models');
    const likeOperator = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
    whereClause.name = {
      [likeOperator]: `%${filter.name}%`
    };
  }

  // Add city filter if provided
  if (filter.cityId) {
    whereClause.city_id = filter.cityId;
  }

  // Build the query options
  const queryOptions = {
    where: whereClause,
    offset,
    limit,
    include: [
      {
        model: City,
        as: 'City',
        attributes: ['id', 'name_en', 'name_ar', 'name_fr']
      }
    ]
  };

  const { count, rows } = await User.findAndCountAll(queryOptions);

  return {
    results: rows,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
    totalResults: count,
  };
};

/**
 * Get provider profile with services and average rating
 * @param {string} providerId
 * @returns {Promise<User>}
 */
const getProviderProfile = async (providerId) => {
  const provider = await User.findOne({
    where: {
      id: providerId,
      role: 'provider',
      active: true
    },
    include: [
      {
        model: City,
        as: 'City',
        attributes: ['id', 'name_en', 'name_ar', 'name_fr']
      },
      {
        model: Service,
        as: 'Services',
        through: { attributes: [] } // Don't include ProviderService attributes
      }
    ]
  });

  if (!provider) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Provider not found');
  }

  // Add average rating, presence info, and response metrics
  provider.dataValues.averageRating = await provider.getAverageRating();
  provider.dataValues.presence = provider.getPresenceInfo();
  provider.dataValues.last_seen_text = provider.getLastSeenText();
  provider.dataValues.is_online = provider.isOnline();
  provider.dataValues.responseMetrics = await provider.getPublicResponseMetrics();

  // Add portfolio data for providers
  try {
    const portfolioService = new PortfolioService();
    const portfolioResult = await portfolioService.getProviderPortfolio(providerId, { includePrivate: false });
    
    if (portfolioResult.success && portfolioResult.data.portfolio.length > 0) {
      provider.dataValues.portfolio = portfolioResult.data.portfolio;
      provider.dataValues.portfolioUrls = generatePortfolioUrls(providerId, 'profile');
    } else {
      provider.dataValues.portfolio = [];
      provider.dataValues.portfolioPlaceholder = getPortfolioPlaceholder('profile');
      provider.dataValues.portfolioUrls = generatePortfolioUrls(providerId, 'profile');
    }
  } catch (error) {
    // If portfolio service fails, set empty portfolio with placeholder
    console.warn('Failed to load portfolio for provider:', error.message);
    provider.dataValues.portfolio = [];
    provider.dataValues.portfolioPlaceholder = getPortfolioPlaceholder('default');
    provider.dataValues.portfolioUrls = generatePortfolioUrls(providerId, 'profile');
  }

  // Remove sensitive fields from public profile
  const publicProvider = provider.toJSON();
  delete publicProvider.password;
  delete publicProvider.verify;
  delete publicProvider.average_response_time_minutes;
  delete publicProvider.response_rate_percentage;
  delete publicProvider.metrics_last_updated;

  return publicProvider;
};

/**
 * Get client profile
 * @param {string} clientId
 * @returns {Promise<User>}
 */
const getClientProfile = async (clientId) => {
  const client = await User.findOne({
    where: {
      id: clientId,
      role: 'client',
      active: true
    },
    include: [
      {
        model: City,
        as: 'City',
        attributes: ['id', 'name_en', 'name_ar', 'name_fr']
      }
    ]
  });

  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }

  // Remove sensitive fields from public profile
  const publicClient = client.toJSON();
  delete publicClient.password;
  delete publicClient.verify;
  delete publicClient.average_response_time_minutes;
  delete publicClient.response_rate_percentage;
  delete publicClient.metrics_last_updated;

  return publicClient;
};

/**
 * Generate portfolio URLs for different contexts
 * @param {string} providerId - The provider's user ID
 * @param {string} context - Context for URL generation ('profile', 'browse', 'search')
 * @returns {Object} Portfolio URLs object
 */
const generatePortfolioUrls = (providerId, context = 'profile') => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  return {
    publicPortfolio: `${baseUrl}/api/users/${providerId}/portfolio`,
    profileView: `${baseUrl}/api/users/providers/${providerId}/profile`,
    context: context
  };
};

/**
 * Get portfolio placeholder message based on context
 * @param {string} context - Context for placeholder message
 * @returns {string} Placeholder message
 */
const getPortfolioPlaceholder = (context = 'profile') => {
  const placeholders = {
    profile: 'This provider has not added any portfolio images yet.',
    browse: 'No portfolio images available',
    search: 'No portfolio',
    default: 'Portfolio images are currently unavailable.'
  };
  
  return placeholders[context] || placeholders.default;
};

module.exports = {
  createUser,
  getUserById,
  getUserByEmail,
  updateUserById,
  updateUserPassword,
  updateAvatar,
  deleteUserById,
  updateProviderServices,
  queryProviders,
  queryClients,
  getProviderProfile,
  getClientProfile,
  generatePortfolioUrls,
  getPortfolioPlaceholder,
};