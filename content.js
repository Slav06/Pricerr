// Content script for Page Price Analyzer
// This script runs on every page and extracts pricing information

class PageAnalyzer {
    constructor() {
        this.data = {
            locations: {
                from: { zip: '', city: '', state: '' },
                to: { zip: '', city: '', state: '' }
            },
            pricing: {
                initialPrice: '',
                fuelSurcharge: '',
                extraCharges: '',
                totalEstimate: ''
            },
            jobDetails: {
                jobNumber: '',
                status: '',
                pickupDate: ''
            },
            movingDetails: {
                customerName: '',
                movingFrom: '',
                movingTo: '',
                cubes: '',
                pickupDate: '',
                distance: ''
            }
        };
        this.pricingData = null;
        this.loadPricingData();
    }

    // Load pricing data from Google Sheet
    async loadPricingData() {
        try {
            const sheetUrl = 'https://docs.google.com/spreadsheets/d/1PBkNMBhstlTNZBoWONX1Te-0KcHKf2AAG95JI9WYG2g/edit?gid=0#gid=0';
            const csvUrl = sheetUrl.replace('/edit?gid=0#gid=0', '/export?format=csv&gid=0');
            
            const response = await fetch(csvUrl);
            const csvText = await response.text();
            this.pricingData = this.parseCSV(csvText);
            console.log('Pricing data loaded:', this.pricingData);
        } catch (error) {
            console.error('Failed to load pricing data:', error);
        }
    }

