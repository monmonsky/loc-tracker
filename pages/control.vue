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
          <div class="info-row">
            <div class="info-label">Device:</div>
            <div class="info-value">{{ device.deviceInfo.brand }} {{ device.deviceInfo.device }}</div>
          </div>
          <div class="info-row">
            <div class="info-label">OS:</div>
            <div class="info-value">{{ device.deviceInfo.os }}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Browser:</div>
            <div class="info-value">{{ device.deviceInfo.browser }}</div>
          </div>
          <div class="info-row">
            <div class="info-label">IP:</div>
            <div class="info-value">{{ device.deviceInfo.ip }}</div>
          </div>
          <details v-if="device.deviceInfo.userAgent">
            <summary class="user-agent-summary">View User Agent</summary>
            <div class="user-agent">{{ device.deviceInfo.userAgent }}</div>
          </details>
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
          <div class="link-label">Tracking Link (with PWA support):</div>
          {{ device.trackingLink }}
          <button @click="copyLink(device.trackingLink)" class="btn btn-copy">Copy</button>
          <p class="link-hint">User dapat install sebagai PWA dari link ini</p>
        </div>
      </div>
    </div>
    
    <button @click="addDevice" class="btn btn-add">+ Add New Device</button>
    
    <!-- Modal for showing map with history -->
    <div v-if="showModal" class="overlay" @click="closeModal">
      <div class="map-modal" @click.stop>
        <span class="close-btn" @click="closeModal">&times;</span>
        <h3>Device Location History</h3>
        
        <div v-if="selectedDevice">
          <div class="controls">
            <button @click="clearHistory(selectedDevice)" class="btn btn-danger">Clear History</button>
            <button @click="exportHistory(selectedDevice)" class="btn">Export CSV</button>
          </div>
          
          <div v-if="selectedDevice.locationHistory && selectedDevice.locationHistory.length > 0">
            <div id="map" style="height: 400px; width: 100%; margin-top: 20px;"></div>
            
            <div class="history-list">
              <h4>Location History</h4>
              <div v-for="(item, index) in selectedDevice.locationHistory" :key="index" class="history-item">
                <div class="history-time">{{ formatDateTime(item.timestamp) }}</div>
                <div class="history-coords">
                  Lat: {{ item.location.lat.toFixed(6) }}, Lon: {{ item.location.lon.toFixed(6) }}
                </div>
              </div>
            </div>
          </div>
          <div v-else>
            <p>No location history available</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const devices = ref([])
const showModal = ref(false)
const selectedDevice = ref(null)
const editingDevice = ref(null)
const editName = ref('')
let map, polyline, markers = [], infoWindows = []

const config = useRuntimeConfig()

useHead({
  script: [
    {
      src: `https://maps.googleapis.com/maps/api/js?key=${config.public.googleMapsApiKey}`,
      async: true,
      defer: true
    }
  ]
})

