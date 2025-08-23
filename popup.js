// Simple Popup-Based Transfer System using Chrome Storage
document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup loaded - initializing transfer system');
    
    // DOM elements
    const loginSection = document.getElementById('loginSection');
    const userNameInput = document.getElementById('userName');
    const loginBtn = document.getElementById('loginBtn');
    const userInfo = document.getElementById('userInfo');
    const currentUser = document.getElementById('currentUser');
    const logoutBtn = document.getElementById('logoutBtn');
    const transferSection = document.getElementById('transferSection');
    const transferList = document.getElementById('transferList');
    
    // Check if user is already logged in
    checkLoginStatus();
    
    // Check for transfer updates every 2 seconds
    setInterval(checkTransferUpdates, 2000);
    
    // Event listeners
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    userNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    
    // Login function
    function handleLogin() {
        const userName = userNameInput.value.trim();
        if (!userName) {
            alert('Please enter your name');
            return;
        }
        
        // Store user info in Chrome storage
        const userData = {
            name: userName,
            id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            loginTime: new Date().toISOString()
        };
        
        chrome.storage.local.set({ popupUser: userData }, () => {
            showUserInfo(userName);
            console.log('User logged in:', userName);
            
            // Clear input
            userNameInput.value = '';
        });
    }
    
    // Logout function
    function handleLogout() {
        chrome.storage.local.remove(['popupUser'], () => {
            showLoginForm();
            console.log('User logged out');
        });
    }
    
    // Show user info after login
    function showUserInfo(userName) {
        loginSection.style.display = 'none';
        userInfo.style.display = 'block';
        currentUser.textContent = userName;
        transferSection.style.display = 'block';
    }
    
    // Show login form
    function showLoginForm() {
        loginSection.style.display = 'block';
        userInfo.style.display = 'none';
        transferSection.style.display = 'none';
    }
    
    // Check login status
    function checkLoginStatus() {
        chrome.storage.local.get(['popupUser'], (result) => {
            if (result.popupUser) {
                showUserInfo(result.popupUser.name);
            } else {
                showLoginForm();
            }
        });
    }
    
    // Check for transfer updates
    function checkTransferUpdates() {
        chrome.storage.local.get(['popupUser', 'transferUpdates'], (result) => {
            const user = result.popupUser;
            const transferUpdates = result.transferUpdates || {};
            
            if (!user) return;
            
            try {
                // Filter updates for this user
                const userUpdates = Object.values(transferUpdates).filter(update => 
                    update.chrome_profile_id === user.id || 
                    update.user_name === user.name
                );
                
                if (userUpdates.length > 0) {
                    displayTransferUpdates(userUpdates);
                } else {
                    showNoTransfers();
                }
                
            } catch (error) {
                console.log('Error checking transfer updates:', error);
            }
        });
    }
    
    // Display transfer updates
    function displayTransferUpdates(updates) {
        transferList.innerHTML = '';
        
        updates.forEach((update, index) => {
            const transferItem = document.createElement('div');
            transferItem.className = 'transfer-item';
            
            transferItem.innerHTML = `
                <h4>🔄 Transfer Request</h4>
                <p><strong>Job:</strong> ${update.job_number || 'Unknown'}</p>
                <p><strong>From:</strong> ${update.initiated_by || 'Unknown'}</p>
                <p><strong>To:</strong> ${update.user_name || 'Unknown'}</p>
                <div class="transfer-actions">
                    <button class="transfer-btn accept" onclick="acceptTransfer('${update.jobId || index}')">
                        ✅ Accept
                    </button>
                    <button class="transfer-btn decline" onclick="declineTransfer('${update.jobId || index}')">
                        ❌ Decline
                    </button>
                </div>
            `;
            
            transferList.appendChild(transferItem);
        });
    }
    
    // Show no transfers message
    function showNoTransfers() {
        transferList.innerHTML = '<p class="no-transfers">No transfer updates</p>';
    }
    
    // Accept transfer
    window.acceptTransfer = function(jobId) {
        console.log('Transfer accepted for job:', jobId);
        alert('Transfer accepted! You will be notified when the job is transferred.');
        
        // Remove this transfer update
        removeTransferUpdate(jobId);
    };
    
    // Decline transfer
    window.declineTransfer = function(jobId) {
        console.log('Transfer declined for job:', jobId);
        alert('Transfer declined.');
        
        // Remove this transfer update
        removeTransferUpdate(jobId);
    };
    
    // Remove transfer update
    function removeTransferUpdate(jobId) {
        chrome.storage.local.get(['transferUpdates'], (result) => {
            const transferUpdates = result.transferUpdates || {};
            delete transferUpdates[jobId];
            
            chrome.storage.local.set({ transferUpdates }, () => {
                // Refresh display
                checkTransferUpdates();
            });
        });
    }
    
    // Test function to simulate transfer update
    window.testTransferUpdate = function() {
        chrome.storage.local.get(['popupUser'], (result) => {
            const user = result.popupUser;
            if (!user) {
                alert('Please login first');
                return;
            }
            
            const testUpdate = {
                jobId: 'test123',
                user_name: user.name,
                job_number: 'TEST123',
                chrome_profile_id: user.id,
                initiated_by: 'Test User',
                page_url: 'test.com'
            };
            
            // Store test update
            chrome.storage.local.get(['transferUpdates'], (result) => {
                const transferUpdates = result.transferUpdates || {};
                transferUpdates['test123'] = testUpdate;
                
                chrome.storage.local.set({ transferUpdates }, () => {
                    console.log('Test transfer update created');
                    alert('Test transfer update created! Check the transfer section.');
                    
                    // Refresh display
                    checkTransferUpdates();
                });
            });
        });
    };
    
    // Initial check
    checkTransferUpdates();
    
    console.log('Popup transfer system initialized');
    console.log('Available test function: testTransferUpdate()');
});
