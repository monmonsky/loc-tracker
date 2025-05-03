<template>
  <div class="container">
    <h1>Multi-Device Location Tracker - Control Panel</h1>
    
    <div class="control-hint">
      <h3>📱 How to share tracking link:</h3>
      <ol>
        <li>Click "Generate Link" for a device</li>
        <li>Copy the tracking link</li>
        <li>Send link to client</li>
        <li>View client's location from control panel</li>
      </ol>
    </div>
    
    <div class="devices-container">
      <div v-for="device in devices" :key="device.id" class="device-card">
        <!-- Device Header -->
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
        
        <!-- Device Info -->
        <div v-if="device.deviceInfo" class="device-info">
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Device:</span>
              <span class="value">{{ device.deviceInfo.brand }} {{ device.deviceInfo.device }}</span>
            </div>
            <div class="info-item">
              <span class="label">OS:</span>
              <span class="value">{{ device.deviceInfo.os }}</span>
            </div>
            <div class="info-item">
              <span class="label">Browser:</span>
              <span class="value">{{ device.deviceInfo.browser }}</span>
            </div>
            <div class="info-item">
              <span class="label">IP:</span>
              <span class="value">{{ device.deviceInfo.ip }}</span>
            </div>
          </div>
        </div>
        
        <!-- Location Info -->
        <div v-if="device.location" class="location-info">
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Last Update:</span>
              <span class="value">{{ formatTime(device.lastUpdate) }}</span>
            </div>
            <div class="info-item">
              <span class="label">Coordinates:</span>
              <span class="value">{{ device.location.lat.toFixed(6) }}, {{ device.location.lon.toFixed(6) }}</span>
            </div>
            <div class="info-item" v-if="device.accuracy">
              <span class="label">Accuracy:</span>
              <span class="value">{{ device.accuracy.toFixed(1) }}m</span>
            </div>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="device-actions">
          <button @click="startTracking(device)" :disabled="device.status === 'active'" class="btn">
            {{ device.status === 'active' ? 'Link Generated' : 'Generate Link' }}
          </button>
          <button @click="stopTracking(device)" :disabled="device.status === 'inactive'" class="btn">Stop</button>
          <button @click="showLocation(device)" :disabled="!device.location" class="btn">Show Location</button>
          <button @click="removeDevice(device)" class="btn btn-danger">Remove</button>
        </div>
        
        <!-- Tracking Link -->
        <div v-if="device.trackingLink" class="link-box">
          <div class="link-label">Tracking Link:</div>
          <div class="link-content">
            <span class="link-url">{{ device.trackingLink }}</span>
            <button @click="copyLink(device.trackingLink)" class="btn btn-copy">Copy</button>
          </div>
        </div>
      </div>
    </div>
    
    <button @click="addDevice" class="btn btn-add">+ Add New Device</button>
    
    <!-- OpenStreetMap Modal -->
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
  let map = null
  let polyline = null
  let markers = []
  
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

    if (typeof L === 'undefined') {
      console.error('Leaflet is not loaded properly')
    }
    
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
      
      // Tunggu modal terbuka dan Leaflet loaded
      nextTick(() => {
        if (typeof L !== 'undefined') {
          initializeMap(device)
        } else {
          console.error('Leaflet not loaded yet')
          // Atau coba load ulang script Leaflet
        }
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
    
    // Clear Leaflet markers
    if (markers.length > 0) {
      markers.forEach(marker => {
        map.removeLayer(marker)
      })
      markers = []
    }
    
    // Clear polyline
    if (polyline) {
      map.removeLayer(polyline)
      polyline = null
    }
    
    // Remove map entirely
    if (map) {
      map.remove()
      map = null
    }
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
    
    // Clear jika ada map sebelumnya
    if (map) {
      map.remove()
    }
    
    const lastLocation = device.location
    if (!lastLocation) return
    
    // Initialize Leaflet map
    map = L.map('map').setView([lastLocation.lat, lastLocation.lon], 15)
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map)
    
    // Clear existing markers array
    markers = []
    
    // Draw path if history exists
    if (device.locationHistory && device.locationHistory.length > 1) {
      const latLngs = device.locationHistory.map(item => [item.location.lat, item.location.lon])
      
      // Create blue route line
      polyline = L.polyline(latLngs, { color: '#2196F3', weight: 3 }).addTo(map)
      
      // Add interactive segments
      for (let i = 0; i < device.locationHistory.length - 1; i++) {
        const currentPoint = device.locationHistory[i]
        const nextPoint = device.locationHistory[i + 1]
        
        const segmentPath = [
          [currentPoint.location.lat, currentPoint.location.lon],
          [nextPoint.location.lat, nextPoint.location.lon]
        ]
        
        const segment = L.polyline(segmentPath, { 
          color: '#2196F3', 
          weight: 10,
          opacity: 0 // Invisible but clickable
        }).addTo(map)
        
        // Calculate distance and time
        const distance = calculateDistance(
          currentPoint.location.lat, 
          currentPoint.location.lon,
          nextPoint.location.lat, 
          nextPoint.location.lon
        )
        
        const timeDiff = nextPoint.timestamp - currentPoint.timestamp
        const timeStr = formatTimeDiff(timeDiff)
        
        // Add click handler for segment info
        segment.on('click', () => {
          const midPoint = L.latLng(
            (currentPoint.location.lat + nextPoint.location.lat) / 2,
            (currentPoint.location.lon + nextPoint.location.lon) / 2
          )
          
          L.popup()
            .setLatLng(midPoint)
            .setContent(`
              <div>
                <strong>Path Segment ${i + 1}</strong><br>
                From: ${formatDateTime(currentPoint.timestamp)}<br>
                To: ${formatDateTime(nextPoint.timestamp)}<br>
                Distance: ${(distance * 1000).toFixed(1)} meters<br>
                Time: ${timeStr}
              </div>
            `)
            .openOn(map)
        })
      }
      
      // Add markers for each location
      device.locationHistory.forEach((item, index) => {
        const isCurrent = index === device.locationHistory.length - 1
        
        const markerOptions = {}
        
        // Different style for current location
        if (isCurrent) {
          const currentIcon = L.divIcon({
            className: 'current-location-marker',
            html: '<div style="background-color: #4CAF50; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 2px #4CAF50;"></div>',
            iconSize: [15, 15],
            iconAnchor: [7.5, 7.5]
          })
          markerOptions.icon = currentIcon
        }
        
        const marker = L.marker([item.location.lat, item.location.lon], markerOptions).addTo(map)
        
        // Add popup
        marker.bindPopup(`
          <div>
            <strong>${isCurrent ? 'Current Location' : 'Location ' + (index + 1)}</strong><br>
            Time: ${formatDateTime(item.timestamp)}<br>
            Coordinates: ${item.location.lat.toFixed(6)}, ${item.location.lon.toFixed(6)}
          </div>
        `)
        
        markers.push(marker)
      })
      
      // Fit map to show all markers
      map.fitBounds(polyline.getBounds())
    } else {
      // Single location marker
      const currentIcon = L.divIcon({
        className: 'current-location-marker',
        html: '<div style="background-color: #4CAF50; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 2px #4CAF50;"></div>',
        iconSize: [15, 15],
        iconAnchor: [7.5, 7.5]
      })
      
      const marker = L.marker([lastLocation.lat, lastLocation.lon], {icon: currentIcon}).addTo(map)
      markers.push(marker)
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
  /* Container */
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: Arial, sans-serif;
  }
  
  /* Typography */
  h1 {
    text-align: center;
    color: #333;
    margin-bottom: 30px;
  }
  
  /* Hint Box */
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
  
  /* Devices Grid */
  .devices-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }
  
  /* Device Card */
  .device-card {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 15px;
    background-color: #f9f9f9;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }
  
  /* Device Header */
  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  
  .device-name-container {
    flex: 1;
  }
  
  .device-name {
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    padding: 5px;
    display: inline-flex;
    align-items: center;
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
  
  /* Status Badge */
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
  
  /* Info Grids */
  .device-info, .location-info {
    background-color: #f8f9fa;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 10px;
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
    font-size: 14px;
  }
  
  .info-item {
    display: flex;
    flex-direction: column;
  }
  
  .info-item .label {
    font-weight: bold;
    color: #555;
    font-size: 12px;
    text-transform: uppercase;
  }
  
  .info-item .value {
    color: #333;
  }
  
  /* Actions */
  .device-actions {
    display: flex;
    gap: 10px;
    margin-top: 10px;
    flex-wrap: wrap;
  }
  
  /* Buttons */
  .btn {
    background-color: #2196F3;
    color: white;
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
    font-size: 14px;
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
    padding: 6px 12px;
    font-size: 12px;
  }
  
  .btn-add {
    background-color: #4CAF50;
    padding: 10px 20px;
    display: block;
    margin: 0 auto;
  }
  
  /* Link Box */
  .link-box {
    background-color: #e3f2fd;
    padding: 10px;
    border-radius: 4px;
    margin-top: 10px;
  }
  
  .link-label {
    font-weight: bold;
    margin-bottom: 5px;
    color: #1976D2;
    font-size: 12px;
  }
  
  .link-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .link-url {
    font-family: monospace;
    font-size: 12px;
    word-break: break-all;
    flex: 1;
  }
  
  /* Map Modal */
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
    width: 90%;
    max-width: 1000px;
    position: relative;
    max-height: 90vh;
    overflow-y: auto;
  }
  
  .close-btn {
    position: absolute;
    right: 10px;
    top: 10px;
    font-size: 24px;
    cursor: pointer;
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
  
  .current-location-marker {
    z-index: 1000;
  }
  </style>