// Background service worker for Page Price Analyzer
// Handles extension lifecycle and background tasks

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Page Price Analyzer extension installed');
        
        // Set default settings
        chrome.storage.local.set({
            settings: {
                autoAnalyze: true,
                showNotifications: true,
                pricingCurrency: 'USD'
            }
        });
    } else if (details.reason === 'update') {
        console.log('Page Price Analyzer extension updated');
    }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Page Price Analyzer extension started');
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getSettings':
            chrome.storage.local.get(['settings'], (result) => {
                sendResponse({ settings: result.settings || {} });
            });
            return true; // Keep message channel open for async response
            
        case 'updateSettings':
            chrome.storage.local.set({ settings: request.settings }, () => {
                sendResponse({ success: true });
            });
            return true;
            
        case 'analyzePage':
            // Forward analysis request to content script
            if (sender.tab) {
                chrome.tabs.sendMessage(sender.tab.id, request, sendResponse);
            }
            return true;
            

            
        default:
            sendResponse({ error: 'Unknown action' });
    }
});

// Handle tab updates to potentially analyze new pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Check if this is a page we might want to analyze
        const url = tab.url.toLowerCase();
        
        // Look for moving company or pricing related URLs
        const movingKeywords = ['moving', 'relocation', 'transport', 'charges', 'estimate', 'quote'];
        const shouldAnalyze = movingKeywords.some(keyword => url.includes(keyword));
        
        if (shouldAnalyze) {
            // Notify content script that page might be relevant
            chrome.tabs.sendMessage(tabId, { 
                action: 'pageRelevant',
                url: tab.url 
            }).catch(() => {
                // Content script might not be ready yet, ignore error
            });
        }
    }
});

// Handle tab activation to potentially analyze the new active tab
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab && tab.url) {
            // Check if this tab should be analyzed
            const url = tab.url.toLowerCase();
            const movingKeywords = ['moving', 'relocation', 'transport', 'charges', 'estimate', 'quote'];
            const shouldAnalyze = movingKeywords.some(keyword => url.includes(keyword));
            
            if (shouldAnalyze) {
                // Notify content script
                chrome.tabs.sendMessage(tab.id, { 
                    action: 'tabActivated',
                    url: tab.url 
                }).catch(() => {
                    // Content script might not be ready yet, ignore error
                });
            }
        }
    });
});

// Context menu for right-click analysis
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'analyzePage',
        title: 'Analyze Page for Pricing',
        contexts: ['page', 'selection']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'analyzePage') {
        // Trigger page analysis
        chrome.tabs.sendMessage(tab.id, { action: 'analyzePage' });
    }
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.settings) {
        console.log('Settings updated:', changes.settings.newValue);
        
        // Notify all tabs about settings change
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { 
                    action: 'settingsChanged',
                    settings: changes.settings.newValue 
                }).catch(() => {
                    // Tab might not have content script, ignore error
                });
            });
        });
    }
});

