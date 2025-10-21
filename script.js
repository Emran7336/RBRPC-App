// Firebase References
const auth = firebase.auth();
const db = firebase.firestore();

// Global State
let currentUser = null;
let isAdmin = false;
let authMode = 'login'; // 'login' or 'signup'

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    loadCodes();
    setupTheme();
});

// Firebase Auth State Listener
function initApp() {
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        updateUI();
        
        if (user) {
            checkAdminStatus(user.uid);
            loadUserData(user.uid);
        }
    });
}

// Theme Management
function setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.className = savedTheme + '-theme';
    updateThemeButton();
}

function toggleTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    document.body.className = isDark ? 'light-theme' : 'dark-theme';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
    updateThemeButton();
}

function updateThemeButton() {
    const isDark = document.body.classList.contains('dark-theme');
    document.querySelector('.theme-toggle').textContent = isDark ? '☀️' : '🌙';
}

// Authentication
function toggleAuthModal() {
    const modal = document.getElementById('authModal');
    modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}

function switchAuthMode() {
    authMode = authMode === 'login' ? 'signup' : 'login';
    const submitBtn = document.getElementById('authSubmit');
    const switchBtn = document.getElementById('authSwitch');
    
    submitBtn.textContent = authMode === 'login' ? 'Login' : 'Sign Up';
    switchBtn.textContent = authMode === 'login' ? 'Switch to Signup' : 'Switch to Login';
}

async function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const submitBtn = document.getElementById('authSubmit');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait...';
    
    try {
        if (authMode === 'login') {
            await auth.signInWithEmailAndPassword(email, password);
        } else {
            await auth.createUserWithEmailAndPassword(email, password);
        }
        toggleAuthModal();
        showSuccess(authMode === 'login' ? 'Login successful!' : 'Account created!');
    } catch (error) {
        showSuccess('Error: ' + error.message, true);
    }
    
    submitBtn.disabled = false;
    submitBtn.textContent = authMode === 'login' ? 'Login' : 'Sign Up';
}

// Admin Functions
function checkAdminStatus(uid) {
    // For demo - you can set specific emails as admin
    const adminEmails = [ 'emraaanrasheed@gmail.com'];
    auth.currentUser.getIdTokenResult().then((idTokenResult) => {
        isAdmin = adminEmails.includes(auth.currentUser.email);
        document.getElementById('adminBtn').style.display = isAdmin ? 'block' : 'none';
    });
}

function toggleAdminPanel() {
    const modal = document.getElementById('adminModal');
    modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
    if (modal.style.display === 'block') {
        loadAdminData();
    }
}

function openAdminTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById('admin' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');
    event.target.classList.add('active');
}

// Code Management
async function loadCodes() {
    try {
        const snapshot = await db.collection('codes')
            .where('expiryDate', '>=', new Date().toISOString())
            .get();
        
        const codesList = document.getElementById('codesList');
        const availableCodes = document.getElementById('availableCodes');
        
        availableCodes.textContent = snapshot.size;
        
        if (snapshot.empty) {
            codesList.innerHTML = '<div class="login-prompt">No active codes available. Check back later!</div>';
            return;
        }
        
        codesList.innerHTML = '';
        let totalClaims = 0;
        
        snapshot.forEach(doc => {
            const code = doc.data();
            totalClaims += code.claimedCount || 0;
            const codeElement = createCodeElement(code, doc.id);
            codesList.appendChild(codeElement);
        });
        
        document.getElementById('totalClaims').textContent = totalClaims;
    } catch (error) {
        console.error('Error loading codes:', error);
    }
}

