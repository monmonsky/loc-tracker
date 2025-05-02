<template>
  <div class="container">
    <h1>Multi-Device Location Tracker - Control Panel</h1>
    
    <div class="control-hint">
      <h3>📱 How to share tracking link:</h3>
      <ol>
        <li>Click "Generate Link" for a device</li>
        <li>Copy the tracking link</li>
        <li>Send link to client - they'll automatically start sharing location</li>
        <li>View client's location from control panel</li>
      </ol>
    </div>
    
    <div class="devices-container">
      <div v-for="device in devices" :key="device.id" class="device-card">
        <div class="device-header">
          <div class="device-name-container">
            <input 
              v-if="editingDevice === device.id" 
              v-model="editName" 
              @keyup.enter="saveDeviceName(device)"
              @blur="saveDeviceName(device)"
              class="name-input"
              ref="nameInput"
            />
            <span v-else class="device-name" @click="startEdit(device)">
              {{ device.name }}
              <span class="edit-icon">✎</span>
            </span>
          </div>
          <span :class="['status', device.status === 'active' ? 'status-active' : 'status-inactive']">
            {{ device.status }}
          </span>
        </div>
        
        <div v-if="device.deviceInfo" class="device-info">
          <p><strong>Device:</strong> {{ device.deviceInfo.browser }}</p>
          <p><strong>IP:</strong> {{ device.deviceInfo.ip }}</p>
          <p><strong>User Agent:</strong> {{ device.deviceInfo.userAgent }}</p>
        </div>
        
        <div v-if="device.location" class="location-info">
          <p><strong>Last Update:</strong> {{ formatTime(device.lastUpdate) }}</p>
          <p><strong>Coordinates:</strong> {{ device.location.lat.toFixed(6) }}, {{ device.location.lon.toFixed(6) }}</p>
          <p v-if="device.accuracy"><strong>Accuracy:</strong> {{ device.accuracy.toFixed(1) }}m</p>
        </div>
        
        <div class="device-actions">
          <button @click="startTracking(device)" :disabled="device.status === 'active'" class="btn">
            {{ device.status === 'active' ? 'Link Generated' : 'Generate Link' }}
          </button>
          <button @click="stopTracking(device)" :disabled="device.status === 'inactive'" class="btn">Stop</button>
          <button @click="showLocation(device)" :disabled="!device.location" class="btn">Show Location</button>
          <button @click="removeDevice(device)" class="btn btn-danger">Remove</button>
        </div>
        
        <div v-if="device.trackingLink" class="link-box">
          <div class="link-label">Tracking Link (share with client):</div>
          {{ device.trackingLink }}
          <button @click="copyLink(device.trackingLink)" class="btn btn-copy">Copy</button>
        </div>
      </div>
    </div>
    
    <button @click="addDevice" class="btn btn-add">+ Add New Device</button>
    
    <!-- Modal for showing map in control panel -->
    <div v-if="showModal" class="overlay" @click="closeModal">
      <div class="map-modal" @click.stop>
        <span class="close-btn" @click="closeModal">&times;</span>
        <h3>Device Location Preview</h3>
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
const editingDevice = ref(null)
const editName = ref('')

// Cek apakah ini akses client tracking
const isClientView = computed(() => {
  const query = useRoute().query
  return query.deviceId && (query.lat || query.lon)
})

// Redirect ke client view jika parameter deviceId ada
onMounted(() => {
  if (isClientView.value) {
    navigateTo({
      path: '/tracking',
      query: useRoute().query
    })
  } else {
    fetchDevices()
    setInterval(fetchDevices, 5000)
  }
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

const startEdit = (device) => {
  editingDevice.value = device.id
  editName.value = device.name
  // Auto focus input saat edit dimulai
  nextTick(() => {
    const input = document.querySelector('.name-input')
    if (input) input.focus()
  })
}

const saveDeviceName = async (device) => {
  if (editName.value && editName.value !== device.name) {
    try {
      await $fetch(`/api/device/${device.id}`, {
        method: 'PUT',
        body: {
          name: editName.value
        }
      })
      await fetchDevices()
    } catch (error) {
      console.error('Failed to update device name:', error)
    }
  }
  editingDevice.value = null
}

const startTracking = async (device) => {
  // Hanya set device sebagai active tanpa mulai tracking lokal
  try {
    const trackingLink = `${window.location.origin}/tracking?deviceId=${device.id}`
    
    await $fetch(`/api/device/${device.id}`, {
      method: 'PUT',
      body: {
        status: 'active',
        trackingLink
      }
    })
    
    await fetchDevices()
  } catch (error) {
    console.error('Failed to update device:', error)
  }
}

const stopTracking = async (device) => {
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
  try {
    await $fetch(`/api/device/${device.id}`, { method: 'DELETE' })
    await fetchDevices()
  } catch (error) {
    console.error('Failed to remove device:', error)
  }
}

const copyLink = (link) => {
  navigator.clipboard.writeText(link).then(() => {
    alert('Tracking link copied to clipboard!')
  }).catch((error) => {
    console.error('Failed to copy link:', error)
  })
}

const closeModal = () => {
  showModal.value = false
  selectedLocation.value = null
}
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

.control-hint {
  background-color: #e3f2fd;
  border-left: 4px solid #2196F3;
  padding: 15px;
  margin-bottom: 30px;
  border-radius: 4px;
}

.control-hint h3 {
  margin: 0;
  color: #1976D2;
}

.control-hint ol {
  margin: 10px 0 0 20px;
  padding: 0;
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

.device-name-container {
  display: flex;
  align-items: center;
  flex: 1;
}

.device-name {
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  padding: 5px;
}

.edit-icon {
  margin-left: 5px;
  color: #999;
  font-size: 16px;
}

.name-input {
  font-size: 18px;
  font-weight: bold;
  border: 1px solid #2196F3;
  border-radius: 4px;
  padding: 4px 8px;
  background: white;
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

.device-info {
  background-color: #f0f0f0;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 10px;
  font-size: 14px;
}

.device-info p {
  margin: 5px 0;
}

.location-info {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.location-info p {
  margin: 5px 0;
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
  transition: background-color 0.3s;
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
}

.link-label {
  font-weight: bold;
  margin-bottom: 5px;
  color: #1976D2;
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