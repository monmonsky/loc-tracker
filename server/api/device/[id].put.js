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
    
    // Ambil informasi device jika tracking dimulai dari client
    const req = event.node.req
    const deviceInfo = {
      userAgent: req.headers['user-agent'] || '',
      ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '',
      ...parseDeviceInfo(req.headers['user-agent'])
    }
    
    // Jika memperbarui lokasi, cek apakah lokasi berbeda baru simpan ke history
    if (body.location) {
      const isNewLocation = !devices[deviceIndex].location || 
        devices[deviceIndex].location.lat !== body.location.lat || 
        devices[deviceIndex].location.lon !== body.location.lon;
      
      if (isNewLocation) {
        if (!devices[deviceIndex].locationHistory) {
          devices[deviceIndex].locationHistory = []
        }
        
        // Cek apakah ada perubahan signifikan (minimal 5 meter)
        const lastHistory = devices[deviceIndex].locationHistory[devices[deviceIndex].locationHistory.length - 1]
        const shouldAdd = !lastHistory || 
          calculateDistance(
            lastHistory.location.lat, 
            lastHistory.location.lon, 
            body.location.lat, 
            body.location.lon
          ) > 0.005; // ~5 meter
        
        if (shouldAdd) {
          devices[deviceIndex].locationHistory.push({
            location: body.location,
            timestamp: Date.now()
          })
          
          // Batasi history ke 100 lokasi terakhir
          if (devices[deviceIndex].locationHistory.length > 100) {
            devices[deviceIndex].locationHistory.shift()
          }
        }
      }
    }
    
    devices[deviceIndex] = {
      ...devices[deviceIndex],
      ...body,
      deviceInfo: body.location ? deviceInfo : devices[deviceIndex].deviceInfo, // Update device info hanya saat ada lokasi
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

function parseDeviceInfo(userAgent) {
  const info = {
    browser: 'Unknown',
    os: 'Unknown',
    device: 'Unknown',
    brand: 'Unknown'
  }
  
  if (!userAgent) return info
  
  // Browser detection
  if (userAgent.includes('Chrome')) info.browser = 'Chrome'
  else if (userAgent.includes('Firefox')) info.browser = 'Firefox'
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) info.browser = 'Safari'
  else if (userAgent.includes('Edge')) info.browser = 'Edge'
  else if (userAgent.includes('MSIE') || userAgent.includes('Trident')) info.browser = 'Internet Explorer'
  
  // OS Detection
  if (/iPhone/.test(userAgent)) {
    info.os = 'iOS'
    info.device = 'iPhone'
    info.brand = 'Apple'
    
    // iPhone model detection
    const match = userAgent.match(/iPhone OS (\d+_\d+)/);
    if (match) {
      info.os = `iOS ${match[1].replace('_', '.')}`
    }
  } else if (/iPad/.test(userAgent)) {
    info.os = 'iPadOS'
    info.device = 'iPad'
    info.brand = 'Apple'
    
    const match = userAgent.match(/OS (\d+_\d+)/);
    if (match) {
      info.os = `iPadOS ${match[1].replace('_', '.')}`
    }
  } else if (/Android/.test(userAgent)) {
    info.os = 'Android'
    
    // Android device detection
    if (/Mobile/.test(userAgent)) {
      info.device = 'Android Phone'
    } else if (/Tablet/.test(userAgent)) {
      info.device = 'Android Tablet'
    } else {
      info.device = 'Android Device'
    }
    
    // Try to get brand from user agent
    const brandMatch = userAgent.match(/;\s+([^;]+)\s+[a-zA-Z0-9-_]+\)/)
    if (brandMatch) {
      info.brand = brandMatch[1].split(' ')[0]
    }
    
    // Android version
    const androidMatch = userAgent.match(/Android\s*([\d\.]+)/);
    if (androidMatch) {
      info.os = `Android ${androidMatch[1]}`
    }
  } else if (/Macintosh/.test(userAgent)) {
    info.os = 'macOS'
    info.device = 'Mac'
    info.brand = 'Apple'
    
    const macMatch = userAgent.match(/Mac OS X (10[._]\d+)/);
    if (macMatch) {
      info.os = `macOS ${macMatch[1].replace('_', '.')}`
    }
  } else if (/Windows/.test(userAgent)) {
    info.os = 'Windows'
    info.device = 'Windows PC'
    info.brand = 'PC'
    
    const winMatch = userAgent.match(/Windows NT (\d+\.\d+)/);
    if (winMatch) {
      info.os = `Windows ${getWindowsVersion(winMatch[1])}`
    }
  }
  
  return info
}

function getWindowsVersion(ntVersion) {
  const versions = {
    '10.0': '10',
    '6.3': '8.1',
    '6.2': '8',
    '6.1': '7',
    '6.0': 'Vista',
    '5.1': 'XP'
  }
  return versions[ntVersion] || ntVersion
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius bumi dalam km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}