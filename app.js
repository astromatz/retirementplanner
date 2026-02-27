import { initialState, emptyState } from './core/state.js';
import { calculateSimulation } from './core/simulation.js';
import { encryptData, decryptData } from './utils/storage.js';
import { createWizard } from './ui/wizard.js';
import { StateManager } from './core/state_manager.js';
import { ChartRenderer } from './ui/chart_renderer.js';
import { TableRenderer } from './ui/table_renderer.js';
import { EditorRenderer } from './ui/editor_renderer.js';

class App {
    constructor() {
        this.stateManager = new StateManager(initialState);
        this.chartRenderer = new ChartRenderer('wealthChart');
        this.tableRenderer = new TableRenderer('#details-table');
        this.editorRenderer = new EditorRenderer(this);

        this.activeTab = 'strategie';
        this.currentPotIndex = 0;
        this.simulationResults = [];
        this.updateParamsDebounced = null;

        this.init();
    }

    get state() { return this.stateManager.getState(); }

    init() {
        this.wizard = createWizard(this);
        this.showLandingPage();

        this.stateManager.subscribe(() => this.onStateChange());

        // Expose to window for inline HTML handlers
        window.app = this;

        this.initTooltipPositioning();
        this.initCursorAtEnd();
        this._wizardBusy = false;
        this._passwordCallback = null;
    }

    // Cursor always jumps to the END when tapping any input field.
    // Works for type="number" and type="text". Uses event delegation
    // so dynamically-created inputs (editor, wizard) are covered too.
    initCursorAtEnd() {
        document.addEventListener('focus', (e) => {
            const el = e.target;
            if (el.tagName !== 'INPUT' || el.type === 'checkbox' || el.type === 'radio') return;
            // Clear + reassign forces cursor to end in all browsers incl. iOS Safari
            const val = el.value;
            el.value = '';
            el.value = val;
        }, true); // capture phase so it fires before other handlers
    }

    onStateChange() {
        // Core logic when state changes: recalculate and re-render dashboard
        if (document.getElementById('view-dashboard').style.display !== 'none') {
            if (this.updateParamsDebounced) clearTimeout(this.updateParamsDebounced);
            this.updateParamsDebounced = setTimeout(() => {
                this.updateDashboard();
            }, 200);
        }
    }

    updateDashboard(skipEditor = false) {
        this.simulationResults = calculateSimulation(this.state.data);
        this.renderDashboard(skipEditor);
    }

    renderDashboard(skipEditor = false, isStructural = false) {
        const results = this.simulationResults;
        const d = this.state.data;

        if (!results || results.length === 0) {
            // No results yet, render empty editor only
            if (!skipEditor) {
                this.editorRenderer.render(this.state, this.activeTab, this.currentPotIndex, results, true);
            }
            return;
        }
        // Render KPI Bar
        this.updateKpiBar(results);

        // Render Chart
        this.chartRenderer.render(results, d);

        // Render Table
        this.tableRenderer.render(results, d,
            (row) => this.toggleRow(row),
            (age) => this.openDetailModal(age)
        );

        // Render Editor — isStructural=false for normal value updates (patch path)
        if (!skipEditor) {
            this.editorRenderer.render(this.state, this.activeTab, this.currentPotIndex, results, isStructural);
        }

        // Sync extra UI elements
        const toggle = document.getElementById('toggle-purchasing-power');
        if (toggle) toggle.checked = !!d.showPurchasingPower;

        this.updateCoverageDisplay(results);
    }

    // --- NAVIGATION ---
    showLandingPage() {
        this.showView('landing-page');
    }

    startWizard() {
        this.stateManager.setData(emptyState.data);
        this.stateManager.state.step = 0;
        this.showView('wizard-container');
        this.renderStep();
    }

    finishWizard() {
        this.showView('view-dashboard');
        this.updateDashboard();
        // Switch to Strategie tab as default
        setTimeout(() => this.switchEditorTab('strategie'), 50);
        // Init swipe gestures once (guard with flag)
        if (!this._swipeInited) {
            const editorBody = document.querySelector('.editor-body');
            if (editorBody) this.editorRenderer.initSwipeGestures(editorBody);
            this._swipeInited = true;
        }
    }

    loadExampleData() {
        this.stateManager.setData(initialState.data);
        this.finishWizard();
    }