const formatTimeDiff = (timeDiff) => {
  const seconds = Math.floor(timeDiff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius bumi dalam km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Cek apakah ini akses client tracking
const isClientView = computed(() => {
  const query = useRoute().query
  return query.deviceId && (query.lat || query.lon)
})

// Redirect ke client view jika parameter deviceId ada
onMounted(() => {
  if (isClientView.value) {
    navigateTo({
      path: '/product',
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
    const trackingLink = `${window.location.origin}/product?deviceId=${device.id}`
    const pwaLink = `${window.location.origin}/install?deviceId=${device.id}`
    
    await $fetch(`/api/device/${device.id}`, {
      method: 'PUT',
      body: {
        status: 'active',
        trackingLink: trackingLink,
        pwaLink: pwaLink
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
    selectedDevice.value = device
    showModal.value = true
    
    // Load Google Maps setelah modal terbuka
    nextTick(() => {
      loadGoogleMaps(device)
    })
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
  selectedDevice.value = null
   // Clear markers
   markers.forEach(marker => marker.setMap(null))
  markers = []
  // Clear info windows
  infoWindows.forEach(infoWindow => infoWindow.close())
  infoWindows = []
}

const formatDateTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

const loadGoogleMaps = (device) => {
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${config.public.googleMapsApiKey}`
  script.onload = () => initializeMap(device)
  document.head.appendChild(script)
}

const initializeMap = (device) => {
  const mapElement = document.getElementById('map')
  if (!mapElement) return
  
  const lastLocation = device.location
  if (!lastLocation) return
  
  // Initialize map
  map = new google.maps.Map(mapElement, {
    center: { lat: lastLocation.lat, lng: lastLocation.lon },
    zoom: 15
  })
  
  // Draw polyline for history
  if (device.locationHistory && device.locationHistory.length > 1) {
    const path = device.locationHistory.map(item => ({
      lat: item.location.lat,
      lng: item.location.lon
    }))
    
    polyline = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: '#2196F3',
      strokeOpacity: 1.0,
      strokeWeight: 2,
      map: map
    })
    
    // Add interactive segments
    for (let i = 0; i < device.locationHistory.length - 1; i++) {
      const currentPoint = device.locationHistory[i]
      const nextPoint = device.locationHistory[i + 1]
      
      const segmentPath = [
        { lat: currentPoint.location.lat, lng: currentPoint.location.lon },
        { lat: nextPoint.location.lat, lng: nextPoint.location.lon }
      ]
      
      const segment = new google.maps.Polyline({
        path: segmentPath,
        strokeColor: '#2196F3',
        strokeOpacity: 0.01, // Almost invisible but clickable
        strokeWeight: 10,
        map: map
      })
      
      // Create info window for segment
      const midPoint = {
        lat: (currentPoint.location.lat + nextPoint.location.lat) / 2,
        lng: (currentPoint.location.lon + nextPoint.location.lon) / 2
      }
      
      const distance = calculateDistance(
        currentPoint.location.lat, 
        currentPoint.location.lon,
        nextPoint.location.lat, 
        nextPoint.location.lon
      )
      
      const timeDiff = nextPoint.timestamp - currentPoint.timestamp
      const timeStr = formatTimeDiff(timeDiff)
      
      const segmentInfo = new google.maps.InfoWindow({
        content: `
          <div>
            <strong>Path Segment ${i + 1}</strong><br>
            From: ${formatDateTime(currentPoint.timestamp)}<br>
            To: ${formatDateTime(nextPoint.timestamp)}<br>
            Distance: ${(distance * 1000).toFixed(1)} meters<br>
            Time: ${timeStr}
          </div>
        `,
        position: midPoint
      })
      
      segment.addListener('click', () => {
        // Close all info windows
        infoWindows.forEach(infoWindow => infoWindow.close())
        // Open this one
        segmentInfo.open(map)
      })
      
      infoWindows.push(segmentInfo)
    }
    
    // Add markers for each location
    device.locationHistory.forEach((item, index) => {
      const isCurrent = index === device.locationHistory.length - 1
      
      const markerOptions = {
        position: { lat: item.location.lat, lng: item.location.lon },
        map: map,
        title: formatDateTime(item.timestamp)
      }
      
      if (isCurrent) {
        markerOptions.animation = google.maps.Animation.BOUNCE
        markerOptions.icon = {
          url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
        }
      } else {
        markerOptions.label = (index + 1).toString()
      }
      
      const marker = new google.maps.Marker(markerOptions)
      
      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div>
            <strong>${isCurrent ? 'Current Location' : 'Location ' + (index + 1)}</strong><br>
            Time: ${formatDateTime(item.timestamp)}<br>
            Coordinates: ${item.location.lat.toFixed(6)}, ${item.location.lon.toFixed(6)}
          </div>
        `
      })
      
      marker.addListener('click', () => {
        // Close all info windows
        infoWindows.forEach(w => w.close())
        infoWindow.open(map, marker)
      })
      
      markers.push(marker)
      infoWindows.push(infoWindow)
    })
    
    // Fit map to show all markers
    const bounds = new google.maps.LatLngBounds()
    device.locationHistory.forEach(item => {
      bounds.extend(new google.maps.LatLng(item.location.lat, item.location.lon))
    })
    map.fitBounds(bounds)
  } else {
    // Only one location
    new google.maps.Marker({
      position: { lat: lastLocation.lat, lng: lastLocation.lon },
      map: map,
      title: 'Current Location',
      animation: google.maps.Animation.BOUNCE,
      icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
    })
  }
}

const clearHistory = async (device) => {
  if (!confirm('Are you sure you want to clear the location history for this device?')) return
  
  try {
    await $fetch(`/api/device/${device.id}`, {
      method: 'PUT',
      body: {
        locationHistory: []
      }
    })
    await fetchDevices()
    closeModal()
  } catch (error) {
    console.error('Failed to clear history:', error)
  }
}

const exportHistory = (device) => {
  if (!device.locationHistory || device.locationHistory.length === 0) return
  
  let csvContent = 'Timestamp,Latitude,Longitude\n'
  
  device.locationHistory.forEach(item => {
    const timestamp = new Date(item.timestamp).toISOString()
    csvContent += `${timestamp},${item.location.lat},${item.location.lon}\n`
  })
  
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `location-history-${device.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}
</script>

<style scoped>

.device-info {
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 10px;
  font-size: 14px;
}

.info-row {
  display: flex;
  margin-bottom: 4px;
}

.info-label {
  width: 60px;
  font-weight: bold;
  color: #555;
}

.info-value {
  flex: 1;
  color: #333;
}

.user-agent-summary {
  cursor: pointer;
  margin-top: 8px;
  color: #666;
  font-size: 12px;
}

.user-agent {
  font-family: monospace;
  font-size: 11px;
  color: #666;
  margin-top: 4px;
  word-break: break-all;
  background: #e9ecef;
  padding: 4px 8px;
  border-radius: 3px;
}

.link-box {
  background-color: #e3f2fd;
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
  word-break: break-all;
}

.link-hint {
  font-size: 12px;
  color: #666;
  margin-top: 5px;
  font-style: italic;
}


.btn-copy {
  background-color: #4CAF50;
  padding: 4px 8px;
  font-size: 12px;
}

.btn-install {
  background-color: #FF9800;
  margin-left: 10px;
}
.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.history-list {
  margin-top: 20px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px solid #eee;
}

.history-item:last-child {
  border-bottom: none;
}

.history-time {
  font-weight: bold;
  color: #666;
}

.history-coords {
  font-family: monospace;
  color: #999;
}
.map-modal {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  width: 90%;
  max-width: 1000px;
  position: relative;
  max-height: 90vh;
  overflow-y: auto;
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.history-list {
  margin-top: 20px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px solid #eee;
}

.history-item:last-child {
  border-bottom: none;
}

.history-time {
  font-weight: bold;
  color: #666;
}

.history-coords {
  font-family: monospace;
  color: #999;
}
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