// UI Management Module
// Handles all user interface updates and interactions

// Track upload state
let isUploading = false;

/**
 * Shows loading animation while scanning files
 */
const showLoadingState = () => {
    const fileListDiv = document.getElementById('fileList');
    fileListDiv.innerHTML = `
        <h3>Scanning Downloaded Files...</h3>
        <div class="loader"></div>
    `;
};

/**
 * Clears the file list display
 */
const clearFileList = () => {
    const fileListDiv = document.getElementById('fileList');
    if (fileListDiv) {
        fileListDiv.innerHTML = '';
    }
};

/**
 * Creates the file list display
 * @param {Array} validFiles - List of valid files to display
 * @param {string} token - Google OAuth token
 */
const createFileList = (validFiles, token) => {
    const fileListDiv = document.getElementById('fileList');
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
};

/**
 * Updates the file list in the UI
 * @param {Array} validFiles - List of valid files to display
 * @param {string} token - Google OAuth token
 */
const updateFileList = (validFiles, token) => {
    const fileListDiv = document.getElementById('fileList');
    fileListDiv.innerHTML = '<h3>Downloaded Files:</h3>';

    if (validFiles.length === 0) {
        fileListDiv.innerHTML += '<p>No spreadsheet files found in Downloads.</p>';
        return;
    }

    createFileList(validFiles, token);
};

/**
 * Disables file list during upload
 * @param {HTMLElement} filesContainer - Container for file list
 * @param {HTMLElement} statusContainer - Container for status messages
 * @param {string} uploadingFileName - Name of file being uploaded
 */
const disableFileList = (filesContainer, statusContainer, uploadingFileName) => {
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
};

/**
 * Enables file list after upload
 * @param {HTMLElement} filesContainer - Container for file list
 * @param {HTMLElement} statusContainer - Container for status messages
 */
const enableFileList = (filesContainer, statusContainer) => {
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
};

/**
 * Starts the upload process for a file
 * @param {Object} downloadItem - The file to upload
 * @param {string} token - Google OAuth token
 * @param {HTMLElement} filesContainer - Container for file list
 * @param {HTMLElement} statusContainer - Container for status messages
 */
const startUpload = async (downloadItem, token, filesContainer, statusContainer) => {
    const filename = downloadItem.filename.split('\\').pop().split('/').pop();
    disableFileList(filesContainer, statusContainer, filename);

    try {
        await window.driveUploader.handleDriveFileUpload(
            await window.fileManager.readFileUsingDownloads(downloadItem),
            downloadItem.filename,
            token
        );
    } finally {
        enableFileList(filesContainer, statusContainer);
    }
};

// Export functions to be used by other modules
window.uiManager = {
    showLoadingState,
    updateFileList,
    clearFileList,
    isUploading,
    createFileList,
    startUpload,
    disableFileList,
    enableFileList
};