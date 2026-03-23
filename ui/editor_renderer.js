export class EditorRenderer {
    constructor(app) {
        this.app = app;
        // Track the last known structural shape so we know when a full rebuild is needed
        this._lastStructure = null;
    }

    // Helper that renders a styled number input with +/- buttons for mobile
    // The buttons call app.adjustValue which changes the value and fires 'input' event
    renderNumberInput(label, className, value, dataAttrs = '', step = 1, min = '', tooltipId = '') {
        const minAttr = min !== '' ? `min="${min}"` : '';
        return `
            <div class="form-group">
                <label>${label}</label>
                <div class="hybrid-input-wrapper">
                    <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this, -${step})">−</button>
                    <input type="number" step="${step}" ${minAttr} class="${className}" ${dataAttrs} value="${value}">
                    <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this, ${step})">+</button>
                </div>
            </div>`;
    }

    // ─────────────────────────────────────────────────────────────────
    // Public entry point
    // isStructural = true  → full innerHTML rebuild (add/remove phase etc.)
    // isStructural = false → patch existing DOM values only
    // ─────────────────────────────────────────────────────────────────
    render(appState, activeTab, currentPotIndex, results, isStructural = false) {
        const tabSparphase = document.getElementById('tab-sparphase');
        const tabRentenphase = document.getElementById('tab-rentenphase');
        const tabStrategie = document.getElementById('tab-strategie');
        if (!tabSparphase || !tabRentenphase || !tabStrategie) return;

        window.requestAnimationFrame(() => {
            const d = appState.data;
            const potIdx = Math.min(currentPotIndex, (d.pots?.length ?? 1) - 1);

            // Determine if the structure has changed (different number of items)
            const structure = this._describeStructure(d, potIdx);
            const structureChanged = isStructural || structure !== this._lastStructure;
            this._lastStructure = structure;

            if (structureChanged) {
                // Full rebuild path
                this.renderSparphase(tabSparphase, d, potIdx);
                this.renderRentenphase(tabRentenphase, d);
                this.renderStrategie(tabStrategie, d, results);
            } else {
                // Fast patch path – don't touch the focused element
                this._patchSparphase(tabSparphase, d, potIdx);
                this._patchRentenphase(tabRentenphase, d);
                this._patchStrategie(tabStrategie, d, results);
            }
        });
    }

    // Returns a string that uniquely describes the structural shape of the data.
    // If this string changes, a full rebuild is triggered.
    _describeStructure(d, potIdx) {
        const pot = d.pots?.[potIdx];
        return [
            d.pots?.length,
            potIdx,
            pot?.savingsPhases?.length,
            d.retirementPhases?.length,
            d.oneTimePayments?.length,
            d.oneTimeExpenses?.length,
            d.pensions?.length,
        ].join('|');
    }

    // ─────────────────────────────────────────────────────────────────
    // Patch helpers – only update .value, never touch focused element
    // ─────────────────────────────────────────────────────────────────
    _patch(el, value) {
        if (!el || document.activeElement === el) return;
        const strVal = String(value ?? '');
        if (el.value !== strVal) el.value = strVal;
    }

    _patchSparphase(container, d, potIdx) {
        const pot = d.pots?.[potIdx];
        if (!pot) return;

        this._patch(container.querySelector('.inp-pot-name'), pot.name);
        this._patch(container.querySelector('.inp-pot-value'), pot.value);
        this._patch(container.querySelector('.inp-pot-dynamic'), pot.contributionIncrease ?? 0);
        this._patch(container.querySelector('.inp-pot-interest'), pot.interestRate);
        this._patch(container.querySelector('.inp-pot-interest-ret'), pot.interestRateRetirement);
        this._patch(container.querySelector('.inp-pot-tax-rate'), pot.taxRate ?? d.withdrawalTaxRate ?? 0);

        (pot.savingsPhases || []).forEach((phase, pIdx) => {
            this._patch(container.querySelector(`.inp-phase-from[data-phase="${pIdx}"]`), phase.fromAge);
            this._patch(container.querySelector(`.inp-phase-amount[data-phase="${pIdx}"]`), phase.amount);
        });

        (d.oneTimePayments || []).forEach((otp, i) => {
            this._patch(container.querySelector(`.inp-otp-age[data-index="${i}"]`), otp.age);
            this._patch(container.querySelector(`.inp-otp-amount[data-index="${i}"]`), otp.amount);
            this._patch(container.querySelector(`.inp-otp-desc[data-index="${i}"]`), otp.description ?? '');
            // select: patch only if not focused
            const sel = container.querySelector(`.inp-otp-pot[data-index="${i}"]`);
            if (sel && document.activeElement !== sel) sel.value = String(otp.targetPotIndex);
        });
    }

    _patchRentenphase(container, d) {
        (d.retirementPhases || []).forEach((phase, phIdx) => {
            this._patch(container.querySelector(`.inp-retphase-from[data-index="${phIdx}"]`), phase.fromAge);
            this._patch(container.querySelector(`.inp-retphase-amount[data-index="${phIdx}"]`), phase.monthlyAmount);
        });

        (d.oneTimeExpenses || []).forEach((exp, i) => {
            this._patch(container.querySelector(`.inp-ote-age[data-index="${i}"]`), exp.age);
            this._patch(container.querySelector(`.inp-ote-amount[data-index="${i}"]`), exp.amount);
            this._patch(container.querySelector(`.inp-ote-desc[data-index="${i}"]`), exp.description ?? '');
            const sel = container.querySelector(`.inp-ote-pot[data-index="${i}"]`);
            if (sel && document.activeElement !== sel) sel.value = String(exp.targetPotIndex);
        });

        (d.pensions || []).forEach((p, idx) => {
            this._patch(container.querySelector(`.inp-pension-label[data-index="${idx}"]`), p.label);
            this._patch(container.querySelector(`.inp-pension-amount[data-index="${idx}"]`), p.amount);
            this._patch(container.querySelector(`.inp-pension-start[data-index="${idx}"]`), p.startAge);
            this._patch(container.querySelector(`.inp-pension-growth[data-index="${idx}"]`), p.growth);


        });

    }

    _patchStrategie(container, d, results) {
        this._patch(container.querySelector('.inp-age[data-key="currentAge"]'), d.currentAge);
        this._patch(container.querySelector('.inp-age[data-key="retirementAge"]'), d.retirementAge);
        this._patch(container.querySelector('.inp-age[data-key="endAge"]'), d.endAge);
        this._patch(container.querySelector('.inp-econ[data-key="inflationRate"]'), d.inflationRate);
        this._patch(container.querySelector('.inp-econ[data-key="withdrawalTaxRate"]'), d.withdrawalTaxRate);

        // Also patch the security check display directly
        if (results && results.length > 0) {
            const sc = this._computeSecurityCheck(d, results);
            const ratioEl = container.querySelector('#coverage-ratio');
            const statusEl = container.querySelector('#coverage-status');
            const cardEl = container.querySelector('#security-check-card');
            const commentEl = container.querySelector('.security-check-commentary');
            if (ratioEl) ratioEl.textContent = sc.scoreDisplay;
            if (statusEl) { statusEl.textContent = sc.statusText; statusEl.style.color = sc.statusColor; }
            if (commentEl) commentEl.innerHTML = sc.commentary; // Use innerHTML so HTML markup renders
            if (cardEl) {
                cardEl.style.borderLeftColor = sc.statusColor;
                cardEl.style.background = sc.statusColor + '18';
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Full-rebuild renderers (called on structural changes)
    // ─────────────────────────────────────────────────────────────────
    renderSparphase(container, data, currentPotIndex) {
        const d = data;
        let htmlPots = '';
        if (d.pots && d.pots.length > 0) {
            const potIdx = Math.min(currentPotIndex, d.pots.length - 1);
            const currentPot = d.pots[potIdx];

            htmlPots += `
            <div id="acc-spar-pots" class="accordion-section sub ${this.app.isExpanded('acc-spar-pots') ? 'expanded' : ''}">
                <button class="accordion-header sub" onclick="app.toggleAccordion(this)">🏦 Ihre Anlage-Töpfe</button>
                 <div class="accordion-content">
                    <div class="card pot-color-${potIdx % 5}" style="position:relative; margin-bottom:0;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; padding-bottom:0.75rem; border-bottom:2px solid #e2e8f0;">
                            <button class="btn btn-icon btn-prev-pot" ${potIdx === 0 ? 'disabled style="opacity:0.3;"' : ''}>◀</button>
                            <div style="text-align:center; flex:1;">
                                <input type="text" class="inp-pot-name" data-index="${potIdx}" value="${currentPot.name}" style="font-weight:bold; font-size:1.1rem; text-align:center; border:none; border-bottom:2px solid transparent; padding:4px; max-width:200px;">
                                <div style="font-size:0.75rem; color:#64748b; margin-top:4px;">Topf ${potIdx + 1} von ${d.pots.length}</div>
                            </div>
                            <button class="btn btn-icon btn-next-pot" ${potIdx === d.pots.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>▶</button>
                        </div>
                        <div style="margin-bottom:12px;">
                            <div style="font-size:0.75rem; font-weight:600; color:#64748b; margin-bottom:8px; text-transform:uppercase;">Spar-Phasen</div>`;

            (currentPot.savingsPhases || []).forEach((phase, pIdx) => {
                htmlPots += `
                <div class="input-grid-2" style="margin-bottom:8px; padding-bottom:4px; border-bottom: 1px dotted #e2e8f0;">
                    ${this.renderNumberInput('Ab Alter', 'inp-phase-from', phase.fromAge, `data-pot="${potIdx}" data-phase="${pIdx}"`, 1, 0)}
                    <div style="display:flex; gap:8px; align-items:end;">
                        ${this.renderNumberInput('Rate (€)', 'inp-phase-amount', phase.amount, `data-pot="${potIdx}" data-phase="${pIdx}"`, 50, 0)}
                        <button class="btn btn-icon delete btn-remove-phase" data-pot="${potIdx}" data-phase="${pIdx}" style="padding:4px; margin-bottom:12px;" ${currentPot.savingsPhases.length === 1 ? 'disabled' : ''}>🗑️</button>
                    </div>
                </div>`;
            });

            htmlPots += `
                    <button class="btn btn-sm btn-outline btn-add-phase" data-pot="${potIdx}" style="width:100%; font-size:0.75rem; padding:4px;">+ Phase hinzufügen</button>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    ${this.renderNumberInput('Start (€)', 'inp-pot-value', currentPot.value, `data-index="${potIdx}"`, 500, 0, 'tt-pot-start')}
                    ${this.renderNumberInput('± (%)', 'inp-pot-dynamic', currentPot.contributionIncrease || 0, `data-index="${potIdx}"`, 0.1, -20, 'tt-pot-dyn')}
                    ${this.renderNumberInput('Zins A.', 'inp-pot-interest', currentPot.interestRate, `data-index="${potIdx}"`, 0.1, -20, 'tt-pot-int-a')}
                    ${this.renderNumberInput('Zins E.', 'inp-pot-interest-ret', currentPot.interestRateRetirement, `data-index="${potIdx}"`, 0.1, -20, 'tt-pot-int-e')}
                    ${this.renderNumberInput('Steuer', 'inp-pot-tax-rate', currentPot.taxRate || data.withdrawalTaxRate || 0, `data-index="${potIdx}"`, 0.5, 0, 'tt-pot-tax')}
                </div>
                <div style="display:flex; gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid #e2e8f0;">
                    <button class="btn btn-sm btn-add-pot" style="flex:1; background:var(--primary); color:white; font-size:0.75rem;">➕ Neuer Topf</button>
                    <button class="btn btn-sm btn-outline btn-delete-pot" data-index="${potIdx}" style="font-size:0.75rem; color:#ef4444; border-color:#ef4444;" ${d.pots.length === 1 ? 'disabled' : ''}>🗑️ Löschen</button>
                </div>
            </div>
        </div>`;
        }

        htmlPots += `
        <div id="acc-spar-otp" class="accordion-section sub ${this.app.isExpanded('acc-spar-otp') ? 'expanded' : ''}">
            <button class="accordion-header sub" onclick="app.toggleAccordion(this)">💰 Einmalige Einzahlungen</button>
            <div class="accordion-content">
                <div class="card" style="background:#f0fdf4; border-left:4px solid #16a34a; margin-top:0;">
                    <div style="font-weight:600; font-size:0.9rem; margin-bottom:8px;" class="hide-small">💰 Einmalige Einzahlungen</div>`;

        (d.oneTimePayments || []).forEach((otp, i) => {
            let potOptions = `<option value="all" ${otp.targetPotIndex === 'all' ? 'selected' : ''}>Alle Töpfe</option>`;
            d.pots.forEach((p, pIdx) => { potOptions += `<option value="${pIdx}" ${otp.targetPotIndex == pIdx ? 'selected' : ''}>${p.name}</option>`; });
            htmlPots += `
            <div style="background:white; border-radius:6px; border:1px solid #fee2e2; padding:8px; margin-bottom:8px;">
                <div class="input-grid-2" style="margin-bottom:8px;">
                    ${this.renderNumberInput('Alter', 'inp-otp-age', otp.age, `data-index="${i}"`, 1, 0)}
                    ${this.renderNumberInput('Betrag (€)', 'inp-otp-amount', otp.amount, `data-index="${i}"`, 1000, 0)}
                </div>
                <div class="input-grid-2" style="align-items:end;">
                    <div class="form-group" style="margin:0;"><label>Ziel-Topf</label><select class="inp-otp-pot" data-index="${i}">${potOptions}</select></div>
                    <div style="display:flex; gap:8px; align-items:end;">
                        <div class="form-group" style="margin:0; flex:1;"><label>Stichwort</label><input type="text" class="inp-otp-desc" data-index="${i}" value="${otp.description || ''}" placeholder="z.B. Bonus"></div>
                        <button class="btn btn-icon delete btn-remove-otp" data-index="${i}" style="padding:4px; color:#16a34a; margin-bottom:12px;">🗑️</button>
                    </div>
                </div>
            </div>`;
        });
        htmlPots += `<button class="btn btn-sm btn-outline btn-add-otp" style="width:100%; font-size:0.75rem; padding:4px; color:#16a34a; border-color:#16a34a;">+ Einzahlung hinzufügen</button></div></div></div>`;
        container.innerHTML = htmlPots;

        this.attachSparphaseListeners(container);
    }

    renderRentenphase(container, data) {
        const d = data;
        // Read active sub-tab from container; default to 'bedarf'
        const activePanel = container.dataset.retPanel || 'bedarf';

        let html = `
        <div class="ret-sub-tabs">
            <button class="ret-sub-tab ${activePanel === 'bedarf' ? 'active' : ''}"
                    onclick="app.switchRetTab('bedarf')">📉 Mein Bedarf</button>
            <button class="ret-sub-tab ${activePanel === 'renten' ? 'active' : ''}"
                    onclick="app.switchRetTab('renten')">🏝️ Renten & Einkünfte</button>
        </div>`;

        // ── Panel: Bedarf ─────────────────────────────────────────────
        html += `<div class="ret-panel${activePanel === 'bedarf' ? ' active' : ''}" id="ret-panel-bedarf">`;
        html += `<div class="card" style="background:#fff1f2; border-left:4px solid #e11d48; padding:0.75rem; margin-top:0;">
                    <div style="margin-bottom:12px;">
                        <div style="font-size:0.7rem; font-weight:600; color:#64748b; margin-bottom:4px; text-transform:uppercase;">
                            Ruhestands-Phasen (Netto-Bedarf)
                            <span class="tooltip-trigger" data-tooltip-id="tt-ret-need">ℹ️<span class="tooltip-content" id="tt-ret-need">Monatlicher Betrag nach heutiger Kaufkraft, den du im Ruhestand zur Verfügung haben möchtest.</span></span>
                        </div>`;

        (d.retirementPhases || []).forEach((phase, phIdx) => {
            html += `
            <div class="input-grid-2" style="margin-bottom:8px; padding-bottom:4px; border-bottom: 1px dotted #fecaca;">
                ${this.renderNumberInput('Ab Alter', 'inp-retphase-from', phase.fromAge, `data-index="${phIdx}"`, 1, 0)}
                <div style="display:flex; gap:8px; align-items:end;">
                    ${this.renderNumberInput('Bedarf (€/Mo)', 'inp-retphase-amount', phase.monthlyAmount, `data-index="${phIdx}"`, 50, 0)}
                    <button class="btn btn-icon delete btn-remove-retphase" data-index="${phIdx}" style="padding:4px; margin-bottom:12px;" ${d.retirementPhases.length === 1 ? 'disabled' : ''}>🗑️</button>
                </div>
            </div>`;
        });

        if (!d.retirementPhases || d.retirementPhases.length === 0) {
            html += this.renderNumberInput('Monatlicher Bedarf (Basis)', 'inp-ret-expenses', d.retirementExpenses, '', 50, 0);
        }

        html += `
            <button class="btn btn-sm btn-outline btn-add-retphase" style="width:100%; font-size:0.75rem; padding:4px; color:#e11d48; border-color:#e11d48; margin-top:4px;">+ Phase hinzufügen</button>
            </div>
            <div style="font-weight:600; font-size:0.75rem; margin-bottom:6px; color:#e11d48; border-top:1px solid #fecaca; padding-top:12px; margin-top:12px;">
                💰 Einmalige Ausgaben
                <span class="tooltip-trigger" data-tooltip-id="tt-ret-ote">ℹ️<span class="tooltip-content" id="tt-ret-ote">Größere Anschaffungen oder Weltreisen, die zu einem bestimmten Alter geplant sind.</span></span>
            </div>`;

        (d.oneTimeExpenses || []).forEach((exp, i) => {
            let potOptions = `<option value="all" ${exp.targetPotIndex === 'all' ? 'selected' : ''}>Alle Töpfe</option>`;
            d.pots.forEach((p, pIdx) => { potOptions += `<option value="${pIdx}" ${exp.targetPotIndex == pIdx ? 'selected' : ''}>${p.name}</option>`; });
            html += `
            <div style="background:white; border-radius:6px; border:1px solid #fecaca; padding:8px; margin-bottom:8px;">
                <div class="input-grid-2" style="margin-bottom:8px;">
                    ${this.renderNumberInput('Alter', 'inp-ote-age', exp.age, `data-index="${i}"`, 1, 0)}
                    ${this.renderNumberInput('Betrag (€)', 'inp-ote-amount', exp.amount, `data-index="${i}"`, 1000, 0)}
                </div>
                <div class="input-grid-2" style="align-items:end;">
                    <div class="form-group" style="margin:0;"><label style="font-size:0.75rem;">Ziel-Topf</label><select class="inp-ote-pot" data-index="${i}" style="font-size:0.85rem;">${potOptions}</select></div>
                    <div style="display:flex; gap:8px; align-items:end;">
                        <div class="form-group" style="margin:0; flex:1;"><label style="font-size:0.75rem;">Stichwort</label><input type="text" class="inp-ote-desc" data-index="${i}" value="${exp.description || ''}" placeholder="z.B. Weltreise" style="font-size:0.85rem;"></div>
                        <button class="btn btn-icon delete btn-remove-ote" data-index="${i}" style="padding:4px; color:#e11d48; margin-bottom:12px;">🗑️</button>
                    </div>
                </div>
            </div>`;
        });
        html += `<button class="btn btn-sm btn-outline btn-add-ote" style="width:100%; font-size:0.75rem; padding:4px; color:#e11d48; border-color:#e11d48;">+ Ausgabe hinzufügen</button></div></div>`;
        html += `</div>`; // end ret-panel-bedarf

        // ── Panel: Renten & Einkünfte ─────────────────────────────────
        html += `<div class="ret-panel${activePanel === 'renten' ? ' active' : ''}" id="ret-panel-renten">`;
        html += `<div class="card" style="background:#f0fdfa; border-left:4px solid #0d9488; padding:0.75rem; margin-top:0;">
                    <div style="font-weight:600; font-size:0.85rem; margin-bottom:8px;" class="hide-small">
                        🏝️ Rentenquellen
                        <span class="tooltip-trigger" data-tooltip-id="tt-ret-pensions">ℹ️<span class="tooltip-content" id="tt-ret-pensions">
                            <strong>🏝️ Rentenquellen</strong>
                            Zahlungen aus gesetzlicher, betrieblicher oder privater Rente.
                            <div class="tt-rule"><strong>Wichtig:</strong> Die Rente wächst (Dynamik) erst ab dem hier eingestellten <strong>Rentenbeginn</strong>.</div>
                            <div class="tt-rule">Netto einplanen: Zieh ca. 11-12% für KV/PV von der Bruttorente ab.</div>
                        </span></span>
                    </div>`;

        (d.pensions || []).forEach((p, idx) => {
            html += `
            <div style="background:white; padding:6px; border-radius:6px; margin-bottom:6px; border:1px solid #e2e8f0;">
                <div style="display:flex; gap:6px; margin-bottom:4px;">
                    <input type="text" class="inp-pension-label" data-index="${idx}" value="${p.label}" style="flex:2; font-weight:600; font-size:0.8rem; padding: 2px 6px;">
                    <button class="btn-icon delete btn-remove-pension" data-index="${idx}" style="padding:2px;">🗑️</button>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:8px;">
                    <div style="grid-column: 1 / -1; margin-bottom: 4px;">
                        ${this.renderNumberInput('Monatlicher Betrag (€)', 'inp-pension-amount', p.amount, `data-index="${idx}"`, 50, 0)}
                    </div>
                    <div>
                        <label style="display:block; font-size:0.7rem; font-weight:600; color:#64748b; margin-bottom:4px;">Ab Alter</label>
                        <div class="hybrid-input-wrapper">
                            <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this, -1)">−</button>
                            <input type="number" min="0" max="150" class="inp-pension-start" data-index="${idx}" value="${p.startAge}">
                            <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this, 1)">+</button>
                        </div>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.7rem; font-weight:600; color:#64748b; margin-bottom:4px;">Dynamik (%/J)</label>
                        <div class="hybrid-input-wrapper">
                            <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this, -0.1)">−</button>
                            <input type="number" step="0.1" min="-10" max="20" class="inp-pension-growth" data-index="${idx}" value="${p.growth}">
                            <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this, 0.1)">+</button>
                        </div>
                    </div>
                </div>
            </div>`;
        });

        html += `<button class="btn btn-sm btn-add-pension" style="background:#0d9488; color:white; width:100%; font-size:0.75rem; padding:4px;">➕ Quelle hinzufügen</button></div>`;
        html += `</div>`; // end ret-panel-renten

        container.innerHTML = html;
        this.attachRentenphaseListeners(container);
    }

    renderStrategie(container, data, results) {
        const d = data;
        const sc = this._computeSecurityCheck(d, results);

        let html = '';
        html += `
        <div class="card" style="background:var(--primary-light); border-left:4px solid var(--primary);">
            <div style="font-weight:600; font-size:0.9rem; margin-bottom:12px;">📅 Alter & Planung</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px;">
                ${this.renderNumberInput('Alter', 'inp-age', d.currentAge, 'data-key="currentAge"', 1, 0, 'tt-age-cur')}
                ${this.renderNumberInput('Rente', 'inp-age', d.retirementAge, 'data-key="retirementAge"', 1, 0, 'tt-age-ret')}
                ${this.renderNumberInput('Ende', 'inp-age', d.endAge, 'data-key="endAge"', 1, 0, 'tt-age-end')}
            </div>
        </div>
        <div class="card" style="background:#f8fafc; border-left:4px solid #f59e0b;">
            <div style="font-weight:600; font-size:0.9rem; margin-bottom:12px;">📊 Wirtschaftliche Annahmen</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom: 12px;">
                ${this.renderNumberInput('Inflation (%)', 'inp-econ', d.inflationRate, 'data-key="inflationRate"', 0.1, -5, 'tt-inflation')}
                ${this.renderNumberInput('Steuer (%)', 'inp-econ', d.withdrawalTaxRate, 'data-key="withdrawalTaxRate"', 0.5, 0, 'tt-tax')}
            </div>
            <div style="padding-top:10px; border-top:1px solid #e2e8f0;">
                <div style="font-size:0.7rem; font-weight:600; color:#64748b; margin-bottom:6px; text-transform:uppercase;">Steuer-Quick-Select (Alle Töpfe)</div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn btn-sm btn-outline btn-apply-tax" data-tax="26.375" style="font-size:0.7rem; padding:4px 8px;">Abgeltungsteuer (26,3%)</button>
                    <button class="btn btn-sm btn-outline btn-apply-tax" data-tax="18.46" style="font-size:0.7rem; padding:4px 8px;">ETF-Teilfreist. (18,5%)</button>
                    <button class="btn btn-sm btn-outline btn-apply-tax" data-tax="0" style="font-size:0.7rem; padding:4px 8px;">Steuerfrei (0%)</button>
                </div>
            </div>
        </div>
        <div class="card security-check-card" id="security-check-card" style="border-left: 5px solid ${sc.statusColor}; background: ${sc.statusColor}0a; padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 4px 0; font-size: 1rem; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                        🛡️ Sicherheitscheck
                    </h3>
                    <div id="coverage-status" style="font-size: 0.85rem; font-weight: 700; color: ${sc.statusColor}; text-transform: uppercase; letter-spacing: 0.05em;">
                        ${sc.statusText}
                    </div>
                </div>
                <div id="coverage-ratio" style="font-size: 1.75rem; font-weight: 900; color: ${sc.statusColor}; line-height: 1;">
                    ${sc.scoreDisplay}
                </div>
            </div>
            
            <p class="security-check-commentary" style="font-size: 0.9rem; color: var(--text-main); margin: 0 0 1.25rem 0; line-height: 1.6; font-weight: 500;">
                ${sc.commentary}
            </p>
            
            <div class="kpi-advice" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(0,0,0,0.08); font-size: 0.8rem; line-height: 1.5; color: var(--text-muted);">
                <div style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 6px;">
                    <span style="font-size: 1.1rem; line-height: 1;">💡</span>
                    <div style="font-weight: 600; color: var(--text-main);">Kaufkraft-Check</div>
                </div>
                Diese Reserve von ca. 2-3 Jahren (Cash-Bucket) wird auf Basis deines Preisniveaus am Ende der Simulation berechnet. 
                So bist du auch bei hoher Inflation und Marktschwankungen auf der sicheren Seite.
                <div style="margin-top: 6px; font-style: italic; opacity: 0.8;">
                    Alle Ergebnisse basieren rein auf den eingegebenen Parametern und stellen keine Anlageberatung dar.
                </div>
            </div>
        </div>
        <div class="card debt-disclaimer-card" style="margin-top: 1rem; background: #f8fafc; border: 1px dashed #cbd5e1; padding: 1.25rem;">
            <div style="display: flex; gap: 8px; align-items: flex-start;">
                <span style="font-size: 1.1rem; line-height: 1;">ℹ️</span>
                <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">
                    <div style="font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Hinweis zu Schulden & Krediten</div>
                    Dieses Tool fokussiert sich zur Vereinfachung auf die Simulation von Guthaben. Falls du laufende Schulden hast, prüfe bitte kritisch, ob eine vorrangige Tilgung sinnvoll ist. 
                    Kreditzinsen (Sollzinsen) sind in der Regel höher als die Rendite von Ersparnissen und können den Vermögensaufbau erheblich bremsen.
                </div>
            </div>
        </div>`;

        container.innerHTML = html;
        this.attachStrategieListeners(container);
    }

    // ─────────────────────────────────────────────────────────────────
    // Security check computation (shared between render & patch)
    // ─────────────────────────────────────────────────────────────────
    _computeSecurityCheck(d, results) {
        let statusColor = '#64748b';
        let statusText = '-';
        let scoreDisplay = '-%';
        let commentary = 'Lade Daten...';

        if (results && results.length > 0) {
            const last = results[results.length - 1];
            const finalWealth = last.totalWealth;

            // Find the first age where wealth becomes negative (gap detection)
            const exhaustionRow = results.find(r => r.totalWealth < 0);
            const exhaustionAge = exhaustionRow ? exhaustionRow.age : null;

            // Base reserve years on last year's nominal expenses (High price level)
            const lastRow = results[results.length - 1];
            const lastYearExpenses = lastRow.expenses || 1;
            const yearsOfBuffer = finalWealth / lastYearExpenses;

            if (exhaustionAge !== null) {
                statusColor = '#dc2626'; // Red
                statusText = `Lücke ab ${exhaustionAge}`;
                scoreDisplay = '0 J.';
                commentary = `⚠️ <strong>Vorsicht:</strong> In dieser Simulation ist dein Vermögen bereits mit <strong>Alter ${exhaustionAge}</strong> aufgebraucht. <br><br>Das bedeutet, dass ab diesem Zeitpunkt eine monatliche Lücke entsteht, die nicht mehr durch dein Erspartes gedeckt werden kann. Wir empfehlen, die Sparrate zu erhöhen, den Rentenbeginn hinauszuschieben oder das Wunsch-Budget kritisch zu prüfen.`;
            } else if (finalWealth > 0) {
                if (yearsOfBuffer < 3) {
                    statusColor = '#f59e0b'; // Amber
                    statusText = 'Knapp';
                    scoreDisplay = yearsOfBuffer.toFixed(1) + ' J.';
                    commentary = `⚖️ <strong>Dein Plan ist auf Kante genäht:</strong> Du hast am Ende der Simulation nur einen Puffer von ca. <strong>${yearsOfBuffer.toFixed(1)} Jahren</strong>. <br><br>Schon kleine Änderungen (höhere Inflation oder geringere Rendite) könnten zu einer Lücke führen. Überlege, ob du eine zusätzliche Sicherheitsmarge einplanen möchtest.`;
                } else {
                    statusColor = '#10b981'; // Green
                    statusText = 'Sicher';
                    const bufferText = Number.isFinite(yearsOfBuffer) ? yearsOfBuffer.toFixed(1) + ' Jahre' : '>50 Jahre';
                    scoreDisplay = Number.isFinite(yearsOfBuffer) ? yearsOfBuffer.toFixed(1) + ' J.' : '>50 J.';
                    commentary = `✅ <strong>Hervorragend:</strong> Dein Plan steht auf einem soliden Fundament. Das rechnerische Restvermögen deckt deine geplanten Ausgaben für <strong>weitere ${bufferText}</strong> ab.<br><br>Selbst Marktschwankungen oder eine etwas höhere Inflation sollten diesen Plan nicht so leicht aus der Bahn werfen. Du bist auf einem sehr guten Weg!`;
                }
            } else {
                // Fallback for finalWealth <= 0 but exhaustionAge search failed (unlikely)
                statusColor = '#dc2626';
                statusText = 'Lücke';
                scoreDisplay = '0 J.';
                commentary = 'In dieser Simulation besteht am Ende der Laufzeit Handlungsbedarf.';
            }
        }
        return { statusColor, statusText, scoreDisplay, commentary };
    }

    // ─────────────────────────────────────────────────────────────────
    // Event listeners (attached after full rebuild only)
    // ─────────────────────────────────────────────────────────────────
    attachSparphaseListeners(container) {
        container.querySelector('.btn-prev-pot')?.addEventListener('click', () => this.app.prevPot());
        container.querySelector('.btn-next-pot')?.addEventListener('click', () => this.app.nextPot());
        container.querySelector('.btn-add-pot')?.addEventListener('click', () => this.app.addNewPot());
        container.querySelector('.btn-add-otp')?.addEventListener('click', () => this.app.addOneTimePayment());

        container.querySelectorAll('.btn-remove-phase').forEach(btn => {
            btn.addEventListener('click', () => this.app.removeSavingsPhase(btn.dataset.pot, btn.dataset.phase));
        });
        container.querySelectorAll('.btn-add-phase').forEach(btn => {
            btn.addEventListener('click', () => this.app.addSavingsPhase(btn.dataset.pot));
        });
        container.querySelectorAll('.btn-delete-pot').forEach(btn => {
            btn.addEventListener('click', () => this.app.deletePot(btn.dataset.index));
        });
        container.querySelectorAll('.btn-remove-otp').forEach(btn => {
            btn.addEventListener('click', () => this.app.removeOneTimePayment(btn.dataset.index));
        });

        container.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', () => {
                const val = input.type === 'number' ? +input.value : input.value;
                if (input.classList.contains('inp-pot-name')) this.app.updatePotParam(input.dataset.index, 'name', val);
                if (input.classList.contains('inp-pot-value')) this.app.updatePotParam(input.dataset.index, 'value', val);
                if (input.classList.contains('inp-pot-interest')) this.app.updatePotParam(input.dataset.index, 'interestRate', val);
                if (input.classList.contains('inp-pot-interest-ret')) this.app.updatePotParam(input.dataset.index, 'interestRateRetirement', val);
                if (input.classList.contains('inp-pot-tax-rate')) this.app.updatePotParam(input.dataset.index, 'taxRate', val);
                if (input.classList.contains('inp-pot-dynamic')) this.app.updatePotParam(input.dataset.index, 'contributionIncrease', val);
                if (input.classList.contains('inp-phase-amount')) this.app.updateSavingsPhase(input.dataset.pot, input.dataset.phase, 'amount', val);
                if (input.classList.contains('inp-phase-from')) this.app.updateSavingsPhase(input.dataset.pot, input.dataset.phase, 'fromAge', val);
                if (input.classList.contains('inp-otp-age')) this.app.updateOneTimePayment(input.dataset.index, 'age', val);
                if (input.classList.contains('inp-otp-amount')) this.app.updateOneTimePayment(input.dataset.index, 'amount', val);
                if (input.classList.contains('inp-otp-pot')) this.app.updateOneTimePayment(input.dataset.index, 'targetPotIndex', val);
                if (input.classList.contains('inp-otp-desc')) this.app.updateOneTimePayment(input.dataset.index, 'description', val);
            });
        });
    }

    attachRentenphaseListeners(container) {
        container.querySelector('.inp-ret-expenses')?.addEventListener('input', (e) => this.app.updateDataParam('retirementExpenses', e.target.value));
        container.querySelector('.btn-add-retphase')?.addEventListener('click', () => this.app.addRetirementPhase());
        container.querySelector('.btn-add-ote')?.addEventListener('click', () => this.app.addOneTimeExpense());
        container.querySelector('.btn-add-pension')?.addEventListener('click', () => this.app.addPension());

        container.querySelectorAll('.btn-remove-retphase').forEach(btn => {
            btn.addEventListener('click', () => this.app.removeRetirementPhase(btn.dataset.index));
        });
        container.querySelectorAll('.btn-remove-ote').forEach(btn => {
            btn.addEventListener('click', () => this.app.removeOneTimeExpense(btn.dataset.index));
        });
        container.querySelectorAll('.btn-remove-pension').forEach(btn => {
            btn.addEventListener('click', () => this.app.removePension(btn.dataset.index));
        });

        container.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', () => {
                const val = input.type === 'number' ? +input.value : input.value;
                const idx = input.dataset.index;
                if (input.classList.contains('inp-retphase-from')) this.app.updateRetirementPhase(idx, 'fromAge', val);
                if (input.classList.contains('inp-retphase-amount')) this.app.updateRetirementPhase(idx, 'monthlyAmount', val);
                if (input.classList.contains('inp-ote-age')) this.app.updateOneTimeExpense(idx, 'age', val);
                if (input.classList.contains('inp-ote-amount')) this.app.updateOneTimeExpense(idx, 'amount', val);
                if (input.classList.contains('inp-ote-desc')) this.app.updateOneTimeExpense(idx, 'description', val);
                if (input.classList.contains('inp-ote-pot')) this.app.updateOneTimeExpense(idx, 'targetPotIndex', val);
                if (input.classList.contains('inp-pension-label')) this.app.updatePensionParam(idx, 'label', val);
                if (input.classList.contains('inp-pension-amount')) this.app.updatePensionParam(idx, 'amount', val);
                if (input.classList.contains('inp-pension-start')) this.app.updatePensionParam(idx, 'startAge', val);
                if (input.classList.contains('inp-pension-growth')) this.app.updatePensionParam(idx, 'growth', val);

            });
        });
    }

    attachStrategieListeners(container) {
        container.querySelectorAll('.btn-apply-tax').forEach(btn => {
            btn.addEventListener('click', () => {
                const tax = +btn.dataset.tax;
                this.app.updateDataParam('withdrawalTaxRate', tax);
                this.app.state.data.pots.forEach((_, i) => this.app.updatePotParam(i, 'taxRate', tax));
            });
        });

        container.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => {
                const val = input.type === 'number' ? +input.value : input.value;
                this.app.updateDataParam(input.dataset.key, val);
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // Swipe gestures (unchanged)
    // ─────────────────────────────────────────────────────────────────
    initSwipeGestures(editorBody) {
        let startX = 0;
        let startY = 0;
        const SWIPE_THRESHOLD = 60;

        editorBody.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });

        editorBody.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;

            const activeEl = document.querySelector('.editor-tab-content.active');
            const activeId = activeEl ? activeEl.id : '';

            if (activeId === 'tab-sparphase') {
                if (dx < 0) this.app.nextPot();
                else this.app.prevPot();
            } else {
                const tabs = ['sparphase', 'rentenphase', 'strategie'];
                const currentTab = this.app.activeTab;
                const idx = tabs.indexOf(currentTab);
                if (dx < 0 && idx < tabs.length - 1) this.app.switchEditorTab(tabs[idx + 1]);
                else if (dx > 0 && idx > 0) this.app.switchEditorTab(tabs[idx - 1]);
            }
        }, { passive: true });
    }
}
