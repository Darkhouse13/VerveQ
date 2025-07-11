/**
 * VerveQ Frontend Main Entry Point
 * Modern JavaScript entry point for the FootQuizz application
 */

// Import styles
import '../styles/main.scss'

// Import accessibility features
import './accessibility.js'

// Global application state
window.VerveQ = {
  version: '2.0.0',
  buildTime: new Date().toISOString(),
  isDev: __DEV__,
  isProd: __PROD__
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 VerveQ Frontend Initialized')
  console.log(`Version: ${window.VerveQ.version}`)
  console.log(`Build Time: ${window.VerveQ.buildTime}`)
  console.log(`Environment: ${window.VerveQ.isDev ? 'Development' : 'Production'}`)
  
  // Initialize performance monitoring
  if (window.VerveQ.isProd && 'performance' in window) {
    // Log performance metrics
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType('navigation')[0]
        console.log('📊 Page Load Performance:', {
          domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
          loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
          totalTime: perfData.loadEventEnd - perfData.fetchStart
        })
      }, 0)
    })
  }
  
  // Initialize service worker for offline support (production only)
  if (window.VerveQ.isProd && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('✅ Service Worker registered:', registration.scope)
      })
      .catch(error => {
        console.log('❌ Service Worker registration failed:', error)
      })
  }
})

// Hot Module Replacement (HMR) support for development
if (import.meta.hot) {
  import.meta.hot.accept()
  console.log('🔥 HMR enabled')
}