function createCodeElement(code, codeId) {
    const div = document.createElement('div');
    div.className = 'code-item';
    
    if (!currentUser) {
        div.classList.add('blurred');
    }
    
    const claimedCount = code.claimedCount || 0;
    const isFullyClaimed = claimedCount >= code.maxClaims;
    
    div.innerHTML = `
        <div class="code-info">
            <div class="code-value">${currentUser ? code.code : '••••••••'}</div>
            <div class="code-details">
                ${code.coin} • Claims: ${claimedCount}/${code.maxClaims} • 
                Expires: ${new Date(code.expiryDate).toLocaleDateString()}
                ${isFullyClaimed ? ' • 🏁 Fully Claimed' : ''}
            </div>
        </div>
        <div class="code-actions">
            ${currentUser ? `
                <button class="btn-copy" onclick="copyCode('${code.code}', '${codeId}')" 
                        ${isFullyClaimed ? 'disabled' : ''}>
                    📋 Copy
                </button>
                ${isAdmin ? `<button class="btn-delete" onclick="deleteCode('${codeId}')">🗑️</button>` : ''}
            ` : `
                <button class="btn-login" onclick="toggleAuthModal()">Login to Copy</button>
            `}
        </div>
    `;
    
    return div;
}

// User Actions
async function watchAd() {
    if (!currentUser) {
        toggleAuthModal();
        return;
    }
    
    // Simulate ad watching
    showSuccess('Watching ad... Please wait.');
    
    setTimeout(async () => {
        try {
            const userRef = db.collection('users').doc(currentUser.uid);
            await userRef.update({
                points: firebase.firestore.FieldValue.increment(10),
                lastAdWatch: new Date().toISOString()
            });
            showSuccess('+10 Points added! Watch more ads to earn more.');
            loadUserData(currentUser.uid);
        } catch (error) {
            showSuccess('Error adding points: ' + error.message, true);
        }
    }, 3000);
}

async function copyCode(code, codeId) {
    if (!currentUser) return;
    
    try {
        // Update claim count
        const codeRef = db.collection('codes').doc(codeId);
        await codeRef.update({
            claimedCount: firebase.firestore.FieldValue.increment(1)
        });
        
        // Copy to clipboard
        await navigator.clipboard.writeText(code);
        showSuccess('Code copied to clipboard! Paste it in Binance app.');
        
        // Reload codes
        loadCodes();
    } catch (error) {
        showSuccess('Error copying code: ' + error.message, true);
    }
}

// Publish Code
function showPublishForm() {
    if (!currentUser) {
        toggleAuthModal();
        return;
    }
    
    const userPoints = parseInt(document.getElementById('userPoints').textContent);
    if (userPoints < 5) {
        showSuccess('You need at least 5 points to publish a code!', true);
        return;
    }
    
    document.getElementById('publishModal').style.display = 'block';
    document.getElementById('expiryDate').min = new Date().toISOString().split('T')[0];
}

function closePublishModal() {
    document.getElementById('publishModal').style.display = 'none';
}

async function publishCode(event) {
    event.preventDefault();
    
    const code = document.getElementById('codeInput').value.trim().toUpperCase();
    const coin = document.getElementById('coinSelect').value;
    const maxClaims = parseInt(document.getElementById('maxClaims').value);
    const expiryDate = document.getElementById('expiryDate').value;
    
    try {
        // Deduct points
        const userRef = db.collection('users').doc(currentUser.uid);
        await userRef.update({
            points: firebase.firestore.FieldValue.increment(-5)
        });
        
        // Add code to database
        await db.collection('codes').add({
            code: code,
            coin: coin,
            maxClaims: maxClaims,
            expiryDate: expiryDate,
            claimedCount: 0,
            publishedBy: currentUser.uid,
            publishedAt: new Date().toISOString()
        });
        
        showSuccess('Code published successfully!');
        closePublishModal();
        loadCodes();
        loadUserData(currentUser.uid);
        
        // Reset form
        document.getElementById('publishForm').reset();
    } catch (error) {
        showSuccess('Error publishing code: ' + error.message, true);
    }
}

