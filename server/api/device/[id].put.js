// server/api/device/[id].put.js
import redis, { DEVICES_KEY } from '~/utils/redis'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  
  try {
    const devicesStr = await redis.get(DEVICES_KEY)
    
    if (!devicesStr) {
      throw createError({
        statusCode: 404,
        message: 'Device not found'
      })
    }
    
    const devices = JSON.parse(devicesStr)
    const deviceIndex = devices.findIndex(d => d.id === parseInt(id))
    
    if (deviceIndex === -1) {
      throw createError({
        statusCode: 404,
        message: 'Device not found'
      })
    }
    
    // Jika memperbarui lokasi, simpan history
    if (body.location) {
      if (!devices[deviceIndex].locationHistory) {
        devices[deviceIndex].locationHistory = []
      }
      devices[deviceIndex].locationHistory.push({
        location: body.location,
        timestamp: Date.now()
      })
      
      // Batasi history ke 100 lokasi terakhir
      if (devices[deviceIndex].locationHistory.length > 100) {
        devices[deviceIndex].locationHistory.shift()
      }
    }
    
    devices[deviceIndex] = {
      ...devices[deviceIndex],
      ...body,
      lastUpdate: Date.now()
    }
    
    await redis.set(DEVICES_KEY, JSON.stringify(devices))
    
    return devices[deviceIndex]
  } catch (error) {
    console.error('Update error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to update device'
    })
  }
})