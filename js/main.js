// Main Module
// Initializes the extension and sets up event listeners

document.addEventListener('DOMContentLoaded', () => {
    // Initialize auth check
    window.auth.checkAuthenticationStatus();

    // Set up event listeners
    const loginButton = document.getElementById('login');
    loginButton.addEventListener('click', window.auth.authenticate);
});