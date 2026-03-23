export function initGlobalEvents(app) {
    initCursorAtEnd();
    initTooltipPositioning();
}

/**
 * Cursor always jumps to the END when tapping any input field.
 * Works for type="number" and type="text". Uses event delegation
 * so dynamically-created inputs (editor, wizard) are covered too.
 */
function initCursorAtEnd() {
    document.addEventListener('focus', (e) => {
        const el = e.target;
        if (el.tagName !== 'INPUT' || el.type === 'checkbox' || el.type === 'radio') return;
        // Clear + reassign forces cursor to end in all browsers incl. iOS Safari
        const val = el.value;
        el.value = '';
        el.value = val;
    }, true); // capture phase so it fires before other handlers
}

/**
 * Robust Positioning for Tooltips (especially on Mobile)
 */
function initTooltipPositioning() {
    let activeTooltip = null;
    let hideTimeout = null;

    const show = (trigger) => {
        const tooltipId = trigger.dataset.tooltipId;
        const tooltip = document.getElementById(tooltipId);
        if (!tooltip) return;

        clearTimeout(hideTimeout);
        if (activeTooltip && activeTooltip !== tooltip) {
            activeTooltip.style.opacity = '0';
            activeTooltip.style.visibility = 'hidden';
        }

        activeTooltip = tooltip;
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';

        // Smarter Positioning
        const rect = trigger.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        // Default: Top Center
        let top = rect.top - tooltipRect.height - 10;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        // Boundary checks
        if (top < 10) top = rect.bottom + 10; // Flip to bottom if no space on top
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        tooltip.style.top = `${top + window.scrollY}px`;
        tooltip.style.left = `${left + window.scrollX}px`;
    };

    const hide = () => {
        hideTimeout = setTimeout(() => {
            if (activeTooltip) {
                activeTooltip.style.opacity = '0';
                activeTooltip.style.visibility = 'hidden';
                activeTooltip = null;
            }
        }, 300); // Small delay to allow moving mouse TO the tooltip
    };

    // Event delegation
    document.addEventListener('mouseover', (e) => {
        const trigger = e.target.closest('.tooltip-trigger');
        const tooltipContent = e.target.closest('.tooltip-content');

        if (trigger) show(trigger);
        if (tooltipContent) clearTimeout(hideTimeout); // Cancel hide if mouse is OVER tooltip
    });

    document.addEventListener('mouseout', (e) => {
        const trigger = e.target.closest('.tooltip-trigger');
        const tooltipContent = e.target.closest('.tooltip-content');

        if (trigger || tooltipContent) hide();
    });

    // Mobile: Tap to show
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.tooltip-trigger');
        if (trigger) {
            show(trigger);
            // On mobile, keep it open until click elsewhere
        } else if (!e.target.closest('.tooltip-content')) {
            hide();
        }
    });
}
