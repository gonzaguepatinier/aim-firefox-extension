(function() {
    'use strict';

    console.log('Enter Key Modifier (Site-Specific): Starting...');

    let extensionEnabled = true;

    // Optional: Load extension state from storage
    if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.local.get(['enterModifierEnabled']).then(result => {
            extensionEnabled = result.enterModifierEnabled !== false;
            console.log('Extension enabled state loaded:', extensionEnabled);
        }).catch(err => {
            console.warn('Storage access failed for extension state, using default (enabled).', err);
        });
    }

    function insertNewline(element) {
        if (element.tagName === 'TEXTAREA') {
            const start = element.selectionStart;
            const end = element.selectionEnd;
            const value = element.value;
            element.value = value.substring(0, start) + '\n' + value.substring(end);
            element.selectionStart = element.selectionEnd = start + 1;
            // Dispatch an 'input' event for frameworks that listen for it
            element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            console.log('Inserted newline in textarea.');
        } else if (element.contentEditable === 'true') {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const br = document.createElement('br');
            range.insertNode(br);
            // Ensure cursor can be placed after the <br>
            const nbsp = document.createTextNode('\u200B'); // Zero-width space
            range.insertNode(nbsp);
            range.setStartAfter(nbsp);
            range.setEndAfter(nbsp);
            selection.removeAllRanges();
            selection.addRange(range);
            element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            console.log('Inserted newline in contenteditable.');
        }
    }

    function findAndClickSendIcon(textareaElement) {
        console.log('Attempting to find and click send icon relative to:', textareaElement);

        // Structure:
        // grandParent (div.el-col.d-flex.align-items-end)
        //   |- parentOfTextarea (div.message-content-row)
        //   |  |- div.message-input-textarea
        //   |     |- textareaElement
        //   |- parentOfIcon (div.aside-button)
        //      |- sendIcon (.send-message-icon)

        const parentOfTextareaContainer = textareaElement.closest('.message-content-row');
        if (!parentOfTextareaContainer) {
            console.warn('Could not find ".message-content-row" ancestor of the textarea.');
            return false;
        }

        const grandParent = parentOfTextareaContainer.parentElement;
        if (!grandParent) {
            console.warn('Could not find parentElement of ".message-content-row".');
            return false;
        }
        
        // Log the grandparent to help debug its structure if needed
        // console.log('Grandparent element:', grandParent);

        // Now search for the send icon within this grandparent
        const sendIcon = grandParent.querySelector('.send-message-icon');

        if (sendIcon && typeof sendIcon.click === 'function') {
            console.log('Found send icon:', sendIcon, 'Attempting click sequence.');
            // For framework-heavy sites, a simple .click() might not be enough.
            // Try a sequence of events that more closely mimics a user interaction.
            sendIcon.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, composed: true }));
            sendIcon.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, composed: true }));
            sendIcon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, composed: true }));
            console.log('Send icon click sequence dispatched.');
            return true;
        } else {
            if (!sendIcon) {
                console.warn('Send message icon (.send-message-icon) not found within the expected grandparent container.');
            } else {
                console.warn('Found send icon, but it does not have a click method or is not an HTMLElement:', sendIcon);
            }
            return false;
        }
    }

    function handleKeyDown(event) {
        if (!extensionEnabled) return;
        if (event.key !== 'Enter') return;

        const element = event.target;

        // Target the specific textarea using its class and parent's class
        const isTargetTextarea = element.tagName === 'TEXTAREA' &&
                                 element.classList.contains('el-textarea__inner') &&
                                 element.closest('.message-input-textarea');

        // Handle generic textareas or contenteditables differently if needed, or ignore them
        const isGenericEditable = (element.tagName === 'TEXTAREA' || element.contentEditable === 'true') && !isTargetTextarea;

        if (!isTargetTextarea && !isGenericEditable) {
            // console.log('Not a recognized textarea or editable field. Ignoring.');
            return;
        }

        console.log(`Enter Key Modifier: Keydown on ${element.tagName} (Target: ${isTargetTextarea}), Shift: ${event.shiftKey}`, element);

        if (event.shiftKey) {
            console.log('Shift+Enter: Inserting newline.');
            event.preventDefault();
            event.stopPropagation(); // Important to stop other listeners if any
            insertNewline(element);
        } else {
            // Plain Enter
            if (isTargetTextarea) {
                console.log('Plain Enter on target chat textarea: Preventing default and attempting to click send icon.');
                event.preventDefault();
                event.stopPropagation(); // Crucial to prevent the site's own Enter handling if it exists and conflicts

                if (!findAndClickSendIcon(element)) {
                    console.error("Failed to find or click the send icon. Enter was prevented, so it will appear to do nothing.");
                }
            } else if (isGenericEditable) {
                // Behavior for other textareas/contenteditables when Enter is pressed (without Shift)
                // Option 1: Let the site handle it (if placeholder suggests Enter submits)
                const placeholder = element.placeholder?.toLowerCase() || '';
                if (placeholder.includes('shift + enter to') || placeholder.includes('enter to send')) {
                     console.log('Generic editable with submit hint in placeholder. Letting site handle plain Enter.');
                     // Do NOT preventDefault or stopPropagation here.
                     return;
                }

                // Option 2: Default to inserting a newline (safer for unknown contexts)
                console.log('Plain Enter on generic editable: Defaulting to insert newline.');
                event.preventDefault();
                event.stopPropagation();
                insertNewline(element);
                
                // Option 3: Attempt a generic form submission (more complex, might require another function)
                // console.log('Plain Enter on generic editable: Attempting generic submit (not implemented in this version).');
                // event.preventDefault();
                // event.stopPropagation();
                // attemptGenericSubmit(element);
            }
        }
    }

    document.addEventListener('keydown', handleKeyDown, true); // Use capturing phase

    // Optional: Message listener for enabling/disabling via a popup
    if (typeof browser !== 'undefined' && browser.runtime) {
        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'toggleExtension') {
                extensionEnabled = message.enabled;
                console.log('Extension toggled via message:', extensionEnabled);
                sendResponse({ success: true });
            } else if (message.action === 'getStatus') {
                sendResponse({ enabled: extensionEnabled });
            }
            return true; // Indicates you wish to send a response (asynchronously or synchronously)
        });
    }

    console.log('Enter Key Modifier (Site-Specific): Loaded and ready.');
})();
