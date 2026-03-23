import { initialState, emptyState } from './core/state.js?v=2';
import { calculateSimulation } from './core/simulation.js?v=2';
import { encryptData, decryptData } from './utils/storage.js?v=2';
import { createWizard } from './ui/wizard.js?v=2';
import { StateManager } from './core/state_manager.js?v=2';
import { ChartRenderer } from './ui/chart_renderer.js?v=4';
import { TableRenderer } from './ui/table_renderer.js?v=4';
import { EditorRenderer } from './ui/editor_renderer.js?v=4';
import { KpiManager } from './ui/kpi_manager.js?v=4';
import { initGlobalEvents } from './ui/event_initializer.js?v=4';
import { clip, fmtCSV } from './utils/helpers.js?v=4';

const STORAGE_KEY = 'retirement_planner_autosave';

class App {
    constructor() {
        // Expose to window immediately so inline handlers can find it during init if needed
        window.app = this;
        
        try {
            let startState = initialState;
            let loadedFromAutosave = false;
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) {
                    startState = JSON.parse(saved);
                    loadedFromAutosave = true;
                }
            } catch(e) { console.warn('Autosave load failed', e); }

            this.stateManager = new StateManager(startState, STORAGE_KEY, sessionStorage);
            this.chartRenderer = new ChartRenderer('wealthChartMobile');
            this.tableRenderer = new TableRenderer('#mobile-details-table');
            this.editorRenderer = new EditorRenderer(this);
            this.kpiManager = new KpiManager(this);

            this.activeTab = 'strategie';
            this.currentPotIndex = 0;
            this.simulationResults = [];
            this.updateParamsDebounced = null;
            this.tableFilter = 'all';
            this._expandedOTP = null;
            this._expandedOTE = null;

