// Chrome Extension Popup with Dashboard User Management Integration
document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup loaded - initializing dashboard-integrated system');
    
    // DOM elements
    const loginSection = document.getElementById('loginSection');
    const secretKeyInput = document.getElementById('secretKeyInput');
    const loginBtn = document.getElementById('loginBtn');
    const userInfo = document.getElementById('userInfo');
    const currentUser = document.getElementById('currentUser');
    const userRole = document.getElementById('userRole');
    const logoutBtn = document.getElementById('logoutBtn');
    
    let currentUserData = null;
    
    // Check if user is already logged in
    checkLoginStatus();
    
    // Event listeners
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    secretKeyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    
    // Login function - validates against Supabase users
    async function handleLogin() {
        const secretKey = secretKeyInput.value.trim();
        if (!secretKey) {
            showNotification('Please enter your secret key', 'error');
            return;
        }
        
        try {
            // Show loading state
            loginBtn.textContent = 'Logging in...';
            loginBtn.disabled = true;
            
            console.log('🔐 Attempting login with key:', secretKey);
            console.log('🔍 Secret key length:', secretKey.length);
            
            // First, let's test the connection and see what tables exist
            console.log('🔗 Testing Supabase connection...');
            const testResponse = await fetch('https://xlnqqbbyivqlymmgchlw.supabase.co/rest/v1/', {
                headers: {
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbnFxYmJ5aXZxbHltbWdjaGx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMDkwOTgsImV4cCI6MjA2NTU4NTA5OH0.kyU2uNqVc6bualjIOUIW9syuAYdS4llPRVcrwBDOOIM',
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbnFxYmJ5aXZxbHltbWdjaGx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMDkwOTgsImV4cCI6MjA2NTU4NTA5OH0.kyU2uNqVc6bualjIOUIW9syuAYdS4llPRVcrwBDOOIM'
                }
            });
            
            console.log('🔗 Supabase connection test:', testResponse.status, testResponse.statusText);
            
            // Try different possible table names
            const possibleTables = ['dashboard_users', 'users', 'user_management', 'dashboard_users_table'];
            
            for (const tableName of possibleTables) {
                try {
                    console.log(`🔍 Trying table: ${tableName}`);
                    
                    const response = await fetch(`https://xlnqqbbyivqlymmgchlw.supabase.co/rest/v1/${tableName}?select=*`, {
                        headers: {
                            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbnFxYmJ5aXZxbHltbWdjaGx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMDkwOTgsImV4cCI6MjA2NTU4NTA5OH0.kyU2uNqVc6bualjIOUIW9syuAYdS4llPRVcrwBDOOIM',
                            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbnFxYmJ5aXZxbHltbWdjaGx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMDkwOTgsImV4cCI6MjA2NTU4NTA5OH0.kyU2uNqVc6bualjIOUIW9syuAYdS4llPRVcrwBDOOIM'
                        }
                    });
                    
                    console.log(`📡 Response for ${tableName}:`, response.status, response.statusText);
                    
                    if (response.ok) {
                        const users = await response.json();
                        console.log(`✅ Found table ${tableName} with ${users.length} users:`, users);
                        
                        // Debug: Show the actual column names from first user
                        if (users.length > 0) {
                            console.log('🔍 First user object keys:', Object.keys(users[0]));
                            console.log('🔍 Sample user data:', users[0]);
                        }
                        
                        // Now try to find user by secret key (handle different column names)
                        console.log('🔍 Looking for user with secret key:', secretKey);
                        const user = users.find(u => {
                            const match = u.secretKey === secretKey || 
                                         u.secret_key === secretKey || 
                                         u.secretkey === secretKey;
                            console.log(`🔍 Checking user ${u.name}:`, {
                                secretKey: u.secretKey,
                                secret_key: u.secret_key,
                                secretkey: u.secretkey,
                                match: match
                            });
                            return match;
                        });
                        
                        if (user) {
                            console.log('✅ User found:', user);
                            
                            // Check if user is active (handle different possible field names)
                            const isActive = user.isActive !== false && user.is_active !== false && user.isactive !== false;
                            console.log('🔍 User active status:', {
                                isActive: user.isActive,
                                is_active: user.is_active,
                                isactive: user.isactive,
                                final: isActive
                            });
                            
                            if (isActive) {
                                // Store user info in Chrome storage
                                currentUserData = user;
                                chrome.storage.local.set({ popupUser: user }, () => {
                                    showUserInfo(user);
                                    console.log('User logged in:', user.name, 'Role:', user.role);
                                    
                                    // Clear input
                                    secretKeyInput.value = '';
                                    
                                    // Show success notification
                                    showNotification(`Welcome, ${user.name}!`, 'success');
                                });
                                return; // Exit the loop
                            } else {
                                showNotification('User account is inactive', 'error');
                                return;
                            }
                        } else {
                            console.log('❌ No user found with that secret key');
                        }
                    } else {
                        console.log(`❌ Table ${tableName} not accessible:`, response.status, response.statusText);
                        try {
                            const errorText = await response.text();
                            console.log(`❌ Error details:`, errorText);
                        } catch (e) {
                            console.log(`❌ Could not read error response`);
                        }
                    }
                } catch (error) {
                    console.log(`❌ Error accessing table ${tableName}:`, error);
                }
            }
            
            // If we get here, no user was found
            console.log('❌ No valid user found in any table');
            showNotification('Invalid secret key or user not found', 'error');
            
        } catch (error) {
            console.error('❌ Login error:', error);
            showNotification('Network error. Please check your connection.', 'error');
        } finally {
            // Reset button state
            loginBtn.textContent = 'Login';
            loginBtn.disabled = false;
        }
    }
    
    // Logout function
    function handleLogout() {
        chrome.storage.local.remove(['popupUser'], () => {
            currentUserData = null;
            showLoginForm();
            console.log('User logged out');
            showNotification('Logged out successfully', 'success');
        });
    }
    
    // Show user info after login
    function showUserInfo(user) {
        loginSection.style.display = 'none';
        userInfo.style.display = 'block';
        
        // Set the user information text content
        currentUser.textContent = user.name;
        userRole.textContent = user.role;
        
        // Update page title to show user is logged in
        document.title = `Page Price Analyzer - ${user.name}`;
    }
    
    // Show login form
    function showLoginForm() {
        loginSection.style.display = 'block';
        userInfo.style.display = 'none';
        document.title = 'Page Price Analyzer';
    }
    
    // Check login status
    function checkLoginStatus() {
        chrome.storage.local.get(['popupUser'], (result) => {
            if (result.popupUser) {
                currentUserData = result.popupUser;
                showUserInfo(result.popupUser);
            } else {
                showLoginForm();
            }
        });
    }
    
    // Show notification
    function showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 5px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            background: ${type === 'success' ? '#28a745' : '#dc3545'};
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // Debug functions for testing
    window.testExtensionStatus = function() {
        console.log('🧪 Testing extension status...');
        console.log('Current user data:', currentUserData);
        console.log('Login section visible:', loginSection.style.display !== 'none');
        console.log('User info visible:', userInfo.style.display !== 'none');
        
        chrome.storage.local.get(['popupUser'], (result) => {
            console.log('Chrome storage popupUser:', result.popupUser);
        });
    };
    
    window.testLogin = function() {
        console.log('🧪 Testing login function...');
        const testKey = 'admin'; // Use your admin key
        console.log('Testing with key:', testKey);
        
        // Temporarily set the input value and trigger login
        secretKeyInput.value = testKey;
        handleLogin();
    };
    
    window.testSupabaseConnection = async function() {
        console.log('🧪 Testing Supabase connection...');
        try {
            const response = await fetch('https://xlnqqbbyivqlymmgchlw.supabase.co/rest/v1/dashboard_users?select=*', {
                headers: {
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbnFxYmJ5aXZxbHltbWdjaGx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMDkwOTgsImV4cCI6MjA2NTU4NTA5OH0.kyU2uNqVc6bualjIOUIW9syuAYdS4llPRVcrwBDOOIM',
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbnFxYmJ5aXZxbHltbWdjaGx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMDkwOTgsImV4cCI6MjA2NTU4NTA5OH0.kyU2uNqVc6bualjIOUIW9syuAYdS4llPRVcrwBDOOIM'
                }
            });
            
            console.log('Supabase test response:', response.status, response.statusText);
            
            if (response.ok) {
                const users = await response.json();
                console.log('Users found:', users.length);
                console.log('First user:', users[0]);
            } else {
                const errorText = await response.text();
                console.log('Error response:', errorText);
            }
        } catch (error) {
            console.error('Supabase test error:', error);
        }
    };
    
    console.log('🔧 Debug functions available:');
    console.log('- testExtensionStatus() - Check extension state');
    console.log('- testLogin() - Test login with admin key');
    console.log('- testSupabaseConnection() - Test Supabase connection');
    
    // Initialize price box functionality
    initializePriceBoxes();
});

