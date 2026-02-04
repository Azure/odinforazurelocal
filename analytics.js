// ============================================================================
// ODIN SHARED ANALYTICS MODULE
// ============================================================================
// Lightweight analytics tracking for all ODIN pages (Knowledge, Sizer, etc.)
// This is a standalone version of the Firebase analytics for sub-pages.
// ============================================================================

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDBMPWx1F7G6T-KMEkkfhLNbl145mU9m-Q",
    authDomain: "odin-analytics-7881f.firebaseapp.com",
    databaseURL: "https://odin-analytics-7881f-default-rtdb.firebaseio.com",
    projectId: "odin-analytics-7881f",
    storageBucket: "odin-analytics-7881f.firebasestorage.app",
    messagingSenderId: "35317804205",
    appId: "1:35317804205:web:8e9622c2c21ccd690b2a24"
};

// Analytics state
const odinAnalytics = {
    initialized: false,
    database: null,
    enabled: false
};

// Initialize Firebase Analytics
function initializeOdinAnalytics() {
    try {
        // Check if Firebase config is properly set up
        if (FIREBASE_CONFIG.apiKey.startsWith('REPLACE_WITH_')) {
            console.log('Analytics: Firebase not configured');
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

        odinAnalytics.database = firebase.database();
        odinAnalytics.initialized = true;
        odinAnalytics.enabled = true;
        console.log('Analytics: Firebase initialized successfully');
        return true;
    } catch (error) {
        console.warn('Analytics: Failed to initialize Firebase:', error.message);
        return false;
    }
}

// Track a page view
function trackOdinPageView() {
    if (!odinAnalytics.enabled || !odinAnalytics.database) {
        return;
    }

    try {
        const pageViewRef = odinAnalytics.database.ref('analytics/pageViews');
        pageViewRef.set(firebase.database.ServerValue.increment(1))
            .then(() => {
                console.log('Analytics: Page view tracked');
            })
            .catch((error) => {
                console.warn('Analytics: Failed to track page view:', error.message);
            });
    } catch (error) {
        console.warn('Analytics: Error tracking page view:', error.message);
    }
}

// Initialize and track on page load
document.addEventListener('DOMContentLoaded', function() {
    if (initializeOdinAnalytics()) {
        trackOdinPageView();
    }
});
