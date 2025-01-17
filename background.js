// Add this as background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "readFile") {
      const fileUrl = request.fileUrl;
      fetch(fileUrl)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onload = () => sendResponse({ data: reader.result });
          reader.onerror = () => sendResponse({ error: "Failed to read file" });
          reader.readAsArrayBuffer(blob);
        })
        .catch(error => sendResponse({ error: error.message }));
      return true; // Keep the message channel open for async response
    }
  });