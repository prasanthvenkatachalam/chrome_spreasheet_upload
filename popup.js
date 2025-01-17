document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('login');
    const messageDiv = document.getElementById('message');
    const fileListDiv = document.getElementById('fileList');
    let isUploading = false;

    // Check authentication status on load
    checkAuthenticationStatus();

    async function isAuthenticated() {
        try {
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

            // Verify token is valid
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
            });

            return response.ok;
        } catch (error) {
            console.error('Auth check error:', error);
            return false;
        }
    }

    function checkAuthenticationStatus() {
        console.log('Checking authentication status...');
        // Clear UI state first
        loginButton.style.display = 'none';
        messageDiv.textContent = '';
        fileListDiv.innerHTML = '';

        isAuthenticated().then(isAuth => {
            if (!isAuth) {
                loginButton.style.display = 'block';
                messageDiv.textContent = 'Please sign in to continue';
                loginButton.removeEventListener('click', authenticate);
                loginButton.addEventListener('click', authenticate);
                return;
            }

            chrome.identity.getAuthToken({ interactive: false }, function(token) {
                if (chrome.runtime.lastError || !token) {
                    console.log('No valid token found');
                    loginButton.style.display = 'block';
                    messageDiv.textContent = 'Please sign in to continue';
                    return;
                }
                handleUserInfo(token);
            });
        });
    }

    function authenticate() {
        console.log('Authentication started...');
        messageDiv.textContent = 'Authenticating...';
        
        chrome.identity.getAuthToken({ 
            interactive: true,
            scopes: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/userinfo.email'
            ]
        }, function(token) {
            if (chrome.runtime.lastError || !token) {
                console.error('Auth error:', chrome.runtime.lastError);
                messageDiv.textContent = chrome.runtime.lastError ? 
                    `Error: ${chrome.runtime.lastError.message}` : 
                    'Authentication failed. Please try again.';
                return;
            }
            
            console.log('Authentication successful');
            loginButton.style.display = 'none';
            handleUserInfo(token);
        });
    }

    async function handleSignOut() {
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

            // 4. Verify token is actually removed
            const verifyToken = await new Promise((resolve) => {
                chrome.identity.getAuthToken({ interactive: false }, (token) => {
                    if (chrome.runtime.lastError || !token) {
                        resolve(true);
                    } else {
                        // If token still exists, try to remove it one last time
                        chrome.identity.removeCachedAuthToken({ token }, () => {
                            resolve(false);
                        });
                    }
                });
            });

            if (verifyToken || success) {
                // Clear UI state
                loginButton.style.display = 'block';
                messageDiv.textContent = 'Signed out successfully';
                fileListDiv.innerHTML = '';
                
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
            } else {
                throw new Error('Failed to completely sign out');
            }

        } catch (error) {
            console.error('Sign out error:', error);
            loginButton.style.display = 'block';
            messageDiv.textContent = 'Error during sign out. Please close and reopen the extension.';
            fileListDiv.innerHTML = '';
            
            const logoutButton = document.querySelector('.logout-button');
            if (logoutButton) {
                logoutButton.remove();
            }

            // Force reload after a delay
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        }
    }

    function addLogoutButton() {
        const existingButton = document.querySelector('.logout-button');
        if (!existingButton) {
            const logoutButton = document.createElement('button');
            logoutButton.textContent = 'Sign Out';
            logoutButton.className = 'logout-button';
            logoutButton.onclick = handleSignOut;
            document.body.appendChild(logoutButton);
        }
    }

    function handleUserInfo(token) {
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
            showLoadingState();
            verifyAndListFiles(token);
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
    }

    function showLoadingState() {
        fileListDiv.innerHTML = `
            <h3>Scanning Downloaded Files...</h3>
            <div class="loader"></div>
        `;
    }

    async function verifyAndListFiles(token) {
        chrome.downloads.search({
            state: 'complete',
            orderBy: ['-startTime']
        }, async function(downloads) {
            const validFiles = [];
            
            for (const download of downloads) {
                const filename = download.filename.toLowerCase();
                if ((filename.endsWith('.xlsx') || filename.endsWith('.csv'))) {
                    try {
                        const existsInHistory = await new Promise(resolve => {
                            chrome.downloads.search({ id: download.id }, results => {
                                resolve(results.length > 0 && results[0].exists);
                            });
                        });

                        if (existsInHistory) {
                            validFiles.push(download);
                        }
                    } catch (error) {
                        console.error('Error verifying file:', error);
                    }
                }
            }

            updateFileList(validFiles, token);
        });
    }

    function updateFileList(validFiles, token) {
        fileListDiv.innerHTML = '<h3>Downloaded Files:</h3>';

        if (validFiles.length === 0) {
            fileListDiv.innerHTML += '<p>No spreadsheet files found in Downloads.</p>';
            return;
        }

        const statusContainer = document.createElement('div');
        statusContainer.id = 'statusContainer';
        fileListDiv.appendChild(statusContainer);

        const filesContainer = document.createElement('div');
        filesContainer.id = 'filesContainer';

        validFiles.forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'file-link';
            const filename = file.filename.split('\\').pop().split('/').pop();
            fileDiv.textContent = filename;
            fileDiv.onclick = () => {
                if (!isUploading) {
                    startUpload(file, token, filesContainer, statusContainer);
                }
            };
            filesContainer.appendChild(fileDiv);
        });

        fileListDiv.appendChild(filesContainer);
    }

    function disableFileList(filesContainer, statusContainer, uploadingFileName) {
        isUploading = true;
        
        const fileLinks = filesContainer.getElementsByClassName('file-link');
        Array.from(fileLinks).forEach(fileLink => {
            fileLink.classList.add('disabled');
        });

        const logoutButton = document.querySelector('.logout-button');
        if (logoutButton) {
            logoutButton.classList.add('disabled');
            logoutButton.disabled = true;
        }

        const statusMessage = document.createElement('div');
        statusMessage.className = 'upload-in-progress';
        statusMessage.textContent = `Uploading ${uploadingFileName}... Please wait.`;
        statusContainer.innerHTML = '';
        statusContainer.appendChild(statusMessage);
    }

    function enableFileList(filesContainer, statusContainer) {
        isUploading = false;
        
        const fileLinks = filesContainer.getElementsByClassName('file-link');
        Array.from(fileLinks).forEach(fileLink => {
            fileLink.classList.remove('disabled');
        });

        const logoutButton = document.querySelector('.logout-button');
        if (logoutButton) {
            logoutButton.classList.remove('disabled');
            logoutButton.disabled = false;
        }

        statusContainer.innerHTML = '';
    }

    async function startUpload(downloadItem, token, filesContainer, statusContainer) {
        const filename = downloadItem.filename.split('\\').pop().split('/').pop();
        disableFileList(filesContainer, statusContainer, filename);

        try {
            await verifyAndUpload(downloadItem, token);
        } finally {
            enableFileList(filesContainer, statusContainer);
        }
    }

    async function verifyAndUpload(downloadItem, token) {
        try {
            // First verify if file exists
            const existsInHistory = await new Promise(resolve => {
                chrome.downloads.search({ id: downloadItem.id }, results => {
                    resolve(results.length > 0 && results[0].exists);
                });
            });

            if (!existsInHistory) {
                throw new Error('File no longer exists in downloads. Please check if the file has been moved or deleted.');
            }

            // Read file using chrome.downloads.download API
            const fileData = await readFileUsingDownloads(downloadItem);
            if (fileData) {
                await handleDriveFileUpload(fileData, downloadItem.filename, token);
            } else {
                throw new Error('Failed to read file');
            }
        } catch (error) {
            messageDiv.textContent = 'Error: ' + error.message;
            console.error('Verification error:', error);
        }
    }

    async function readFileUsingDownloads(downloadItem) {
        try {
            return new Promise((resolve) => {
                const blob = fetch(downloadItem.url)
                    .then(response => response.blob())
                    .then(blob => resolve(blob))
                    .catch(error => {
                        console.error('Fetch error:', error);
                        resolve(null);
                    });
            });
        } catch (error) {
            console.error('File read error:', error);
            return null;
        }
    }

    async function handleDriveFileUpload(fileBlob, filename, token) {
        try {
            messageDiv.textContent = 'Reading file...';

            if (!fileBlob) {
                throw new Error('Failed to read file. Please ensure the file exists and try again.');
            }

            messageDiv.textContent = 'Uploading to Google Drive...';

            const metadata = {
                name: filename.split('\\').pop().split('/').pop(),
                mimeType: 'application/vnd.google-apps.spreadsheet'
            };

            const formData = new FormData();
            formData.append(
                'metadata',
                new Blob([JSON.stringify(metadata)], { type: 'application/json' })
            );
            formData.append('file', fileBlob, metadata.name);

            const uploadResponse = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                }
            );

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error?.message || 'Upload failed');
            }

            const data = await uploadResponse.json();
            messageDiv.textContent = 'File uploaded successfully!';
            
            const sheetsUrl = `https://docs.google.com/spreadsheets/d/${data.id}/edit`;
            chrome.tabs.create({ url: sheetsUrl });

        } catch (error) {
            messageDiv.textContent = 'Error: ' + (error.message || 'Unknown error occurred');
            console.error('Operation error:', error);
        }
    }
});