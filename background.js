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
        
        // Detect and store Chrome profile information
        detectChromeProfile();
    } else if (details.reason === 'update') {
        console.log('Page Price Analyzer extension updated');
        // Re-detect profile info on update
        detectChromeProfile();
    }
});

// Detect Chrome profile information
async function detectChromeProfile() {
    try {
        // Get profile information from Chrome
        const profileInfo = await chrome.identity.getProfileUserInfo();
        
        // Get additional profile details
        const profileDetails = {
            profileId: profileInfo.id || 'unknown',
            profileName: profileInfo.email ? profileInfo.email.split('@')[0] : 'Chrome Profile',
            userIdentifier: profileInfo.email || 'anonymous',
            email: profileInfo.email || null,
            isManaged: profileInfo.isManaged || false
        };
        
        // Store profile information
        chrome.storage.local.set({ profileInfo: profileDetails });
        console.log('Chrome profile detected and stored:', profileDetails);
        
    } catch (error) {
        console.error('Error detecting Chrome profile:', error);
        
        // Fallback: generate a unique profile identifier
        const fallbackProfile = {
            profileId: 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            profileName: 'Chrome Profile',
            userIdentifier: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            email: null,
            isManaged: false
        };
        
        chrome.storage.local.set({ profileInfo: fallbackProfile });
        console.log('Fallback profile created:', fallbackProfile);
    }
}

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
            
        case 'transferUpdated':
            // Handle transfer updates from dashboard
            console.log('Transfer update received:', request.data);
            
            // Store the transfer update in chrome.storage.local
            chrome.storage.local.get(['transferUpdates'], (result) => {
                const transferUpdates = result.transferUpdates || {};
                const key = `${request.data.jobId}_${request.data.chrome_profile_id}`;
                transferUpdates[key] = {
                    jobId: request.data.jobId,
                    user_name: request.data.user_name,
                    job_number: request.data.job_number,
                    chrome_profile_id: request.data.chrome_profile_id,
                    initiated_by: request.data.initiated_by || 'Unknown User',
                    initiated_by_id: request.data.initiated_by_id || 'Unknown',
                    updated_at: new Date().toISOString()
                };
                
                chrome.storage.local.set({ transferUpdates }, () => {
                    console.log('Transfer update stored:', transferUpdates[key]);
                    
                    // Notify all popups about the transfer update
                    chrome.runtime.sendMessage({
                        action: 'transferUpdateReceived',
                        data: transferUpdates[key]
                    }).catch(() => {
                        // Ignore errors if no popups are listening
                    });
                });
            });
            
            // Forward the transfer message to the tab where the job was originally submitted
            if (request.data.page_url) {
                chrome.tabs.query({}, function(tabs) {
                    console.log('Searching through tabs for URL match...');
                    console.log('Target page URL:', request.data.page_url);
                    
                    // Try multiple matching strategies
                    let targetTab = null;
                    
                    // Strategy 1: Exact URL match
                    targetTab = tabs.find(tab => tab.url === request.data.page_url);
                    if (targetTab) {
                        console.log('Found exact URL match:', targetTab.url);
                    }
                    
                    // Strategy 2: Domain + path match
                    if (!targetTab) {
                        const targetUrl = new URL(request.data.page_url);
                        targetTab = tabs.find(tab => {
                            try {
                                const tabUrl = new URL(tab.url);
                                return tabUrl.hostname === targetUrl.hostname && 
                                       tabUrl.pathname === targetUrl.pathname;
                            } catch (e) {
                                return false;
                            }
                        });
                        if (targetTab) {
                            console.log('Found domain + path match:', targetTab.url);
                        }
                    }
                    
                    // Strategy 3: Contains job number in URL
                    if (!targetTab && request.data.job_number) {
                        targetTab = tabs.find(tab => tab.url && tab.url.includes(request.data.job_number));
                        if (targetTab) {
                            console.log('Found job number match in URL:', targetTab.url);
                        }
                    }
                    
                    // Strategy 4: Contains domain from page URL
                    if (!targetTab) {
                        const targetDomain = request.data.page_url.split('/')[2]; // Get domain
                        targetTab = tabs.find(tab => tab.url && tab.url.includes(targetDomain));
                        if (targetTab) {
                            console.log('Found domain match:', targetTab.url);
                        }
                    }
                    
                    if (targetTab) {
                        console.log('Sending transfer overlay to tab:', targetTab.url);
                        chrome.tabs.sendMessage(targetTab.id, {
                            action: 'showTransferOverlay',
                            data: request.data
                        }).catch(error => {
                            console.log('Could not send transfer message to content script:', error);
                        });
                    } else {
                        console.log('Could not find matching tab. Available tabs:');
                        tabs.forEach(tab => console.log('-', tab.url));
                        
                        // Fallback: try to send to active tab
                        chrome.tabs.query({active: true, currentWindow: true}, function(activeTabs) {
                            if (activeTabs[0]) {
                                console.log('Fallback: sending to active tab:', activeTabs[0].url);
                                chrome.tabs.sendMessage(activeTabs[0].id, {
                                    action: 'showTransferOverlay',
                                    data: request.data
                                }).catch(error => {
                                    console.log('Could not send transfer message to active tab:', error);
                                });
                            }
                        });
                    }
                });
            } else {
                // Fallback: send to active tab if no page URL
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (tabs[0]) {
                        console.log('No page URL, sending to active tab:', tabs[0].url);
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'showTransferOverlay',
                            data: request.data
                        }).catch(error => {
                            console.log('Could not send transfer message to content script:', error);
                        });
                    }
                });
            }
            
            sendResponse({ success: true });
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

