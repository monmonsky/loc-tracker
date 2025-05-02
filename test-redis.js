// test-redis.js
import Redis from 'ioredis'

const testRedis = async () => {
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
  })

  try {
    console.log('Testing Redis connection...')
    const result = await redis.ping()
    console.log('Redis ping result:', result)
    
    // Test set/get
    await redis.set('test_key', 'test_value')
    const value = await redis.get('test_key')
    console.log('Test value:', value)
    
    console.log('Redis test passed!')
  } catch (error) {
    console.error('Redis test failed:', error)
  } finally {
    await redis.quit()
  }
}

testRedis()