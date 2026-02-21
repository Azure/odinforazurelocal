// ============================================================================
// ODIN FIREBASE ANALYTICS MODULE
// ============================================================================
// Usage tracking for page views and form completions.
// To enable analytics, replace the placeholder values with your Firebase config.
//
// Firebase Realtime Database Rules (recommended):
// {
//   "rules": {
//     "analytics": {
//       "pageViews": {
//         ".read": false,
//         ".write": true,
//         ".validate": "newData.isNumber() && newData.val() >= data.val()"
//       },
//       "formCompletions": {
//         "designDocument": {
//           ".read": false,
//           ".write": true,
//           ".validate": "newData.isNumber() && newData.val() >= data.val()"
//         },
//         "armDeployment": {
//           ".read": false,
//           ".write": true,
//           ".validate": "newData.isNumber() && newData.val() >= data.val()"
//         },
//         "sizerCalculation": {
//           ".read": false,
//           ".write": true,
//           ".validate": "newData.isNumber() && newData.val() >= data.val()"
//         }
//       }
//     }
//   }
// }
// ============================================================================

const FIREBASE_CONFIG = {
    // Replace with your Firebase project configuration
    // Get these values from: Firebase Console > Project Settings > General > Your apps > Config
    apiKey: 'AIzaSyDBMPWx1F7G6T-KMEkkfhLNbl145mU9m-Q',
    authDomain: 'odin-analytics-7881f.firebaseapp.com',
    databaseURL: 'https://odin-analytics-7881f-default-rtdb.firebaseio.com',
    projectId: 'odin-analytics-7881f',
    storageBucket: 'odin-analytics-7881f.firebasestorage.app',
    messagingSenderId: '35317804205',
    appId: '1:35317804205:web:8e9622c2c21ccd690b2a24'
};

// Analytics state
const analytics = {
    initialized: false,
    database: null,
    enabled: false
};

/**
 * Initialize Firebase Analytics
 * @returns {boolean} True if initialization succeeded
 */
function initializeAnalytics() {
    try {
        // Check if Firebase config is properly set up (not using placeholder values)
        if (FIREBASE_CONFIG.apiKey.startsWith('REPLACE_WITH_')) {
            console.log('Analytics: Firebase not configured. To enable analytics, update FIREBASE_CONFIG in analytics.js');
            return false;
        }

        // Check if Firebase SDK is loaded
        if (typeof firebase === 'undefined') {
            console.warn('Analytics: Firebase SDK not loaded');
            return false;
        }

        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }

        analytics.database = firebase.database();
        analytics.initialized = true;
        analytics.enabled = true;
        console.log('Analytics: Firebase initialized successfully');
        return true;
    } catch (error) {
        console.warn('Analytics: Failed to initialize Firebase:', error.message);
        return false;
    }
}

/**
 * Track a page view
 */
function trackPageView() {
    if (!analytics.enabled || !analytics.database) {
        return;
    }

    try {
        const pageViewRef = analytics.database.ref('analytics/pageViews');
        // Use set with increment - doesn't require read permissions
        pageViewRef.set(firebase.database.ServerValue.increment(1))
            .then(() => {
                console.log('Analytics: Page view tracked');
                // Fetch and display updated stats
                fetchAndDisplayStats();
            })
            .catch((error) => {
                console.warn('Analytics: Failed to track page view:', error.message);
            });
    } catch (error) {
        console.warn('Analytics: Error tracking page view:', error.message);
    }
}

/**
 * Track form completion events
 * @param {string} eventType - Event type: 'designDocument' or 'armDeployment'
 */
function trackFormCompletion(eventType) {
    if (!analytics.enabled || !analytics.database) {
        return;
    }

    const validEvents = ['designDocument', 'armDeployment', 'sizerCalculation'];
    if (!validEvents.includes(eventType)) {
        console.warn('Analytics: Invalid event type:', eventType);
        return;
    }

    try {
        const eventRef = analytics.database.ref(`analytics/formCompletions/${eventType}`);
        // Use set with increment - doesn't require read permissions
        eventRef.set(firebase.database.ServerValue.increment(1))
            .then(() => {
                console.log(`Analytics: Form completion tracked - ${eventType}`);
                // Refresh displayed stats after tracking
                fetchAndDisplayStats();
            })
            .catch((error) => {
                console.warn(`Analytics: Failed to track ${eventType}:`, error.message);
            });
    } catch (error) {
        console.warn(`Analytics: Error tracking ${eventType}:`, error.message);
    }
}

/**
 * Fetch and display page statistics
 */
function fetchAndDisplayStats() {
    if (!analytics.enabled || !analytics.database) {
        return;
    }

    try {
        // Fetch all stats
        const analyticsRef = analytics.database.ref('analytics');
        analyticsRef.once('value')
            .then((snapshot) => {
                const data = snapshot.val() || {};

                // Update page views
                const pageViewsEl = document.getElementById('stat-page-views');
                if (pageViewsEl) {
                    pageViewsEl.textContent = formatNumber(data.pageViews || 0);
                }

                // Update design documents
                const designDocsEl = document.getElementById('stat-design-docs');
                if (designDocsEl) {
                    const formCompletions = data.formCompletions || {};
                    designDocsEl.textContent = formatNumber(formCompletions.designDocument || 0);
                }

                // Update ARM deployments
                const armDeploymentsEl = document.getElementById('stat-arm-deployments');
                if (armDeploymentsEl) {
                    const formCompletions = data.formCompletions || {};
                    armDeploymentsEl.textContent = formatNumber(formCompletions.armDeployment || 0);
                }

                // Update sizer calculations
                const sizerCalcsEl = document.getElementById('stat-sizer-calcs');
                if (sizerCalcsEl) {
                    const formCompletions = data.formCompletions || {};
                    sizerCalcsEl.textContent = formatNumber(formCompletions.sizerCalculation || 0);
                }

                console.log('Analytics: Stats displayed');
            })
            .catch((error) => {
                console.warn('Analytics: Failed to fetch stats:', error.message);
            });
    } catch (error) {
        console.warn('Analytics: Error fetching stats:', error.message);
    }
}

// ============================================================================
// END FIREBASE ANALYTICS MODULE
// ============================================================================