// Function to initialize price box functionality
function initializePriceBoxes() {
    console.log('🔧 Initializing price boxes...');
    
    // Get all price input elements
    const depositInput = document.getElementById('depositInput');
    const pickupInput = document.getElementById('pickupInput');
    const dropoffInput = document.getElementById('dropoffInput');
    
    // Get all price amount display elements
    const depositAmount = document.getElementById('depositAmount');
    const pickupAmount = document.getElementById('pickupAmount');
    const dropoffAmount = document.getElementById('dropoffAmount');
    
    // Function to format currency
    function formatCurrency(amount) {
        if (!amount || isNaN(amount)) return '$0.00';
        return '$' + parseFloat(amount).toFixed(2);
    }
    
    // Function to update price display
    function updatePriceDisplay(input, display) {
        const value = input.value;
        display.textContent = formatCurrency(value);
        
        // Save to storage
        savePriceData();
    }
    
    // Add event listeners for input changes
    if (depositInput && depositAmount) {
        depositInput.addEventListener('input', () => updatePriceDisplay(depositInput, depositAmount));
        depositInput.addEventListener('blur', () => updatePriceDisplay(depositInput, depositAmount));
    }
    
    if (pickupInput && pickupAmount) {
        pickupInput.addEventListener('input', () => updatePriceDisplay(pickupInput, pickupAmount));
        pickupInput.addEventListener('blur', () => updatePriceDisplay(pickupInput, pickupAmount));
    }
    
    if (dropoffInput && dropoffAmount) {
        dropoffInput.addEventListener('input', () => updatePriceDisplay(dropoffInput, dropoffAmount));
        dropoffInput.addEventListener('blur', () => updatePriceDisplay(dropoffInput, dropoffAmount));
    }
    
    // Load saved price data
    loadPriceData();
    
    console.log('✅ Price boxes initialized');
}

