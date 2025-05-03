// verify-redis-urls.js
import Redis from 'ioredis'

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || '',
})

const DEVICES_KEY = 'devices'

async function verifyUrls() {
  try {
    const devicesStr = await redis.get(DEVICES_KEY)
    
    if (!devicesStr) {
      console.log('No devices found in Redis')
      return
    }
    
    const devices = JSON.parse(devicesStr)
    console.log(`\nChecking ${devices.length} devices...`)
    
    let oldUrlCount = 0
    let newUrlCount = 0
    
    devices.forEach((device, index) => {
      if (device.trackingLink) {
        if (device.trackingLink.includes('point.cepetsugih.com')) {
          oldUrlCount++
          console.log(`\n⚠️ Device ${index + 1} still has old URL:`)
          console.log(`Name: ${device.name}`)
          console.log(`Link: ${device.trackingLink}`)
        } else if (device.trackingLink.includes('makeovershop.store')) {
          newUrlCount++
        }
      }
    })
    
    console.log(`\n📊 Summary:`)
    console.log(`- Devices with old URL: ${oldUrlCount}`)
    console.log(`- Devices with new URL: ${newUrlCount}`)
    console.log(`- Total devices: ${devices.length}`)
    
    if (oldUrlCount === 0 && newUrlCount > 0) {
      console.log('\n✅ Migration successful! All URLs updated.')
    } else if (oldUrlCount > 0) {
      console.log('\n❌ Some URLs still need to be updated.')
    }
    
  } catch (error) {
    console.error('Error verifying URLs:', error)
  } finally {
    await redis.quit()
  }
}

// Run verification
console.log('Starting URL verification...')
verifyUrls()