const { Notification, User, ServiceRequest, Service, City, ProviderService } = require('../models');
const httpStatus = require('http-status').default;
const ApiError = require('../utils/ApiError');
const { broadcastPresenceUpdate } = require('../utils/presenceBroadcast');

/**
 * Create a notification
 * @param {Object} notificationBody
 * @returns {Promise<Notification>}
 */
const createNotification = async (notificationBody) => {
  const notification = await Notification.create(notificationBody);
  return notification;
};

/**
 * Get notifications by user id with sender presence information
 * @param {string} userId
 * @param {Object} options - Query options
 * @returns {Promise<Notification[]>}
 */
const getNotificationsByUserId = async (userId, options = {}) => {
  const { read, limit = 10, offset = 0, includePresence = false } = options;
  
  const whereClause = { user_id: userId };
  if (read !== undefined) {
    whereClause.read = read;
  }
  
  const notifications = await Notification.findAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  // Add presence information if requested
  if (includePresence) {
    const notificationsWithPresence = await Promise.all(
      notifications.map(async (notification) => {
        const notificationData = notification.toJSON();
        
        // If notification has a related user (like from offers, messages, etc.)
        if (notificationData.data && notificationData.data.provider_id) {
          try {
            const relatedUser = await User.findByPk(notificationData.data.provider_id, {
              attributes: ['id', 'name', 'online_status', 'last_activity', 'show_online_status', 'custom_status_message']
            });
            
            if (relatedUser) {
              notificationData.relatedUserPresence = relatedUser.getPresenceInfo();
            }
          } catch (error) {
            // Continue without presence info if there's an error
          }
        }
        
        return notificationData;
      })
    );
    
    return notificationsWithPresence;
  }
  
  return notifications;
};

/**
 * Get notification by id
 * @param {string} notificationId
 * @returns {Promise<Notification>}
 */
const getNotificationById = async (notificationId) => {
  return Notification.findByPk(notificationId);
};

/**
 * Update notification by id
 * @param {string} notificationId
 * @param {Object} updateBody
 * @returns {Promise<Notification>}
 */
const updateNotificationById = async (notificationId, updateBody) => {
  const notification = await getNotificationById(notificationId);
  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Notification not found');
  }
  Object.assign(notification, updateBody);
  await notification.save();
  return notification;
};

/**
 * Mark notification as read
 * @param {string} notificationId
 * @returns {Promise<Notification>}
 */
const markAsRead = async (notificationId) => {
  return updateNotificationById(notificationId, { read: true });
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId
 * @returns {Promise<number>}
 */
const markAllAsRead = async (userId) => {
  return Notification.update(
    { read: true },
    { where: { user_id: userId, read: false } }
  );
};

/**
 * Delete notification by id
 * @param {string} notificationId
 * @returns {Promise<Notification>}
 */
const deleteNotificationById = async (notificationId) => {
  const notification = await getNotificationById(notificationId);
  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Notification not found');
  }
  await notification.destroy();
  return notification;
};

/**
 * Create notifications for service request
 * @param {ServiceRequest} serviceRequest
 * @returns {Promise<void>}
 */
const createServiceRequestNotifications = async (serviceRequest) => {
  // Find all providers in the same city who provide the same service
  const providers = await User.findAll({
    include: [
      {
        model: Service,
        through: {
          where: {
            service_id: serviceRequest.service_id
          },
          attributes: []
        },
        attributes: []
      }
    ],
    where: {
      city_id: serviceRequest.city_id,
      role: 'provider',
      active: true
    }
  });

  // Create a notification for each provider
  const notifications = providers.map(provider => ({
    user_id: provider.id,
    type: 'service_request',
    title: 'New Service Request in Your Area',
    message: `A new service request for ${serviceRequest.title} has been posted in your city.`,
    data: {
      service_request_id: serviceRequest.id,
      client_id: serviceRequest.client_id,
      service_id: serviceRequest.service_id,
      city_id: serviceRequest.city_id
    },
    related_id: serviceRequest.id,
    related_type: 'service_request'
  }));

  if (notifications.length > 0) {
    await Notification.bulkCreate(notifications);
  }
};

/**
 * Create notification for new offer
 * @param {Offer} offer
 * @param {ServiceRequest} serviceRequest
 * @param {User} provider
 * @returns {Promise<void>}
 */
const createOfferNotification = async (offer, serviceRequest, provider) => {
  const notification = {
    user_id: serviceRequest.client_id,
    type: 'offer',
    title: 'New Offer Received',
    message: `${provider.name} has made an offer of $${offer.price} for your service request "${serviceRequest.title}".`,
    data: {
      offer_id: offer.id,
      service_request_id: serviceRequest.id,
      provider_id: provider.id,
      price: offer.price
    },
    related_id: offer.id,
    related_type: 'offer'
  };

  await Notification.create(notification);
};

/**
 * Send real-time notification with presence information
 * @param {object} io - Socket.IO server instance
 * @param {string} userId - The user to send notification to
 * @param {object} notificationData - The notification data
 * @param {object} options - Additional options
 * @returns {Promise<void>}
 */
const sendRealtimeNotification = async (io, userId, notificationData, options = {}) => {
  try {
    const { includePresence = false, senderId = null } = options;
    
    let enhancedNotification = { ...notificationData };
    
    // Add sender presence information if requested and sender is provided
    if (includePresence && senderId) {
      const sender = await User.findByPk(senderId, {
        attributes: ['id', 'name', 'online_status', 'last_activity', 'show_online_status', 'custom_status_message']
      });
      
      if (sender) {
        enhancedNotification.senderPresence = sender.getPresenceInfo();
      }
    }
    
    // Send notification to user's room
    io.to(userId).emit('newNotification', enhancedNotification);
    
  } catch (error) {
    console.error('Error sending realtime notification:', error);
  }
};

/**
 * Create and send chat message notification with presence
 * @param {object} io - Socket.IO server instance
 * @param {string} recipientId - The recipient user ID
 * @param {string} senderId - The sender user ID
 * @param {string} messageContent - The message content
 * @returns {Promise<void>}
 */
const createChatNotification = async (io, recipientId, senderId, messageContent) => {
  try {
    const sender = await User.findByPk(senderId, {
      attributes: ['id', 'name', 'avatar', 'online_status', 'last_activity', 'show_online_status', 'custom_status_message']
    });
    
    if (!sender) {
      return;
    }
    
    const notificationData = {
      type: 'chat_message',
      title: 'New Message',
      message: `${sender.name}: ${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}`,
      data: {
        sender_id: senderId,
        sender_name: sender.name,
        sender_avatar: sender.avatar
      },
      timestamp: new Date()
    };
    
    // Send real-time notification with presence information
    await sendRealtimeNotification(io, recipientId, notificationData, {
      includePresence: true,
      senderId: senderId
    });
    
  } catch (error) {
    console.error('Error creating chat notification:', error);
  }
};

module.exports = {
  createNotification,
  getNotificationsByUserId,
  getNotificationById,
  updateNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotificationById,
  createServiceRequestNotifications,
  createOfferNotification,
  sendRealtimeNotification,
  createChatNotification
};