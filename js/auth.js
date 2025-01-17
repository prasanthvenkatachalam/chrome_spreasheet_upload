// Authentication Module
// Handles all Google OAuth authentication operations

// Get DOM elements
const loginButton = document.getElementById('login');
const messageDiv = document.getElementById('message');

/**
 * Checks if user is currently authenticated
 * @returns {Promise<boolean>} Authentication status
 */
const isAuthenticated = async () => {
    try {
        // Get auth token without user interaction
        const token = await new Promise((resolve) => {
            chrome.identity.getAuthToken({ interactive: false }, (token) => {
                if (chrome.runtime.lastError || !token) {
                    resolve(null);
                } else {
                    resolve(token);
                }
            });
        });

        if (!token) {
            return false;
        }

        // Verify token validity with Google
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });

        return response.ok;
    } catch (error) {
        console.error('Auth check error:', error);
        return false;
    }
};

/**
 * Checks authentication status and updates UI accordingly
 */
const checkAuthenticationStatus = async () => {
    console.log('Checking authentication status...');
    // Clear UI state first
    loginButton.style.display = 'none';
    messageDiv.textContent = '';
    window.uiManager.clearFileList();

    const isAuth = await isAuthenticated();
    if (!isAuth) {
        handleNotAuthenticated();
        return;
    }

    // Get auth token for authenticated user
    chrome.identity.getAuthToken({ interactive: false }, handleAuthToken);
};

/**
 * Handles the case when user is not authenticated
 * Shows login button and message
 */
const handleNotAuthenticated = () => {
    loginButton.style.display = 'block';
    messageDiv.textContent = 'Please sign in to continue';
    
    // Remove any existing click handlers and add new one
    loginButton.removeEventListener('click', authenticate);
    loginButton.addEventListener('click', authenticate);
};

/**
 * Handles user authentication process
 */
const authenticate = () => {
    console.log('Authentication started...');
    messageDiv.textContent = 'Authenticating...';
    
    chrome.identity.getAuthToken({ 
        interactive: true,
        scopes: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/userinfo.email'
        ]
    }, handleAuthToken);
};

/**
 * Handles the authentication token response
 * @param {string} token - The authentication token from Google
 */
const handleAuthToken = (token) => {
    if (chrome.runtime.lastError || !token) {
        console.error('Auth error:', chrome.runtime.lastError);
        messageDiv.textContent = chrome.runtime.lastError ? 
            `Error: ${chrome.runtime.lastError.message}` : 
            'Authentication failed. Please try again.';
        return;
    }

    console.log('Authentication successful');
    loginButton.style.display = 'none';
    fetchUserInfo(token);
};

/**
 * Fetches user info using the auth token
 * @param {string} token - The authentication token
 */
const fetchUserInfo = (token) => {
    fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Token validation failed');
        }
        return response.json();
    })
    .then(data => {
        loginButton.style.display = 'none';
        messageDiv.textContent = `Logged in as: ${data?.email || ""}`;
        addLogoutButton();
        window.uiManager.showLoadingState();
        window.fileManager.verifyAndListFiles(token);
    })
    .catch(async error => {
        console.error('Error:', error);
        if (error.message === 'Token validation failed') {
            chrome.identity.removeCachedAuthToken({ token }, () => {
                loginButton.style.display = 'block';
                messageDiv.textContent = 'Please sign in to continue';
            });
        } else {
            messageDiv.textContent = 'Failed to fetch user info: ' + error.message;
        }
    });
};

/**
 * Adds the logout button to the UI
 */
const addLogoutButton = () => {
    const existingButton = document.querySelector('.logout-button');
    if (!existingButton) {
        const logoutButton = document.createElement('button');
        logoutButton.textContent = 'Sign Out';
        logoutButton.className = 'logout-button';
        logoutButton.onclick = handleSignOut;
        document.body.appendChild(logoutButton);
    }
};

/**
 * Handles the sign out process
 */
const handleSignOut = async () => {
    try {
        messageDiv.textContent = 'Signing out...';
        let success = false;

        // Get current token
        const token = await new Promise((resolve) => {
            chrome.identity.getAuthToken({ interactive: false }, (token) => {
                if (chrome.runtime.lastError) {
                    console.log('Get token error:', chrome.runtime.lastError);
                    resolve(null);
                } else {
                    resolve(token);
                }
            });
        });

        if (token) {
            try {
                // 1. Revoke access first
                const revokeResponse = await fetch(
                    `https://accounts.google.com/o/oauth2/revoke?token=${token}`,
                    { method: 'GET' }
                );
                
                if (revokeResponse.ok) {
                    success = true;
                    console.log('Token revoked successfully');
                }
            } catch (error) {
                console.log('Token revocation error:', error);
            }

            // 2. Remove token from Chrome's cache
            await new Promise((resolve) => {
                chrome.identity.removeCachedAuthToken({ token }, () => {
                    if (chrome.runtime.lastError) {
                        console.log('Remove token error:', chrome.runtime.lastError);
                    }
                    resolve();
                });
            });
        }

        // 3. Clear all cached tokens
        await new Promise((resolve) => {
            chrome.identity.clearAllCachedAuthTokens(() => {
                if (chrome.runtime.lastError) {
                    console.log('Clear tokens error:', chrome.runtime.lastError);
                }
                resolve();
            });
        });

        if (success) {
            handleSignOutSuccess();
        } else {
            throw new Error('Failed to completely sign out');
        }

    } catch (error) {
        handleSignOutError(error);
    }
};

/**
 * Handles successful sign out
 */
const handleSignOutSuccess = () => {
    loginButton.style.display = 'block';
    messageDiv.textContent = 'Signed out successfully';
    window.uiManager.clearFileList();
    
    // Remove logout button
    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) {
        logoutButton.remove();
    }

    // Reset event listener
    loginButton.removeEventListener('click', authenticate);
    loginButton.addEventListener('click', authenticate);

    // Force reload after a short delay
    setTimeout(() => {
        window.location.reload();
    }, 1000);
};

/**
 * Handles sign out errors
 * @param {Error} error - The error that occurred
 */
const handleSignOutError = (error) => {
    console.error('Sign out error:', error);
    loginButton.style.display = 'block';
    messageDiv.textContent = 'Error during sign out. Please close and reopen the extension.';
    window.uiManager.clearFileList();
    
    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) {
        logoutButton.remove();
    }

    // Force reload after a delay
    setTimeout(() => {
        window.location.reload();
    }, 2000);
};

// Wait for DOM to load before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Initialize auth check
    checkAuthenticationStatus();
});

// Export functions to be used by other modules
window.auth = {
    isAuthenticated,
    checkAuthenticationStatus,
    authenticate,
    handleNotAuthenticated,
    handleAuthToken,
    handleSignOut
};