            this.initTheme(); // Set theme colors before first render
            this.init(loadedFromAutosave);
        } catch (err) {
            console.error('App Construction failed:', err);
            // Fallback for mobile debugging:
            if (typeof window !== 'undefined' && !window.InitErrorCaptured) {
                alert('Fehler beim Starten der App: ' + err.message);
                window.InitErrorCaptured = true;
            }
        }
    }

    get state() { return this.stateManager.getState(); }

    init(loadedFromAutosave = false) {
        try {
            this.wizard = createWizard(this);
            
            if (loadedFromAutosave) {
                this.finishSetup();
                setTimeout(() => this.showToast('✅ Sitzung wiederhergestellt. Bitte nutze [Speichern], um den Plan dauerhaft zu sichern.', 'success'), 800);
            } else {
                this.showLandingPage();
            }

            this.stateManager.subscribe((state) => this.onStateChange());

            initGlobalEvents(this);
            this._wizardBusy = false;
            this._passwordCallback = null;
        } catch (err) {
            console.error('App.init failed:', err);
            throw err;
        }
    }


    onStateChange(isStructural = false) {
        if (isStructural) this._isStructuralPending = true;
        // Core logic when state changes: recalculate and re-render dashboard
        if (document.getElementById('view-dashboard').style.display !== 'none') {
            if (this.updateParamsDebounced) clearTimeout(this.updateParamsDebounced);
            this.updateParamsDebounced = setTimeout(() => {
                this.updateDashboard(false, this._isStructuralPending);
                this._isStructuralPending = false;
            }, 200);
        }
    }

    updateDashboard(skipEditor = false, isStructural = false) {
        this._activeUpdateIsStructural = isStructural;
        
        // CRITICAL: Purge any legacy data fields to ensure simulation purity
        const d = this.state.data;
        // Purge only truly obsolete fields if they exist as objects (not primitives used by wizard)
        if (d.expenseAdjustments) delete d.expenseAdjustments;

        this.simulationResults = calculateSimulation(d);
        this.renderDashboard(skipEditor, isStructural);
        this._activeUpdateIsStructural = false;
    }

    renderDashboard(skipEditor = false, isStructural = false) {
        const results = this.simulationResults;
        const d = this.state.data;

        if (!results || results.length === 0) {
            if (!skipEditor) {
                this.editorRenderer.render(this.state, this.activeTab, this.currentPotIndex, results, true);
            }
            return;
        }

        // Render Chart (Initial background render if on Desktop, or just KPI Bar)
        this.kpiManager.updateKpiBar(results);

        // ALWAYS render the Mobile Pillars on this layout, 
        // as index.html currently only provides the mobile-view container IDs.
        this.renderMobilePillars(results);

        this.kpiManager.updateCoverageDisplay(results);
    }

    renderMobilePillars(results) {
        // Skip re-rendering a pillar if user is currently editing an input inside it
        // UNLESS it's a structural change (e.g. adding a phase, delete pot)
        const activeEl = document.activeElement;
        const activePillar = activeEl ? activeEl.closest('.pillar-section') : null;
        const isStructural = this._activeUpdateIsStructural;

        if (isStructural || !activePillar || activePillar.id !== 'pillar-assets') {
            this.renderAssetCards();
        }
        if (isStructural || !activePillar || activePillar.id !== 'pillar-retirement') {
            this.renderRetirementStory(results);
        }
        // ALWAYS re-render results summary so toggles like "Inflation" take effect immediately
        this.renderResultsSummary(results);
    }

    _POT_PRESETS = {
        etf: { label: '📈 ETF', interestRate: 6.0, interestRateRetirement: 4.5, taxRate: 18.5 },
        tagesgeld: { label: '🏦 Tagesgeld', interestRate: 2.5, interestRateRetirement: 2.0, taxRate: 26.375 },
        festgeld: { label: '🔒 Festgeld', interestRate: 3.5, interestRateRetirement: 3.0, taxRate: 26.375 },
        manuell: { label: '✏️ Manuell', interestRate: null, interestRateRetirement: null, taxRate: null },
    };

    getPotColor(i) {
        // Theme-aware primary fallback for index 0
        if (i === 0) {
            const theme = document.documentElement.getAttribute('data-theme') || 'clean';
            const primaries = {
                clean: 'hsl(161, 72%, 40%)',
                edel: 'hsl(145, 45%, 32%)',
                finanz: 'hsl(220, 65%, 45%)',
                senior: 'hsl(25, 35%, 35%)'
            };
            return primaries[theme] || primaries.clean;
        }

        // High quality categorical colors for subsequent pots
        const palette = [
            '#f97316', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', 
            '#10b981', '#3b82f6', '#f43f5e', '#84cc16', '#6366f1', '#14b8a6'
        ];
        return palette[(i - 1) % palette.length];
    }

    _applyPotPreset(index, presetKey) {
        const p = this._POT_PRESETS[presetKey];
        if (!p || p.interestRate === null) return; // 'manuell' = don't change values
        // Persist selected preset key so the dropdown doesn't jump back to 'manuell'
        this.state.data.pots[index]._preset = presetKey;
        this.stateManager.update(`data.pots.${index}.interestRate`, p.interestRate);
        this.stateManager.update(`data.pots.${index}.taxRate`, p.taxRate);
        // Preset update should be immediate and structural to reflect values
        this.updateDashboard(false, true);
    }

    renderAssetCards() {
        const container = document.getElementById('asset-cards-container');
        if (!container) return;

        if (!this._assetViewMode) this._assetViewMode = 'pots';

        const d = this.state.data;
        const pots = d.pots;

        // Thousand-separator display helper
        const fmtN = (v) => Number(v).toLocaleString('de-DE');
        const fmt = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

        container.innerHTML = `
            <div style="display:flex; gap:0.5rem; margin-bottom:1rem; padding:0 0.25rem;">
                <button class="btn btn-sm btn-outline table-filter-btn ${this._assetViewMode === 'pots' ? 'active' : ''}" onclick="app.setAssetView('pots')" style="flex:1; font-size:0.85rem; border-radius:8px; line-height:1;">🏦 Töpfe</button>
                <button class="btn btn-sm btn-outline table-filter-btn ${this._assetViewMode === 'transactions' ? 'active' : ''}" onclick="app.setAssetView('transactions')" style="flex:1; font-size:0.85rem; border-radius:8px; line-height:1;">🔄 Transaktionen</button>
            </div>
        `;

        if (this._assetViewMode === 'pots') {
            // --- NEW: Timeframe (Spar-Zeitraum) at the top of Assets screen ---
            container.innerHTML += `
                <div class="pillar-card" style="margin-bottom:1rem; background:var(--primary-light); border:none;">
                    <h3 style="margin:0 0 1rem 0; font-size:1.1rem; display:flex; align-items:center; gap:0.5rem;">
                        <span>🕒</span> Spar-Zeitraum
                    </h3>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                        <div class="form-group">
                            <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Aktuelles Alter</label>
                            <div class="hybrid-input-wrapper" style="height:40px;">
                                <button class="hybrid-spin-btn minus" style="width:25px; font-size:1rem;" onclick="app.adjustValue(this, -1)">−</button>
                                <input type="number" min="1" max="120" value="${d.currentAge}" onchange="app.updateDataParam('currentAge', this.value)" style="font-size:0.9rem;">
                                <button class="hybrid-spin-btn plus" style="width:25px; font-size:1rem;" onclick="app.adjustValue(this, 1)">+</button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Renten-Beginn</label>
                            <div class="hybrid-input-wrapper" style="height:40px;">
                                <button class="hybrid-spin-btn minus" style="width:25px; font-size:1rem;" onclick="app.adjustValue(this, -1)">−</button>
                                <input type="number" min="1" max="120" value="${d.retirementAge}" onchange="app.updateDataParam('retirementAge', this.value)" style="color:var(--primary); font-size:0.9rem;">
                                <button class="hybrid-spin-btn plus" style="width:25px; font-size:1rem;" onclick="app.adjustValue(this, 1)">+</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;


        if (this._currentPotCarouselIndex === undefined) this._currentPotCarouselIndex = 0;
        const potIdx = Math.min(this._currentPotCarouselIndex, pots.length - 1);
        const pot = pots[potIdx];
        const domRetAge = d.retirementAge;
        if (!pot) return;

        // Thousand-separator display helper
        const fmtN = (v) => Number(v).toLocaleString('de-DE');

        // Arrow navigation (only if multiple pots)
        const prevArrow = potIdx > 0 ? `<button onclick="app.gotoPotsCarousel(${potIdx-1})" style="background:none; border:none; font-size:1.4rem; color:var(--primary); cursor:pointer; padding:0 4px; line-height:1;">◀</button>` : `<span style="width:28px; display:inline-block;"></span>`;
        const nextArrow = potIdx < pots.length-1 ? `<button onclick="app.gotoPotsCarousel(${potIdx+1})" style="background:none; border:none; font-size:1.4rem; color:var(--primary); cursor:pointer; padding:0 4px; line-height:1;">▶</button>` : `<span style="width:28px; display:inline-block;"></span>`;

        // Phase pills — collapsed = chip; expanded = inline form
        if (!this._expandedPhase) this._expandedPhase = {};
        const activePh = this._expandedPhase[potIdx] ?? null;

        const phasePills = (pot.savingsPhases || []).map((ph, phIdx) => {
            const toAgeVal = ph.toAge !== undefined ? ph.toAge : domRetAge;
            const isExpanded = activePh === phIdx;
            const pillLabel = `Ab ${ph.fromAge}\u2013Bis ${toAgeVal}&nbsp;&nbsp;|&nbsp;&nbsp;${fmtN(ph.amount)} \u20ac/Mo`;
            if (isExpanded) {
                return `
                <div style="border:1.5px solid var(--primary); border-radius:12px; padding:0.75rem; margin-bottom:0.5rem; background:var(--primary-light);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
                        <span style="font-size:0.7rem; font-weight:700; color:var(--primary); text-transform:uppercase;">Phase ${phIdx+1} bearbeiten</span>
                        <div style="display:flex; gap:6px; align-items:center;">
                            ${pot.savingsPhases.length > 1 ? `<button class="btn-delete" onclick="app.removeSavingsPhase(${potIdx},${phIdx})" style="padding:2px 6px; font-size:0.75rem;">\u{1F5D1}\uFE0F</button>` : ''}
                            <button onclick="app.collapsePhase(${potIdx})" style="border:none; background:var(--primary); color:white; border-radius:6px; padding:2px 10px; font-size:0.8rem; cursor:pointer; font-weight:700;">&check; OK</button>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:auto 1fr auto 1fr; gap:0.4rem; align-items:center; margin-bottom:0.5rem;">
                        <span style="font-size:0.65rem; font-weight:700; color:var(--text-muted);">AB</span>
                        <div class="hybrid-input-wrapper" style="height:38px; border-radius:6px;">
                            <button class="hybrid-spin-btn minus" style="width:28px;" onclick="app.adjustValue(this,-1)">\u2212</button>
                            <input type="number" min="1" max="120" value="${ph.fromAge}" oninput="app.updateSavingsPhaseDirect(${potIdx},${phIdx},'fromAge',this.value)" style="font-size:0.9rem;">
                            <button class="hybrid-spin-btn plus" style="width:28px;" onclick="app.adjustValue(this,1)">+</button>
                        </div>
                        <span style="font-size:0.65rem; font-weight:700; color:var(--text-muted);">BIS</span>
                        <div class="hybrid-input-wrapper" style="height:38px; border-radius:6px;">
                            <button class="hybrid-spin-btn minus" style="width:28px;" onclick="app.adjustValue(this,-1)">\u2212</button>
                            <input type="number" min="${ph.fromAge}" max="120" value="${toAgeVal}" oninput="app.updateSavingsPhaseDirect(${potIdx},${phIdx},'toAge',this.value)" style="font-size:0.9rem;">
                            <button class="hybrid-spin-btn plus" style="width:28px;" onclick="app.adjustValue(this,1)">+</button>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.4rem;">
                        <span style="font-size:0.65rem; font-weight:700; color:var(--text-muted); white-space:nowrap;">RATE €/Mo</span>
                        <div class="hybrid-input-wrapper" style="height:38px; border-radius:6px; flex:1;">
                            <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this,-50)">−</button>
                            <input type="text" inputmode="numeric" value="${fmtN(ph.amount)}"
                                onfocus="this.value=this.value.replace(/\./g,'')"
                                onblur="this.value=new Intl.NumberFormat('de-DE').format(parseFloat(this.value.replace(/\./g,'').replace(',','.'))||app.state.data.pots[${potIdx}].savingsPhases[${phIdx}].amount)"
                                oninput="app.updateSavingsPhaseDirect(${potIdx},${phIdx},'amount',this.value)">
                            <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this,50)">+</button>
                        </div>
                    </div>
                </div>`;
            } else {
                return `
                <div class="pill-row" onclick="app.expandPhase(${potIdx},${phIdx})" style="--primary: ${this.getPotColor(potIdx)}">
                    <div class="pill-badge" style="background: ${this.getPotColor(potIdx)}15; color: ${this.getPotColor(potIdx)}; border-color: ${this.getPotColor(potIdx)}30">Phase ${phIdx + 1}</div>
                    <div class="pill-label">Ab ${ph.fromAge}\u2013Bis ${toAgeVal}</div>
                    <div class="pill-value" style="color: ${this.getPotColor(potIdx)}">${fmtN(ph.amount)} €</div>
                    <div class="pill-edit-icon">✎</div>
                </div>`;
            }
        }).join('');

        const card = document.createElement('div');
        card.className = `pillar-card pot-branded`;
        card.style.setProperty('--pot-accent', this.getPotColor(potIdx));
        card.innerHTML = `
            <div class="pot-card-header" style="background: ${this.getPotColor(potIdx)}10; border-bottom-color: ${this.getPotColor(potIdx)}">
                ${prevArrow}
                <input type="text" value="${pot.name}" oninput="app.updatePotParamDirect(${potIdx},'name',this.value)" placeholder="Topf-Name..." style="color: ${this.getPotColor(potIdx)}">
                ${nextArrow}
            </div>
            <div style="text-align:center; font-size:0.7rem; font-weight:700; color: ${this.getPotColor(potIdx)}; margin-bottom:0.75rem; opacity:0.8; text-transform:uppercase;">Topf ${potIdx + 1} / ${pots.length}</div>
            <div style="margin-bottom:0.75rem;">
                <label style="font-size:0.6rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; display:block; margin-bottom:0.25rem;">Typ / Preset</label>
                <select onchange="app._applyPotPreset(${potIdx},this.value)" style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:8px; font-size:0.9rem;">
                    ${Object.entries(this._POT_PRESETS).map(([k,v]) => `<option value="${k}" ${(pot._preset||'manuell')===k?'selected':''}>${v.label}</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:0.75rem;">
                <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Startkapital \u20ac</label>
                <div class="hybrid-input-wrapper" style="height:52px;">
                    <button class="hybrid-spin-btn minus" onclick="app.adjustPotValue(${potIdx},-1000)">−</button>
                    <input type="text" inputmode="numeric" value="${fmtN(pot.value)}"
                        onfocus="this.value=this.value.replace(/\./g,'')"
                        onblur="this.value=new Intl.NumberFormat('de-DE').format(parseFloat(this.value.replace(/\./g,'').replace(',','.'))||app.state.data.pots[${potIdx}].value)"
                        oninput="app.updatePotValueDirect(${potIdx}, this.value)">
                    <button class="hybrid-spin-btn plus" onclick="app.adjustPotValue(${potIdx},1000)">+</button>
                </div>
            </div>
            <div style="margin-bottom:0.75rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                    <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Spar-Phasen</label>
                    <button onclick="app.addSavingsPhase(${potIdx})" style="background:none; border:1px solid var(--primary); border-radius:6px; font-size:0.7rem; padding:2px 8px; color:var(--primary); font-weight:700; cursor:pointer;">+ Phase</button>
                </div>
                ${phasePills}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;">
                <div class="form-group">
                    <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Rendite %</label>
                    <div class="hybrid-input-wrapper">
                        <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this,-0.1)">\u2212</button>
                        <input type="number" step="0.1" value="${pot.interestRate}" oninput="app.updatePotParamDirect(${potIdx},'interestRate',this.value)">
                        <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this,0.1)">+</button>
                    </div>
                </div>
                <div class="form-group">
                    <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Steuer %</label>
                    <div class="hybrid-input-wrapper">
                        <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this,-0.1)">\u2212</button>
                        <input type="number" step="0.1" value="${pot.taxRate!==undefined?pot.taxRate:(d.withdrawalTaxRate||0)}" oninput="app.updatePotParamDirect(${potIdx},'taxRate',this.value)">
                        <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this,0.1)">+</button>
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-secondary" onclick="app.addNewPot()" style="flex:1; font-size:0.8rem;">+ Weiterer Topf</button>
                <button class="btn" onclick="app.deletePot(${potIdx})" style="flex:0.6; font-size:0.8rem; color:#ef4444; border:1.5px solid #ef4444; background:white;" ${pots.length===1?'disabled':''}>L\u00f6schen</button>
            </div>
        `;
        container.appendChild(card);

        } else if (this._assetViewMode === 'transactions') {

        // One-time payments/expenses
        const potOptions = (selectedIdx) => {
            let opts = `<option value="all" ${selectedIdx === 'all' ? 'selected' : ''}>Alle T\u00f6pfe (proportional)</option>`;
            d.pots.forEach((p, pIdx) => {
                opts += `<option value="${pIdx}" ${selectedIdx == pIdx ? 'selected' : ''}>${p.name}</option>`;
            });
            return opts;
        };

        const otpCard = document.createElement('div');
        otpCard.className = 'pillar-card';
        otpCard.style.background = '#f8fafc';
        otpCard.innerHTML = `
            <h3 style="margin:0 0 1rem 0; font-size:1.1rem; display:flex; align-items:center; gap:0.5rem;"><span>💰</span> Einmal-Transaktionen</h3>
            
            <!-- EINZAHLUNGEN -->
            <div style="margin-bottom:1.5rem;">
                <label style="font-size:0.75rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.5rem;">EINZAHLUNGEN / BONUS</label>
                ${(d.oneTimePayments || []).map((otp, i) => {
                    const isExpanded = this._expandedOTP === i;
                    return isExpanded ? `
                        <div class="card pot-color-${i%5} animate-in" style="background:white; padding:1rem; border-radius:16px; margin-bottom:0.75rem; border:2px solid var(--primary);">
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;">
                                <div><label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; display:block; margin-bottom:4px;">Alter</label><input type="number" min="1" max="120" value="${otp.age}" oninput="app.updateOneTimePaymentDirect(${i},'age',this.value)" style="height:42px; font-weight:700;"></div>
                                <div>
                                    <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; display:block; margin-bottom:4px;">Betrag (€)</label>
                                    <div class="hybrid-input-wrapper" style="height:42px;">
                                        <button class="hybrid-spin-btn minus" style="width:30px;" onclick="app.adjustValue(this,-1000)">−</button>
                                        <input type="text" inputmode="numeric" value="${fmtN(otp.amount)}"
                                            onfocus="this.value=this.value.replace(/\./g,'')"
                                            onblur="this.value=new Intl.NumberFormat('de-DE').format(parseFloat(this.value.replace(/\./g,'').replace(',','.'))||app.state.data.oneTimePayments[${i}].amount)"
                                            oninput="app.updateOneTimePaymentDirect(${i},'amount',this.value)" style="font-weight:700;">
                                        <button class="hybrid-spin-btn plus" style="width:30px;" onclick="app.adjustValue(this,1000)">+</button>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-bottom:0.75rem;"><label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; display:block; margin-bottom:4px;">Ziel-Topf</label><select onchange="app.updateOneTimePaymentDirect(${i},'targetPotIndex',this.value)" style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:8px; font-size:0.9rem;">${potOptions(otp.targetPotIndex)}</select></div>
                            <div style="display:flex; gap:0.75rem; align-items:flex-end;">
                                <div style="flex:1;"><label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; display:block; margin-bottom:4px;">Stichwort</label><input type="text" value="${otp.description||''}" placeholder="z.B. Bonus" oninput="app.updateOneTimePaymentDirect(${i},'description',this.value)" style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:8px; font-size:0.9rem;"></div>
                                <button class="btn-delete" onclick="app.removeOneTimePayment(${i})" style="height:42px; width:42px;">🗑️</button>
                                <button class="btn btn-primary" onclick="app.toggleOTP(${i})" style="height:42px; padding:0 1rem; border-radius:8px; font-weight:700;">OK</button>
                            </div>
                        </div>
                    ` : `
                        <div class="pill-row" onclick="app.toggleOTP(${i})" style="--primary: ${this.getPotColor(otp.targetPotIndex)}">
                            <div class="pill-badge" style="background: ${this.getPotColor(otp.targetPotIndex)}15; color: ${this.getPotColor(otp.targetPotIndex)}; border-color: ${this.getPotColor(otp.targetPotIndex)}30">Alter ${otp.age}</div>
                            <div class="pill-label">${otp.description || 'Einzahlung'}</div>
                            <div class="pill-value" style="color: ${this.getPotColor(otp.targetPotIndex)}">${fmt(otp.amount)}</div>
                            <div class="pill-edit-icon">✎</div>
                        </div>
                    `;
                }).join('')}
                <button class="btn btn-secondary" onclick="app.addOneTimePayment()" style="width:100%; font-size:0.85rem; padding:10px; border-radius:10px; margin-top:0.5rem;">+ Einzahlung hinzufügen</button>
            </div>

            <!-- AUSGABEN -->
            <div>
                <label style="font-size:0.75rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.5rem;">AUSGABEN / ANSCHAFFUNGEN</label>
                ${(d.oneTimeExpenses || []).map((ote, i) => {
                    const isExpanded = this._expandedOTE === i;
                    return isExpanded ? `
                        <div class="card pot-color-${i%5} animate-in" style="background:white; padding:1rem; border-radius:16px; margin-bottom:0.75rem; border:2px solid #ef4444;">
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;">
                                <div><label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; display:block; margin-bottom:4px;">Alter</label><input type="number" min="1" max="120" value="${ote.age}" oninput="app.updateOneTimeExpenseDirect(${i},'age',this.value)" style="height:42px; font-weight:700;"></div>
                                <div>
                                    <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; display:block; margin-bottom:4px;">Betrag (€)</label>
                                    <div class="hybrid-input-wrapper" style="height:42px;">
                                        <button class="hybrid-spin-btn minus" style="width:30px;" onclick="app.adjustValue(this,-1000)">−</button>
                                        <input type="text" inputmode="numeric" value="${fmtN(ote.amount)}"
                                            onfocus="this.value=this.value.replace(/\./g,'')"
                                            onblur="this.value=new Intl.NumberFormat('de-DE').format(parseFloat(this.value.replace(/\./g,'').replace(',','.'))||app.state.data.oneTimeExpenses[${i}].amount)"
                                            oninput="app.updateOneTimeExpenseDirect(${i},'amount',this.value)" style="font-weight:700;">
                                        <button class="hybrid-spin-btn plus" style="width:30px;" onclick="app.adjustValue(this,1000)">+</button>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-bottom:0.75rem;"><label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; display:block; margin-bottom:4px;">Entnahme aus</label><select onchange="app.updateOneTimeExpenseDirect(${i},'targetPotIndex',this.value)" style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:8px; font-size:0.9rem;">${potOptions(ote.targetPotIndex)}</select></div>
                            <div style="display:flex; gap:0.75rem; align-items:flex-end;">
                                <div style="flex:1;"><label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; display:block; margin-bottom:4px;">Zweck</label><input type="text" value="${ote.description||''}" placeholder="z.B. Weltreise" oninput="app.updateOneTimeExpenseDirect(${i},'description',this.value)" style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:8px; font-size:0.9rem;"></div>
                                <button class="btn-delete" onclick="app.removeOneTimeExpense(${i})" style="height:42px; width:42px;">🗑️</button>
                                <button class="btn btn-primary" onclick="app.toggleOTE(${i})" style="height:42px; background:#ef4444; border-color:#ef4444; padding:0 1rem; border-radius:8px; font-weight:700;">OK</button>
                            </div>
                        </div>
                    ` : `
                        <div class="pill-row" onclick="app.toggleOTE(${i})" style="--primary: ${this.getPotColor(ote.targetPotIndex)}">
                            <div class="pill-badge" style="background:#fee2e2; color:#ef4444; border-color:#fecaca;">Alter ${ote.age}</div>
                            <div class="pill-label">${ote.description || 'Ausgabe'}</div>
                            <div class="pill-value" style="color:#ef4444;">-${fmt(ote.amount)}</div>
                            <div class="pill-edit-icon">✎</div>
                        </div>
                    `;
                }).join('')}
                <button class="btn btn-secondary" onclick="app.addOneTimeExpense()" style="width:100%; font-size:0.85rem; padding:10px; border-radius:10px; margin-top:0.5rem;">+ Ausgabe hinzufügen</button>
            </div>
        `;
        container.appendChild(otpCard);

        }

        // Inflation Card (always visible at bottom)
        const inflationCard = document.createElement('div');
        inflationCard.className = 'pillar-card';
        inflationCard.style.background = 'var(--primary-light)';
        inflationCard.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.75rem;">
                <span style="font-size:1.5rem;">\u{1F4C8}</span>
                <div style="flex:1;">
                    <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Globale Inflation %</label>
                    <div class="hybrid-input-wrapper">
                        <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this,-0.1)">\u2212</button>
                        <input type="number" step="0.1" value="${d.inflationRate}" oninput="app.updateDataParamDirect('inflationRate',this.value)">
                        <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this,0.1)">+</button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(inflationCard);
    }

    setAssetView(mode) {
        this._assetViewMode = mode;
        this.renderAssetCards();
    }

    gotoPotsCarousel(idx) {
        this._currentPotCarouselIndex = idx;
        this._expandedPhase = {};
        this.renderAssetCards();
    }

    expandPhase(potIdx, phIdx) {
        if (!this._expandedPhase) this._expandedPhase = {};
        this._expandedPhase[potIdx] = phIdx;
        this.renderAssetCards();
    }

    collapsePhase(potIdx) {
        if (this._expandedPhase) this._expandedPhase[potIdx] = null;
        this.renderAssetCards();
    }

    renderRetirementStory(results) {
        const container = document.getElementById('pillar-retirement');
        if (!container) return;
        const d = this.state.data;

        // Preserve active tab across re-renders; default to 'bedarf'
        const activeTab = this._retStoryTab || 'bedarf';

        // Thousand-separator display helper
        const fmtN = (v) => Number(v).toLocaleString('de-DE');

        // ── Build Bedarf panel HTML ──────────────────────────────────────
        const bedarfHtml = (d.retirementPhases || []).map((ph, idx) => {
            const isExp = (this._expandedRetPhase === idx);
            if (isExp) {
                return `
                <div style="border:1.5px solid var(--primary); border-radius:12px; padding:0.75rem; margin-bottom:0.5rem; background:var(--primary-light);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
                        <span style="font-size:0.7rem; font-weight:700; color:var(--primary); text-transform:uppercase;">Phase ${idx+1} bearbeiten</span>
                        <div style="display:flex; gap:6px;">
                            ${d.retirementPhases.length > 1 ? `<button class="btn-delete" onclick="app.removeRetirementPhase(${idx})" style="padding:2px 6px; font-size:0.75rem;">&#128465;&#65039;</button>` : ''}
                            <button onclick="app._expandedRetPhase=null; app.renderRetirementStory(app.simulationResults)" style="border:none; background:var(--primary); color:white; border-radius:6px; padding:2px 10px; font-size:0.8rem; cursor:pointer; font-weight:700;">&check; OK</button>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:auto 1fr; gap:0.5rem; align-items:center; margin-bottom:0.5rem;">
                        <span style="font-size:0.65rem; font-weight:700; color:var(--text-muted); white-space:nowrap;">AB ALTER</span>
                        <div class="hybrid-input-wrapper" style="height:38px;">
                            <button class="hybrid-spin-btn minus" style="width:28px;" onclick="app.adjustValue(this,-1)">−</button>
                            <input type="number" min="1" max="120" value="${ph.fromAge}" oninput="app.updateRetirementPhaseDirect(${idx},'fromAge',this.value)" style="font-size:0.9rem;">
                            <button class="hybrid-spin-btn plus" style="width:28px;" onclick="app.adjustValue(this,1)">+</button>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.4rem;">
                        <span style="font-size:0.65rem; font-weight:700; color:var(--text-muted); white-space:nowrap;">BEDARF €/Mo</span>
                        <div class="hybrid-input-wrapper" style="height:38px; border-radius:6px; flex:1;">
                            <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this,-100)">−</button>
                            <input type="text" inputmode="numeric" value="${fmtN(ph.monthlyAmount)}"
                                onfocus="this.value=this.value.replace(/\\./g,'')"
                                onblur="this.value=new Intl.NumberFormat('de-DE').format(parseFloat(this.value.replace(/\\./g,'').replace(',','.'))||app.state.data.retirementPhases[${idx}].monthlyAmount)"
                                oninput="app.updateRetirementPhaseDirect(${idx},'monthlyAmount',this.value)">
                            <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this,100)">+</button>
                        </div>
                    </div>
                </div>`;
            } else {
                return `
                <div class="pill-row" onclick="app._expandedRetPhase=${idx}; app.renderRetirementStory(app.simulationResults)">
                    <div class="pill-badge">Phase ${idx + 1}</div>
                    <div class="pill-label">Ab Alter ${ph.fromAge}</div>
                    <div class="pill-value">${Number(ph.monthlyAmount).toLocaleString('de-DE')} \u20ac/Mo</div>
                    <div class="pill-edit-icon">✎</div>
                </div>`;
            }
        }).join('');

        // ── Build Renten panel HTML ──────────────────────────────────────
        const rentenHtml = (d.pensions || []).map((p, i) => {
            const isExp = (this._expandedPension === i);
            const amt = Number(p.amount || 0).toLocaleString('de-DE');
            const startAge = p.startAge || d.retirementAge;
            if (isExp) {
                return `
                <div style="border:1.5px solid var(--primary); border-radius:12px; padding:0.75rem; margin-bottom:0.5rem; background:var(--primary-light);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.7rem;">
                        <input type="text" value="${p.label}" oninput="app.updatePensionParamDirect(${i},'label',this.value)"
                            style="border:none; background:transparent; font-weight:700; font-size:0.95rem; color:var(--primary); flex:1; min-width:0;">
                        <div style="display:flex; gap:6px; align-items:center;">
                            ${d.pensions.length > 1 ? `<button class="btn-delete" onclick="app.removePension(${i})" style="padding:2px 6px;">🗑️</button>` : ''}
                            <button onclick="app._expandedPension=null; app.renderRetirementStory(app.simulationResults)" style="border:none; background:var(--primary); color:white; border-radius:6px; padding:2px 10px; font-size:0.8rem; cursor:pointer; font-weight:700;">&check; OK</button>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:auto 1fr; gap:0.45rem; align-items:center;">
                        <span style="font-size:0.65rem; font-weight:700; color:var(--text-muted); white-space:nowrap;">€ / Mo</span>
                        <div class="hybrid-input-wrapper" style="height:38px;">
                            <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this,-50)">−</button>
                            <input type="text" inputmode="numeric" value="${fmtN(p.amount)}"
                                onfocus="this.value=this.value.replace(/\\./g,'')"
                                onblur="this.value=new Intl.NumberFormat('de-DE').format(parseFloat(this.value.replace(/\\./g,'').replace(',','.'))||app.state.data.pensions[${i}].amount)"
                                oninput="app.updatePensionParamDirect(${i},'amount',this.value)">
                            <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this,50)">+</button>
                        </div>
                        <span style="font-size:0.65rem; font-weight:700; color:var(--text-muted); white-space:nowrap;">AB ALTER</span>
                        <div class="hybrid-input-wrapper" style="height:38px;">
                            <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this,-1)">−</button>
                            <input type="number" min="1" max="120" value="${startAge}" oninput="app.updatePensionParamDirect(${i},'startAge',this.value)">
                            <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this,1)">+</button>
                        </div>
                        <span style="font-size:0.65rem; font-weight:700; color:var(--text-muted); white-space:nowrap;">STEIGERUNG %</span>
                        <div class="hybrid-input-wrapper" style="height:38px;">
                            <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this,-0.1)">−</button>
                            <input type="number" step="0.1" value="${p.growth || 0}" oninput="app.updatePensionParamDirect(${i},'growth',this.value)">
                            <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this,0.1)">+</button>
                        </div>
                    </div>
                </div>`;
            } else {
                return `
                <div class="pill-row" onclick="app._expandedPension=${i}; app.renderRetirementStory(app.simulationResults)">
                    <div class="pill-badge" style="min-width:80px;">${p.label || 'Rente'}</div>
                    <div class="pill-label">Ab Alter ${startAge}</div>
                    <div class="pill-value">${amt} \u20ac/Mo</div>
                    <div class="pill-edit-icon">✎</div>
                </div>`;
            }
        }).join('');

        container.innerHTML = `
            <!-- 🕒 Planungs-Horizont (always visible) -->
            <div class="pillar-card" style="margin-bottom:1rem; background:var(--primary-light); border:none;">
                <h3 style="margin:0 0 1rem 0; font-size:1.1rem; display:flex; align-items:center; gap:0.5rem;">
                    <span>🕒</span> Renten-Zeitplan
                </h3>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                    <div class="form-group">
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Renten-Beginn</label>
                        <div class="hybrid-input-wrapper" style="height:40px;">
                            <button class="hybrid-spin-btn minus" style="width:25px; font-size:1rem;" onclick="app.adjustValue(this, -1)">−</button>
                            <input type="number" min="1" max="120" value="${d.retirementAge}" oninput="app.updateDataParamDirect('retirementAge', this.value)" style="color:var(--primary); font-size:0.9rem;">
                            <button class="hybrid-spin-btn plus" style="width:25px; font-size:1rem;" onclick="app.adjustValue(this, 1)">+</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Ende Planung</label>
                        <div class="hybrid-input-wrapper" style="height:40px;">
                            <button class="hybrid-spin-btn minus" style="width:25px; font-size:1rem;" onclick="app.adjustValue(this, -1)">−</button>
                            <input type="number" min="1" max="120" value="${d.endAge}" oninput="app.updateDataParamDirect('endAge', this.value)" style="font-size:0.9rem;">
                            <button class="hybrid-spin-btn plus" style="width:25px; font-size:1rem;" onclick="app.adjustValue(this, 1)">+</button>
                        </div>
                    </div>
                </div>
                <div style="text-align:center; font-size:0.7rem; color:var(--text-muted); margin-top:0.5rem;">
                    Dauer des Ruhestands: <strong>${d.endAge - d.retirementAge} Jahre</strong>
                </div>
            </div>

            <!-- Tab-Leiste -->
            <div class="ret-sub-tabs">
                <button class="ret-sub-tab ${activeTab === 'bedarf' ? 'active' : ''}"
                        onclick="app.switchRetStoryTab('bedarf')">🌄 Mein Bedarf</button>
                <button class="ret-sub-tab ${activeTab === 'renten' ? 'active' : ''}"
                        onclick="app.switchRetStoryTab('renten')">🏛️ Renten &amp; Einkünfte</button>
            </div>

            <!-- Panel: Mein Bedarf -->
            <div class="pillar-card card-expenses" style="${activeTab === 'bedarf' ? '' : 'display:none;'}">
                ${bedarfHtml}
                <button class="btn btn-secondary" onclick="app.addRetirementPhase()" style="width:100%; font-size:0.85rem;">+ Neue Bedarfsphase</button>
            </div>

            <!-- Panel: Renten & Einkünfte -->
            <div class="pillar-card card-pensions" style="${activeTab === 'renten' ? '' : 'display:none;'}">
                ${rentenHtml}
                <button class="btn btn-secondary" onclick="app.addPension()" style="width:100%; font-size:0.85rem;">+ Rentenquelle hinzufügen</button>
            </div>

            <!-- ⚖️ Auszahlungs-Strategie (always visible) -->
            <div class="pillar-card" style="background:var(--primary-light); border:none;">
                <h3 style="margin:0 0 1rem 0; font-size:1.1rem; display:flex; align-items:center; gap:0.5rem;">
                    <span>⚖️</span> Auszahlungs-Strategie
                </h3>
                <div class="form-group" style="margin-bottom:0;">
                    <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Wie soll entnommen werden?</label>
                    <select onchange="app.updateDataParam('withdrawalStrategy', this.value)"
                            style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:8px; font-weight:700;">
                        <option value="proportional" ${d.withdrawalStrategy === 'proportional' ? 'selected' : ''}>Proportional (Alle gleichzeitig)</option>
                        <option value="sequential" ${d.withdrawalStrategy === 'sequential' ? 'selected' : ''}>Sequentiell (In fester Reihe)</option>
                    </select>
                </div>
            </div>
        `;
    }

    switchRetStoryTab(panel) {
        this._retStoryTab = panel;
        this.renderRetirementStory(this.simulationResults);
    }
    setWithdrawalTaxPreset(rate) {
        this.stateManager.update('data.withdrawalTaxRate', rate);
    }

    renderResultsSummary(results) {
        const container = document.getElementById('pillar-results');
        if (!container) return;
        const last = results[results.length - 1];
        const fmt = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

        // Calculate security info
        const exhaustionRow = results.find(r => r.totalWealth < 0);
        const exhaustionAge = exhaustionRow ? exhaustionRow.age : null;
        const finalWealth = last.totalWealth;
        const lastYearExpenses = last.expenses || 1;
        const yearsOfBuffer = finalWealth / lastYearExpenses;

        let securityLabel, securityColor, securityBg, securityBorder, securityDetail;
        if (exhaustionAge !== null) {
            securityLabel = `⚠️ Lücke ab ${exhaustionAge}`;
            securityColor = '#991b1b';
            securityBg = '#fef2f2';
            securityBorder = '#fecaca';
            securityDetail = `⚠️ <strong>Vorsicht:</strong> In dieser Simulation ist dein Vermögen bereits mit <strong>Alter ${exhaustionAge}</strong> aufgebraucht. Ab diesem Zeitpunkt entsteht eine monatliche Lücke, die nicht mehr aus Ersparten gedeckt werden kann.<br><br>Empfehlung: Sparrate erhöhen, Rentenbeginn hinauszögern oder das Wunsch-Budget überprüfen.`;
        } else if (yearsOfBuffer >= 3) {
            const bufferText = Number.isFinite(yearsOfBuffer) ? yearsOfBuffer.toFixed(1) : '>50';
            securityLabel = '✅ Sicher';
            securityColor = '#166534';
            securityBg = '#f0fdf4';
            securityBorder = '#bbf7d0';
            securityDetail = `✅ <strong>Hervorragend:</strong> Dein Plan steht auf einem soliden Fundament. Das rechnerische Restvermögen deckt deine geplanten Ausgaben für <strong>weitere ca. ${bufferText} Jahre</strong> ab.<br><br>Selbst Marktschwankungen oder eine etwas höhere Inflation sollten diesen Plan nicht so leicht aus der Bahn werfen. Du bist auf einem sehr guten Weg!`;
        } else {
            securityLabel = '⚡ Knapp';
            securityColor = '#92400e';
            securityBg = '#fffbeb';
            securityBorder = '#fde68a';
            securityDetail = `⚖️ <strong>Knapp kalkuliert:</strong> Dein Plan geht rechnerisch auf, aber du hast nur einen Puffer von <strong>${yearsOfBuffer.toFixed(1)} Jahren</strong>.<br><br>Schon kleine Änderungen (höhere Inflation oder geringere Rendite) könnten zu einer Lücke führen. Überlege, ob du eine zusätzliche Sicherheitsmarge einplanen möchtest.`;
        }

        // Refactor: Only update innerHTML if basic structure is missing
        // This prevents the <canvas> from being destroyed and recreated on every input
        if (!container.querySelector('#wealthChartMobile')) {
            container.innerHTML = `
                <div class="pillar-card" style="padding:0.75rem; margin-top:0;">
                    <h3 style="margin:0 0 1rem 0; font-size:1.1rem; display:flex; align-items:center; gap:0.5rem;">
                        <span>📈</span> Vermögensentwicklung
                    </h3>
                    <div style="height:250px; position:relative;">
                        <canvas id="wealthChartMobile"></canvas>
                    </div>
                    <div style="display:flex; justify-content:center; margin-top:1rem;">
                        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                            <input type="checkbox" id="chk-purchasing-power" oninput="app.togglePurchasingPower(this.checked)" style="width:20px; height:20px;">
                            <span style="font-size:0.85rem; font-weight:600;">Inflation berücksichtigen (Realwert)</span>
                        </label>
                    </div>
                </div>

                <div class="kpi-row-compact" style="margin-bottom:1rem;">
                    <div id="final-wealth-box" class="stat-box-small" style="grid-column:1/-1;">
                        <div class="stat-label-small">Endvermögen</div>
                        <div id="final-wealth-value" class="stat-value-small"></div>
                    </div>
                </div>

                <!-- Security Check Card -->
                <div id="security-card" class="pillar-card" style="margin-bottom:1rem; padding:1.25rem;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                        <div>
                            <div style="font-size:0.65rem; font-weight:700; text-transform:uppercase; margin-bottom:0.25rem;">Sicherheitscheck</div>
                            <div id="security-label" style="font-size:1.3rem; font-weight:900;"></div>
                        </div>
                        <div style="font-size:2rem;">🛡️</div>
                    </div>
                    <p id="dashboard-security-detail" style="font-size:0.85rem; margin:0; line-height:1.6;"></p>
                    <div id="security-advice" style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid rgba(0,0,0,0.08); font-size:0.8rem; opacity:0.75; line-height:1.5;">
                        💡 <strong>Kaufkraft-Check:</strong> Der Puffer wird auf Basis des inflationierten Preisniveaus am Ende der Simulation berechnet.<br>
                        <em style="opacity:0.7;">Keine Anlageberatung.</em>
                    </div>
                </div>

                <button class="btn btn-outline" onclick="app.toggleDetailsTable()" style="width:100%; border-radius:12px; padding:12px; font-weight:700; margin-bottom:1rem;">
                    <span id="btn-details-text">Jahrestabelle anzeigen</span> 🔍
                </button>
                
                <div id="mobile-table-wrapper" style="display:none;">
                    <div class="landscape-hint">🔄 Tipp: Für mehr Details Handy drehen</div>
                    <div style="display:flex; gap:0.5rem; margin-bottom:1rem; padding:0 0.25rem;">
                        <button class="btn btn-sm btn-outline table-filter-btn" data-filter="all" onclick="app.setTableFilter('all')" style="flex:1; font-size:0.75rem; border-radius:8px;">Alle</button>
                        <button class="btn btn-sm btn-outline table-filter-btn" data-filter="sparphase" onclick="app.setTableFilter('sparphase')" style="flex:1; font-size:0.75rem; border-radius:8px;">Sparphase</button>
                        <button class="btn btn-sm btn-outline table-filter-btn" data-filter="rentenphase" onclick="app.setTableFilter('rentenphase')" style="flex:1; font-size:0.75rem; border-radius:8px;">Rentenphase</button>
                    </div>
                    <div id="mobile-details-table" class="table-scroll-container"></div>
                </div>
            `;
        }

        // 2. Efficiently update only changed values
        const finalWealthValue = container.querySelector('#final-wealth-value');
        const finalWealthBox = container.querySelector('#final-wealth-box');
        const securityCard = container.querySelector('#security-card');
        const securityLabelEl = container.querySelector('#security-label');
        const securityDetailEl = container.querySelector('#dashboard-security-detail');
        const securityAdviceEl = container.querySelector('#security-advice');
        const chkPurchasingPower = container.querySelector('#chk-purchasing-power');

        if (finalWealthValue) finalWealthValue.textContent = fmt(Math.max(0, finalWealth));
        if (finalWealthBox) {
            finalWealthBox.style.background = '#f0fdf4';
            finalWealthBox.style.borderColor = '#bbf7d0';
            finalWealthBox.querySelector('.stat-label-small').style.color = '#166534';
            finalWealthValue.style.color = '#166534';
        }

        if (securityCard) {
            securityCard.style.background = securityBg;
            securityCard.style.borderColor = securityBorder;
            securityCard.style.color = securityColor;
            if (securityLabelEl) {
                securityLabelEl.textContent = securityLabel;
                securityLabelEl.style.color = securityColor;
            }
            if (securityDetailEl) {
                securityDetailEl.innerHTML = securityDetail;
                securityDetailEl.style.color = securityColor;
            }
            if (securityAdviceEl) securityAdviceEl.style.color = securityColor;
        }

        if (chkPurchasingPower) chkPurchasingPower.checked = this.state.data.showPurchasingPower;

        // 3. Update table if visible
        if (document.getElementById('mobile-table-wrapper')?.style.display !== 'none') {
            this.renderResultsTable();
        }

        // 4. Update chart (ChartRenderer now uses .update() instead of .destroy())
        this.chartRenderer.render(results, this.state.data);
    }

    renderResultsTable() {
        let results = this.simulationResults;
        const d = this.state.data;
        const el = document.getElementById('mobile-details-table');
        if (!el || !results || results.length === 0) return;

        // Apply filtering
        if (this.tableFilter === 'sparphase') {
            results = results.filter(r => r.age < d.retirementAge);
        } else if (this.tableFilter === 'rentenphase') {
            results = results.filter(r => r.age >= d.retirementAge);
        }

        // TableRenderer.render() looks for <table> + <tbody> inside the container.
        // We must inject the skeleton first so querySelector finds the elements.
        el.innerHTML = `
            <table class="results-table" style="width:100%; border-collapse:collapse; font-size:0.82rem;">
                <thead><tr></tr></thead>
                <tbody></tbody>
            </table>`;

        const tableRenderer = new TableRenderer('#mobile-details-table table');
        tableRenderer.render(results, d,
            (row) => this.toggleRow(row),
            (age) => this.openDetailModal(age),
            (age, pots) => this.openRealityCheck(age, pots)
        );
    }

    setTableFilter(filter) {
        this.tableFilter = filter;
        this.renderResultsTable();
        // Update active class on filter buttons
        document.querySelectorAll('.table-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
    }

    toggleDetailsTable() {
        const wrapper = document.getElementById('mobile-table-wrapper');
        const btnText = document.getElementById('btn-details-text');
        if (!wrapper) return;

        const isShowing = wrapper.style.display !== 'none';
        if (isShowing) {
            wrapper.style.display = 'none';
            if (btnText) btnText.textContent = 'Jahrestabelle anzeigen';
        } else {
            wrapper.style.display = 'block';
            if (btnText) btnText.textContent = 'Tabelle ausblenden';
            this.renderResultsTable();
        }
    }

    // --- NAVIGATION ---
    showLandingPage() {
        this.showView('landing-page');
    }

    startSetup() {
        this.stateManager.setData(emptyState.data);
        this.stateManager.state.step = 0;
        this.showView('wizard-container');
        this.renderStep();
    }

    finishSetup() {
        this.showView('view-dashboard');
        this.updateDashboard(false, true); // Force structural update to ensure all pillars populate
        // Default to results pillar on mobile
        setTimeout(() => this.showPillar('results'), 50);
        
        if (!this._swipeInited) {
            const editorBody = document.querySelector('.editor-body');
            if (editorBody) this.editorRenderer.initSwipeGestures(editorBody);
            this._swipeInited = true;
        }
    }

    loadExampleData() {
        this.stateManager.setData(initialState.data);
        this.finishSetup();
    }

    showView(id) {
        ['landing-page', 'wizard-container', 'view-dashboard', 'help-screen'].forEach(v => {
            let display = 'none';
            if (v === id) {
                if (v === 'landing-page' || v === 'wizard-container') display = 'flex';
                else display = 'block';
            }
            const el = document.getElementById(v);
            if (el) el.style.display = display;
        });
    }

    adjustValue(btn, delta) {
        const input = btn.parentElement.querySelector('input');
        if (!input) return;

        let rawValue = input.value;
        // CURRENCY fields typically use type="text" and inputmode="numeric" with thousand-separators
        // PERCENTAGE/AGE fields typically use type="number" or type="text" without thousand-separators
        const isCurrency = input.getAttribute('inputmode') === 'numeric' || input.id?.includes('amount') || input.id?.includes('value');

        if (input.type === 'text' && isCurrency) {
            rawValue = rawValue.replace(/\./g, '').replace(',', '.');
        } else {
            // For rates and ages, only comma-to-dot replacement, NO thousand-separator stripping
            rawValue = rawValue.replace(',', '.');
        }
        
        const currentVal = parseFloat(rawValue) || 0;
        const newVal = currentVal + delta;
        
        // Respect min/max attributes if present
        const min = input.getAttribute('min');
        const max = input.getAttribute('max');
        if (min !== null && newVal < parseFloat(min)) return;
        if (max !== null && newVal > parseFloat(max)) return;

        // Update value (rounding handles floating point precision issues)
        // If it was a rate, keep decimals.
        const precision = (Math.abs(delta) < 1) ? 3 : 1; 
        input.value = parseFloat(newVal.toFixed(precision));
        
        // Trigger both events so all listeners are covered (change for our handlers, input for others)
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Dedicated adjuster for Startkapital (reads from state to avoid formatted-string parsing issues)
    adjustPotValue(potIdx, delta) {
        const current = this.state.data.pots[potIdx]?.value || 0;
        const newVal = Math.max(0, current + delta);
        this.updatePotParam(potIdx, 'value', newVal);
    }

    // Direct in-place update for pots value that does NOT trigger a re-render of the editor pillar
    updatePotValueDirect(index, rawValue) {
        const clean = rawValue.replace(/\./g, '').replace(',', '.');
        const val = parseFloat(clean) || 0;
        this.state.data.pots[index].value = val;

        if (this._updateTimer) clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => { this.updateDashboard(false, false); }, 300);
    }

    updateOneTimePaymentDirect(idx, key, value) {
        if (key === undefined) { // Compatibility for older "just amount" calls
            key = 'amount';
        }
        let parsed = value;
        if (key === 'amount') {
            parsed = parseFloat(String(value).replace(/\./g, '').replace(',', '.')) || 0;
        } else if (key === 'age') {
            parsed = parseInt(value, 10) || 0;
            parsed = Math.max(1, Math.min(120, parsed));
        }
        this.state.data.oneTimePayments[idx][key] = parsed;
        if (this._updateTimer) clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => { this.updateDashboard(false, false); }, 500);
    }

    updateOneTimeExpenseDirect(idx, key, value) {
        if (key === undefined) {
            key = 'amount';
        }
        let parsed = value;
        if (key === 'amount') {
            parsed = parseFloat(String(value).replace(/\./g, '').replace(',', '.')) || 0;
        } else if (key === 'age') {
            parsed = parseInt(value, 10) || 0;
            parsed = Math.max(1, Math.min(120, parsed));
        }
        this.state.data.oneTimeExpenses[idx][key] = parsed;
        if (this._updateTimer) clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => { this.updateDashboard(false, false); }, 500);
    }

    updateRetirementPhaseDirect(idx, key, value) {
        if (key === undefined) {
            key = 'monthlyAmount';
        }
        let parsed = value;
        if (key === 'monthlyAmount') {
            parsed = parseFloat(String(value).replace(/\./g, '').replace(',', '.')) || 0;
        } else if (key === 'fromAge') {
            parsed = parseInt(value, 10) || 0;
            parsed = Math.max(1, Math.min(120, parsed));
        }
        this.state.data.retirementPhases[idx][key] = parsed;
        if (this._updateTimer) clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => { this.updateDashboard(false, false); }, 500);
    }

    // Generic pension direct update - superseded by updatePensionParamDirect
    // (keeping for safety if some old code still calls it, but redirected to amount)
    updatePensionDirect(index, rawValue) {
        this.updatePensionParamDirect(index, 'amount', rawValue);
    }

    // --- MOBILE SPECIFIC ---
    showPillar(pillarId) {
        // Toggle Sections
        document.querySelectorAll('.pillar-section').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(`pillar-${pillarId}`);
        if (target) target.classList.add('active');

        // Toggle Nav Icons
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        const navItem = document.getElementById(`nav-${pillarId}`);
        if (navItem) navItem.classList.add('active');

        // Ensure proper chart resize if showing results
        if (pillarId === 'results' && this.chartRenderer && this.chartRenderer.chart) {
            this.chartRenderer.chart.resize();
        }
    }

    // --- THEME MANAGEMENT ---
    initTheme() {
        const savedTheme = localStorage.getItem('rp-theme') || 'clean';
        this.setTheme(savedTheme, false); // Don't show toast on first load
    }

    setTheme(theme, showToast = true) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('rp-theme', theme);
        
        // We don't necessarily need to trigger a full updateDashboard here 
        // if another update is already queued or if we are just initializing.
        // But for interactive switching, we need to refresh the chart.
        if (this.simulationResults.length > 0 && showToast) {
            this.updateDashboard();
        }

        if (showToast) {
            const names = { clean: 'Clean (Standard)', edel: 'Edel (Waldgrün)', finanz: 'Finanz (Vertrauen)', senior: 'Senior (Wärme)' };
            this.showToast(`✨ Design auf „${names[theme] || theme}“ aktualisiert`, 'success');
        }

        // Close menu if open
        const menu = document.getElementById('header-menu');
        if (menu) menu.style.display = 'none';
    }

    toggleMenu() {
        const menu = document.getElementById('header-menu');
        if (!menu) return;
        const isVisible = menu.style.display === 'flex';
        menu.style.display = isVisible ? 'none' : 'flex';

        if (!isVisible) {
            const closer = (e) => {
                if (!menu.contains(e.target) && e.target.id !== 'menu-trigger') {
                    menu.style.display = 'none';
                    document.removeEventListener('click', closer);
                }
            };
            setTimeout(() => document.addEventListener('click', closer), 10);
        }
    }

    // --- HELP SYSTEM ---
    showHelp(cardId = null) {
        this._previousView = Array.from(document.querySelectorAll('.animate-in')).find(v => v.style.display !== 'none')?.id || 'view-dashboard';
        this.showView('help-screen');
        if (!this._helpInited) {
            this.renderHelpContent();
            this._helpInited = true;
        }
        if (cardId) {
            this.deepLinkHelp(cardId);
        } else {
            window.scrollTo(0, 0);
        }
    }

    closeHelp() {
        this.showView(this._previousView || 'view-dashboard');
    }

    renderHelpContent() {
        const container = document.getElementById('help-content');
        if (!container) return;

        const cards = [
            {
                id: 'karte-1', num: 1, icon: '🗺️', title: 'Wie benutze ich dieses Tool?', teaser: 'Der Ablauf in 4 Schritten', content: `
                <p>Das Tool führt dich in vier Schritten zu deinem persönlichen Ruhestandsplan:</p>
                <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
                    <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.8rem;">
                        <div style="width:24px;height:24px;background:var(--primary);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.7rem;flex-shrink:0;">1</div>
                        <div><strong>Wizard:</strong><br>Grunddaten eingeben — Alter, Sparrate, Töpfe. Ca. 5 Minuten.</div>
                    </div>
                    <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.8rem;">
                        <div style="width:24px;height:24px;background:var(--primary);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.7rem;flex-shrink:0;">2</div>
                        <div><strong>Dashboard:</strong><br>Vermögensverlauf und Kennzahlen auf einen Blick.</div>
                    </div>
                    <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.8rem;">
                        <div style="width:24px;height:24px;background:var(--primary);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.7rem;flex-shrink:0;">3</div>
                        <div><strong>Anpassen:</strong><br>Werte ändern, Chart reagiert sofort — einfach ausprobieren.</div>
                    </div>
                    <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.8rem;">
                        <div style="width:24px;height:24px;background:var(--primary);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.7rem;flex-shrink:0;">4</div>
                        <div><strong>Speichern:</strong><br>Plan per Passwort als Datei sichern — kein Server, alles lokal.</div>
                    </div>
                </div>
                <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px;">
                    <div style="font-size:0.78rem;font-weight:600;margin-bottom:6px;">📊 Den Chart lesen</div>
                    <p style="font-size:0.8rem;">Die Kurve zeigt dein Vermögen Jahr für Jahr. Bleibt sie über null — alles gut. Fällt sie darunter, entsteht eine Lücke. Ganz rechts siehst du, wie viel am Ende übrig bleibt.</p>
                </div>
                <div class="merksatz">✅ Du kannst nichts kaputt machen — Werte ändern und schauen, was passiert.</div>
            `},
            {
                id: 'karte-2', num: 2, icon: '🌅', title: 'Dein Plan in Phasen denken', teaser: 'Ausgaben schwanken — Sparraten auch', content: `
                <p>Der Ruhestand ist kein gleichförmiger Block. Dein Bedarf verändert sich — nach oben und nach unten.</p>
                <div style="display:flex;flex-direction:column;gap:6px;margin:10px 0;">
                    <div style="display:flex;gap:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 10px;font-size:0.78rem;">
                        <span>🏃</span>
                        <div><strong>Aktiver Ruhestand (60–75)</strong><br>Reisen, Hobbys, Restaurantbesuche — oft <strong>höhere</strong> Ausgaben als erwartet.</div>
                    </div>
                     <div style="display:flex;gap:10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 10px;font-size:0.78rem;">
                        <span>🛋️</span>
                        <div><strong>Ruhigerer Ruhestand (75–85)</strong><br>Langsameres Leben, weniger Konsum — Ausgaben oft <strong>niedriger</strong>.</div>
                    </div>
                    <div style="display:flex;gap:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;font-size:0.78rem;">
                        <span>🏥</span>
                        <div><strong>Später Ruhestand (85+)</strong><br>Pflege, Unterstützung, Heimkosten — Ausgaben können wieder <strong>stark steigen</strong>.</div>
                    </div>
                </div>
                <p>Im Tool bildest du das ab, indem du mehrere <strong>Ruhestands-Phasen</strong> einträgst — jede mit eigenem monatlichen Bedarf ab einem bestimmten Alter. Das Prinzip gilt genauso für die Sparphase.</p>
                <p style="margin-top:10px;">Für größere Einmalausgaben — Weltreise, Umbau, neues Auto — gibt es die <strong>„Einmalige Ausgaben"</strong>-Funktion: Betrag und Alter eintragen, der Betrag wird einmalig vom Vermögen abgezogen.</p>
                <div class="merksatz">✅ Ein realistischer Plan hat mindestens zwei Phasen: einen aktiven Ruhestand mit höherem Bedarf — und einen ruhigeren mit niedrigerem.</div>
            `},
            {
                id: 'karte-3', num: 3, icon: '📈', title: 'Zins & Zinseszins', teaser: 'Zeit ist dein größter Hebel', content: `
                <p>Zins bedeutet: Dein Geld bringt Geld. Im nächsten Jahr wächst nicht nur dein ursprüngliches Kapital, sondern auch der Ertrag des Vorjahres — das nennt sich Zinseszins.</p>
                <div class="example-box">
                    <strong>200 € / Monat bei 6 % Rendite:</strong><br>
                    10 Jahre sparen → ca. <strong>33.000 €</strong><br>
                    20 Jahre sparen → ca. <strong>92.000 €</strong><br>
                    30 Jahre sparen → ca. <strong>200.000 €</strong>
                </div>
                <p>Die letzten 10 Jahre produzieren fast genauso viel wie die ersten 20. Das ist der wichtigste Grund, früh anzufangen.</p>
                <p style="margin-top:8px;"><strong>Zwei Rendite-Felder im Tool:</strong> In der Ansparphase legst du oft risikoreicher an. Im Ruhestand empfiehlt sich eine konservativere Strategie.</p>

            `},
            {
                id: 'karte-4', num: 4, icon: '🌡️', title: 'Inflation: Das unsichtbare Loch', teaser: 'Warum 2.800 € in 30 Jahren weniger wert sind', content: `
                <p>Inflation bedeutet: Preise steigen jedes Jahr ein bisschen. Was heute 2.800 € kostet, kostet in 30 Jahren bei 2 % Inflation etwa <strong>5.100 €</strong> — für denselben Lebensstandard.</p>
                <div class="example-box">
                    <strong>Was du eingibst:</strong> 2.800 € Bedarf (heutige Kaufkraft)<br>
                    <strong>Was das Tool berechnet:</strong> In Jahr 30 braucht es ~5.100 €.<br>
                    <strong>Kaufkraft-Toggle:</strong> Zeigt dein Vermögen in heutigen Euro.
                </div>
                <div class="merksatz">✅ Trag deinen Bedarf immer in heutigen Euro ein. Das Tool rechnet die Inflation automatisch drauf.</div>
            `},
            {
                id: 'karte-5', num: 5, icon: '🏦', title: 'Meine Konten richtig einordnen', teaser: 'Welches Konto ist ein Topf, was eine Rente?', content: `
                <p>Ein <strong>Topf</strong> ist jedes Konto oder Depot, das du im Ruhestand selbst anzapfst. Die Tabelle zeigt Richtwerte:</p>
                <div style="margin:12px 0;">
                    <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:4px;font-size:0.68rem;font-weight:700;color:var(--text-muted);padding:0 8px 4px;text-transform:uppercase;">
                        <span>Kontotyp</span><span style="text-align:center;">Rendite</span><span style="text-align:center;">Steuer</span>
                    </div>
                    <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:4px;align-items:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px;margin-bottom:5px;font-size:0.78rem;">
                        <div><strong>ETF-Depot</strong></div><div style="text-align:center;font-weight:700;color:var(--primary);">5–7 %</div><div style="text-align:center;font-weight:700;color:var(--primary);">18,5 %</div>
                    </div>
                    <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:4px;align-items:center;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px;margin-bottom:5px;font-size:0.78rem;">
                        <div><strong>Tagesgeld</strong></div><div style="text-align:center;font-weight:700;color:var(--primary);">2–3 %</div><div style="text-align:center;font-weight:700;color:var(--primary);">25 %</div>
                    </div>
                    <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:4px;align-items:center;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:8px;font-size:0.78rem;">
                        <div><strong>Priv. Rente</strong></div><div style="text-align:center;font-weight:700;color:var(--primary);">3–5 %</div><div style="text-align:center;font-size:0.72rem;">individ.</div>
                    </div>
                </div>
                <div class="warning-box">⚠️ Gesetzliche Rente & betriebl. Vorsorge gehören unter „Rentenquellen".</div>
                <div class="merksatz">✅ Steuer auf 0 zu lassen verfälscht das Ergebnis erheblich.</div>
            `},
            {
                id: 'karte-6', num: 6, icon: '⚠️', title: 'Typische Fehler vermeiden', teaser: 'Die 6 häufigsten Fallstricke', content: `
                <div class="error-item"><span class="err-icon">📈</span><div><strong>Rendite zu optimistisch</strong><br>10 %+ klingt verlockend, ist aber unrealistisch. <span class="fix">→ Bleib bei 5–7 %.</span></div></div>
                <div class="error-item"><span class="err-icon">🌡️</span><div><strong>Inflation auf 0 % setzen</strong><br>Unterschätzt deinen Bedarf massiv. <span class="fix">→ Mindestens 2 % einplanen.</span></div></div>
                <div class="error-item"><span class="err-icon">💸</span><div><strong>Steuer weglassen</strong><br>Ohne Steuer sieht der Plan besser aus als er ist. <span class="fix">→ Immer ausfüllen.</span></div></div>
                <div class="error-item"><span class="err-icon">🎂</span><div><strong>Entnahme-Ende zu früh</strong><br>„Bis 80" klingt lang — aber viele werden 90+. <span class="fix">→ Mindestens bis 90, besser 95.</span></div></div>
                <div class="error-item"><span class="err-icon">🧾</span><div><strong>Bruttorente eingetragen</strong><br>Im Bescheid steht Brutto. <span class="fix">→ Ca. 15–20 % abziehen für KV/PV.</span></div></div>
                <div class="error-item"><span class="err-icon">🛡️</span><div><strong>Rente zu optimistisch</strong><br>Plane lieber konservativ (Puffer). <span class="fix">→ Lieber 100€ weniger ansetzen.</span></div></div>
                <div class="warning-box">⚠️ Dieses Tool ist kein Ersatz für eine professionelle Finanzberatung.</div>
            `},
            {
                id: 'karte-7', num: 7, icon: '💾', title: 'Speichern & Sicherheit', teaser: 'Wie deine Daten geschützt werden', content: `
                <p>Der Ruhestandsplaner legt höchsten Wert auf Datenschutz. Es gibt keinen Server, an den deine Daten geschickt werden.</p>
                <div style="margin:10px 0;">
                    <div style="display:flex;gap:10px;align-items:flex-start;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 10px;font-size:0.78rem;margin-bottom:8px;">
                        <span>🔄</span>
                        <div><strong>Temporärer Autosave (Crash-Schutz)</strong><br>Während du tippst, wird der Plan lokal im Tab zwischengespeichert. Aktualisierst du die Seite versehentlich, ist alles noch da. <strong>Schließt du den Tab oder Browser, wird alles restlos gelöscht!</strong></div>
                    </div>
                    <div style="display:flex;gap:10px;align-items:flex-start;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 10px;font-size:0.78rem;">
                        <span>🔒</span>
                        <div><strong>Dauerhaft Speichern (Verschlüsselt)</strong><br>Um den Plan aufzuheben, klicke im Menü auf „Speichern". Du vergibst ein eigenes Passwort. Das Tool lädt dann eine stark verschlüsselte Datei (.encrypted) auf dein Gerät herunter. Ohne das Passwort kann niemand diese Datei auslesen.</div>
                    </div>
                </div>
                <div class="merksatz">✅ Nutze nach jeder Sitzung den Speichern-Button im Menü.</div>
            `}
        ];

        container.innerHTML = cards.map(c => `
            <div id="${c.id}" class="help-card card">
                <div class="help-card-header" onclick="this.parentElement.classList.toggle('open')">
                    <div class="card-num">${c.num}</div>
                    <div class="card-icon">${c.icon}</div>
                    <div class="card-header-text">
                        <h3>${c.title}</h3>
                        <div class="card-teaser">${c.teaser}</div>
                    </div>
                    <div class="card-chevron">▼</div>
                </div>
                <div class="help-card-body">
                    ${c.content}
                </div>
            </div>
        `).join('');
    }

    deepLinkHelp(cardId) {
        const card = document.getElementById(cardId);
        if (card) {
            // Close all others
            document.querySelectorAll('.help-card').forEach(c => c.classList.remove('open', 'highlighted'));
            card.classList.add('open', 'highlighted');
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => card.classList.remove('highlighted'), 2000);
        }
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
            this.finishSetup();
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
        const currentTransform = new DOMMatrix(window.getComputedStyle(inner).transform).m41;
        const maxScroll = -(inner.children.length - 1) * width;

        let newScroll = currentTransform + (direction * width);
        if (newScroll > 0) newScroll = 0;
        if (newScroll < maxScroll) newScroll = maxScroll;

        inner.style.transform = `translateX(${newScroll}px)`;
    }

    // Pot tab navigation
    _currentPotSlide = 0;

    switchPotTab(index) {
        if (index === this._currentPotSlide) return; // Already there, don't interrupt (e.g. editing name)
        if (document.activeElement) document.activeElement.blur();
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

    updatePotName(index, value) {
        this.state.data.pots[index].name = value;
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

    switchRetTab(panel) {
        const container = document.getElementById('tab-rentenphase');
        if (!container) return;
        // Store active panel so renderRentenphase can read it after rebuild
        container.dataset.retPanel = panel;
        this.editorRenderer.renderRentenphase(container, this.state.data);
    }


    // Helper for robust value clipping

    // --- DATA UPDATES ---
    updateDataParam(key, value) {
        let parsed = (typeof this.state.data[key] === 'number' || key === 'endAge' || key === 'currentAge' || key === 'retirementAge') ? +value : value;
        
        // Robust Age Limits [1, 120]
        if (typeof parsed === 'number' && (key.toLowerCase().includes('age') || key.toLowerCase().includes('jahr'))) {
            parsed = clip(parsed, 1, 120);
            // Force DOM update if the value was clipped to ensure UI consistency
            const activeEl = document.activeElement;
            if (activeEl && activeEl.tagName === 'INPUT' && activeEl.type === 'number') {
                activeEl.value = parsed;
            }
        }

        // IMPORTANT: Read old values BEFORE updating state, for sync comparisons
        const oldRetirementAge = this.state.data.retirementAge;

        this.stateManager.update(`data.${key}`, parsed);

        // Auto-sync retirement age to associated fields
        if (key === 'retirementAge') {
            const d = this.state.data;
            const newAge = parsed;

            // 1. Sync retirement phases that started at the old retirement age
            if (d.retirementPhases) {
                d.retirementPhases.forEach(ph => {
                    if (ph.fromAge === oldRetirementAge) ph.fromAge = newAge;
                });
            }

            // 2. Sync pensions that start at the old retirement age
            (d.pensions || []).forEach(p => {
                if (p.startAge === oldRetirementAge) {
                    p.startAge = newAge;
                }
            });


            // 4. Sync savings phases (toAge that was set to retire at old retirement age)
            (d.pots || []).forEach(pot => {
                (pot.savingsPhases || []).forEach(ph => {
                    if (ph.toAge === oldRetirementAge) ph.toAge = newAge;
                });
            });

            // Force a full structural rebuild so all age fields update in the editor
            this.onStateChange(true);
            return;
        }

        // If currentAge changes, force a rebuild to update the simulation correctly
        if (key === 'currentAge') {
            this.onStateChange(true);
            return;
        }

        this.onStateChange(false);
    }


    updatePotParam(index, key, value) {
        let parsed = (key === 'name') ? value : +value;
        if (typeof parsed === 'number' && key.toLowerCase().includes('age')) {
            parsed = clip(parsed, 1, 120);
        }
        this.stateManager.update(`data.pots.${index}.${key}`, parsed);
        // Also ensure tax rate is synced if it was the global one
        if (key === 'taxRate') this.stateManager.notify();
    }

    // --- ONE-TIME PAYMENTS ---
    addOneTimePayment() {
        if (!this.state.data.oneTimePayments) this.state.data.oneTimePayments = [];
        this.state.data.oneTimePayments.push({ 
            age: this.state.data.currentAge + 1, 
            amount: 10000, 
            targetPotIndex: 'all', 
            description: '' 
        });
        this._expandedOTP = this.state.data.oneTimePayments.length - 1;
        this.onStateChange(true); // Structural change
    }

    removeOneTimePayment(index) {
        if (confirm('Sicher löschen?')) {
            this.state.data.oneTimePayments.splice(index, 1);
            this.onStateChange(true);
        }
    }

    updateOneTimePayment(index, key, value) {
        let parsed = (key === 'description' || key === 'targetPotIndex') ? value : +value;
        if (typeof parsed === 'number' && key.toLowerCase().includes('age')) {
            parsed = clip(parsed, 1, 120);
        }
        this.stateManager.update(`data.oneTimePayments.${index}.${key}`, parsed);
    }

    // --- PENSIONS ---
    updatePension(index, key, value) {
        let parsed = (key === 'label') ? value : +value;
        if (typeof parsed === 'number' && key.toLowerCase().includes('age')) {
            parsed = clip(parsed, 1, 120);
        }
        this.stateManager.update(`data.pensions.${index}.${key}`, parsed);
    }

    // addPension removed from here, unified in updatePensionParam area

    removePension(index) {
        if (confirm('Rentenquelle wirklich löschen?')) {
            this.state.data.pensions.splice(index, 1);
            this.onStateChange(true); // Structural change
        }
    }

    // Direct in-place updates that do NOT trigger an immediate full re-render
    // These are used for actively typed input fields to preserve focus.
    updatePotParamDirect(index, key, value) {
        if (typeof value === 'string' && (key === 'interestRate' || key === 'taxRate' || key === 'interestRateRetirement')) {
            value = parseFloat(value.replace(',', '.')) || 0;
        }
        this.state.data.pots[index][key] = value;
        if (this._updateTimer) clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => { this.updateDashboard(false, false); }, 500);
    }

    updateDataParamDirect(key, value) {
        let parsed = value;
        if (key === 'inflationRate' || key === 'withdrawalTaxRate') {
            parsed = parseFloat(String(value).replace(',', '.')) || 0;
        } else if (key === 'retirementAge' || key === 'endAge' || key === 'currentAge') {
            parsed = parseInt(value, 10) || 0;
            parsed = Math.max(1, Math.min(120, parsed));
        }
        this.state.data[key] = parsed;
        if (this._updateTimer) clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => { this.updateDashboard(false, false); }, 500);
    }

    updatePensionParamDirect(idx, key, value) {
        let parsed = value;
        if (key === 'amount') {
            parsed = parseFloat(String(value).replace(/\./g, '').replace(',', '.')) || 0;
        } else if (key === 'growth') {
            // Growth is a rate: replace comma with dot, but DO NOT strip dots!
            parsed = parseFloat(String(value).replace(',', '.')) || 0;
        } else if (key === 'startAge') {
            parsed = parseInt(value, 10) || 0;
            parsed = Math.max(1, Math.min(120, parsed));
        }
        this.state.data.pensions[idx][key] = parsed;
        if (this._updateTimer) clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => { this.updateDashboard(false, false); }, 500);
    }

    updateSavingsPhaseDirect(pIdx, phIdx, key, value) {
        let parsed = value;
        if (key === 'amount') {
            parsed = parseFloat(String(value).replace(/\./g, '').replace(',', '.')) || 0;
        } else if (key === 'fromAge' || key === 'toAge') {
            parsed = parseInt(value, 10) || 0;
            parsed = Math.max(1, Math.min(120, parsed));
        }
        this.state.data.pots[pIdx].savingsPhases[phIdx][key] = parsed;
        if (this._updateTimer) clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => { this.updateDashboard(false, false); }, 500);
    }

    updateSavingsPhase(pIdx, phIdx, key, value) {
        let parsed = +value;
        if (key.toLowerCase().includes('age')) {
            parsed = clip(parsed, 1, 120);
            const phases = this.state.data.pots[pIdx].savingsPhases;
            const phase = phases[phIdx];
            // Enforce BIS >= AB
            if (key === 'fromAge') {
                if (phase.toAge !== undefined && parsed > phase.toAge) {
                    this.stateManager.update(`data.pots.${pIdx}.savingsPhases.${phIdx}.toAge`, parsed);
                }
            } else if (key === 'toAge') {
                const fromAge = phase.fromAge || 1;
                if (parsed < fromAge) parsed = fromAge;
            }
        }
        this.stateManager.update(`data.pots.${pIdx}.savingsPhases.${phIdx}.${key}`, parsed);
    }

    addSavingsPhase(pIdx) {
        const phases = this.state.data.pots[pIdx].savingsPhases;
        if (!phases) this.state.data.pots[pIdx].savingsPhases = [];
        const last = phases[phases.length - 1];
        phases.push({
            fromAge: last ? last.fromAge + 1 : this.state.data.currentAge + 1,
            toAge: this.state.data.retirementAge,
            amount: last ? last.amount : 0
        });
        this.onStateChange(true); // Structural update
    }

    removeSavingsPhase(pIdx, phIdx) {
        if (confirm('Sparphase wirklich löschen?')) {
            this.state.data.pots[pIdx].savingsPhases.splice(phIdx, 1);
            this.onStateChange(true);
        }
    }

    updateRetirementPhase(idx, key, value) {
        let parsed = +value;
        if (key.toLowerCase().includes('age')) {
            parsed = clip(parsed, 1, 120);
        }
        this.stateManager.update(`data.retirementPhases.${idx}.${key}`, parsed);
    }

    addRetirementPhase() {
        const d = this.state.data;
        if (!d.retirementPhases) d.retirementPhases = [];

        if (d.retirementPhases.length === 0) {
            // First time adding
            const applicable = (d.retirementPhases || [])
                .filter(ph => d.retirementAge >= ph.fromAge)
                .sort((a,b) => b.fromAge - a.fromAge);
            const basisAmount = applicable.length > 0 ? (applicable[0].monthlyAmount * 12) : 0;
            d.retirementPhases.push({ fromAge: d.retirementAge, monthlyAmount: basisAmount });
        } else {
            // Regular addition: add based on the last one
            const last = d.retirementPhases[d.retirementPhases.length - 1];
            d.retirementPhases.push({
                fromAge: last.fromAge + 1,
                monthlyAmount: last.monthlyAmount
            });
        }
        this.onStateChange(true);
    }

    removeRetirementPhase(idx) {
        if (confirm('Bedarfsphase wirklich löschen?')) {
            this.state.data.retirementPhases.splice(idx, 1);
            this.onStateChange(true);
        }
    }

    addNewPot() {
        const d = this.state.data;
        d.pots.push({ 
            name: `Topf ${d.pots.length + 1}`, 
            value: 0, 
            interestRate: 5, 
            interestRateRetirement: 4, 
            taxRate: d.withdrawalTaxRate || 18.5, 
            savingsPhases: [{ fromAge: d.currentAge, toAge: d.retirementAge, amount: 0 }] 
        });
        this._currentPotCarouselIndex = d.pots.length - 1;
        this._expandedPhase = {}; // Clear expanded phase state
        this.onStateChange(true);
    }

    deletePot(index) {
        if (this.state.data.pots.length <= 1) return;
        if (confirm('Topf wirklich löschen?')) {
            this.state.data.pots.splice(index, 1);
            this.currentPotIndex = Math.max(0, this.currentPotIndex - 1);
            this.onStateChange(true);
        }
    }

    // --- ONE-TIME EXPENSES ---
    addOneTimeExpense() {
        if (!this.state.data.oneTimeExpenses) this.state.data.oneTimeExpenses = [];
        this.state.data.oneTimeExpenses.push({ 
            age: this.state.data.retirementAge, 
            amount: 5000, 
            targetPotIndex: 'all', 
            description: '' 
        });
        this._expandedOTE = this.state.data.oneTimeExpenses.length - 1;
        this.onStateChange(true);
    }
    // Simplified update method forExpenses (legacy handled by Direct method now)
    removeOneTimeExpense(index) {
        if (confirm('Sicher löschen?')) {
            this.state.data.oneTimeExpenses.splice(index, 1);
            this.onStateChange(true);
        }
    }

    addPension() {
        const retirementAge = this.state.data.retirementAge || 67;
        const newPension = {
            id: 'pension_' + Date.now(),
            label: 'Neue Rente',
            amount: 500,
            growth: 1.5,
            startAge: retirementAge
        };
        // Update state and force a structural re-render immediately
        this.state.data.pensions.push(newPension);
        this.onStateChange(true);
    }

    // Second addPension removed - only one definition kept above at line ~987

    toggleOTP(index) {
        this._expandedOTP = (this._expandedOTP === index) ? null : index;
        this.renderAssetCards();
    }

    toggleOTE(index) {
        this._expandedOTE = (this._expandedOTE === index) ? null : index;
        this.renderAssetCards();
    }


    nextPot() { if (this.currentPotIndex < this.state.data.pots.length - 1) { this.currentPotIndex++; this.editorRenderer.render(this.state, this.activeTab, this.currentPotIndex, this.simulationResults, true); } }
    prevPot() { if (this.currentPotIndex > 0) { this.currentPotIndex--; this.editorRenderer.render(this.state, this.activeTab, this.currentPotIndex, this.simulationResults, true); } }

    setOption(key, value, el) {
        this.stateManager.update(`data.${key}`, value);
        // Ensure structural update if it's a strategy or tax change
        if (key === 'withdrawalStrategy' || key === 'withdrawalTaxRate') {
            this.updateDashboard(false, true);
        }
        if (el) {
            Array.from(el.parentElement.children).forEach(s => s.classList.remove('selected'));
            el.classList.add('selected');
        }
    }

    // --- UI STUFF ---
    togglePurchasingPower(enabled) {
        // Update state and let the onStateChange debouncer handle the UI update smoothly
        this.stateManager.update('data.showPurchasingPower', enabled);
    }

    toggleRow(row) {
        row.classList.toggle('expanded');
        row.nextElementSibling?.classList.toggle('show');
    }

    openDetailModal(age) {
        const results = this.simulationResults;
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
                    this.finishSetup(); // Navigate to dashboard
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
            try { sessionStorage.removeItem(STORAGE_KEY); } catch(e) {}
            this.stateManager.state.step = 0;
            this.showLandingPage();
        }
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

        const existingEntry = (this.state.data.realHistory || []).find(h => h.age === age);
        const isAlreadyReal = !!existingEntry;

        let overrideText = isAlreadyReal ? ' (bereits überschrieben)' : '';
        desc.textContent = `Setze die realen Ist-Werte für Alter ${age} fest. Dies überschreibt die Simulation ab diesem Punkt.` + overrideText;

        const container = document.getElementById('rcInputsContainer');
        const currentVals = isAlreadyReal ? existingEntry.pots : potValues;

        container.innerHTML = this.state.data.pots.map((p, i) => `
            <div class="form-group">
                <label>${p.name}</label>
                <input type="number" class="rc-pot-input" data-index="${i}" value="${currentVals[i].toFixed(0)}">
            </div>
        `).join('');

        // Ensure "Löschen" button exists or gets removed if not applicable
        let deleteBtn = document.getElementById('btn-delete-rc');
        const flexContainer = document.getElementById('btn-save-rc').parentElement;

        if (isAlreadyReal) {
            if (!deleteBtn) {
                deleteBtn = document.createElement('button');
                deleteBtn.id = 'btn-delete-rc';
                deleteBtn.className = 'btn btn-action-danger';
                deleteBtn.style.flex = '1';
                deleteBtn.textContent = 'Ist-Wert löschen';
                deleteBtn.onclick = () => this.deleteRealityCheck();
                flexContainer.insertBefore(deleteBtn, flexContainer.firstChild);
            }
        } else {
            if (deleteBtn) {
                deleteBtn.remove();
            }
        }

        modal.style.display = 'flex';
    }

    closeRealityCheckModal() {
        document.getElementById('realityCheckModal').style.display = 'none';
    }

    saveRealityCheck() {
        const inputs = document.querySelectorAll('.rc-pot-input');
        const values = Array.from(inputs).map(inp => Number(inp.value));

        const d = this.state.data;
        d.realHistory = d.realHistory || [];
        // Remove existing entry for same age if exists
        d.realHistory = d.realHistory.filter(h => h.age !== this.rcTargetAge);
        d.realHistory.push({ age: this.rcTargetAge, pots: values });

        this.stateManager.notify();
        this.closeRealityCheckModal();
        this.showToast('Realitätscheck gespeichert.', 'success');
    }

    deleteRealityCheck() {
        const d = this.state.data;
        if (d.realHistory) {
            d.realHistory = d.realHistory.filter(h => h.age !== this.rcTargetAge);
            this.stateManager.notify();
        }
        this.closeRealityCheckModal();
        this.showToast('Ist-Wert entfernt. Simulation rechnet wieder normal.', 'info');
    }

    // Remaining methods from original app.js

    // --- CSV EXPORT ---
    exportCSV() {
        if (!this.simulationResults || this.simulationResults.length === 0) {
            this.showToast('Keine Daten zum Exportieren.', 'error');
            return;
        }

        const data = this.stateManager.getState()?.data || {};
        const isPurchasingPower = data.showPurchasingPower;

        const headers = ['Alter', 'Jahr', 'Szenario', 'Vermögen', 'Sparrate', 'Entnahme', 'Netto-Rente', 'Bedarf (Gesamt)', 'Lücke'];
        const rows = [headers.join(';')]; // Use semicolon for German Excel

        const currentYear = new Date().getFullYear();
        const startAge = data.currentAge || 35;

        this.simulationResults.forEach(r => {
            const year = currentYear + (r.age - startAge);
            const scenario = isPurchasingPower ? 'Kaufkraft' : 'Nominal';

            const row = [
                r.age,
                year,
                scenario,
                fmtCSV(r.totalWealth),
                fmtCSV(r.savings),
                fmtCSV(r.withdrawal),
                fmtCSV(r.pension),
                fmtCSV(r.expenses),
                fmtCSV(r.gap)
            ];
            rows.push(row.join(';'));
        });

        const csvContent = "\uFEFF" + rows.join('\r\n'); // \uFEFF for BOM UTF-8
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);

        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute("download", `ruhestandsplan_${dateStr}_${isPurchasingPower ? 'kaufkraft' : 'nominal'}.csv`);

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast('CSV Export erfolgreich!');
    }
}

try {
    const appInstance = new App();
    if (typeof window !== 'undefined') window.app = appInstance;
} catch (err) {
    console.error('App initialization failed:', err);
}

export default window.app;
