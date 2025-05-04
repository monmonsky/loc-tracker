// server/api/notifications.get.js
import redis from '~/utils/redis'

export default defineEventHandler(async (event) => {
  try {
    const notificationsStr = await redis.get('device-notifications')
    const notifications = notificationsStr ? JSON.parse(notificationsStr) : []
    
    // Get query parameters
    const deviceId = getQuery(event).deviceId
    const limit = parseInt(getQuery(event).limit || '20')
    
    // Filter by device if specified
    let filteredNotifications = notifications
    if (deviceId) {
      filteredNotifications = notifications.filter(n => n.deviceId === parseInt(deviceId))
    }
    
    // Limit results
    filteredNotifications = filteredNotifications.slice(0, limit)
    
    return filteredNotifications
  } catch (error) {
    console.error('Error fetching notifications:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch notifications'
    })
  }
})