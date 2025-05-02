<template>
  <div class="container">
    <h1>Multi-Device Location Tracker</h1>
    
    <div class="devices-container">
      <div v-for="device in devices" :key="device.id" class="device-card">
        <div class="device-header">
          <span class="device-name">{{ device.name }}</span>
          <span :class="['status', device.status === 'active' ? 'status-active' : 'status-inactive']">
            {{ device.status }}
          </span>
          <span v-if="device.status === 'active'" class="tracking-indicator">
            📍 Real-time tracking
          </span>
        </div>
        
        <div v-if="device.location" class="location-info">
          Last Update: {{ formatTime(device.lastUpdate) }}
        </div>
        
        <div class="device-actions">
          <button @click="startTracking(device)" :disabled="device.status === 'active'" class="btn">
            {{ device.status === 'active' ? 'Tracking...' : 'Start Tracking' }}
          </button>
          <button @click="stopTracking(device)" :disabled="device.status === 'inactive'" class="btn">Stop</button>
          <button @click="showLocation(device)" :disabled="!device.location" class="btn">Show Location</button>
          <button @click="removeDevice(device)" class="btn btn-danger">Remove</button>
        </div>
        
        <div v-if="device.trackingLink" class="link-box">
          Tracking Link: {{ device.trackingLink }}
          <button @click="copyLink(device.trackingLink)" class="btn btn-copy">Copy</button>
        </div>
      </div>
    </div>
    
    <button @click="addDevice" class="btn btn-add">+ Add New Device</button>
    
    <!-- Modal for showing map -->
    <div v-if="showModal" class="overlay" @click="closeModal">
      <div class="map-modal" @click.stop>
        <span class="close-btn" @click="closeModal">&times;</span>
        <h3>Device Location</h3>
        <iframe 
          v-if="selectedLocation" 
          :src="`https://maps.google.com/maps?hl=en&q=${selectedLocation.lat},${selectedLocation.lon}&z=15&output=embed`"
          class="map-frame"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script setup>
const devices = ref([])
const showModal = ref(false)
const selectedLocation = ref(null)
const watchIds = reactive({}) // Untuk menyimpan watch position IDs

// Fetch devices saat mount
onMounted(async () => {
  await fetchDevices()
  // Polling untuk update devices setiap 5 detik
  setInterval(fetchDevices, 5000)
})

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}

const fetchDevices = async () => {
  try {
    const response = await $fetch('/api/devices')
    devices.value = response
  } catch (error) {
    console.error('Failed to fetch devices:', error)
  }
}

const addDevice = async () => {
  try {
    await $fetch('/api/device/add', { 
      method: 'POST',
      body: {}
    })
    await fetchDevices()
  } catch (error) {
    console.error('Failed to add device:', error)
    alert('Failed to add device: ' + error.message)
  }
}

const startTracking = async (device) => {
  if (!navigator.geolocation) {
    alert('Your browser does not support location tracking')
    return
  }

  // Mulai watch position untuk real-time tracking
  const watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const lat = position.coords.latitude
      const lon = position.coords.longitude
      
      const trackingLink = `${window.location.origin}?deviceId=${device.id}&lat=${lat}&lon=${lon}`
      
      try {
        await $fetch(`/api/device/${device.id}`, {
          method: 'PUT',
          body: {
            status: 'active',
            location: { lat, lon },
            trackingLink,
            accuracy: position.coords.accuracy
          }
        })
        
        // Tidak perlu fetch semua device setiap update
        // Hanya update device ini saja dalam local state
        const index = devices.value.findIndex(d => d.id === device.id)
        if (index !== -1) {
          devices.value[index].location = { lat, lon }
          devices.value[index].lastUpdate = Date.now()
        }
        
      } catch (error) {
        console.error('Failed to update device:', error)
      }
    },
    (error) => {
      console.error('Error getting location:', error)
      stopTracking(device)
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  )
  
  // Simpan watch ID untuk device ini
  watchIds[device.id] = watchId
}

const stopTracking = async (device) => {
  // Hentikan watching position
  if (watchIds[device.id]) {
    navigator.geolocation.clearWatch(watchIds[device.id])
    delete watchIds[device.id]
  }
  
  try {
    await $fetch(`/api/device/${device.id}`, {
      method: 'PUT',
      body: {
        status: 'inactive',
        location: null,
        trackingLink: null
      }
    })
    await fetchDevices()
  } catch (error) {
    console.error('Failed to stop tracking:', error)
  }
}

const showLocation = (device) => {
  if (device.location) {
    selectedLocation.value = device.location
    showModal.value = true
  }
}

const removeDevice = async (device) => {
  // Pastikan tracking dihentikan sebelum menghapus
  if (device.status === 'active') {
    await stopTracking(device)
  }
  
  try {
    await $fetch(`/api/device/${device.id}`, { method: 'DELETE' })
    await fetchDevices()
  } catch (error) {
    console.error('Failed to remove device:', error)
  }
}

const copyLink = (link) => {
  navigator.clipboard.writeText(link).then(() => {
    alert('Link copied successfully!')
  }).catch((error) => {
    console.error('Failed to copy link:', error)
  })
}

const closeModal = () => {
  showModal.value = false
  selectedLocation.value = null
}

// Check if this is a tracking link
onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const deviceId = urlParams.get('deviceId')
  const lat = urlParams.get('lat')
  const lon = urlParams.get('lon')
  
  if (deviceId && lat && lon) {
    selectedLocation.value = { lat: parseFloat(lat), lon: parseFloat(lon) }
    showModal.value = true
  }
})

// Cleanup saat component unmount
onUnmounted(() => {
  // Hentikan semua tracking
  Object.keys(watchIds).forEach(deviceId => {
    navigator.geolocation.clearWatch(watchIds[deviceId])
  })
})
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

.devices-container {
  display: grid;
  gap: 20px;
  margin-bottom: 30px;
}

.device-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  background-color: #f9f9f9;
}

.device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.device-name {
  font-size: 18px;
  font-weight: bold;
}

.status {
  padding: 5px 10px;
  border-radius: 4px;
  color: white;
  font-size: 14px;
}

.status-active {
  background-color: #4CAF50;
}

.status-inactive {
  background-color: #f44336;
}

.tracking-indicator {
  color: #4CAF50;
  font-size: 14px;
  margin-left: 10px;
}

.location-info {
  font-size: 12px;
  color: #666;
  margin-bottom: 10px;
}

.device-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.btn {
  background-color: #2196F3;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn:hover {
  background-color: #1976D2;
}

.btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.btn-danger {
  background-color: #f44336;
}

.btn-danger:hover {
  background-color: #d32f2f;
}

.btn-copy {
  background-color: #4CAF50;
  padding: 4px 8px;
  font-size: 12px;
}

.btn-add {
  background-color: #4CAF50;
  padding: 10px 20px;
  display: block;
  margin: 0 auto;
}

.link-box {
  background-color: #e3f2fd;
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
  word-break: break-all;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.map-modal {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  width: 80%;
  max-width: 800px;
  position: relative;
}

.close-btn {
  position: absolute;
  right: 10px;
  top: 10px;
  font-size: 24px;
  cursor: pointer;
}

.map-frame {
  width: 100%;
  height: 400px;
  border: none;
  border-radius: 4px;
  margin-top: 20px;
}
</style>