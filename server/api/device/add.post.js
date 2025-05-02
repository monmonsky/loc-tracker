// server/api/device/add.post.js
import redis, { DEVICES_KEY } from '~/utils/redis'

export default defineEventHandler(async (event) => {
  try {
    // Dapatkan body request
    let body = {}
    try {
      body = await readBody(event) || {}
    } catch (e) {
      // Jika tidak ada body, gunakan object kosong
      body = {}
    }
    
    console.log('Body:', body)
    
    const devicesStr = await redis.get(DEVICES_KEY)
    const devices = devicesStr ? JSON.parse(devicesStr) : []
    
    const newDevice = {
      id: Date.now(),
      name: body.name || `Device ${devices.length + 1}`,
      status: 'inactive',
      location: null,
      trackingLink: null,
      lastUpdate: Date.now()
    }
    
    devices.push(newDevice)
    await redis.set(DEVICES_KEY, JSON.stringify(devices))
    
    console.log('Device added:', newDevice)
    return newDevice
  } catch (error) {
    console.error('Error adding device:', error)
    return createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: `Failed to add device: ${error.message}`
    })
  }
})