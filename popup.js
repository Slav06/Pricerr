// Popup script for Page Price Analyzer
// Handles the popup interface and communication with content script

class PopupManager {
            constructor() {
            this.initializeEventListeners();
            this.autoAnalyze();
        }

    initializeEventListeners() {
        // Submit Job Number button
        document.getElementById('submitJobButton').addEventListener('click', async () => {
            console.log('Submit Job Number clicked - submitting to database...');
            
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) {
                    console.error('No active tab found');
                    return;
                }

                console.log('Current tab:', tab.url);

                // Get job number from the current page
                const response = await chrome.tabs.sendMessage(tab.id, { 
                    action: 'getJobNumber'
                });
                
                console.log('Response from content script:', response);
                
                if (response && response.success && response.jobNumber) {
                    console.log('Job number found:', response.jobNumber);
                    // Submit to database
                    await this.submitJobToDatabase(response.jobNumber, tab.url);
                    console.log('Job number submitted successfully');
                } else {
                    console.error('Failed to get job number:', response?.error || 'No response');
                    this.showMessage('No job number found on this page', 'error');
                }
                
            } catch (error) {
                console.error('Error submitting job number:', error);
                this.showMessage(`Error: ${error.message}`, 'error');
            }
        });

        // Insert Max Binder button
        document.querySelector('.top-button:not(#submitJobButton)').addEventListener('click', async () => {
            console.log('Insert Max Binder clicked - inserting data...');
            
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) {
                    console.error('No active tab found');
                    return;
                }

                // Use calculated price if available, otherwise use default
                const amount = this.calculatedPrice || 859.00;
                
                const response = await chrome.tabs.sendMessage(tab.id, { 
                    action: 'insertMaxBinder',
                    data: {
                        extraText: 'Origin & Destination',
                        extraAmount: amount.toFixed(2)
                    }
                });
                
                if (response && response.success) {
                    console.log('Max Binder data inserted successfully');
                } else {
                    console.error('Failed to insert Max Binder data:', response?.error);
                }
                
            } catch (error) {
                console.error('Error inserting Max Binder data:', error);
            }
        });

        // Price slider
        const slider = document.getElementById('priceSlider');
        const sliderValue = document.getElementById('sliderValue');
        
        slider.addEventListener('input', (e) => {
            const value = e.target.value;
            sliderValue.textContent = `$${value}`;
            this.calculatedPrice = parseFloat(value);
        });
    }

    // Analyze the current active tab
    async analyzeCurrentPage() {
        try {
            // Get the current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('No active tab found');
            }

            // Check if this is a page we can analyze
            if (this.isRestrictedPage(tab.url)) {
                throw new Error('Cannot analyze this type of page. Please navigate to a regular website.');
            }

            // Check if content script is ready
            try {
                // Send message to content script
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'analyzePage' });
                
                if (response && response.success) {
                    this.displayResults(response.data);
                } else {
                    throw new Error(response?.error || 'Analysis failed');
                }
            } catch (messageError) {
                if (messageError.message.includes('Receiving end does not exist')) {
                    // Content script not ready, try to inject it
                    await this.injectContentScript(tab.id);
                    // Wait a moment for script to initialize
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Try again
                    const response = await chrome.tabs.sendMessage(tab.id, { action: 'analyzePage' });
                    if (response && response.success) {
                        this.displayResults(response.data);
                    } else {
                        throw new Error(response?.error || 'Analysis failed after injection');
                    }
                } else {
                    throw messageError;
                }
            }
            
        } catch (error) {
            console.error('Analysis error:', error);
            // Don't show error to user, just log it
        }
    }

    // Check if page is restricted (can't run content scripts)
    isRestrictedPage(url) {
        if (!url) return true;
        
        const restrictedPatterns = [
            'chrome://',
            'chrome-extension://',
            'edge://',
            'about:',
            'moz-extension://',
            'view-source:',
            'data:',
            'file://'
        ];
        
        return restrictedPatterns.some(pattern => url.startsWith(pattern));
    }

    // Inject content script if needed
    async injectContentScript(tabId) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            console.log('Content script injected successfully');
        } catch (error) {
            console.log('Content script injection failed:', error);
        }
    }

    // Display the analysis results
    displayResults(data) {
        console.log('Raw data received:', data);
        console.log('Data type:', typeof data);
        console.log('Data keys:', Object.keys(data));
        
        if (data.locations && data.locations.from) {
            const fromZip = data.locations.from.zip || 'Not found';
            const fromState = data.locations.from.state || 'Not found';
            document.getElementById('fromZipState').textContent = `${fromZip} ${fromState}`;
            console.log('From location set to:', `${fromZip} ${fromState}`);
        } else {
            console.log('No from location data found');
        }
        
        if (data.locations && data.locations.to) {
            const toZip = data.locations.to.zip || 'Not found';
            const toState = data.locations.to.state || 'Not found';
            document.getElementById('toZipState').textContent = `${toZip} ${toState}`;
            console.log('To location set to:', `${toZip} ${toState}`);
        } else {
            console.log('No to location data found');
        }
        
        console.log('Extracted location data:', JSON.stringify(data.locations, null, 2));
        
        // Calculate and display pricing if we have both zip codes
        if (data.locations && data.locations.from && data.locations.to) {
            this.calculateAndDisplayPrice(data.locations.from.zip, data.locations.to.zip);
        }
    }

    // Calculate and display pricing from Google Sheet
    async calculateAndDisplayPrice(fromZip, toZip) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return;

            const response = await chrome.tabs.sendMessage(tab.id, { 
                action: 'calculatePrice',
                fromZip: fromZip,
                toZip: toZip
            });
            
            if (response && response.success && response.priceData) {
                const price = response.priceData.totalPrice;
                const distance = response.priceData.distance;
                const fromZone = response.priceData.fromZone;
                const toZone = response.priceData.toZone;
                
                // Display calculated price
                document.getElementById('calculatedPrice').textContent = `$${price.toFixed(2)}`;
                
                // Set slider to calculated price
                const slider = document.getElementById('priceSlider');
                slider.value = Math.round(price);
                document.getElementById('sliderValue').textContent = `$${Math.round(price)}`;
                
                // Store the calculated price for use in Insert Max Binder
                this.calculatedPrice = price;
                
                console.log(`Price calculated: $${price.toFixed(2)} for ${distance.toFixed(0)} miles (Zones ${fromZone}-${toZone})`);
            }
        } catch (error) {
            console.error('Error calculating price:', error);
        }
    }

    // Submit job number to Supabase
    async submitJobToDatabase(jobNumber, pageUrl) {
        try {
            // Get Supabase configuration from config file
            const supabaseUrl = window.CONFIG?.SUPABASE?.URL || 'https://your-project.supabase.co';
            const supabaseKey = window.CONFIG?.SUPABASE?.ANON_KEY || 'your-anon-key';
            
            // Check if credentials are still placeholder
            if (supabaseUrl === 'https://your-project.supabase.co' || supabaseKey === 'your-anon-key') {
                throw new Error('Please update Supabase credentials in config.js');
            }
            
            console.log('Submitting job number:', jobNumber, 'to URL:', pageUrl);
            
            // Get Chrome profile information
            const profileInfo = await this.getChromeProfileInfo();
            console.log('Chrome profile info:', profileInfo);
            
            // Get moving details from the current page
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            let movingDetails = {};
            
            if (tab) {
                try {
                    const analysisResponse = await chrome.tabs.sendMessage(tab.id, { action: 'analyzePage' });
                    if (analysisResponse && analysisResponse.success && analysisResponse.data.movingDetails) {
                        movingDetails = analysisResponse.data.movingDetails;
                        console.log('Moving details extracted:', movingDetails);
                    }
                } catch (error) {
                    console.log('Could not extract moving details:', error);
                }
            }
            
            const response = await fetch(`${supabaseUrl}/rest/v1/job_submissions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    job_number: jobNumber,
                    page_url: pageUrl,
                    submitted_at: new Date().toISOString(),
                    source: 'Page Price Analyzer Extension',
                    chrome_profile_id: profileInfo.profileId,
                    chrome_profile_name: profileInfo.profileName,
                    user_identifier: profileInfo.userIdentifier,
                    customer_name: movingDetails.customerName || null,
                    moving_from: movingDetails.movingFrom || null,
                    moving_to: movingDetails.movingTo || null,
                    cubes: movingDetails.cubes || null,
                    pickup_date: movingDetails.pickupDate || null,
                    distance: movingDetails.distance || null
                })
            });

            if (response.ok) {
                console.log('Job submitted to Supabase successfully');
                this.showMessage(`Job submitted by ${profileInfo.profileName}!`, 'success');
                

            } else {
                const errorData = await response.json();
                throw new Error(`Supabase submission failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error submitting to Supabase:', error);
            this.showMessage(`Failed to submit: ${error.message}`, 'error');
        }
    }

    // Get Chrome profile information
    async getChromeProfileInfo() {
        try {
            // Get Chrome profile information
            const profileInfo = await new Promise((resolve) => {
                chrome.storage.local.get(['profileInfo'], (result) => {
                    if (result.profileInfo) {
                        resolve(result.profileInfo);
                    } else {
                        // Fallback: generate a profile identifier
                        const fallbackInfo = {
                            profileId: 'profile_' + Math.random().toString(36).substr(2, 9),
                            profileName: 'Chrome Profile',
                            userIdentifier: 'user_' + Math.random().toString(36).substr(2, 9)
                        };
                        resolve(fallbackInfo);
                    }
                });
            });

            return profileInfo;
        } catch (error) {
            console.error('Error getting profile info:', error);
            // Return fallback info if anything fails
            return {
                profileId: 'profile_fallback',
                profileName: 'Chrome Profile',
                userIdentifier: 'user_fallback'
            };
        }
    }

    // Show user feedback messages
    showMessage(message, type) {
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        
        // Add to container
        document.querySelector('.container').appendChild(messageEl);
        
        // Remove after 3 seconds
        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }

    // Auto-analyze when popup opens
    async autoAnalyze() {
        try {
            // Small delay to ensure popup is fully loaded
            await new Promise(resolve => setTimeout(resolve, 100));
            await this.analyzeCurrentPage();
        } catch (error) {
            console.log('Auto-analysis not available:', error.message);
        }
    }
    

}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const popup = new PopupManager();
});