    showView(id) {
        ['landing-page', 'wizard-container', 'view-dashboard'].forEach(v => {
            let display = 'none';
            if (v === id) {
                if (v === 'landing-page' || v === 'wizard-container') display = 'flex';
                else display = 'block';
            }
            document.getElementById(v).style.display = display;
        });
    }

    // --- WIZARD logic ---
    renderStep() {
        console.log('Wizard: renderStep called for step index:', this.state.step);
        const stepDef = this.wizard.steps[this.state.step];
        console.log('Wizard: rendering step ID:', stepDef.id);
        const container = document.getElementById('wizard-content');

        // Render only the step content — no roadmap in the scroll area
        container.innerHTML = `<div class="wizard-main-content">${stepDef.render(this.state.data)}</div>`;
        container.scrollTop = 0;

        // Render progress dots into the sticky footer (immune to overlap issues)
        const stepCounter = document.getElementById('footer-step-counter');
        if (stepCounter) {
            stepCounter.innerHTML = this.wizard.steps.map((s, i) => `
                <button class="wz-dot ${this.state.step === i ? 'active' : (i < this.state.step ? 'done' : '')}"
                        onclick="app.jumpToStep(${i})"
                        title="${s.id}"
                        aria-label="Schritt ${i + 1}"></button>
            `).join('');
        }

        const totalSteps = this.wizard.steps.length;
        document.getElementById('prev-btn').style.display = this.state.step === 0 ? 'none' : 'flex';
        document.getElementById('next-btn').style.display = 'flex'; // Ensure next is always flex when visible
        document.getElementById('next-btn').textContent = this.state.step === totalSteps - 1 ? 'Zum Dashboard' : 'Weiter';

        window.scrollTo(0, 0);
    }

    updateWizardPreview() {
        // Live chart removed from wizard; no-op kept for compatibility
    }

    nextStep() {
        if (Date.now() - (this.lastNav || 0) < 500) return;
        this.lastNav = Date.now();

        if (document.activeElement) {
            console.log('Wizard: blurring active element:', document.activeElement.tagName);
            document.activeElement.blur();
        }

        const stepDef = this.wizard.steps[this.state.step];
        console.log('Wizard: evaluating step:', stepDef.id);

        if (stepDef.validate && !stepDef.validate(this.state.data)) {
            console.warn('Wizard: validation failed for step:', stepDef.id);
            this.showToast('Bitte prüfe deine Eingaben.', 'warning');
            return;
        }
        if (stepDef.save) {
            console.log('Wizard: saving step data for:', stepDef.id);
            stepDef.save(this.state.data);
        }

        if (this.state.step < this.wizard.steps.length - 1) {
            this.state.step++;
            console.log('Wizard: proceeding to step:', this.state.step);
            this.renderStep();
        } else {
            console.log('Wizard: reaching final step, finishing.');
            this.finishWizard();
        }
    }

    prevStep() {
        if (Date.now() - (this.lastNav || 0) < 500) return;
        this.lastNav = Date.now();

        if (document.activeElement) {
            document.activeElement.blur();
        }
        if (this.state.step > 0) {
            this.state.step--;
            this.renderStep();
        }
    }

    jumpToStep(index) {
        if (Date.now() - (this.lastNav || 0) < 500) return;
        this.lastNav = Date.now();

        if (document.activeElement) {
            document.activeElement.blur();
        }
        // Only allow jumping back or to the very next step (simple validation)
        if (index <= this.state.step + 1) {
            const currentStepDef = this.wizard.steps[this.state.step];
            if (index > this.state.step && currentStepDef.save) {
                currentStepDef.save(this.state.data);
            }
            this.state.step = index;
            this.renderStep();
        }
    }

