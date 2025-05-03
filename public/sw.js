// public/sw.js
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  self.skipWaiting();
})

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  event.waitUntil(self.clients.claim());
})

// Background sync untuk location tracking
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-location') {
    event.waitUntil(syncLocation());
  }
})

async function syncLocation() {
  try {
    // Send message to all clients to get location
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    for (const client of clients) {
      client.postMessage({ type: 'REQUEST_LOCATION' });
    }
  } catch (error) {
    console.error('Failed to sync location:', error);
  }
}

// Listen for messages from client
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  if (type === 'LOCATION_UPDATE') {
    const { deviceId, location } = data;
    
    try {
      await fetch(`/api/device/${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'active',
          location: location,
          accuracy: location.accuracy
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Location updated successfully');
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  }
})

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-location-sync') {
    event.waitUntil(syncLocation());
  }
})

// Background location update every minute
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
})

// Background fetch untuk update lokasi
self.addEventListener('background-fetch', (event) => {
  console.log('Background fetch event', event);
})