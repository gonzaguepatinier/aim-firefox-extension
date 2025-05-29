(function() {
    'use strict';
    
    // Check if extension is enabled (default: true)
    let extensionEnabled = true;
    
    // Load extension state from storage
    if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.local.get(['enterModifierEnabled']).then(result => {
            extensionEnabled = result.enterModifierEnabled !== false;
        });
    }
    
    function isSubmittableInput(element) {
        // Check if the element is in a form or has submit-like behavior
        if (element.form) return true;
        
        // Check for common chat/messaging contexts
        const parentElement = element.parentElement;
        if (parentElement) {
            const classes = parentElement.className.toLowerCase();
            const parentClasses = parentElement.parentElement?.className.toLowerCase() || '';
            
            // Common patterns for chat/messaging inputs
            if (classes.includes('message') || classes.includes('chat') || 
                classes.includes('comment') || classes.includes('reply') ||
                parentClasses.includes('message') || parentClasses.includes('chat')) {
                return true;
            }
        }
        
        // Check for nearby submit buttons
        const form = element.closest('form');
        if (form && form.querySelector('button[type="submit"], input[type="submit"]')) {
            return true;
        }
        
        return false;
    }
    
    function findNearestForm(element) {
        // Try to find the closest form
        let form = element.closest('form');
        if (form) return form;
        
        // Look for nearby submit buttons or forms
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
            form = parent.querySelector('form');
            if (form) return form;
            
            const submitButton = parent.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
            if (submitButton) {
                return submitButton.closest('form') || submitButton;
            }
            
            parent = parent.parentElement;
        }
        
        return null;
    }
    
    function simulateSubmit(element) {
        // Try different submission methods
        
        // Method 1: Find and click submit button
        const form = findNearestForm(element);
        if (form) {
            const submitButton = form.querySelector('button[type="submit"], input[type="submit"]') ||
                               form.querySelector('button:not([type="button"]):not([type="reset"])');
            
            if (submitButton) {
                submitButton.click();
                return true;
            }
            
            // Method 2: Submit form directly
            if (form.tagName === 'FORM') {
                form.submit();
                return true;
            }
        }
        
        // Method 3: Look for nearby clickable buttons
        const nearbyButton = element.parentElement?.querySelector('button') ||
                           element.parentElement?.parentElement?.querySelector('button');
        
        if (nearbyButton && !nearbyButton.disabled) {
            nearbyButton.click();
            return true;
        }
        
        // Method 4: Dispatch custom submit event
        const submitEvent = new CustomEvent('submit', { bubbles: true, cancelable: true });
        element.dispatchEvent(submitEvent);
        
        return false;
    }
    
    function handleKeyDown(event) {
        if (!extensionEnabled) return;
        
        const element = event.target;
        
        // Only handle textarea and contenteditable elements, plus input fields that are text-like
        const isTextarea = element.tagName === 'TEXTAREA';
        const isContentEditable = element.contentEditable === 'true';
        const isTextInput = element.tagName === 'INPUT' && 
                           ['text', 'search', 'url', 'email', 'password'].includes(element.type);
        
        if (!isTextarea && !isContentEditable && !isTextInput) {
            return;
        }
        
        // Handle Enter key
        if (event.key === 'Enter') {
            if (event.shiftKey) {
                // Shift+Enter: Insert newline (default behavior for textareas)
                if (isTextarea) {
                    // Let default behavior happen
                    return;
                }
                
                if (isContentEditable) {
                    // Insert newline in contenteditable
                    event.preventDefault();
                    document.execCommand('insertLineBreak');
                    return;
                }
                
                if (isTextInput) {
                    // Text inputs don't normally support newlines, so we'll ignore Shift+Enter
                    event.preventDefault();
                    return;
                }
            } else {
                // Plain Enter: Submit
                event.preventDefault();
                
                // For single-line inputs, always try to submit
                if (isTextInput || isSubmittableInput(element)) {
                    simulateSubmit(element);
                    return;
                }
                
                // For textareas and contenteditable, check context
                if (isTextarea || isContentEditable) {
                    // In forms or chat-like contexts, submit
                    if (isSubmittableInput(element)) {
                        simulateSubmit(element);
                    } else {
                        // In other contexts (like document editing), insert newline
                        if (isTextarea) {
                            const start = element.selectionStart;
                            const end = element.selectionEnd;
                            const value = element.value;
                            
                            element.value = value.substring(0, start) + '\n' + value.substring(end);
                            element.selectionStart = element.selectionEnd = start + 1;
                        } else if (isContentEditable) {
                            document.execCommand('insertLineBreak');
                        }
                    }
                }
            }
        }
    }
    
    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown, true);
    
    // Listen for messages from popup to toggle extension
    if (typeof browser !== 'undefined' && browser.runtime) {
        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'toggleExtension') {
                extensionEnabled = message.enabled;
                sendResponse({success: true});
            } else if (message.action === 'getStatus') {
                sendResponse({enabled: extensionEnabled});
            }
        });
    }
    
    console.log('Enter Key Behavior Modifier loaded');
})();