document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.getElementById('toggleSwitch');
    const status = document.getElementById('status');
    
    // Load current state
    browser.storage.local.get(['enterModifierEnabled']).then(result => {
        const enabled = result.enterModifierEnabled !== false; // Default to true
        toggle.checked = enabled;
        updateStatus(enabled);
    });
    
    // Handle toggle change
    toggle.addEventListener('change', function() {
        const enabled = toggle.checked;
        
        // Save state
        browser.storage.local.set({
            enterModifierEnabled: enabled
        });
        
        // Update status
        updateStatus(enabled);
        
        // Send message to content scripts
        browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
            if (tabs[0]) {
                browser.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleExtension',
                    enabled: enabled
                }).catch(err => {
                    // Content script might not be loaded yet, that's ok
                    console.log('Could not send message to content script:', err);
                });
            }
        });
    });
    
    function updateStatus(enabled) {
        if (enabled) {
            status.textContent = 'Extension is enabled';
            status.className = 'status enabled';
        } else {
            status.textContent = 'Extension is disabled';
            status.className = 'status disabled';
        }
    }
});