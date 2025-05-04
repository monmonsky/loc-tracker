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
  if (event.tag === 'location-sync') {
    event.waitUntil(syncLocation());
  }
})

// Periodic background sync (perlu permission)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-location-sync') {
    event.waitUntil(syncLocation());
  }
})

// Data store untuk location caching
const LOCATION_CACHE = 'location-cache';

async function syncLocation() {
  try {
    // Attempt to read cached location data
    const cache = await caches.open(LOCATION_CACHE);
    const cachedLocations = await cache.match('pending-locations');
    
    if (cachedLocations) {
      const locations = await cachedLocations.json();
      
      if (locations.length > 0) {
        // Send all pending locations
        await Promise.all(
          locations.map(async (item) => {
            try {
              const response = await fetch(`/api/device/${item.deviceId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  status: 'active',
                  location: item.location,
                  accuracy: item.accuracy,
                  timestamp: item.timestamp
                })
              });
              
              if (response.ok) {
                return { success: true, item };
              } else {
                return { success: false, item };
              }
            } catch (error) {
              return { success: false, item, error };
            }
          })
        );
        
        // Clear cache
        await cache.put('pending-locations', new Response(JSON.stringify([])));
      }
    }
    
    // Request new location from clients
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    clients.forEach(client => {
      client.postMessage({ type: 'REQUEST_LOCATION' });
    });
  } catch (error) {
    console.error('Background sync error:', error);
  }
}