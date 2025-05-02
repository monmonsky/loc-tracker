// server/api/devices.get.js
import redis, { DEVICES_KEY } from '~/utils/redis'

export default defineEventHandler(async () => {
  try {
    const devicesStr = await redis.get(DEVICES_KEY)
    
    if (!devicesStr) {
      return []
    }
    
    return JSON.parse(devicesStr)
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch devices'
    })
  }
})