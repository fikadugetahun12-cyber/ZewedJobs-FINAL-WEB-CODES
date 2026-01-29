const CACHE_NAME = 'ai-chat-v1.0.0';
const CACHE_FILES = [
  '/ai-chat.html',
  '/manifest.json',
  '/',
  '/?source=pwa'
];

const API_CACHE = 'ai-chat-api-v1';
const OFFLINE_PAGE = '/ai-chat.html';

// Install event - cache essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching essential files');
        return cache.addAll(CACHE_FILES);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, cache fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Handle API requests with network-first strategy
  if (url.pathname.includes('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Handle same-origin requests with cache-first strategy
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            // Update cache in background
            fetchAndCache(request);
            return response;
          }
          return fetchAndCache(request);
        })
        .catch(() => {
          // Return offline page if fetch fails
          return caches.match(OFFLINE_PAGE);
        })
    );
    return;
  }
  
  // For cross-origin requests, use network-first
  event.respondWith(fetch(request));
});

// Handle API requests
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Clone and cache the response
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      cache.put(request, responseClone);
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response
    return new Response(JSON.stringify({
      error: 'Network unavailable',
      message: 'You are offline. Please check your connection.',
      timestamp: new Date().toISOString()
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Fetch and cache helper
async function fetchAndCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    throw error;
  }
}

// Background sync for offline messages
self.addEventListener('sync', event => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

// Sync messages when back online
async function syncMessages() {
  // Get stored offline messages from IndexedDB
  const messages = await getOfflineMessages();
  
  for (const message of messages) {
    try {
      // Send each message to server
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      
      // Remove from offline storage if successful
      await removeOfflineMessage(message.id);
    } catch (error) {
      console.error('Failed to sync message:', error);
    }
  }
}

// Push notification handling
self.addEventListener('push', event => {
  const options = {
    body: event.data?.text() || 'New message from AI Chat',
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🤖</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💬</text></svg>',
    vibrate: [200, 100, 200],
    data: { url: '/ai-chat.html' },
    actions: [
      { action: 'open', title: 'Open Chat' },
      { action: 'close', title: 'Close' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('AI Chat Assistant', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/ai-chat.html')
    );
  }
});

// Helper functions for IndexedDB (simplified version)
async function getOfflineMessages() {
  return []; // Implement IndexedDB logic here
}

async function removeOfflineMessage(id) {
  // Implement IndexedDB logic here
}
