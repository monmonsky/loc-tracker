// server/api/notifications.post.js
import redis from '~/utils/redis'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  try {
    // Get existing notifications
    const notificationsStr = await redis.get('device-notifications')
    const notifications = notificationsStr ? JSON.parse(notificationsStr) : []
    
    // Add new notification
    const newNotification = {
      id: Date.now(),
      deviceId: body.deviceId,
      deviceName: body.deviceName,
      type: 'movement',
      timestamp: Date.now(),
      location: body.location,
      accuracy: body.accuracy
    }
    
    notifications.unshift(newNotification)
    
    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications.pop()
    }
    
    // Save back to Redis
    await redis.set('device-notifications', JSON.stringify(notifications))
    
    return newNotification
  } catch (error) {
    console.error('Error saving notification:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to save notification'
    })
  }
})