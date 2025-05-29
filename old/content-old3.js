(function() {
    'use strict';
    
    console.log('Enter Key Behavior Modifier: Starting...');
    
    // Check if extension is enabled (default: true)
    let extensionEnabled = true;
    
    // Load extension state from storage
    if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.local.get(['enterModifierEnabled']).then(result => {
            extensionEnabled = result.enterModifierEnabled !== false;
            console.log('Extension enabled:', extensionEnabled);
        }).catch(err => {
            console.log('Storage access failed, using default enabled state');
        });
    }
    
    function isFormInput(element) {
        // Check if element is in a form
        const form = element.closest('form');
        if (form) {
            console.log('Found form element');
            return true;
        }
        
        // Check for common messaging/chat patterns
        const elementClasses = element.className?.toLowerCase() || '';
        const parentClasses = element.parentElement?.className?.toLowerCase() || '';
        
        const chatPatterns = ['message', 'chat', 'comment', 'reply', 'input', 'compose', 'send'];
        const hasPattern = chatPatterns.some(pattern => 
            elementClasses.includes(pattern) || parentClasses.includes(pattern)
        );
        
        if (hasPattern) {
            console.log('Found chat/messaging pattern');
            return true;
        }
        
        // Check for submit buttons nearby
        const submitButton = document.querySelector('button[type="submit"], input[type="submit"]') ||
                           element.parentElement?.querySelector('button') ||
                           element.parentElement?.parentElement?.querySelector('button');
        
        if (submitButton) {
            console.log('Found nearby submit button');
            return true;
        }
        
        return false;
    }
    
    function insertNewline(element) {
        if (element.tagName === 'TEXTAREA') {
            const start = element.selectionStart;
            const end = element.selectionEnd;
            const value = element.value;
            
            element.value = value.substring(0, start) + '\n' + value.substring(end);
            element.selectionStart = element.selectionEnd = start + 1;
            
            // Trigger input event for frameworks that listen for it
            element.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('Inserted newline in textarea');
        } else if (element.contentEditable === 'true') {
            // For contenteditable elements
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            
            const br = document.createElement('br');
            range.deleteContents();
            range.insertNode(br);
            range.setStartAfter(br);
            range.setEndAfter(br);
            selection.removeAllRanges();
            selection.addRange(range);
            
            console.log('Inserted newline in contenteditable');
        }
    }
    
    function submitForm(element) {
        console.log('Attempting to submit...');
        
        // Method 1: Find closest form and submit it
        const form = element.closest('form');
        if (form) {
            console.log('Found form, looking for submit button');
            
            // Look for submit button first
            const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
            if (submitBtn && !submitBtn.disabled) {
                console.log('Clicking form submit button');
                submitBtn.click();
                return true;
            }
            
            // Look for any button in form that might submit
            const anyButton = form.querySelector('button:not([type="button"]):not([type="reset"])');
            if (anyButton && !anyButton.disabled) {
                console.log('Clicking form button');
                anyButton.click();
                return true;
            }
            
            // Try form.submit()
            console.log('Using form.submit()');
            try {
                form.submit();
                return true;
            } catch (e) {
                console.log('form.submit() failed:', e);
            }
        }
        
        // Method 2: Look for nearby submit buttons in a wider scope
        const searchArea = element.closest('div, section, main') || document;
        
        // Look for submit buttons
        let submitButton = searchArea.querySelector('button[type="submit"], input[type="submit"]');
        
        if (!submitButton) {
            // Look for buttons with submit-like text or classes
            const buttons = searchArea.querySelectorAll('button');
            submitButton = Array.from(buttons).find(btn => {
                const text = (btn.textContent || '').toLowerCase();
                const className = (btn.className || '').toLowerCase();
                return text.includes('send') || text.includes('submit') || text.includes('post') ||
                       className.includes('send') || className.includes('submit') || className.includes('post');
            });
        }
        
        if (submitButton && !submitButton.disabled) {
            console.log('Clicking nearby submit button:', submitButton.textContent);
            submitButton.click();
            return true;
        }
        
        // Method 3: For single-line inputs, create a simple Enter key event
        if (element.tagName === 'INPUT') {
            console.log('Creating Enter key event for input');
            
            // First try a more compatible approach - temporarily allow the original event
            setTimeout(() => {
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                
                // Remove our event listener temporarily
                document.removeEventListener('keydown', handleKeyDown, true);
                element.dispatchEvent(enterEvent);
                
                // Re-add our listener after a short delay
                setTimeout(() => {
                    document.addEventListener('keydown', handleKeyDown, true);
                }, 10);
            }, 10);
            
            return true;
        }
        
        console.log('No submit method found');
        return false;
    }
    
    function handleKeyDown(event) {
        if (!extensionEnabled) return;
        
        // Only handle Enter key
        if (event.key !== 'Enter') return;
        
        const element = event.target;
        const tagName = element.tagName?.toLowerCase();
        
        console.log('Enter key pressed on:', tagName, element);
        
        // Only handle text inputs, textareas, and contenteditable elements
        const isTextarea = tagName === 'textarea';
        const isContentEditable = element.contentEditable === 'true';
        const isTextInput = tagName === 'input' && 
                           (!element.type || ['text', 'search', 'url', 'email', 'password', 'tel'].includes(element.type));
        
        if (!isTextarea && !isContentEditable && !isTextInput) {
            console.log('Not a text input element, ignoring');
            return;
        }
        
        console.log('Processing Enter key on text input');
        
        if (event.shiftKey) {
            // Shift+Enter: Insert newline
            console.log('Shift+Enter: Inserting newline');
            event.preventDefault();
            event.stopPropagation();
            
            if (isTextInput) {
                // Single-line inputs don't support newlines, so do nothing
                console.log('Text input does not support newlines');
                return;
            }
            
            insertNewline(element);
            
        } else {
            // Plain Enter: Submit
            console.log('Plain Enter: Attempting submit');
            
            // Don't prevent default immediately - let's be more selective
            const shouldIntercept = isFormInput(element) || isTextInput;
            
            if (shouldIntercept) {
                event.preventDefault();
                event.stopPropagation();
                
                // For single-line inputs, always try to submit
                if (isTextInput) {
                    submitForm(element);
                    return;
                }
                
                // For textareas and contenteditable, check if we should submit or insert newline
                if (isFormInput(element)) {
                    console.log('In form context, submitting');
                    submitForm(element);
                } else {
                    console.log('Not in form context, inserting newline');
                    insertNewline(element);
                }
            } else {
                console.log('Not intercepting Enter key for this element');
            }
        }
    }
    
    // Add event listener with high priority
    document.addEventListener('keydown', handleKeyDown, true);
    
    // Also listen for keypress as backup
    document.addEventListener('keypress', function(event) {
        if (!extensionEnabled) return;
        
        if (event.key === 'Enter') {
            const element = event.target;
            const tagName = element.tagName?.toLowerCase();
            
            const isTextarea = tagName === 'textarea';
            const isContentEditable = element.contentEditable === 'true';
            const isTextInput = tagName === 'input' && 
                               (!element.type || ['text', 'search', 'url', 'email', 'password', 'tel'].includes(element.type));
            
            if (isTextarea || isContentEditable || isTextInput) {
                console.log('Preventing default keypress behavior');
                event.preventDefault();
                event.stopPropagation();
            }
        }
    }, true);
    
    // Listen for messages from popup
    if (typeof browser !== 'undefined' && browser.runtime) {
        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'toggleExtension') {
                extensionEnabled = message.enabled;
                console.log('Extension toggled:', extensionEnabled);
                sendResponse({success: true});
            } else if (message.action === 'getStatus') {
                sendResponse({enabled: extensionEnabled});
            }
        });
    }
    
    console.log('Enter Key Behavior Modifier: Loaded and ready');
})();