    // Parse CSV data from Google Sheet
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });
                data.push(row);
            }
        }
        
        return data;
    }

    // Calculate price based on zip codes
    calculatePrice(fromZip, toZip) {
        if (!this.pricingData) {
            console.log('Pricing data not loaded yet');
            return null;
        }

        try {
            // Find zones for from and to zip codes
            const fromZone = this.findZoneForZip(fromZip);
            const toZone = this.findZoneForZip(toZip);
            
            if (!fromZone || !toZone) {
                console.log('Could not determine zones for zip codes');
                return null;
            }

            // Calculate distance (simplified - you can use Google Maps API for accuracy)
            const distance = this.calculateDistance(fromZip, toZip);
            
            // Get pricing for the zones
            const fromZoneData = this.pricingData.find(row => row.Zone === fromZone.toString());
            const toZoneData = this.pricingData.find(row => row.Zone === toZone.toString());
            
            if (!fromZoneData || !toZoneData) {
                console.log('Zone data not found');
                return null;
            }

            // Use the higher surcharge rate for pricing
            const surchargePerMile = Math.max(
                parseFloat(fromZoneData['Surcharge Per Mile']), 
                parseFloat(toZoneData['Surcharge Per Mile'])
            );
            
            const basePrice = parseFloat(fromZoneData['Base Price']);
            const totalPrice = basePrice + (distance * surchargePerMile);
            
            console.log(`Price calculation: Base $${basePrice} + (${distance} miles × $${surchargePerMile}) = $${totalPrice}`);
            
            return {
                basePrice: basePrice,
                distance: distance,
                surchargePerMile: surchargePerMile,
                totalPrice: totalPrice,
                fromZone: fromZone,
                toZone: toZone
            };
        } catch (error) {
            console.error('Error calculating price:', error);
            return null;
        }
    }

    // Find zone for a zip code
    findZoneForZip(zip) {
        if (!this.pricingData) return null;
        
        const zipNum = parseInt(zip);
        if (isNaN(zipNum)) return null;
        
        for (const row of this.pricingData) {
            const range = row['Zip Code Range'];
            if (range && range.includes('-')) {
                const [min, max] = range.split('-').map(z => parseInt(z));
                if (zipNum >= min && zipNum <= max) {
                    return parseInt(row.Zone);
                }
            }
        }
        return null;
    }

    // Calculate distance between zip codes (simplified)
    calculateDistance(fromZip, toZip) {
        // This is a simplified calculation - you can replace with Google Maps API
        // For now, using a rough estimate based on zip code patterns
        const fromNum = parseInt(fromZip);
        const toNum = parseInt(toZip);
        
        if (isNaN(fromNum) || isNaN(toNum)) return 1000; // Default fallback
        
        // Rough distance calculation (this is simplified)
        const diff = Math.abs(fromNum - toNum);
        if (diff < 1000) return diff * 0.1; // Close zip codes
        if (diff < 5000) return diff * 0.2; // Medium distance
        if (diff < 10000) return diff * 0.3; // Long distance
        return diff * 0.4; // Very long distance
    }

    // Main analysis function
    analyzePage() {
        try {
            console.log('Starting page analysis...');
            this.extractLocationInfo();
            this.extractPricingInfo();
            this.extractJobDetails();
            this.extractMovingDetails();
            
            console.log('Final extracted data:', this.data);
            
            return {
                success: true,
                data: this.data
            };
        } catch (error) {
            console.error('Page analysis failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Extract location information (Moving From/To)
    extractLocationInfo() {
        // Look for common patterns in moving forms
        const textContent = document.body.innerText;
        
        // First try to extract from specific "Moving From" and "Moving To" sections
        this.extractMovingSections(textContent);
        
        // If we didn't get both locations, fall back to general extraction
        if (!this.data.locations.from.zip || !this.data.locations.to.zip) {
            this.extractGeneralLocationInfo(textContent);
        }
    }

    // Extract from specific "Moving From" and "Moving To" sections
    extractMovingSections(textContent) {
        console.log('Extracting from text content:', textContent.substring(0, 1000)); // Debug first 1000 chars
        
        // Split the text into sections to isolate Moving From and Moving To
        const sections = textContent.split(/(?=Moving\s+(?:From|To))/i);
        console.log('Split sections:', sections);
        
        // Find Moving From section
        const movingFromSection = sections.find(section => 
            section.toLowerCase().includes('moving from')
        );
        
        if (movingFromSection) {
            console.log('Found Moving From section:', movingFromSection);
            // Look for zip code in this section
            const zipMatch = movingFromSection.match(/(\d{5})/);
            if (zipMatch) {
                this.data.locations.from.zip = zipMatch[1];
            }
            
            // Look for state in this section
            const stateMatch = movingFromSection.match(/\b([A-Z]{2})\b/);
            if (stateMatch) {
                this.data.locations.from.state = stateMatch[1];
            }
            
            console.log('Moving From extracted:', this.data.locations.from);
        }
        
        // Find Moving To section
        const movingToSection = sections.find(section => 
            section.toLowerCase().includes('moving to')
        );
        
        if (movingToSection) {
            console.log('Found Moving To section:', movingToSection);
            // Look for zip code in this section
            const zipMatch = movingToSection.match(/(\d{5})/);
            if (zipMatch) {
                this.data.locations.to.zip = zipMatch[1];
            }
            
            // Look for state in this section
            const stateMatch = movingToSection.match(/\b([A-Z]{2})\b/);
            if (stateMatch) {
                this.data.locations.to.state = stateMatch[1];
            }
            
            console.log('Moving To extracted:', this.data.locations.to);
        }
        
        // If we still don't have states, try to extract them separately
        if (!this.data.locations.from.state || !this.data.locations.to.state) {
            this.extractStatesSeparately(textContent);
        }
    }

    // Extract states separately if the main extraction failed
    extractStatesSeparately(textContent) {
        // Look for state patterns near the zip codes
        const statePattern = /\b([A-Z]{2})\b/g;
        const states = textContent.match(statePattern);
        
        if (states && states.length >= 2) {
            // Find which states go with which zip codes
            const zipCodes = textContent.match(/\b\d{5}\b/g);
            
            if (zipCodes && zipCodes.length >= 2) {
                // Look for state near each zip code
                const fromZip = this.data.locations.from.zip;
                const toZip = this.data.locations.to.zip;
                
                if (fromZip) {
                    // Find state near the "from" zip
                    const fromSection = textContent.substring(0, textContent.indexOf(fromZip) + 100);
                    const fromStateMatch = fromSection.match(/\b([A-Z]{2})\b/);
                    if (fromStateMatch) {
                        this.data.locations.from.state = fromStateMatch[1];
                    }
                }
                
                if (toZip) {
                    // Find state near the "to" zip
                    const toSection = textContent.substring(textContent.indexOf(toZip) - 100, textContent.indexOf(toZip) + 100);
                    const toStateMatch = toSection.match(/\b([A-Z]{2})\b/);
                    if (toStateMatch) {
                        this.data.locations.to.state = toStateMatch[1];
                    }
                }
            }
        }
    }

    // Fallback general extraction method
    extractGeneralLocationInfo(textContent) {
        // Extract zip codes - look for 5-digit patterns
        const zipCodePattern = /\b\d{5}\b/g;
        const zipCodes = textContent.match(zipCodePattern);
        
        if (zipCodes && zipCodes.length >= 2) {
            this.data.locations.from.zip = zipCodes[0];
            this.data.locations.to.zip = zipCodes[1];
        }

        // Extract city and state information
        this.extractCityState(textContent);
    }

    // Extract city and state information
    extractCityState(textContent) {
        // Common state abbreviations
        const statePattern = /\b([A-Z]{2})\b/g;
        const states = textContent.match(statePattern);
        
        if (states && states.length >= 2) {
            this.data.locations.from.state = states[0];
            this.data.locations.to.state = states[1];
        }

        // Try to extract city names (this is more complex and may need refinement)
        this.extractCityNames(textContent);
    }

    // Extract city names - look for common patterns
    extractCityNames(textContent) {
        // Look for text that might be city names
        // This is a simplified approach - in practice, you might want more sophisticated parsing
        
        // Common city indicators
        const cityIndicators = ['city:', 'city', 'town:', 'town'];
        
        for (const indicator of cityIndicators) {
            const regex = new RegExp(`${indicator}\\s*([A-Za-z\\s]+)`, 'gi');
            const matches = textContent.match(regex);
            
            if (matches && matches.length >= 2) {
                // Extract city names from matches
                const cities = matches.map(match => {
                    const city = match.replace(new RegExp(indicator, 'gi'), '').trim();
                    return city.split(/\s+/)[0]; // Take first word as city
                });
                
                if (cities.length >= 2) {
                    this.data.locations.from.city = cities[0];
                    this.data.locations.to.city = cities[1];
                    break;
                }
            }
        }
    }

    // Extract pricing information
    extractPricingInfo() {
        const textContent = document.body.innerText;
        
        // Extract initial price
        const initialPriceMatch = textContent.match(/initial\s*price[:\s]*\$?([\d,]+\.?\d*)/i);
        if (initialPriceMatch) {
            this.data.pricing.initialPrice = `$${initialPriceMatch[1]}`;
        }

        // Extract fuel surcharge
        const fuelMatch = textContent.match(/fuel\s*surcharge[:\s]*\$?([\d,]+\.?\d*)/i);
        if (fuelMatch) {
            this.data.pricing.fuelSurcharge = `$${fuelMatch[1]}`;
        }

        // Extract extra charges
        const extraMatch = textContent.match(/extra\s*charges?[:\s]*\$?([\d,]+\.?\d*)/i);
        if (extraMatch) {
            this.data.pricing.extraCharges = `$${extraMatch[1]}`;
        }

        // Extract total estimate
        const totalMatch = textContent.match(/total\s*estimate[:\s]*\$?([\d,]+\.?\d*)/i);
        if (totalMatch) {
            this.data.pricing.totalEstimate = `$${totalMatch[1]}`;
        }

        // Alternative patterns for total
        if (!this.data.pricing.totalEstimate) {
            const totalAltMatch = textContent.match(/total[:\s]*\$?([\d,]+\.?\d*)/i);
            if (totalAltMatch) {
                this.data.pricing.totalEstimate = `$${totalAltMatch[1]}`;
            }
        }
    }

    // Extract job details
    extractJobDetails() {
        const textContent = document.body.innerText;
        
        // Extract job number - try multiple methods
        let jobNumber = null;
        
        // Method 1: Look for the specific HTML structure you mentioned
        const deptElement = document.querySelector('#dept');
        if (deptElement) {
            const deptLetter = deptElement.textContent.trim();
            // Look for the number that follows the dept element
            const nextText = deptElement.nextSibling;
            if (nextText && nextText.textContent) {
                const numberMatch = nextText.textContent.match(/(\d+)/);
                if (numberMatch) {
                    jobNumber = deptLetter + numberMatch[1];
                }
            }
        }
        
        // Method 2: Look for the combined format in text content
        if (!jobNumber) {
            const combinedMatch = textContent.match(/([A-Z]\d{7})/);
            if (combinedMatch) {
                jobNumber = combinedMatch[1];
            }
        }
        
        // Method 3: Look for the old format (job no:)
        if (!jobNumber) {
            const jobMatch = textContent.match(/job\s*no[:\s]*([A-Z0-9]+)/i);
            if (jobMatch) {
                jobNumber = jobMatch[1];
            }
        }
        
        // Method 4: Look for any pattern that matches A + 7 digits
        if (!jobNumber) {
            const patternMatch = textContent.match(/([A-Z]\d{7})/g);
            if (patternMatch && patternMatch.length > 0) {
                jobNumber = patternMatch[0];
            }
        }
        
        if (jobNumber) {
            this.data.jobDetails.jobNumber = jobNumber;
            console.log('Job number extracted:', jobNumber);
        } else {
            console.log('No job number found using any method');
        }

        // Extract status
        const statusMatch = textContent.match(/status[:\s]*([A-Za-z\s-]+)/i);
        if (statusMatch) {
            this.data.jobDetails.status = statusMatch[1].trim();
        }

        // Extract pick-up date
        const pickupMatch = textContent.match(/pick.?up[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (pickupMatch) {
            this.data.jobDetails.pickupDate = pickupMatch[1];
        }
    }

    // Extract moving details (customer name, locations, cubes, dates, distance)
    extractMovingDetails() {
        const textContent = document.body.innerText;
        
        // Extract customer name - look for the specific HTML structure
        const nameRow = document.querySelector('tr td[colspan="3"] font[face="Verdana"][color="#31557B"][size="4"] b');
        if (nameRow) {
            this.data.movingDetails.customerName = nameRow.textContent.trim();
        } else {
            // Fallback: look for any font with Verdana, color #31557B, size 4, and bold text
            const nameFallback = document.querySelector('font[face="Verdana"][color="#31557B"][size="4"] b');
            if (nameFallback) {
                this.data.movingDetails.customerName = nameFallback.textContent.trim();
            } else {
                // Additional fallback: look for any bold text in a table row
                const boldText = document.querySelector('tr td b');
                if (boldText && boldText.textContent.trim().match(/^[A-Za-z\s]+$/)) {
                    this.data.movingDetails.customerName = boldText.textContent.trim();
                }
            }
        }
        
        // Extract Moving From - look for FROMTO class table rows
        const fromToRows = document.querySelectorAll('tr td.FROMTO');
        if (fromToRows.length >= 6) { // Should have 6 cells: 3 for FROM + 3 for TO
            // First 3 cells are Moving From (city, state, zip)
            const fromCity = fromToRows[0]?.textContent?.trim().replace(/\s+$/, '') || '';
            const fromState = fromToRows[1]?.textContent?.trim().replace(/\s+$/, '') || '';
            const fromZip = fromToRows[2]?.textContent?.trim().replace(/\s+$/, '') || '';
            
            if (fromCity && fromState) {
                this.data.movingDetails.movingFrom = `${fromCity}, ${fromState}`;
                if (fromZip) {
                    this.data.movingDetails.movingFrom += ` ${fromZip}`;
                }
            }
            
            // Next 3 cells are Moving To (city, state, zip)
            const toCity = fromToRows[3]?.textContent?.trim().replace(/\s+$/, '') || '';
            const toState = fromToRows[4]?.textContent?.trim().replace(/\s+$/, '') || '';
            const toZip = fromToRows[5]?.textContent?.trim().replace(/\s+$/, '') || '';
            
            if (toCity && toState) {
                this.data.movingDetails.movingTo = `${toCity}, ${toState}`;
                if (toZip) {
                    this.data.movingDetails.movingTo += ` ${toZip}`;
                }
            }
        } else {
            // Fallback: try regex patterns if DOM structure doesn't match
            const fromMatch = textContent.match(/Moving\s+From[:\s-]+([A-Za-z\s]+)/i);
            if (fromMatch) {
                this.data.movingDetails.movingFrom = fromMatch[1].trim();
            }
            
            const toMatch = textContent.match(/Moving\s+To[:\s-]+([A-Za-z0-9\s]+)/i);
            if (toMatch) {
                this.data.movingDetails.movingTo = toMatch[1].trim();
            }
        }
        
        // Extract Cubes from CFLBS input field
        const cubesInput = document.querySelector('input[name="CFLBS"]');
        if (cubesInput && cubesInput.value) {
            this.data.movingDetails.cubes = cubesInput.value;
            console.log('Cubes extracted from CFLBS input:', cubesInput.value);
        } else {
            // Fallback: try regex pattern
            const cubesMatch = textContent.match(/Cubes[:\s-]+(\d+)/i);
            if (cubesMatch) {
                this.data.movingDetails.cubes = cubesMatch[1];
            }
        }
        
        // Extract Pick Up Date from PUDTE input field
        const pickupInput = document.querySelector('input[name="PUDTE"]');
        if (pickupInput && pickupInput.value) {
            this.data.movingDetails.pickupDate = pickupInput.value;
            console.log('Pickup date extracted from PUDTE input:', pickupInput.value);
        } else {
            // Fallback: try regex pattern
            const pickupMatch = textContent.match(/Pick\s+Up\s+Date[:\s-]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
            if (pickupMatch) {
                this.data.movingDetails.pickupDate = pickupMatch[1];
            }
        }
        
        // Extract Distance - look for "Distance: 439 Miles" pattern
        const distanceMatch = textContent.match(/Distance[:\s]*(\d+)\s*Miles/i);
        if (distanceMatch) {
            this.data.movingDetails.distance = `${distanceMatch[1]} Miles`;
        }
        
        console.log('Moving details extracted:', this.data.movingDetails);
    }

    // Enhanced analysis for moving company specific pages
    analyzeMovingCompanyPage() {
        // Look for specific moving company patterns
        const textContent = document.body.innerText;
        
        // Check if this looks like a moving company page
        const movingKeywords = ['moving', 'charges', 'estimate', 'relocation', 'transport'];
        const isMovingPage = movingKeywords.some(keyword => 
            textContent.toLowerCase().includes(keyword)
        );

        if (isMovingPage) {
            // The enhanced extraction is now handled in extractMovingSections
            // which is called from extractLocationInfo
        }
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    if (request.action === 'analyzePage') {
        console.log('Starting page analysis...');
        const analyzer = new PageAnalyzer();
        
        // First try general analysis
        let result = analyzer.analyzePage();
        console.log('Initial analysis result:', result);
        
        // If it's a moving company page, do enhanced analysis
        if (result.success) {
            analyzer.analyzeMovingCompanyPage();
            // Update the result with enhanced data
            result.data = analyzer.data;
            console.log('Enhanced analysis result:', result);
        }
        
        console.log('Final result being sent:', result);
        console.log('Result data structure:', JSON.stringify(result, null, 2));
        sendResponse(result);
    }
    
    if (request.action === 'calculatePrice') {
        console.log('Calculating price for:', request.fromZip, 'to', request.toZip);
        
        try {
            const analyzer = new PageAnalyzer();
            const priceData = analyzer.calculatePrice(request.fromZip, request.toZip);
            
            if (priceData) {
                sendResponse({ 
                    success: true, 
                    priceData: priceData 
                });
            } else {
                sendResponse({ 
                    success: false, 
                    error: 'Could not calculate price' 
                });
            }
        } catch (error) {
            console.error('Error calculating price:', error);
            sendResponse({ 
                success: false, 
                error: error.message 
            });
        }
    }
    
    if (request.action === 'insertMaxBinder') {
        console.log('Inserting Max Binder data:', request.data);
        
        try {
            console.log('Searching for Extra fields...');
            
            // Method 1: Look for text nodes containing "Extra:"
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            let extraLabels = [];
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.trim() === 'Extra:') {
                    extraLabels.push(node.parentElement);
                }
            }
            
            console.log('Found Extra labels:', extraLabels);
            
            if (extraLabels.length > 0) {
                const firstExtraLabel = extraLabels[0];
                console.log('Processing first Extra label:', firstExtraLabel);
                console.log('Extra label HTML:', firstExtraLabel.outerHTML);
                
                // Look for the EXTRA1 input field directly in the same container as the Extra: label
                let targetInput = firstExtraLabel.querySelector('input[name="EXTRA1"]');
                
                // If not found in the same container, look in the parent
                if (!targetInput && firstExtraLabel.parentElement) {
                    targetInput = firstExtraLabel.parentElement.querySelector('input[name="EXTRA1"]');
                }
                
                // If still not found, look in the grandparent
                if (!targetInput && firstExtraLabel.parentElement && firstExtraLabel.parentElement.parentElement) {
                    targetInput = firstExtraLabel.parentElement.parentElement.querySelector('input[name="EXTRA1"]');
                }
                
                console.log('Target input found:', targetInput);
                
                if (targetInput) {
                    console.log('Targeting input field:', targetInput);
                    console.log('Input type:', targetInput.type);
                    console.log('Input name:', targetInput.name);
                    console.log('Input current value:', targetInput.value);
                    
                    // Insert the text
                    targetInput.value = request.data.extraText;
                    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('Inserted text into input field:', request.data.extraText);
                    
                    // Find and update the EXTRA1AMT amount field specifically
                    const amountField = document.querySelector('input[name="EXTRA1AMT"]');
                    
                    if (amountField) {
                        console.log('Found EXTRA1AMT amount field:', amountField);
                        console.log('Amount field current value:', amountField.value);
                        
                        // Update the amount field value
                        amountField.value = request.data.extraAmount;
                        amountField.dispatchEvent(new Event('input', { bubbles: true }));
                        amountField.dispatchEvent(new Event('change', { bubbles: true }));
                        console.log('Updated amount field to:', request.data.extraAmount);
                    } else {
                        console.log('EXTRA1AMT amount field not found');
                        
                        // Fallback: look for any input field with "0.00" value
                        const fallbackAmountFields = Array.from(document.querySelectorAll('input[type="text"]')).filter(el => 
                            el.value && /0\.00|0\.0|0/.test(el.value.trim())
                        );
                        
                        if (fallbackAmountFields.length > 0) {
                            const fallbackField = fallbackAmountFields[0];
                            console.log('Found fallback amount field:', fallbackField);
                            fallbackField.value = request.data.extraAmount;
                            fallbackField.dispatchEvent(new Event('input', { bubbles: true }));
                            fallbackField.dispatchEvent(new Event('change', { bubbles: true }));
                            console.log('Updated fallback amount field to:', request.data.extraAmount);
                        }
                    }
                    
                    // Find and click the Submit Charges button - target the specific button
                    const submitButton = document.querySelector('input[name="SUBMIT_2"][class="SUBMIT"]');
                    
                    if (submitButton) {
                        console.log('Found Submit Charges button, clicking it...');
                        console.log('Submit button details:', submitButton.outerHTML);
                        submitButton.click();
                        console.log('Submit Charges button clicked');
                    } else {
                        console.log('Submit Charges button not found, trying fallback...');
                        
                        // Fallback: look for any button with "Submit Charges" text
                        const fallbackSubmitButton = Array.from(document.querySelectorAll('*')).find(el => 
                            el.textContent && el.textContent.toLowerCase().includes('submit charges') && 
                            (el.tagName === 'BUTTON' || el.tagName === 'INPUT')
                        );
                        
                        if (fallbackSubmitButton) {
                            console.log('Found fallback Submit Charges button, clicking it...');
                            fallbackSubmitButton.click();
                            console.log('Fallback Submit Charges button clicked');
                        } else {
                            console.log('No Submit Charges button found at all');
                        }
                    }
                    
                    sendResponse({ success: true, message: 'Max Binder data inserted and submitted' });
                } else {
                    console.log('EXTRA1 input field not found near Extra label');
                    sendResponse({ success: false, error: 'EXTRA1 input field not found near Extra label' });
                }
            } else {
                console.log('No Extra labels found');
                sendResponse({ success: false, error: 'No Extra fields found on page' });
            }
            
        } catch (error) {
            console.error('Error inserting Max Binder data:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    if (request.action === 'getJobNumber') {
        console.log('Getting job number from page...');
        
        try {
            const analyzer = new PageAnalyzer();
            
            // Debug: Check what was extracted
            console.log('Analyzer data:', analyzer.data);
            console.log('Job details:', analyzer.data.jobDetails);
            
            const jobNumber = analyzer.data.jobDetails.jobNumber;
            
            if (jobNumber) {
                console.log('Job number found:', jobNumber);
                sendResponse({ 
                    success: true, 
                    jobNumber: jobNumber 
                });
            } else {
                console.log('No job number found on page');
                
                // Additional debugging for the specific element you mentioned
                const deptElement = document.querySelector('#dept');
                if (deptElement) {
                    console.log('Found #dept element:', deptElement.outerHTML);
                    console.log('Dept text:', deptElement.textContent);
                    
                    // Try to manually extract the job number
                    const deptLetter = deptElement.textContent.trim();
                    const nextText = deptElement.nextSibling;
                    if (nextText && nextText.textContent) {
                        console.log('Next sibling text:', nextText.textContent);
                        const numberMatch = nextText.textContent.match(/(\d+)/);
                        if (numberMatch) {
                            const extractedJobNumber = deptLetter + numberMatch[1];
                            console.log('Manually extracted job number:', extractedJobNumber);
                            sendResponse({ 
                                success: true, 
                                jobNumber: extractedJobNumber 
                            });
                            return;
                        }
                    }
                }
                
                sendResponse({ 
                    success: false, 
                    error: 'No job number found on page' 
                });
            }
        } catch (error) {
            console.error('Error getting job number:', error);
            sendResponse({ 
                success: false, 
                error: error.message 
            });
        }
    }
    
    // Always return true to indicate we will send a response asynchronously
    return true;
});

// Also analyze the page when it loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page Price Analyzer content script loaded');
    const analyzer = new PageAnalyzer();
    analyzer.analyzePage();
    analyzer.analyzeMovingCompanyPage();
});

// Also run when window loads (for pages that load content dynamically)
window.addEventListener('load', () => {
    console.log('Page Price Analyzer content script - window loaded');
    const analyzer = new PageAnalyzer();
    analyzer.analyzePage();
    analyzer.analyzeMovingCompanyPage();
});

// Listen for dynamic content changes
const observer = new MutationObserver(() => {
    // Re-analyze if content changes significantly
    const analyzer = new PageAnalyzer();
    analyzer.analyzePage();
    analyzer.analyzeMovingCompanyPage();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
