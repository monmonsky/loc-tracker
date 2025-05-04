<template>
  <div class="container">
    <h1>Multi-Device Location Tracker - Control Panel</h1>

    <!-- Tambahkan di bagian atas template, setelah h1 -->
    <div class="notification-toggle">
      <label class="switch">
        <input type="checkbox" v-model="isNotificationEnabled">
        <span class="slider round"></span>
      </label>
      <span>Enable Movement Notifications</span>
    </div>

    <!-- Notifications area -->
    <transition-group name="notification" class="notifications">
      <div 
        v-for="notification in notifications" 
        :key="notification.id" 
        class="notification-item"
        @click="removeNotification(notification.id)"
      >
        <div class="notification-icon">📍</div>
        <div class="notification-content">
          <h4>{{ notification.deviceName }}</h4>
          <p>Moved from location</p>
          <span class="notification-time">{{ formatTime(notification.timestamp) }}</span>
        </div>
        <button class="notification-close" @click.stop="removeNotification(notification.id)">×</button>
      </div>
    </transition-group>

    <!-- Sound notification -->
    <audio ref="notificationSound" preload="auto">
      <!-- <source src="/notification.mp3" type="audio/mpeg"> -->
      <source src="https://assets.mixkit.co/active_storage_attachments/files/000/063/717/original/mixkit-correct-answer-notification-946.mp3" type="audio/mpeg">
    </audio>
    
    <div class="control-hint">
      <h3>📱 How to share tracking link:</h3>
      <ol>
        <li>Click "Generate Link" for a device</li>
        <li>Copy the tracking link</li>
        <li>Send link to client</li>
        <li>View client's location from control panel</li>
      </ol>
      <button @click="fetchNotificationHistory()" class="btn btn-history-all">
        View All Movement History
      </button>
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

        <div v-if="device.lastHeartbeat" class="device-status">
          <div class="status-indicator">
            <span 
              :class="['online-dot', isDeviceActive(device) ? 'active' : 'inactive']"
            ></span>
            <span>{{ isDeviceActive(device) ? 'Online' : 'Offline' }}</span>
          </div>
          <p class="last-seen">
            Last seen: {{ formatLastSeen(device.lastHeartbeat) }}
          </p>
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
          <!-- Button untuk notifikasi history -->
          <button @click="fetchNotificationHistory(device.id)" class="btn btn-history">
            Movement History
          </button>
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

    <div v-if="showHistoryModal" class="overlay" @click="closeHistoryModal">
      <div class="history-modal" @click.stop>
        <span class="close-btn" @click="closeHistoryModal">&times;</span>
        <h3>Movement History</h3>
        <div v-if="notificationHistory.length > 0" class="history-list">
          <div v-for="notification in notificationHistory" :key="notification.id" class="history-item">
            <div class="history-info">
              <h4>{{ notification.deviceName }}</h4>
              <p>{{ formatDateTime(notification.timestamp) }}</p>
              <p v-if="notification.location">
                Location: {{ notification.location.lat.toFixed(6) }}, {{ notification.location.lon.toFixed(6) }}
              </p>
              <p v-if="notification.accuracy">Accuracy: {{ notification.accuracy.toFixed(1) }}m</p>
            </div>
          </div>
        </div>
        <div v-else>
          <p>No movement history found</p>
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

  const notifications = ref([])
  const isNotificationEnabled = ref(true)
  const deviceStates = ref({}) // Untuk track lokasi terakhir setiap device

  const notificationHistory = ref([])
  const showHistoryModal = ref(false)
  const selectedDeviceHistory = ref(null)

  const isDeviceActive = (device) => {
    if (!device.lastHeartbeat) return false
    
    // Consider device active if heartbeat in last 2 minutes
    const now = Date.now()
    const twoMinutes = 2 * 60 * 1000
    return (now - device.lastHeartbeat) < twoMinutes
  }

  const formatLastSeen = (timestamp) => {
    const now = Date.now()
    const diff = now - timestamp
    
    // If less than a minute
    if (diff < 60 * 1000) {
      return 'just now'
    }
    
    // If less than an hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000))
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    }
    
    // If less than a day
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000))
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    }
    
    // Otherwise, show date
    return new Date(timestamp).toLocaleString()
  }
  
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
  
  const notificationSound = ref(null)
  const fetchDevices = async () => {
    try {
      const response = await $fetch('/api/devices')
      const newDevices = response
      
      // Check for movement
      if (isNotificationEnabled.value) {
        checkDeviceMovement(devices.value, newDevices)
      }
      
      devices.value = newDevices
    } catch (error) {
      console.error('Failed to fetch devices:', error)
    }
  }

  const checkDeviceMovement = async (oldDevices, newDevices) => {
    for (const newDevice of newDevices) {
      const oldDevice = oldDevices.find(d => d.id === newDevice.id)
      
      if (oldDevice && oldDevice.location && newDevice.location) {
        const distance = calculateDistance(
          oldDevice.location.lat,
          oldDevice.location.lon,
          newDevice.location.lat,
          newDevice.location.lon
        )
        
        // Jika pindah lebih dari 5 meter
        if (distance > 0.005) {
          showNotification(newDevice)
          
          // Save to Redis
          await saveNotificationToRedis(newDevice)
        }
      }
    }
  }

  // Fungsi baru untuk menyimpan ke Redis
  const saveNotificationToRedis = async (device) => {
    try {
      await $fetch('/api/notifications', {
        method: 'POST',
        body: {
          deviceId: device.id,
          deviceName: device.name,
          location: device.location,
          accuracy: device.accuracy
        }
      })
    } catch (error) {
      console.error('Failed to save notification:', error)
    }
  }

  // Fungsi untuk mengambil history notifikasi
  const fetchNotificationHistory = async (deviceId = null) => {
    try {
      const query = deviceId ? { deviceId } : {}
      const history = await $fetch('/api/notifications', { query })
      notificationHistory.value = history
      showHistoryModal.value = true
    } catch (error) {
      console.error('Failed to fetch notification history:', error)
    }
  }

  // Fungsi untuk close history modal
  const closeHistoryModal = () => {
    showHistoryModal.value = false
    selectedDeviceHistory.value = null
  }

  const showNotification = (device) => {
    const notification = {
      id: Date.now(),
      deviceName: device.name,
      deviceId: device.id,
      timestamp: device.lastUpdate || Date.now()
    }
    
    notifications.value.unshift(notification)
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(notification.id)
    }, 5000)
    
    // Play sound
    if (notificationSound.value) {
      notificationSound.value.play().catch(err => console.log('Sound play error:', err))
    }
  }

  const removeNotification = (id) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
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

