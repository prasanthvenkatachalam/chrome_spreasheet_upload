// Google Drive Upload Module
// Handles file uploads to Google Drive

/**
 * Gets the message div element
 * @returns {HTMLElement} Message div element
 */
const getMessageDiv = () => document.getElementById('message');

/**
 * Handles the upload process to Google Drive
 * @param {Blob} fileBlob - File data to upload
 * @param {string} filename - Name of the file
 * @param {string} token - Google OAuth token
 */
const handleDriveFileUpload = async (fileBlob, filename, token) => {
    const messageDiv = getMessageDiv();
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
        handleUploadSuccess(data);

    } catch (error) {
        handleUploadError(error);
    }
};

/**
 * Handles successful file upload
 * @param {Object} data - Response data from Google Drive
 */
const handleUploadSuccess = (data) => {
    const messageDiv = getMessageDiv();
    messageDiv.textContent = 'File uploaded successfully!';
    
    // Open the uploaded file in Google Sheets
    const sheetsUrl = `https://docs.google.com/spreadsheets/d/${data.id}/edit`;
    chrome.tabs.create({ url: sheetsUrl });
};

/**
 * Handles upload errors
 * @param {Error} error - The error that occurred
 */
const handleUploadError = (error) => {
    const messageDiv = getMessageDiv();
    console.error('Upload error:', error);
    messageDiv.textContent = 'Error: ' + (error.message || 'Unknown error occurred during upload');
};

/**
 * Validates file before upload
 * @param {Blob} fileBlob - File to validate
 * @returns {boolean} - Whether the file is valid
 */
const validateFile = (fileBlob) => {
    if (!fileBlob) {
        return false;
    }
    
    // Add any additional validation as needed
    return true;
};

// Export functions immediately when the script loads
window.driveUploader = {
    handleDriveFileUpload,
    handleUploadSuccess,
    handleUploadError,
    validateFile
};