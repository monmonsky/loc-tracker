// server/api/device/heartbeat.post.js
import redis from '~/utils/redis'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  try {
    const { deviceId, timestamp } = body
    
    if (!deviceId) {
      throw createError({
        statusCode: 400,
        message: 'Device ID is required'
      })
    }
    
    // Get current devices
    const devicesStr = await redis.get('devices')
    if (!devicesStr) {
      throw createError({
        statusCode: 404,
        message: 'Devices not found'
      })
    }
    
    const devices = JSON.parse(devicesStr)
    const deviceIndex = devices.findIndex(d => d.id === parseInt(deviceId))
    
    if (deviceIndex === -1) {
      throw createError({
        statusCode: 404,
        message: 'Device not found'
      })
    }
    
    // Update last heartbeat
    devices[deviceIndex].lastHeartbeat = timestamp || Date.now()
    
    // Store heartbeat history (optional)
    if (!devices[deviceIndex].heartbeats) {
      devices[deviceIndex].heartbeats = []
    }
    
    devices[deviceIndex].heartbeats.push({
      timestamp: timestamp || Date.now(),
      status: 'active'
    })
    
    // Keep only last 100 heartbeats
    if (devices[deviceIndex].heartbeats.length > 100) {
      devices[deviceIndex].heartbeats.shift()
    }
    
    // Update in Redis
    await redis.set('devices', JSON.stringify(devices))
    
    return { success: true }
  } catch (error) {
    console.error('Heartbeat error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to process heartbeat'
    })
  }
})