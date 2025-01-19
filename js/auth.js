// Authentication Module
// Handles all Google OAuth authentication operations

// Get DOM elements
const loginButton = document.getElementById('login');
const messageDiv = document.getElementById('message');

// Define required scopes
const REQUIRED_SCOPES = [
   'https://www.googleapis.com/auth/drive.file',
   'https://www.googleapis.com/auth/userinfo.email',
   'https://www.googleapis.com/auth/spreadsheets'
];

/**
* Checks authentication status and updates UI accordingly
*/
const checkAuthenticationStatus = async () => {
   console.log('Checking authentication status...');
   
   try {
       // Get token without prompting user
       const token = await new Promise((resolve) => {
           chrome.identity.getAuthToken({ 
               interactive: false,
               scopes: REQUIRED_SCOPES
           }, (token) => {
               if (chrome.runtime.lastError) {
                   const error = chrome.runtime.lastError.message;
                   console.error('Get token error:', error);
                   
                   // If OAuth2 not granted, try interactive mode
                   if (error.includes('OAuth2 not granted or revoked')) {
                       chrome.identity.getAuthToken({ 
                           interactive: true,
                           scopes: REQUIRED_SCOPES
                       }, (interactiveToken) => {
                           if (chrome.runtime.lastError) {
                               console.error('Interactive auth error:', chrome.runtime.lastError.message);
                               resolve(null);
                           } else {
                               resolve(interactiveToken);
                           }
                       });
                   } else {
                       resolve(null);
                   }
               } else {
                   resolve(token);
               }
           });
       });

       if (!token) {
           handleNotAuthenticated();
           return;
       }

       // Verify token with Google
       const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
           headers: { Authorization: `Bearer ${token}` }
       });

       if (!response.ok) {
           await new Promise((resolve) => {
               chrome.identity.removeCachedAuthToken({ token }, resolve);
           });
           handleNotAuthenticated();
           return;
       }

       const data = await response.json();
       loginButton.style.display = 'none';
       messageDiv.textContent = `${data.email || ""}`;
       addLogoutButton();
       window.uiManager.showLoadingState();
       window.fileManager.verifyAndListFiles(token);

   } catch (error) {
       console.error('Auth check error:', error);
       handleNotAuthenticated();
   }
};

/**
* Handles the case when user is not authenticated
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
       scopes: REQUIRED_SCOPES
   }, handleAuthToken);
};

/**
* Handles the authentication token response
* @param {string} token - The authentication token from Google
*/
const handleAuthToken = (token) => {
   if (chrome.runtime.lastError || !token) {
       const error = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'No token received';
       console.error('Auth error:', error);
       messageDiv.textContent = `Error: ${error}`;
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
       messageDiv.textContent = `${data?.email || ""}`;
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

       // Get current token
       const token = await new Promise((resolve) => {
           chrome.identity.getAuthToken({ 
               interactive: false,
               scopes: REQUIRED_SCOPES
           }, (token) => {
               if (chrome.runtime.lastError) {
                   console.log('Get token error:', chrome.runtime.lastError.message);
                   resolve(null);
               } else {
                   resolve(token);
               }
           });
       });

       if (token) {
           // 1. Remove token from Chrome's cache first
           await new Promise((resolve) => {
               chrome.identity.removeCachedAuthToken({ token }, () => {
                   if (chrome.runtime.lastError) {
                       console.log('Remove token error:', chrome.runtime.lastError.message);
                   }
                   resolve();
               });
           });

           try {
               // 2. Then revoke access
               const revokeResponse = await fetch(
                   `https://accounts.google.com/o/oauth2/revoke?token=${token}`,
                   { method: 'GET' }
               );
               
               if (!revokeResponse.ok) {
                   console.log('Token revocation failed:', await revokeResponse.text());
               }
           } catch (error) {
               console.log('Token revocation error:', error);
           }
       }

       // 3. Clear all cached tokens
       await new Promise((resolve) => {
           chrome.identity.clearAllCachedAuthTokens(() => {
               if (chrome.runtime.lastError) {
                   console.log('Clear tokens error:', chrome.runtime.lastError.message);
               }
               resolve();
           });
       });

       // Consider sign out successful even if token revocation failed
       handleSignOutSuccess();

   } catch (error) {
       handleSignOutError(error);
   }
};

/**
* Handles successful sign out
*/
const handleSignOutSuccess = () => {
   // Update UI
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

   // Clear any cached data
   localStorage.clear();

   // Force reload after a short delay
   setTimeout(() => {
       chrome.runtime.reload();
   }, 1000);
};

/**
* Handles sign out errors
* @param {Error} error - The error that occurred
*/
const handleSignOutError = (error) => {
   console.error('Sign out error:', error);
   messageDiv.textContent = 'Error during sign out. Please close and reopen the extension.';
   window.uiManager.clearFileList();
   
   // Remove logout button
   const logoutButton = document.querySelector('.logout-button');
   if (logoutButton) {
       logoutButton.remove();
   }

   // Reset to initial state
   loginButton.style.display = 'block';
   loginButton.removeEventListener('click', authenticate);
   loginButton.addEventListener('click', authenticate);

   // Force reload after a delay
   setTimeout(() => {
       chrome.runtime.reload();
   }, 2000);
};

// Initialize when document loads
document.addEventListener('DOMContentLoaded', async () => {
   loginButton.style.display = 'none'; // Hide login button initially
   messageDiv.textContent = 'Checking authentication...';
   await checkAuthenticationStatus();
});

// Export functions to be used by other modules
window.auth = {
   checkAuthenticationStatus,
   authenticate,
   handleNotAuthenticated,
   handleAuthToken,
   handleSignOut
};