// Function to save price data to Chrome storage
function savePriceData() {
    const priceData = {
        deposit: document.getElementById('depositInput')?.value || '0',
        pickup: document.getElementById('pickupInput')?.value || '0',
        dropoff: document.getElementById('dropoffInput')?.value || '0',
        lastUpdated: new Date().toISOString()
    };
    
    chrome.storage.local.set({ priceData }, () => {
        console.log('💾 Price data saved:', priceData);
    });
}

// Function to load price data from Chrome storage
function loadPriceData() {
    chrome.storage.local.get(['priceData'], (result) => {
        if (result.priceData) {
            const data = result.priceData;
            console.log('📥 Loading saved price data:', data);
            
            // Update input fields
            const depositInput = document.getElementById('depositInput');
            const pickupInput = document.getElementById('pickupInput');
            const dropoffInput = document.getElementById('dropoffInput');
            
            if (depositInput && data.deposit) {
                depositInput.value = data.deposit;
                document.getElementById('depositAmount').textContent = formatCurrency(data.deposit);
            }
            
            if (pickupInput && data.pickup) {
                pickupInput.value = data.pickup;
                document.getElementById('pickupAmount').textContent = formatCurrency(data.pickup);
            }
            
            if (dropoffInput && data.dropoff) {
                dropoffInput.value = data.dropoff;
                document.getElementById('dropoffAmount').textContent = formatCurrency(data.dropoff);
            }
        }
    });
}

// Helper function for currency formatting (make it globally available)
function formatCurrency(amount) {
    if (!amount || isNaN(amount)) return '$0.00';
    return '$' + parseFloat(amount).toFixed(2);
}