.device-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 5px;
  padding: 5px 0;
  border-top: 1px dashed #eee;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
}

.online-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.online-dot.active {
  background-color: #4CAF50;
  box-shadow: 0 0 5px #4CAF50;
}

.online-dot.inactive {
  background-color: #F44336;
}

.last-seen {
  font-size: 12px;
  color: #666;
  margin: 0;
}

  .btn-history {
    background-color: #9C27B0;
  }

  .btn-history:hover {
    background-color: #7B1FA2;
  }

  .btn-history-all {
    background-color: #FF9800;
    margin-left: 10px;
  }

  .history-modal {
    background: white;
    padding: 20px;
    border-radius: 8px;
    width: 90%;
    max-width: 800px;
    position: relative;
    max-height: 80vh;
    overflow-y: auto;
  }

  .history-list {
    margin-top: 20px;
  }

  .history-item {
    border-bottom: 1px solid #eee;
    padding: 10px 0;
  }

  .history-item:last-child {
    border-bottom: none;
  }

  .history-info h4 {
    margin: 0;
    color: #333;
  }

  .history-info p {
    margin: 5px 0;
    color: #666;
    font-size: 14px;
  }
  .notification-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    justify-content: center;
  }

  .switch {
    position: relative;
    display: inline-block;
    width: 60px;
    height: 34px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: .4s;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 26px;
    width: 26px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: .4s;
  }

  input:checked + .slider {
    background-color: #2196F3;
  }

  input:checked + .slider:before {
    transform: translateX(26px);
  }

  .slider.round {
    border-radius: 34px;
  }

  .slider.round:before {
    border-radius: 50%;
  }

  .notifications {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    width: 300px;
  }

  .notification-item {
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 12px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .notification-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.2);
  }

  .notification-icon {
    font-size: 24px;
    margin-right: 12px;
    animation: bounce 1s ease infinite;
  }

  .notification-content {
    flex: 1;
  }

  .notification-content h4 {
    margin: 0;
    font-size: 16px;
    color: #333;
  }

  .notification-content p {
    margin: 4px 0;
    font-size: 14px;
    color: #666;
  }

  .notification-time {
    font-size: 12px;
    color: #999;
  }

  .notification-close {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 0 8px;
    color: #999;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }

  .notification-enter-active,
  .notification-leave-active {
    transition: all 0.3s ease;
  }

  .notification-enter-from {
    opacity: 0;
    transform: translateX(100%);
  }

  .notification-leave-to {
    opacity: 0;
    transform: translateX(-100%);
  }

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