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
    const transferSection = document.getElementById('transferSection');
    const transferList = document.getElementById('transferList');
    
    let currentUserData = null;
    
    // Check if user is already logged in
    checkLoginStatus();
    
    // Check for transfer updates every 3 seconds
    setInterval(checkTransferUpdates, 3000);
    
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
            
            // First, let's test the connection and see what tables exist
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
                    
                    if (response.ok) {
                        const users = await response.json();
                        console.log(`✅ Found table ${tableName} with ${users.length} users:`, users);
                        
                        // Now try to find user by secret key
                        const user = users.find(u => u.secretKey === secretKey || u.secret_key === secretKey);
                        
                        if (user) {
                            console.log('✅ User found:', user);
                            
                            // Check if user is active (handle different possible field names)
                            const isActive = user.isActive !== false && user.is_active !== false;
                            
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
                        }
                    } else {
                        console.log(`❌ Table ${tableName} not accessible:`, response.status, response.statusText);
                    }
                } catch (error) {
                    console.log(`❌ Error accessing table ${tableName}:`, error);
                }
            }
            
            // If we get here, no user was found
            showNotification('Invalid secret key or user not found', 'error');
            
        } catch (error) {
            console.error('Login error:', error);
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
        currentUser.textContent = user.name;
        userRole.textContent = user.role;
        transferSection.style.display = 'block';
        
        // Update page title to show user is logged in
        document.title = `Page Price Analyzer - ${user.name}`;
    }
    
    // Show login form
    function showLoginForm() {
        loginSection.style.display = 'block';
        userInfo.style.display = 'none';
        transferSection.style.display = 'none';
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
    
    // Check for transfer updates from dashboard
    function checkTransferUpdates() {
        if (!currentUserData) return;
        
        chrome.storage.local.get(['dashboardTransfers'], (result) => {
            const dashboardTransfers = result.dashboardTransfers || [];
            
            try {
                // Filter transfers for this user based on role
                let userTransfers = [];
                
                if (currentUserData.role === 'closer') {
                    // Closers see transfers TO them
                    userTransfers = dashboardTransfers.filter(transfer => 
                        transfer.toUser === currentUserData.name
                    );
                } else if (currentUserData.role === 'fronter') {
                    // Fronters see transfers FROM them
                    userTransfers = dashboardTransfers.filter(transfer => 
                        transfer.fromUser === currentUserData.name
                    );
                } else if (currentUserData.role === 'admin') {
                    // Admins see all transfers
                    userTransfers = dashboardTransfers;
                }
                
                if (userTransfers.length > 0) {
                    displayTransferUpdates(userTransfers);
                } else {
                    showNoTransfers();
                }
                
            } catch (error) {
                console.log('Error checking transfer updates:', error);
            }
        });
    }
    
    // Display transfer updates
    function displayTransferUpdates(transfers) {
        transferList.innerHTML = '';
        
        transfers.forEach((transfer, index) => {
            const transferItem = document.createElement('div');
            transferItem.className = 'transfer-item';
            
            transferItem.innerHTML = `
                <h4>🔄 Transfer Update</h4>
                <p><strong>Job:</strong> ${transfer.jobNumber || 'Unknown'}</p>
                <p><strong>From:</strong> ${transfer.fromUser || 'Unknown'}</p>
                <p><strong>To:</strong> ${transfer.toUser || 'Unknown'}</p>
                <p><strong>Status:</strong> <span class="transfer-status ${transfer.status}">${transfer.status}</span></p>
                <p><strong>Date:</strong> ${new Date(transfer.transferredAt).toLocaleDateString()}</p>
            `;
            
            transferList.appendChild(transferItem);
        });
    }
    
    // Show no transfers message
    function showNoTransfers() {
        transferList.innerHTML = '<div class="no-transfers">No transfer updates</div>';
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
    
    // Test function to simulate transfer update
    window.testTransferUpdate = function() {
        if (!currentUserData) {
            showNotification('Please login first', 'error');
            return;
        }
        
        showNotification(`Test function called by ${currentUserData.name}`, 'success');
    };
    
    // Initial check
    checkTransferUpdates();
    
    console.log('Dashboard-integrated popup system initialized');
    console.log('Available test function: testTransferUpdate()');
});
