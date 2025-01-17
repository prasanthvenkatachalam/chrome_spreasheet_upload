// File Management Module
// Handles file operations and validates files before upload

/**
 * Checks if a file is a valid spreadsheet (xlsx or csv)
 * @param {Object} download - The download item to check
 * @returns {boolean} - Whether the file is a valid spreadsheet
 */
const isValidSpreadsheet = (download) => {
    const filename = download.filename.toLowerCase();
    return filename.endsWith('.xlsx') || filename.endsWith('.csv');
};

/**
 * Checks if a file exists in downloads
 * @param {Object} download - The download item to check
 * @returns {Promise<boolean>} - Whether the file exists
 */
const fileExists = async (download) => {
    return new Promise(resolve => {
        chrome.downloads.search({ id: download.id }, results => {
            resolve(results.length > 0 && results[0].exists);
        });
    });
};

/**
 * Searches for valid spreadsheet files in downloads
 * @param {string} token - Google OAuth token
 */
const verifyAndListFiles = async (token) => {
    // Show loading state while scanning
    window.uiManager.showLoadingState();
    
    // Search downloads for complete downloads
    chrome.downloads.search({
        state: 'complete',
        orderBy: ['-startTime']
    }, async (downloads) => {
        const validFiles = await filterValidFiles(downloads);
        window.uiManager.updateFileList(validFiles, token);
    });
};

/**
 * Filters downloads to find valid spreadsheet files
 * @param {Array} downloads - List of downloaded files
 * @returns {Array} - List of valid spreadsheet files
 */
const filterValidFiles = async (downloads) => {
    const validFiles = [];
    
    for (const download of downloads) {
        if (isValidSpreadsheet(download) && await fileExists(download)) {
            validFiles.push(download);
        }
    }
    
    return validFiles;
};

/**
 * Reads a file using the downloads API
 * @param {Object} downloadItem - The download item to read
 * @returns {Promise<Blob>} - The file contents as a Blob
 */
const readFileUsingDownloads = async (downloadItem) => {
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
};

// Export functions to be used by other modules
window.fileManager = {
    verifyAndListFiles,
    filterValidFiles,
    readFileUsingDownloads,
    isValidSpreadsheet,
    fileExists
};