    setPreset(key, type, potIndex = null) {
        const presets = {
            'vorsichtig': { interestRate: 2.0, interestRateRetirement: 1.5 },
            'realistisch': { interestRate: 4.0, interestRateRetirement: 3.0 },
            'optimistisch': { interestRate: 7.0, interestRateRetirement: 5.0 }
        };

        const p = presets[type];
        if (!p || potIndex === null) return;

        // Update state
        this.state.data.pots[potIndex].interestRate = p.interestRate;
        this.state.data.pots[potIndex].interestRateRetirement = p.interestRateRetirement;

        // Patch DOM directly to preserve the carousel scroll position
        const interestInput = document.getElementById(`pot-interest-${potIndex}`);
        const interestRetInput = document.getElementById(`pot-interest-ret-${potIndex}`);
        if (interestInput) interestInput.value = p.interestRate;
        if (interestRetInput) interestRetInput.value = p.interestRateRetirement;

        // Update active state on preset buttons for this slide
        const slide = document.getElementById(`pot-slide-${potIndex}`);
        if (slide) {
            slide.querySelectorAll('.wz-preset').forEach(btn => btn.classList.remove('active'));
            const typeOrder = ['vorsichtig', 'realistisch', 'optimistisch'];
            const btn = slide.querySelectorAll('.wz-preset')[typeOrder.indexOf(type)];
            if (btn) btn.classList.add('active');
        }

        // Refresh mini-preview chart without full re-render
        this.updateWizardPreview();
    }

    moveCarousel(selector, direction) {
        const inner = document.querySelector(selector);
        if (!inner) return;
        const width = inner.parentElement.offsetWidth;
        const currentTransform = new WebKitCSSMatrix(window.getComputedStyle(inner).transform).m41;
        const maxScroll = -(inner.children.length - 1) * width;

        let newScroll = currentTransform + (direction * width);
        if (newScroll > 0) newScroll = 0;
        if (newScroll < maxScroll) newScroll = maxScroll;

        inner.style.transform = `translateX(${newScroll}px)`;
    }

    // Pot tab navigation
    _currentPotSlide = 0;

    switchPotTab(index) {
        this._currentPotSlide = index;
        const inner = document.getElementById('pots-carousel-inner');
        if (inner) {
            const width = inner.parentElement.offsetWidth;
            inner.style.transform = `translateX(${-index * width}px)`;
        }
        document.querySelectorAll('.wz-pot-tab').forEach((t, i) => t.classList.toggle('active', i === index));
    }

    movePotCarousel(direction) {
        const inner = document.getElementById('pots-carousel-inner');
        if (!inner) return;
        const count = inner.children.length;
        const next = Math.max(0, Math.min(count - 1, this._currentPotSlide + direction));
        this.switchPotTab(next);
    }

    updatePotTabLabel(index) {
        const nameInput = document.getElementById(`pot-name-${index}`);
        const tab = document.getElementById(`pot-tab-${index}`);
        if (nameInput && tab) tab.textContent = nameInput.value || `Topf ${index + 1}`;
    }

