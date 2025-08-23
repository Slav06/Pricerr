// Simple Popup-Based Transfer System
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
        
        // Store user info
        localStorage.setItem('popup_user_name', userName);
        localStorage.setItem('popup_user_id', 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
        
        showUserInfo(userName);
        console.log('User logged in:', userName);
        
        // Clear input
        userNameInput.value = '';
    }
    
    // Logout function
    function handleLogout() {
        localStorage.removeItem('popup_user_name');
        localStorage.removeItem('popup_user_id');
        showLoginForm();
        console.log('User logged out');
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
        const userName = localStorage.getItem('popup_user_name');
        const userId = localStorage.getItem('popup_user_id');
        
        if (userName && userId) {
            showUserInfo(userName);
        } else {
            showLoginForm();
        }
    }
    
    // Check for transfer updates
    function checkTransferUpdates() {
        const userId = localStorage.getItem('popup_user_id');
        if (!userId) return;
        
        try {
            // Get transfer updates from localStorage (set by dashboard)
            const transferUpdates = JSON.parse(localStorage.getItem('chromeExtensionTransferUpdates') || '{}');
            
            // Filter updates for this user
            const userUpdates = Object.values(transferUpdates).filter(update => 
                update.chrome_profile_id === userId || 
                update.user_name === localStorage.getItem('popup_user_name')
            );
            
            if (userUpdates.length > 0) {
                displayTransferUpdates(userUpdates);
            } else {
                showNoTransfers();
            }
            
        } catch (error) {
            console.log('Error checking transfer updates:', error);
        }
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
        try {
            const transferUpdates = JSON.parse(localStorage.getItem('chromeExtensionTransferUpdates') || '{}');
            delete transferUpdates[jobId];
            localStorage.setItem('chromeExtensionTransferUpdates', JSON.stringify(transferUpdates));
            
            // Refresh display
            checkTransferUpdates();
        } catch (error) {
            console.log('Error removing transfer update:', error);
        }
    }
    
    // Test function to simulate transfer update
    window.testTransferUpdate = function() {
        const userId = localStorage.getItem('popup_user_id');
        if (!userId) {
            alert('Please login first');
            return;
        }
        
        const testUpdate = {
            jobId: 'test123',
            user_name: localStorage.getItem('popup_user_name'),
            job_number: 'TEST123',
            chrome_profile_id: userId,
            initiated_by: 'Test User',
            page_url: 'test.com'
        };
        
        // Store test update
        const transferUpdates = JSON.parse(localStorage.getItem('chromeExtensionTransferUpdates') || '{}');
        transferUpdates['test123'] = testUpdate;
        localStorage.setItem('chromeExtensionTransferUpdates', JSON.stringify(transferUpdates));
        
        console.log('Test transfer update created');
        alert('Test transfer update created! Check the transfer section.');
        
        // Refresh display
        checkTransferUpdates();
    };
    
    // Initial check
    checkTransferUpdates();
    
    console.log('Popup transfer system initialized');
    console.log('Available test function: testTransferUpdate()');
});
