document.addEventListener('DOMContentLoaded', () => {
    const HELP_OVERLAY_ID = 'accessibility-help-overlay';

    // Function to announce dynamic content changes to screen readers
    function announceToScreenReader(message) {
        const announcer = document.createElement('div');
        announcer.setAttribute('role', 'alert');
        announcer.setAttribute('aria-live', 'assertive');
        announcer.classList.add('sr-only'); // Visually hidden
        document.body.appendChild(announcer);

        setTimeout(() => {
            announcer.textContent = message;
        }, 100);

        setTimeout(() => {
            document.body.removeChild(announcer);
        }, 1000);
    }

    // --- Keyboard Shortcut Handling ---
    document.addEventListener('keydown', (e) => {
        // Toggle Help Overlay: '?'
        if (e.key === '?') {
            toggleHelpOverlay();
        }
        // Close modals/overlays: 'Escape'
        if (e.key === 'Escape') {
            const overlay = document.getElementById(HELP_OVERLAY_ID);
            if (overlay) {
                overlay.style.display = 'none';
            }
            // Add logic to close other modals if they exist
        }

        // Answer selection: 1, 2, 3, 4
        if (['1', '2', '3', '4'].includes(e.key)) {
            const answerIndex = parseInt(e.key, 10) - 1;
            const answerButtons = document.querySelectorAll('.answer-btn');
            if (answerButtons[answerIndex]) {
                answerButtons[answerIndex].click();
                announceToScreenReader(`Answer ${e.key} selected.`);
            }
        }

        // Navigate questions: ArrowLeft, ArrowRight
        if (e.key === 'ArrowRight') {
            const nextButton = document.getElementById('next-question-btn');
            if (nextButton) nextButton.click();
        }
        if (e.key === 'ArrowLeft') {
            const prevButton = document.getElementById('prev-question-btn');
            if (prevButton) prevButton.click();
        }
    });

    // --- Help Overlay ---
    function createHelpOverlay() {
        if (document.getElementById(HELP_OVERLAY_ID)) return;

        const overlay = document.createElement('div');
        overlay.id = HELP_OVERLAY_ID;
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: sans-serif;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: #333;
            padding: 40px;
            border-radius: 10px;
            max-width: 500px;
            text-align: left;
        `;

        content.innerHTML = `
            <h2 style="margin-top: 0;">Keyboard Shortcuts</h2>
            <p><strong>?</strong>: Toggle this help menu</p>
            <p><strong>1-4</strong>: Select an answer</p>
            <p><strong>&larr; / &rarr;</strong>: Navigate between questions</p>
            <p><strong>Esc</strong>: Close this overlay</p>
            <button id="close-help-overlay" style="margin-top: 20px; padding: 10px 20px;">Close</button>
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);

        document.getElementById('close-help-overlay').addEventListener('click', toggleHelpOverlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                toggleHelpOverlay();
            }
        });
    }

    function toggleHelpOverlay() {
        const overlay = document.getElementById(HELP_OVERLAY_ID);
        if (!overlay) return;
        const isVisible = overlay.style.display === 'flex';
        overlay.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible) {
            document.getElementById('close-help-overlay').focus();
        }
    }

    // --- Focus Management for Modals ---
    function trapFocus(element) {
        const focusableEls = element.querySelectorAll(
            'a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled])'
        );
        const firstFocusableEl = focusableEls[0];
        const lastFocusableEl = focusableEls[focusableEls.length - 1];
        const KEYCODE_TAB = 9;

        element.addEventListener('keydown', function(e) {
            if (e.key !== 'Tab' && e.keyCode !== KEYCODE_TAB) {
                return;
            }

            if (e.shiftKey) { /* shift + tab */
                if (document.activeElement === firstFocusableEl) {
                    lastFocusableEl.focus();
                    e.preventDefault();
                }
            } else { /* tab */
                if (document.activeElement === lastFocusableEl) {
                    firstFocusableEl.focus();
                    e.preventDefault();
                }
            }
        });
    }
    
    // Initialize
    createHelpOverlay();

    // Expose functions to global scope if needed
    window.accessibility = {
        announceToScreenReader,
        trapFocus
    };
});