    // --- DASHBOARD ACTIONS ---
    switchEditorTab(tabId) {
        console.log('Switching to editor tab:', tabId);
        this.activeTab = tabId;
        // Force full rebuild when switching tabs (new content entirely)
        this.editorRenderer.render(this.state, this.activeTab, this.currentPotIndex, this.simulationResults, true);

        // Fix: Use data attributes or explicit IDs instead of onclick.toString()
        document.querySelectorAll('.editor-tab').forEach(b => {
            const isTarget = b.getAttribute('onclick')?.includes(tabId);
            b.classList.toggle('active', isTarget);
        });
        document.querySelectorAll('.editor-tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tabId}`));
    }

    updateKpiBar(results) {
        if (!results || results.length === 0) return;
        const d = this.state.data;
        const last = results[results.length - 1];
        const fmt = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

        document.getElementById('stat-wealth').textContent = fmt(Math.max(0, last.totalWealth));
        document.getElementById('stat-wealth').style.color = last.totalWealth >= 0 ? '#16a34a' : '#dc2626';

        const gap = last.totalWealth < 0 ? Math.abs(last.totalWealth) : 0;
        document.getElementById('stat-gap').textContent = fmt(gap);
        document.getElementById('stat-gap').style.color = gap > 0 ? '#dc2626' : '#16a34a';

        // Sparrate Total (Open-ended logic)
        const currentSavings = d.pots.reduce((sum, pot) => {
            const applicable = (pot.savingsPhases || [])
                .filter(p => d.currentAge >= p.fromAge)
                .sort((a, b) => b.fromAge - a.fromAge);
            const amount = applicable.length > 0 ? applicable[0].amount : 0;
            return sum + amount;
        }, 0);
        const savingsEl = document.getElementById('kpi-savings');
        if (savingsEl) savingsEl.textContent = fmt(currentSavings) + ' / Mo';
    }

    // --- DATA UPDATES ---
    updateDataParam(key, value) {
        this.stateManager.update(`data.${key}`, (typeof this.state.data[key] === 'number' || key === 'endAge') ? +value : value);
    }

    updatePotParam(index, key, value) {
        this.stateManager.update(`data.pots.${index}.${key}`, (key === 'name') ? value : +value);
        // Also ensure tax rate is synced if it was the global one
        if (key === 'taxRate') this.stateManager.notify();
    }

    updateSavingsPhase(pIdx, phIdx, key, value) {
        this.stateManager.update(`data.pots.${pIdx}.savingsPhases.${phIdx}.${key}`, +value);
    }

    addSavingsPhase(pIdx) {
        const phases = this.state.data.pots[pIdx].savingsPhases;
        const last = phases[phases.length - 1];
        phases.push({
            fromAge: last.fromAge + 10,
            amount: last.amount
        });
        this.stateManager.notify();
    }

    removeSavingsPhase(pIdx, phIdx) {
        this.state.data.pots[pIdx].savingsPhases.splice(phIdx, 1);
        this.stateManager.notify();
    }

    updateRetirementPhase(idx, key, value) {
        this.stateManager.update(`data.retirementPhases.${idx}.${key}`, +value);
    }

    addRetirementPhase() {
        const d = this.state.data;
        if (!d.retirementPhases) d.retirementPhases = [];

        if (d.retirementPhases.length === 0) {
            // First time adding: convert basis to first phase and add a second one
            const basisAmount = d.retirementExpenses || 2800;
            d.retirementPhases.push({ fromAge: d.retirementAge, monthlyAmount: basisAmount });
            d.retirementPhases.push({ fromAge: d.retirementAge + 10, monthlyAmount: basisAmount });
        } else {
            // Regular addition: add based on the last one
            const last = d.retirementPhases[d.retirementPhases.length - 1];
            d.retirementPhases.push({
                fromAge: last.fromAge + 10,
                monthlyAmount: last.monthlyAmount
            });
        }
        this.stateManager.notify();
    }

    removeRetirementPhase(idx) {
        this.state.data.retirementPhases.splice(idx, 1);
        this.stateManager.notify();
    }

    addNewPot() {
        const d = this.state.data;
        d.pots.push({ name: `Topf ${d.pots.length + 1}`, value: 0, interestRate: 5, interestRateRetirement: 4, taxRate: d.withdrawalTaxRate || 18.5, savingsPhases: [{ fromAge: d.currentAge, toAge: d.retirementAge, amount: 0 }] });
        this.currentPotIndex = d.pots.length - 1;
        this.stateManager.notify();
    }

    deletePot(index) {
        if (this.state.data.pots.length <= 1) return;
        if (confirm('Löschen?')) {
            this.state.data.pots.splice(index, 1);
            this.currentPotIndex = Math.max(0, this.currentPotIndex - 1);
            this.stateManager.notify();
        }
    }

    // --- ADD/REMOVE HANDLERS ---
    addOneTimePayment() {
        this.state.data.oneTimePayments.push({ age: this.state.data.currentAge + 5, amount: 10000, targetPotIndex: 'all', description: '' });
        this.stateManager.notify();
    }
    removeOneTimePayment(index) {
        this.state.data.oneTimePayments.splice(index, 1);
        this.stateManager.notify();
    }
    updateOneTimePayment(index, key, value) {
        this.stateManager.update(`data.oneTimePayments.${index}.${key}`, (key === 'description' || key === 'targetPotIndex') ? value : +value);
    }

    addOneTimeExpense() {
        this.state.data.oneTimeExpenses.push({ age: this.state.data.retirementAge + 5, amount: 5000, targetPotIndex: 'all', description: '' });
        this.stateManager.notify();
    }
    removeOneTimeExpense(index) {
        this.state.data.oneTimeExpenses.splice(index, 1);
        this.stateManager.notify();
    }
    updateOneTimeExpense(index, key, value) {
        this.stateManager.update(`data.oneTimeExpenses.${index}.${key}`, (key === 'description' || key === 'targetPotIndex') ? value : +value);
    }

    addPension() {
        this.state.data.pensions.push({ id: 'pension_' + Date.now(), label: 'Neue Rente', amount: 500, growth: 1.5, startAge: this.state.data.retirementAge });
        this.stateManager.notify();
    }
    removePension(index) {
        this.state.data.pensions.splice(index, 1);
        this.stateManager.notify();
    }
    updatePensionParam(index, key, value) {
        this.stateManager.update(`data.pensions.${index}.${key}`, (key === 'label' || key === 'id') ? value : +value);
    }

    addRentalIncome() {
        this.state.data.rentalIncomes.push({ id: 'rental_' + Date.now(), label: 'Neue Einnahme', amount: 300, growth: 1.0, startAge: this.state.data.retirementAge });
        this.stateManager.notify();
    }
    removeRentalIncome(index) {
        this.state.data.rentalIncomes.splice(index, 1);
        this.stateManager.notify();
    }
    updateRentalIncomeParam(index, key, value) {
        this.stateManager.update(`data.rentalIncomes.${index}.${key}`, (key === 'label' || key === 'id') ? value : +value);
    }

    nextPot() { if (this.currentPotIndex < this.state.data.pots.length - 1) { this.currentPotIndex++; this.editorRenderer.render(this.state, this.activeTab, this.currentPotIndex, this.simulationResults, true); } }
    prevPot() { if (this.currentPotIndex > 0) { this.currentPotIndex--; this.editorRenderer.render(this.state, this.activeTab, this.currentPotIndex, this.simulationResults, true); } }

    setOption(key, value, el) {
        this.stateManager.update(`data.${key}`, value);
        if (el) {
            Array.from(el.parentElement.children).forEach(s => s.classList.remove('selected'));
            el.classList.add('selected');
        }
    }

    // --- UI STUFF ---
    togglePurchasingPower(enabled) {
        this.stateManager.update('data.showPurchasingPower', enabled);
    }

    toggleRow(row) {
        row.classList.toggle('expanded');
        row.nextElementSibling?.classList.toggle('show');
    }

    openDetailModal(age) {
        const results = calculateSimulation(this.state.data);
        const row = results.find(r => r.age === age);
        if (!row) return;

        const format = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
        const modal = document.getElementById('detailModal');
        const content = document.getElementById('modalDetailContent');
        const title = document.getElementById('modalDetailTitle');

        title.innerHTML = `🔍 Jahres-Breakdown: Alter ${age} (${row.year})`;

        content.innerHTML = `
            <div class="detail-grid">
                <div class="detail-section">
                    <h3>📥 Einnahmen-Details</h3>
                    ${row.incomeDetails.length > 0 ? row.incomeDetails.map(inc => `
                        <div class="detail-line">
                            <span class="detail-label">${inc.label}:</span>
                            <span class="detail-value">${format(inc.nominalAmount / 12)} / Mo. <span class="growth-note">(Basis: ${format(inc.baseAmount / 12)})</span></span>
                        </div>
                    `).join('') : '<p style="font-size:0.85rem; color:#666;">Keine spezifischen Renten-Einnahmen in dieser Phase.</p>'}
                    <div class="detail-line" style="border-top:2px solid var(--border); margin-top:10px; padding-top:10px;">
                        <span class="detail-label">Gesamt / Monat:</span>
                        <span class="detail-value" style="color:var(--primary); font-size:1.1rem;">${format((row.pension + row.savings) / 12)}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>📉 Ausgaben-Details</h3>
                    <div class="detail-line">
                        <span class="detail-label">Bedarf (heutige Kaufkraft):</span>
                        <span class="detail-value">${format(row.expenses / row.inflationFactor / 12)} / Mo.</span>
                    </div>
                    <div class="detail-line">
                        <span class="detail-label">Inflationsfaktor:</span>
                        <span class="detail-value inflation-note">× ${row.inflationFactor.toFixed(3)}</span>
                    </div>
                    <div class="detail-line">
                        <span class="detail-label">→ Tatsächlicher Bedarf:</span>
                        <span class="detail-value" style="color:#ef4444;">${format(row.expenses / 12)} / Mo.</span>
                    </div>
                </div>
            </div>

            <div class="topf-breakdown">
                <h3 style="margin-bottom: 1rem; font-size: 1rem;">📊 Topf-für-Topf Breakdown</h3>
                ${row.pots.map((pot, i) => {
            const potBefore = age === this.state.data.currentAge ? this.state.data.pots[i].value : results.find(r => r.age === age - 1).pots[i].value;
            const change = pot.value - potBefore;
            return `
                        <div class="topf-item">
                            <h4>${pot.name}</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem;">
                                <div class="detail-line" style="border:none; padding:2px 0;">
                                    <span class="detail-label">Startwert:</span>
                                    <span class="detail-value">${format(potBefore)}</span>
                                </div>
                                <div class="detail-line" style="border:none; padding:2px 0;">
                                    <span class="detail-label">Veränderung:</span>
                                    <span class="detail-value ${change >= 0 ? 'growth-note' : ''}" style="${change < 0 ? 'color:#ef4444;' : ''}">${change >= 0 ? '+' : ''}${format(change)}</span>
                                </div>
                                <div class="detail-line" style="border:none; padding:2px 0; font-weight:600; border-top:2px solid var(--border); padding-top:8px;">
                                    <span class="detail-label">= Endwert:</span>
                                    <span class="detail-value" style="color:var(--primary);">${format(pot.value)}</span>
                                </div>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;

        modal.classList.add('show');
        modal.onclick = (e) => { if (e.target === modal) this.closeDetailModal(); };
    }

    closeDetailModal() {
        document.getElementById('detailModal').classList.remove('show');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        toast.innerHTML = `<span style="font-size:1.2rem;">${icons[type] || icons.info}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
        toast.onclick = () => toast.remove();
    }

    initTooltipPositioning() {
        document.addEventListener('mouseover', (e) => {
            const trigger = e.target.closest('.tooltip-trigger');
            if (!trigger) return;
            const tooltipId = trigger.getAttribute('data-tooltip-id');
            const tooltip = document.getElementById(tooltipId);
            if (!tooltip) return;
            const triggerRect = trigger.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            // Default: Show BELOW the trigger (as requested)
            let top = triggerRect.bottom + 10;
            let left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);

            // If it would overflow the bottom of the window, show ABOVE as fallback
            if (top + tooltipRect.height > window.innerHeight - 10) {
                top = triggerRect.top - tooltipRect.height - 10;
            }

            if (left < 10) left = 10;
            if (left + tooltipRect.width > window.innerWidth - 10) left = window.innerWidth - tooltipRect.width - 10;
            tooltip.style.top = top + 'px';
            tooltip.style.left = left + 'px';
            tooltip.style.transform = 'none';
        });
    }

    // --- STORAGE & MODALS ---
    showPasswordModal(title, description, callback) {
        const modal = document.getElementById('passwordModal');
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalDescription').textContent = description;
        document.getElementById('passwordInput').value = '';
        this._passwordCallback = callback;
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('passwordInput').focus(), 100);
        // Allow Enter key to submit
        const input = document.getElementById('passwordInput');
        input.onkeydown = (e) => { if (e.key === 'Enter') this.handlePasswordSubmit(); };
    }

    closePasswordModal() {
        document.getElementById('passwordModal').style.display = 'none';
        this._passwordCallback = null;
    }

    handlePasswordSubmit() {
        const password = document.getElementById('passwordInput').value;
        if (this._passwordCallback) this._passwordCallback(password);
        this.closePasswordModal();
    }

    saveData() {
        this.showPasswordModal(
            '💾 Plan speichern',
            'Wähle ein Passwort zur Verschlüsselung deiner Planung.',
            async (password) => {
                if (!password) return;
                try {
                    const encrypted = await encryptData(this.state.data, password);
                    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    document.body.appendChild(a);
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `ruhestandsplanung_${new Date().toISOString().split('T')[0]}.encrypted`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    this.showToast('Erfolgreich gespeichert!', 'success');
                } catch (e) {
                    console.error('Save failed:', e);
                    this.showToast('Fehler beim Speichern.', 'error');
                }
            }
        );
    }

    loadData(event) {
        const file = event.target.files[0];
        if (!file) return;
        // Reset file input so same file can be re-selected later
        event.target.value = '';
        this.showPasswordModal(
            '📂 Plan laden',
            `Gib das Passwort für "${file.name}" ein.`,
            async (password) => {
                if (!password) return;
                try {
                    const buffer = await file.arrayBuffer();
                    const decrypted = await decryptData(new Uint8Array(buffer), password);
                    this.stateManager.setData(decrypted);
                    this.finishWizard(); // Navigate to dashboard
                    this.showToast('Plan erfolgreich geladen!', 'success');
                } catch (e) {
                    this.showToast('Passwort falsch oder Datei beschädigt.', 'error');
                }
            }
        );
    }

    reset() {
        if (confirm('Wirklich alles zurücksetzen?')) {
            this.stateManager.setData(emptyState.data);
            this.showLandingPage();
        }
    }

    loadExampleData() {
        this.stateManager.setData(initialState.data);
        this.finishWizard();
    }

    toggleAccordion(header) {
        const section = header.closest('.accordion-section');
        const id = section?.id || header.dataset.sectionId;
        if (section && id) {
            section.classList.toggle('expanded');
            if (!this._expandedSections) {
                // Initialize with some defaults if it's the first interaction
                this._expandedSections = new Set(['acc-spar-pots', 'acc-ret-expenses']);
            }
            if (section.classList.contains('expanded')) this._expandedSections.add(id);
            else this._expandedSections.delete(id);
        }
    }

    isExpanded(id) {
        if (!this._expandedSections) {
            // Default sections to show expanded at start
            const defaults = ['acc-spar-pots', 'acc-ret-expenses'];
            return defaults.includes(id);
        }
        return this._expandedSections.has(id);
    }

    // Reality Check logic
    openRealityCheck(age, potValues) {
        this.rcTargetAge = age;
        this.rcPotValues = potValues;
        const modal = document.getElementById('realityCheckModal');
        const desc = document.getElementById('rcModalDescription');
        desc.textContent = `Setze die realen Werte für Alter ${age} fest. Dies überschreibt die Simulation bis zu diesem Punkt.`;

        const container = document.getElementById('rcInputsContainer');
        container.innerHTML = this.state.data.pots.map((p, i) => `
            <div class="form-group">
                <label>${p.name}</label>
                <input type="number" class="rc-pot-input" data-index="${i}" value="${potValues[i]}">
            </div>
        `).join('');

        modal.style.display = 'flex';
    }

    closeRealityCheckModal() {
        document.getElementById('realityCheckModal').style.display = 'none';
    }

    saveRealityCheck() {
        const inputs = document.querySelectorAll('.rc-pot-input');
        const values = Array.from(inputs).map(inp => +inp.value);

        const d = this.state.data;
        d.realHistory = d.realHistory || [];
        // Remove existing entry for same age if exists
        d.realHistory = d.realHistory.filter(h => h.age !== this.rcTargetAge);
        d.realHistory.push({ age: this.rcTargetAge, pots: values });

        this.stateManager.notify();
        this.closeRealityCheckModal();
        this.showToast('Realitätscheck gespeichert.', 'success');
    }

    // Remaining methods from original app.js
    updateCoverageDisplay(results) {
        if (!results || results.length === 0) return;
        const d = this.state.data;
        const last = results[results.length - 1];
        const elKpi = document.getElementById('kpi-coverage');
        const elRatio = document.getElementById('coverage-ratio');
        const elStatus = document.getElementById('coverage-status');
        if (!elKpi) return;

        const finalWealth = last.totalWealth;
        const totalRetirementExpenses = results
            .filter(r => r.age >= d.retirementAge)
            .reduce((sum, r) => sum + r.expenses, 0);

        const bufferLimit = (totalRetirementExpenses || 1) * 0.2; // 20% buffer, avoid division by zero

        let statusText = 'Unbekannt';
        let statusColor = '#f59e0b';
        let scoreDisplay = '0%';

        if (finalWealth <= 0) {
            statusColor = '#e11d48'; // Red - Gap
            statusText = 'Lücke';
            scoreDisplay = '0%';
        } else if (finalWealth < bufferLimit) {
            statusColor = '#f59e0b'; // Amber - Tight
            statusText = 'Knapp';
            scoreDisplay = ((finalWealth / bufferLimit) * 100).toFixed(0) + '%';
        } else {
            statusColor = '#10b981'; // Green - Secure
            statusText = 'Sicher';
            scoreDisplay = '100%';
        }

        elKpi.textContent = scoreDisplay;
        elKpi.style.color = statusColor;

        if (elRatio) elRatio.textContent = scoreDisplay;
        if (elRatio) elRatio.style.color = statusColor;
        if (elStatus) elStatus.textContent = statusText;
        if (elStatus) elStatus.style.color = statusColor;
    }
}

const appInstance = new App();
export default appInstance;
