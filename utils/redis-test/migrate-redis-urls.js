// migrate-redis-urls.js
import Redis from 'ioredis'

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || '',
})

const DEVICES_KEY = 'devices'

async function migrateUrls() {
  try {
    // Get current data
    const devicesStr = await redis.get(DEVICES_KEY)
    
    if (!devicesStr) {
      console.log('No devices found in Redis')
      return
    }
    
    const devices = JSON.parse(devicesStr)
    console.log(`Found ${devices.length} devices`)
    
    // Update URLs
    let updatedCount = 0
    devices.forEach(device => {
      if (device.trackingLink && device.trackingLink.includes('point.cepetsugih.com')) {
        device.trackingLink = device.trackingLink.replace('point.cepetsugih.com', 'makeovershop.store')
        updatedCount++
      }
      
      // Update PWA link if exists
      if (device.pwaLink && device.pwaLink.includes('point.cepetsugih.com')) {
        device.pwaLink = device.pwaLink.replace('point.cepetsugih.com', 'makeovershop.store')
      }
    })
    
    console.log(`Updated ${updatedCount} tracking links`)
    
    // Save back to Redis
    await redis.set(DEVICES_KEY, JSON.stringify(devices))
    console.log('Migration completed successfully!')
    
    // Show some examples
    devices.slice(0, 3).forEach((device, index) => {
      console.log(`\nDevice ${index + 1}:`)
      console.log(`Name: ${device.name}`)
      console.log(`Tracking Link: ${device.trackingLink || 'none'}`)
      console.log(`PWA Link: ${device.pwaLink || 'none'}`)
    })
    
  } catch (error) {
    console.error('Error migrating URLs:', error)
  } finally {
    await redis.quit()
  }
}

// Run migration
console.log('Starting URL migration...')
migrateUrls()