// server/api/device/[id].delete.js
import redis, { DEVICES_KEY } from '~/utils/redis'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  
  try {
    const devicesStr = await redis.get(DEVICES_KEY)
    
    if (!devicesStr) {
      throw createError({
        statusCode: 404,
        message: 'Device not found'
      })
    }
    
    const devices = JSON.parse(devicesStr)
    const filteredDevices = devices.filter(d => d.id !== parseInt(id))
    
    await redis.set(DEVICES_KEY, JSON.stringify(filteredDevices))
    
    return { success: true }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to delete device'
    })
  }
})