// Admin Functions
async function loadAdminData() {
    if (!isAdmin) return;
    
    // Load codes for admin
    const snapshot = await db.collection('codes').get();
    const adminCodesList = document.getElementById('adminCodesList');
    adminCodesList.innerHTML = '';
    
    snapshot.forEach(doc => {
        const code = doc.data();
        const div = document.createElement('div');
        div.className = 'code-item';
        div.innerHTML = `
            <div class="code-info">
                <div class="code-value">${code.code}</div>
                <div class="code-details">
                    ${code.coin} • Claims: ${code.claimedCount || 0}/${code.maxClaims} • 
                    Expires: ${new Date(code.expiryDate).toLocaleDateString()}
                </div>
            </div>
            <button class="btn-delete" onclick="deleteCode('${doc.id}')">🗑️ Delete</button>
        `;
        adminCodesList.appendChild(div);
    });
}

async function adminAddCode(event) {
    event.preventDefault();
    
    const code = document.getElementById('adminCode').value.trim().toUpperCase();
    const coin = document.getElementById('adminCoin').value;
    const maxClaims = parseInt(document.getElementById('adminMaxClaims').value);
    const expiryDate = document.getElementById('adminExpiry').value;
    
    try {
        await db.collection('codes').add({
            code: code,
            coin: coin,
            maxClaims: maxClaims,
            expiryDate: expiryDate,
            claimedCount: 0,
            publishedBy: 'admin',
            publishedAt: new Date().toISOString()
        });
        
        showSuccess('Code added by admin!');
        loadAdminData();
        loadCodes();
        document.getElementById('adminCode').value = '';
    } catch (error) {
        showSuccess('Error adding code: ' + error.message, true);
    }
}

async function deleteCode(codeId) {
    if (!isAdmin) return;
    
    if (confirm('Are you sure you want to delete this code?')) {
        try {
            await db.collection('codes').doc(codeId).delete();
            showSuccess('Code deleted successfully!');
            loadAdminData();
            loadCodes();
        } catch (error) {
            showSuccess('Error deleting code: ' + error.message, true);
        }
    }
}

async function postUpdate(event) {
    event.preventDefault();
    
    const updateText = document.getElementById('updateText').value;
    
    try {
        await db.collection('updates').add({
            text: updateText,
            postedBy: currentUser.uid,
            postedAt: new Date().toISOString()
        });
        
        showSuccess('Update posted successfully!');
        document.getElementById('updateText').value = '';
    } catch (error) {
        showSuccess('Error posting update: ' + error.message, true);
    }
}

// User Data
async function loadUserData(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            document.getElementById('userPoints').textContent = userData.points || 0;
            document.getElementById('pointsDisplay').textContent = `Points: ${userData.points || 0}`;
        } else {
            // Create user document if doesn't exist
            await db.collection('users').doc(uid).set({
                points: 0,
                createdAt: new Date().toISOString()
            });
            document.getElementById('userPoints').textContent = '0';
            document.getElementById('pointsDisplay').textContent = 'Points: 0';
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// UI Updates
function updateUI() {
    const loginBtn = document.getElementById('loginBtn');
    
    if (currentUser) {
        loginBtn.textContent = 'Logout';
        loginBtn.onclick = () => auth.signOut();
        document.querySelectorAll('.blurred').forEach(el => {
            el.classList.remove('blurred');
        });
    } else {
        loginBtn.textContent = 'Login';
        loginBtn.onclick = toggleAuthModal;
    }
}

// Utility Functions
function showSuccess(message, isError = false) {
    const successModal = document.getElementById('successModal');
    const successMessage = document.getElementById('successMessage');
    
    successMessage.textContent = message;
    successMessage.style.color = isError ? '#ef4444' : '';
    successModal.style.display = 'block';
}

function closeSuccessModal() {
    document.getElementById('successModal').style.display = 'none';
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Auto-cleanup expired codes (runs every hour)
setInterval(() => {
    if (isAdmin) {
        cleanupExpiredCodes();
    }
}, 60 * 60 * 1000);

async function cleanupExpiredCodes() {
    const snapshot = await db.collection('codes')
        .where('expiryDate', '<', new Date().toISOString())
        .get();
    
    const batch = db.batch();
    snapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    await batch.commit();
    loadCodes();
}