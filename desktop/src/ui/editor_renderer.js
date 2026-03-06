export class EditorRenderer {
    constructor(app) {
        this.app = app;
        // Track the last known structural shape so we know when a full rebuild is needed
        this._lastStructure = null;
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
            d.rentalIncomes?.length,
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

            const chk = container.querySelector(`.inp-pension-penalty[data-index="${idx}"]`);
            if (chk && document.activeElement !== chk) chk.checked = !!p.applyPenalty;

            const calc = container.querySelector(`.pension-penalty-calc[data-index="${idx}"]`);
            if (calc) {
                if (p.id === 'state' && d.retirementAge < 67) {
                    const penalty = Math.min(14.4, (67 - d.retirementAge) * 3.6);
                    calc.style.display = 'block';
                    calc.innerHTML = p.applyPenalty
                        ? `<span style="color:#e11d48">Effektiv: ${Math.round(p.amount * (1 - penalty / 100))} €</span>`
                        : `<span style="color:#64748b">Voraussichtlich: -${penalty.toFixed(1)}%</span>`;
                } else {
                    calc.style.display = 'none';
                }
            }
        });

        (d.rentalIncomes || []).forEach((ri, idx) => {
            this._patch(container.querySelector(`.inp-rental-label[data-index="${idx}"]`), ri.label);
            this._patch(container.querySelector(`.inp-rental-amount[data-index="${idx}"]`), ri.amount);
            this._patch(container.querySelector(`.inp-rental-start[data-index="${idx}"]`), ri.startAge);
            this._patch(container.querySelector(`.inp-rental-growth[data-index="${idx}"]`), ri.growth ?? 0);
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
            if (commentEl) commentEl.textContent = sc.commentary;
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
                    <div class="card" style="border-left:4px solid var(--primary); position:relative; margin-bottom:0;">
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
                    <div class="form-group" style="margin:0;"><label>Ab Alter</label><input type="number" min="0" max="150" class="inp-phase-from" data-pot="${potIdx}" data-phase="${pIdx}" value="${phase.fromAge}"></div>
                    <div style="display:flex; gap:8px; align-items:end;">
                        <div class="form-group" style="margin:0; flex:1;"><label>Rate (€)</label><input type="number" min="0" step="10" class="inp-phase-amount" data-pot="${potIdx}" data-phase="${pIdx}" value="${phase.amount}"></div>
                        <button class="btn btn-icon delete btn-remove-phase" data-pot="${potIdx}" data-phase="${pIdx}" style="padding:4px; margin-bottom:2px;" ${currentPot.savingsPhases.length === 1 ? 'disabled' : ''}>🗑️</button>
                    </div>
                </div>`;
            });

            htmlPots += `
                    <button class="btn btn-sm btn-outline btn-add-phase" data-pot="${potIdx}" style="width:100%; font-size:0.75rem; padding:4px;">+ Phase hinzufügen</button>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(65px, 1fr)); gap:6px;">
                    <div class="form-group" style="margin:0;"><label style="font-size:0.65rem">Start (€) <span class="tooltip-trigger" data-tooltip-id="tt-pot-start">ℹ️<span class="tooltip-content" id="tt-pot-start">Der aktuelle Wert dieses Topfes.</span></span></label><input type="number" min="0" step="100" class="inp-pot-value" data-index="${potIdx}" value="${currentPot.value}" style="padding:2px 6px; font-size:0.8rem;"></div>
                    <div class="form-group" style="margin:0;"><label style="font-size:0.65rem">± (%) <span class="tooltip-trigger" data-tooltip-id="tt-pot-dyn">ℹ️<span class="tooltip-content" id="tt-pot-dyn">Jährliche Steigerung der Sparrate für diesen Topf.</span></span></label><input type="number" step="0.1" min="-20" max="50" class="inp-pot-dynamic" data-index="${potIdx}" value="${currentPot.contributionIncrease || 0}" style="padding:2px 6px; font-size:0.8rem;"></div>
                    <div class="form-group" style="margin:0;"><label style="font-size:0.65rem">Zins A. <span class="tooltip-trigger" data-tooltip-id="tt-pot-int-a">ℹ️<span class="tooltip-content" id="tt-pot-int-a">Erwartete Rendite während der Ansparphase.</span></span></label><input type="number" step="0.1" min="-20" max="50" class="inp-pot-interest" data-index="${potIdx}" value="${currentPot.interestRate}" style="padding:2px 6px; font-size:0.8rem;"></div>
                    <div class="form-group" style="margin:0;"><label style="font-size:0.65rem">Zins E. <span class="tooltip-trigger" data-tooltip-id="tt-pot-int-e">ℹ️<span class="tooltip-content" id="tt-pot-int-e">Erwartete Rendite während der Entnahmephase.</span></span></label><input type="number" step="0.1" min="-20" max="50" class="inp-pot-interest-ret" data-index="${potIdx}" value="${currentPot.interestRateRetirement}" style="padding:2px 6px; font-size:0.8rem;"></div>
                    <div class="form-group" style="margin:0;"><label style="font-size:0.65rem">Steuer <span class="tooltip-trigger" data-tooltip-id="tt-pot-tax">ℹ️<span class="tooltip-content" id="tt-pot-tax">Individueller Steuersatz für diesen Topf bei Entnahme.</span></span></label><input type="number" step="0.1" min="0" max="100" class="inp-pot-tax-rate" data-index="${potIdx}" value="${currentPot.taxRate || data.withdrawalTaxRate || 0}" style="padding:2px 6px; font-size:0.8rem;"></div>
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
                    <div class="form-group" style="margin:0;"><label>Alter</label><input type="number" min="0" max="150" class="inp-otp-age" data-index="${i}" value="${otp.age}"></div>
                    <div class="form-group" style="margin:0;"><label>Betrag (€)</label><input type="number" min="0" step="100" class="inp-otp-amount" data-index="${i}" value="${otp.amount}"></div>
                </div>
                <div class="input-grid-2" style="align-items:end;">
                    <div class="form-group" style="margin:0;"><label>Ziel-Topf</label><select class="inp-otp-pot" data-index="${i}">${potOptions}</select></div>
                    <div style="display:flex; gap:8px; align-items:end;">
                        <div class="form-group" style="margin:0; flex:1;"><label>Stichwort</label><input type="text" class="inp-otp-desc" data-index="${i}" value="${otp.description || ''}" placeholder="z.B. Bonus"></div>
                        <button class="btn btn-icon delete btn-remove-otp" data-index="${i}" style="padding:4px; color:#16a34a; margin-bottom:2px;">🗑️</button>
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
        let html = '';

        html += `
        <div id="acc-ret-expenses" class="accordion-section sub ${this.app.isExpanded('acc-ret-expenses') ? 'expanded' : ''}">
            <button class="accordion-header sub" onclick="app.toggleAccordion(this)">📉 Bedarf / Einmalausgaben</button>
            <div class="accordion-content">
                <div class="card" style="background:#fff1f2; border-left:4px solid #e11d48; padding:0.75rem; margin-top:0;">
                    <div style="font-weight:600; font-size:0.85rem; margin-bottom:8px;" class="hide-small">📉 Bedarf & Einmalausgaben</div>
                    <div style="margin-bottom:12px;">
                        <div style="font-size:0.7rem; font-weight:600; color:#64748b; margin-bottom:4px; text-transform:uppercase;">
                            Ruhestands-Phasen (Netto-Bedarf)
                            <span class="tooltip-trigger" data-tooltip-id="tt-ret-need">ℹ️<span class="tooltip-content" id="tt-ret-need">Monatlicher Betrag nach heutiger Kaufkraft, den du im Ruhestand zur Verfügung haben möchtest.</span></span>
                        </div>`;

        (d.retirementPhases || []).forEach((phase, phIdx) => {
            html += `
            <div class="input-grid-2" style="margin-bottom:8px; padding-bottom:4px; border-bottom: 1px dotted #fecaca;">
                <div class="form-group" style="margin:0;"><label>Ab Alter</label><input type="number" min="0" max="150" class="inp-retphase-from" data-index="${phIdx}" value="${phase.fromAge}"></div>
                <div style="display:flex; gap:8px; align-items:end;">
                    <div class="form-group" style="margin:0; flex:1;"><label>Bedarf (€/Mo)</label><input type="number" min="0" step="50" class="inp-retphase-amount" data-index="${phIdx}" value="${phase.monthlyAmount}"></div>
                    <button class="btn btn-icon delete btn-remove-retphase" data-index="${phIdx}" style="padding:4px; margin-bottom:2px;" ${d.retirementPhases.length === 1 ? 'disabled' : ''}>🗑️</button>
                </div>
            </div>`;
        });

        if (!d.retirementPhases || d.retirementPhases.length === 0) {
            html += `
            <div class="form-group" style="margin-bottom:8px;">
                <label style="font-size:0.7rem;">Monatlicher Bedarf (Basis)</label>
                <input type="number" class="inp-ret-expenses" value="${d.retirementExpenses}" style="padding:2px 6px; font-size:0.85rem;">
            </div>`;
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
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)) auto; gap:6px; align-items:end; margin-bottom:4px; padding:6px; background:white; border-radius:6px; border:1px solid #fecaca;">
                <div class="form-group" style="margin:0;"><label style="font-size:0.65rem">Alter</label><input type="number" min="0" max="150" class="inp-ote-age" data-index="${i}" value="${exp.age}" style="padding:2px 6px; font-size:0.8rem;"></div>
                <div class="form-group" style="margin:0;"><label style="font-size:0.65rem">Betrag (€)</label><input type="number" min="0" step="100" class="inp-ote-amount" data-index="${i}" value="${exp.amount}" style="padding:2px 6px; font-size:0.8rem;"></div>
                <div class="form-group" style="margin:0;"><label style="font-size:0.65rem">Ziel-Topf</label><select class="inp-ote-pot" data-index="${i}" style="padding:2px 6px; font-size:0.8rem; border:1px solid #e2e8f0; border-radius:4px;">${potOptions}</select></div>
                <div class="form-group" style="margin:0;"><label style="font-size:0.65rem">Stichwort</label><input type="text" class="inp-ote-desc" data-index="${i}" value="${exp.description || ''}" placeholder="z.B. Weltreise" style="padding:2px 6px; font-size:0.8rem;"></div>
                <button class="btn btn-icon delete btn-remove-ote" data-index="${i}" style="padding:2px; color:#e11d48; margin-bottom:2px;">🗑️</button>
            </div>`;
        });
        html += `<button class="btn btn-sm btn-outline btn-add-ote" style="width:100%; font-size:0.75rem; padding:4px; color:#e11d48; border-color:#e11d48;">+ Ausgabe hinzufügen</button></div></div></div>`;

        html += `
        <div id="acc-ret-pensions" class="accordion-section sub ${this.app.isExpanded('acc-ret-pensions') ? 'expanded' : ''}">
            <button class="accordion-header sub" onclick="app.toggleAccordion(this)">🏝️ Rentenquellen</button>
            <div class="accordion-content">
                <div class="card" style="background:#f0fdfa; border-left:4px solid #0d9488; padding:0.75rem; margin-top:0;">
                    <div style="font-weight:600; font-size:0.85rem; margin-bottom:8px;" class="hide-small">
                        🏝️ Rentenquellen
                        <span class="tooltip-trigger" data-tooltip-id="tt-ret-pensions">ℹ️<span class="tooltip-content" id="tt-ret-pensions">
                            <strong>🏝️ Rentenquellen</strong>
                            Zahlungen aus gesetzlicher, betrieblicher oder privater Rente.
                            <div class="tt-rule">Netto einplanen: Zieh ca. 11-12% für KV/PV von der Bruttorente ab.</div>
                            <div class="tt-more-link" onclick="app.showHelp('karte-5')">Mehr erfahren →</div>
                        </span></span>
                    </div>`;
        (d.pensions || []).forEach((p, idx) => {
            html += `
            <div style="background:white; padding:6px; border-radius:6px; margin-bottom:6px; border:1px solid #e2e8f0;">
                <div style="display:flex; gap:6px; margin-bottom:4px;">
                    <input type="text" class="inp-pension-label" data-index="${idx}" value="${p.label}" style="flex:2; font-weight:600; font-size:0.8rem; padding: 2px 6px;">
                    <button class="btn-icon delete btn-remove-pension" data-index="${idx}" style="padding:2px;">🗑️</button>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap:6px;">
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div class="form-group" style="margin:0;"><label style="font-size:0.65rem">Betrag / Monat (€)</label><input type="number" min="0" step="50" class="inp-pension-amount" data-index="${idx}" value="${p.amount}"></div>
                        <div style="display:flex; gap:4px;"><label style="font-size:0.65rem; width:45%;">Ab Alter</label><label style="font-size:0.65rem; width:55%;">Dyn. (%/J)</label></div>
                        <div style="display:flex; gap:4px;"><input type="number" min="0" max="150" class="inp-pension-start" data-index="${idx}" value="${p.startAge}" style="padding:2px 4px; font-size:0.8rem; width:45%;"><input type="number" step="0.1" min="-10" max="20" class="inp-pension-growth" data-index="${idx}" value="${p.growth}" style="padding:2px 4px; font-size:0.8rem; width:55%;"></div>
                    </div>
                </div>
                ${p.id === 'state' && d.retirementAge < 67 ? `
                <div style="margin-top: 8px; padding: 6px; background: #f8fafc; border-radius: 4px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
                    <label style="font-size: 0.7rem; color: #1e293b; display: flex; align-items: center; gap: 6px; cursor: pointer;">
                        <input type="checkbox" class="inp-pension-penalty" data-index="${idx}" ${p.applyPenalty ? 'checked' : ''}>
                        Abzüge schätzen (-3,6%/J)
                    </label>
                    <div class="pension-penalty-calc" data-index="${idx}" style="font-size: 0.7rem; font-weight: 600;"></div>
                </div>
                ` : ''}
            </div>`;
        });
        html += `<button class="btn btn-sm btn-add-pension" style="background:#0d9488; color:white; width:100%; font-size:0.75rem; padding:4px;">➕ Quelle hinzufügen</button></div></div></div>`;

        html += `
        <div id="acc-ret-rental" class="accordion-section sub ${this.app.isExpanded('acc-ret-rental') ? 'expanded' : ''}">
            <button class="accordion-header sub" onclick="app.toggleAccordion(this)">🏠 Miete & Sonstiges</button>
            <div class="accordion-content">
                <div class="card" style="background:#fefce8; border-left:4px solid #eab308; padding:0.75rem; margin-top:0;">
                    <div style="font-weight:600; font-size:0.85rem; margin-bottom:8px;" class="hide-small">
                        🏠 Miete & Sonstiges
                        <span class="tooltip-trigger" data-tooltip-id="tt-ret-rental">ℹ️<span class="tooltip-content" id="tt-ret-rental">Zusätzliche monatliche Einnahmen, z.B. aus Immobilienvermietung oder Nebentätigkeiten.</span></span>
                    </div>`;
        (d.rentalIncomes || []).forEach((ri, idx) => {
            html += `
            <div style="background:white; padding:10px; border-radius:8px; margin-bottom:10px; border:1px solid #fef08a; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                    <input type="text" class="inp-rental-label" data-index="${idx}" value="${ri.label}" style="flex:2; font-weight:700; font-size:0.9rem; padding: 4px 8px; border-color: #fef08a;">
                    <button class="btn-icon delete btn-remove-rental" data-index="${idx}" style="padding:4px; color:#eab308; border-color:#fef08a;">🗑️</button>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap:10px; margin-bottom:10px;">
                    <div class="form-group" style="margin:0;"><label style="font-size:0.65rem;">Betrag (€/Mo)</label><input type="number" min="0" step="50" class="inp-rental-amount" data-index="${idx}" value="${ri.amount}" style="padding:4px 8px; font-size:0.85rem;"></div>
                    <div class="form-group" style="margin:0;"><label style="font-size:0.65rem;">Start/Trend (%)</label><div style="display:flex; gap:4px;"><input type="number" min="0" max="150" class="inp-rental-start" data-index="${idx}" value="${ri.startAge}" style="padding:4px; font-size:0.85rem; width:45%;"><input type="number" step="0.1" min="-10" max="20" class="inp-rental-growth" data-index="${idx}" value="${ri.growth || 0}" style="padding:4px; font-size:0.85rem; width:55%;"></div></div>
                    <div class="form-group" style="margin:0;"><label style="font-size:0.65rem;">Steuersatz (%)</label><input type="number" step="0.1" class="inp-rental-tax" data-index="${idx}" value="${ri.taxRate || 0}" style="padding:4px 8px; font-size:0.85rem;"></div>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap; border-top:1px solid #fef08a; padding-top:8px;">
                    <div style="font-size:0.6rem; color:#854d0e; width:100%; font-weight:600; margin-bottom:2px; text-transform:uppercase;">Steuer-Quick-Select</div>
                    <button class="btn btn-sm btn-outline btn-apply-rental-tax" data-index="${idx}" data-tax="0" style="font-size:0.65rem; padding:2px 6px;">0% (Steuerfrei)</button>
                    <button class="btn btn-sm btn-outline btn-apply-rental-tax" data-index="${idx}" data-tax="15" style="font-size:0.65rem; padding:2px 6px;">15% (Pauschal)</button>
                    <button class="btn btn-sm btn-outline btn-apply-rental-tax" data-index="${idx}" data-tax="25" style="font-size:0.65rem; padding:2px 6px;">25% (Kapital)</button>
                    <button class="btn btn-sm btn-outline btn-apply-rental-tax" data-index="${idx}" data-tax="42" style="font-size:0.65rem; padding:2px 6px;">42% (Spitze)</button>
                </div>
            </div>`;
        });
        html += `<button class="btn btn-sm btn-add-rental" style="background:#eab308; width:100%; font-size:0.75rem; padding:6px; color:white; border-radius:8px;">➕ Einnahme hinzufügen</button></div></div></div>`;

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
                <div class="form-group" style="margin:0;"><label style="font-size:0.65rem; display:flex; align-items:center; gap:2px; white-space:nowrap;">Alter <span class="tooltip-trigger" data-tooltip-id="tt-age-cur">ℹ️<span class="tooltip-content" id="tt-age-cur">Dein aktuelles Lebensalter am Anfang der Planung.</span></span></label><input type="number" min="0" max="100" class="inp-age" data-key="currentAge" value="${d.currentAge}" style="padding:4px; font-size:0.85rem;"></div>
                <div class="form-group" style="margin:0;"><label style="font-size:0.65rem; display:flex; align-items:center; gap:2px; white-space:nowrap;">Rente <span class="tooltip-trigger" data-tooltip-id="tt-age-ret">ℹ️<span class="tooltip-content" id="tt-age-ret">Das geplante Alter für den Beginn des Ruhestands.</span></span></label><input type="number" min="0" max="100" class="inp-age" data-key="retirementAge" value="${d.retirementAge}" style="padding:4px; font-size:0.85rem;"></div>
                <div class="form-group" style="margin:0;"><label style="font-size:0.65rem; display:flex; align-items:center; gap:2px; white-space:nowrap;">Ende <span class="tooltip-trigger" data-tooltip-id="tt-age-end">ℹ️<span class="tooltip-content" id="tt-age-end">Bis zu welchem Alter soll die Planung reichen?</span></span></label><input type="number" min="0" max="150" class="inp-age" data-key="endAge" value="${d.endAge}" style="padding:4px; font-size:0.85rem;"></div>
            </div>
        </div>
        <div class="card" style="background:#f8fafc; border-left:4px solid #f59e0b;">
            <div style="font-weight:600; font-size:0.9rem; margin-bottom:12px;">📊 Wirtschaftliche Annahmen</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom: 12px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:0.65rem; display:flex; align-items:center; gap:2px; white-space:nowrap;">
                        Inflation (%) <span class="tooltip-trigger" data-tooltip-id="tt-inflation">ℹ️<span class="tooltip-content" id="tt-inflation">Angenommene jährliche Inflationsrate. Beeinflusst die reale Kaufkraft Ihrer Ersparnisse.</span></span>
                    </label>
                    <input type="number" step="0.1" min="-10" max="30" class="inp-econ" data-key="inflationRate" value="${d.inflationRate}" style="padding:4px; font-size:0.85rem;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:0.65rem; display:flex; align-items:center; gap:2px; white-space:nowrap;">
                        Steuer (%) <span class="tooltip-trigger" data-tooltip-id="tt-tax">ℹ️<span class="tooltip-content" id="tt-tax">Globaler Steuersatz auf Kapitalerträge. Wird als Standard für neue Töpfe verwendet.</span></span>
                    </label>
                    <input type="number" step="0.1" min="0" max="100" class="inp-econ" data-key="withdrawalTaxRate" value="${d.withdrawalTaxRate}" style="padding:4px; font-size:0.85rem;">
                </div>
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
                commentary = `In dieser Simulation ist das Vermögen bereits mit Alter ${exhaustionAge} aufgebraucht. Eine Überprüfung der Eingaben zu Sparrate, Rentenbeginn oder Ausgaben wird dringend empfohlen.`;
            } else if (finalWealth > 0) {
                if (yearsOfBuffer < 3) {
                    statusColor = '#f59e0b'; // Amber
                    statusText = 'Knapp';
                    scoreDisplay = yearsOfBuffer.toFixed(1) + ' J.';
                    commentary = `Die Simulation ergibt einen knappen Puffer von ca. ${yearsOfBuffer.toFixed(1)} Jahren. Prüfe deine Annahmen oder die Sparquote, um die Belastbarkeit der Planung zu erhöhen.`;
                } else {
                    statusColor = '#10b981'; // Green
                    statusText = 'Sicher';
                    scoreDisplay = Number.isFinite(yearsOfBuffer) ? yearsOfBuffer.toFixed(1) + ' J.' : '>50 J.';
                    commentary = `Auf Basis der gewählten Parameter ist dein Plan solide. Das rechnerische Restvermögen deckt die geplanten Ausgaben für ca. ${yearsOfBuffer.toFixed(1)} weitere Jahre (unter Berücksichtigung der Inflation).`;
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
        container.querySelector('.btn-add-rental')?.addEventListener('click', () => this.app.addRentalIncome());

        container.querySelectorAll('.btn-remove-retphase').forEach(btn => {
            btn.addEventListener('click', () => this.app.removeRetirementPhase(btn.dataset.index));
        });
        container.querySelectorAll('.btn-remove-ote').forEach(btn => {
            btn.addEventListener('click', () => this.app.removeOneTimeExpense(btn.dataset.index));
        });
        container.querySelectorAll('.btn-remove-pension').forEach(btn => {
            btn.addEventListener('click', () => this.app.removePension(btn.dataset.index));
        });
        container.querySelectorAll('.btn-remove-rental').forEach(btn => {
            btn.addEventListener('click', () => this.app.removeRentalIncome(btn.dataset.index));
        });
        container.querySelectorAll('.btn-apply-rental-tax').forEach(btn => {
            btn.addEventListener('click', () => this.app.updateRentalIncomeParam(btn.dataset.index, 'taxRate', +btn.dataset.tax));
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
                if (input.classList.contains('inp-pension-penalty')) this.app.updatePensionParam(idx, 'applyPenalty', input.checked);
                if (input.classList.contains('inp-rental-label')) this.app.updateRentalIncomeParam(idx, 'label', val);
                if (input.classList.contains('inp-rental-amount')) this.app.updateRentalIncomeParam(idx, 'amount', val);
                if (input.classList.contains('inp-rental-start')) this.app.updateRentalIncomeParam(idx, 'startAge', val);
                if (input.classList.contains('inp-rental-growth')) this.app.updateRentalIncomeParam(idx, 'growth', val);
                if (input.classList.contains('inp-rental-tax')) this.app.updateRentalIncomeParam(idx, 'taxRate', val);
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
