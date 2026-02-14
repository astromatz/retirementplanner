import { initialState } from './core/state.js';
import { calculateSimulation } from './core/simulation.js';
import { encryptData, decryptData } from './utils/storage.js';
import { createWizard } from './ui/wizard.js';

const app = {
    state: JSON.parse(JSON.stringify(initialState)),
    activeTab: 'sparphase', // Default tab

    switchEditorTab: (tabId) => {
        app.activeTab = tabId;
        // Update Buttons
        document.querySelectorAll('.editor-tab').forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.editor-tab[onclick*="'${tabId}'"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Update Content
        document.querySelectorAll('.editor-tab-content').forEach(c => c.classList.remove('active'));
        const contentEl = document.getElementById(`tab-${tabId}`);
        if (contentEl) contentEl.classList.add('active');

        // Re-render to ensure dynamic inputs are in correct place
        app.populateEditor();

        // Ensure coverage is calculated immediately if switching to Strategie
        if (tabId === 'strategie' && app.simulationResults) {
            app.updateCoverageDisplay(app.simulationResults);
        }
    },

    init: () => {
        app.wizard = createWizard(app);

        // Start directly in Dashboard with Dummy Data
        document.getElementById('wizard-container').style.display = 'none';
        document.getElementById('view-dashboard').style.display = 'block';

        document.getElementById('next-btn').addEventListener('click', app.nextStep);
        document.getElementById('prev-btn').addEventListener('click', app.prevStep);

        window.app = app;

	app.initTooltipPositioning();

        app.initDashboard();
    },
    // === NEU: TOAST NOTIFICATION SYSTEM ===
    showToast: (message, type = 'info') => {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Icon basierend auf Typ
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <span style="font-size:1.2rem;">${icons[type] || icons.info}</span>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Auto-remove nach 3 Sekunden
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
        
        // Click to dismiss
        toast.addEventListener('click', () => {
            toast.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        });
    },
// === ENDE NEU ===

    // === NEU: TOOLTIP HELPER ===
    tooltip: (text) => {
        // Eindeutige ID für jeden Tooltip
        const id = 'tooltip-' + Math.random().toString(36).substr(2, 9);
        return `<span class="tooltip-trigger" data-tooltip-id="${id}">ℹ️<span class="tooltip-content" id="${id}">${text}</span></span>`;
    },

    // NEU: Tooltip Positioning beim Hover
    initTooltipPositioning: () => {
        document.addEventListener('mouseover', (e) => {
            const trigger = e.target.closest('.tooltip-trigger');
            if (!trigger) return;

            const tooltipId = trigger.getAttribute('data-tooltip-id');
            if (!tooltipId) return;

            const tooltip = document.getElementById(tooltipId);
            if (!tooltip) return;

            // Position des Triggers ermitteln
            const triggerRect = trigger.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Standard: Tooltip oben, zentriert
            let top = triggerRect.top - tooltipRect.height - 10;
            let left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
            
            tooltip.classList.remove('below', 'above');
            tooltip.classList.add('above');

            // Wenn oben kein Platz: Tooltip unten
            if (top < 10) {
                top = triggerRect.bottom + 10;
                tooltip.classList.remove('above');
                tooltip.classList.add('below');
            }

            // Links-Korrektur (zu weit links)
            if (left < 10) {
                left = 10;
            }

            // Rechts-Korrektur (zu weit rechts)
            if (left + tooltipRect.width > viewportWidth - 10) {
                left = viewportWidth - tooltipRect.width - 10;
            }

            // Position setzen
            tooltip.style.top = top + 'px';
            tooltip.style.left = left + 'px';
            tooltip.style.transform = 'none';  // Transform deaktivieren
        });
    },
    // === ENDE NEU ===

    currentPotIndex: 0,

    nextPot: () => {
        if (app.currentPotIndex < app.state.data.pots.length - 1) {
            app.currentPotIndex++;
            app.populateEditor();
        }
    },

    prevPot: () => {
        if (app.currentPotIndex > 0) {
            app.currentPotIndex--;
            app.populateEditor();
        }
    },

    addNewPot: () => {
        const d = app.state.data;
        const newPot = {
            name: `Topf ${d.pots.length + 1}`,
            value: 0,
            interestRate: 5.0,
            interestRateRetirement: 4.0,
            contributionIncrease: 0,
            savingsPhases: [{ 
                fromAge: d.currentAge, 
                toAge: d.retirementAge, 
                amount: 0 
            }]
        };
        d.pots.push(newPot);
        app.currentPotIndex = d.pots.length - 1;
        app.initDashboard();
    },

    deletePot: (index) => {
        if (app.state.data.pots.length <= 1) {
            app.showToast('Mindestens ein Topf muss vorhanden sein!', 'warning');
            return;
        }
        if (confirm(`Topf "${app.state.data.pots[index].name}" wirklich löschen?`)) {
            app.state.data.pots.splice(index, 1);
            app.currentPotIndex = Math.max(0, app.currentPotIndex - 1);
            app.initDashboard();
        }
    },

    startWizard: () => {
        document.getElementById('view-dashboard').style.display = 'none';
        document.getElementById('wizard-container').style.display = 'block';
        app.state.step = 0;
        app.renderStep();
    },

    renderStep: () => {
        const stepDef = app.wizard.steps[app.state.step];
        const container = document.getElementById('wizard-content');
        const progress = (app.state.step / (app.wizard.steps.length - 1)) * 100;
        document.getElementById('wizard-progress').style.width = `${progress}%`;
        container.innerHTML = stepDef.render(app.state.data);
        document.getElementById('prev-btn').style.display = app.state.step === 0 ? 'none' : 'block';
        document.getElementById('next-btn').textContent = app.state.step === app.wizard.steps.length - 1 ? 'Zum Dashboard' : 'Weiter';
    },

    nextStep: () => {
        const stepDef = app.wizard.steps[app.state.step];
        if (stepDef.validate && !stepDef.validate(app.state.data)) {
            app.showToast('Bitte überprüfen Sie Ihre Eingaben.', 'warning');
            return;
        }
        if (stepDef.save) stepDef.save(app.state.data);

        if (app.state.step < app.wizard.steps.length - 1) {
            app.state.step++;
            app.renderStep();
        } else {
            app.finishWizard();
        }
    },

    prevStep: () => {
        if (app.state.step > 0) {
            app.state.step--;
            app.renderStep();
        }
    },

    setOption: (key, value, el) => {
        app.state.data[key] = value;
        const siblings = el.parentElement.children;
        for (let sib of siblings) sib.classList.remove('selected');
        el.classList.add('selected');

        // If in wizard
        if (document.getElementById('wizard-container').style.display !== 'none') {
            if (key === 'numPots' || key === 'withdrawalStrategy') app.renderStep();
        } else {
            // Reset order if sequential is picked and order is empty or wrong size
            if (key === 'withdrawalStrategy' && value === 'sequential') {
                if (!app.state.data.withdrawalOrder || app.state.data.withdrawalOrder.length !== app.state.data.pots.length) {
                    app.state.data.withdrawalOrder = app.state.data.pots.map((_, i) => i);
                }
            }
            // If in dashboard
            app.initDashboard();
        }
    },

    finishWizard: () => {
        document.getElementById('wizard-container').style.display = 'none';
        document.getElementById('view-dashboard').style.display = 'block';
        app.initDashboard();
    },

    initDashboard: (skipEditorRefresh = false) => {
        const results = calculateSimulation(app.state.data);
        app.simulationResults = results; // Store for other components
        app.renderResults(results);
        app.updateCoverageDisplay(results);
        if (!skipEditorRefresh) {
            app.populateEditor();
        }
        app.updateKpiBar(results);
    },

    updateKpiBar: (results) => {
        const d = app.state.data;
        const format = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

        // Sparrate Total (Current Year)
        const currentSavings = d.pots.reduce((sum, pot) => {
            const phase = pot.savingsPhases?.find(p => d.currentAge >= p.fromAge && d.currentAge < p.toAge);
            return sum + (phase ? phase.amount : 0);
        }, 0);

        const savingsEl = document.getElementById('kpi-savings');
        if (savingsEl) savingsEl.textContent = format(currentSavings) + ' / Mo';

        // Coverage is already updated by updateCoverageDisplay called in initDashboard (inside handleUpdateParams or init)
        // But let's ensure it's synced here too if needed
        app.updateCoverageDisplay(results);
    },

    toggleTable: () => {
        const wrapper = document.getElementById('details-table-wrapper');
        wrapper.style.display = wrapper.style.display === 'none' ? 'block' : 'none';
    },

    renderResults: (data) => {
        const d = app.state.data;
        const lastPoint = data[data.length - 1];
        const retStartPoint = data.find(p => p.age === d.retirementAge);
        const wealthAtRetirement = retStartPoint ? retStartPoint.totalWealth : 0;
        const wealthAtEnd = lastPoint.totalWealth;
        const format = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

        // Calculate Gap (Sum of all gaps or gap at end?)
        // Let's show the cumulative gap if wealth < 0, or just the gap at end age if we want to be simple.
        // Actually, 'gap' in simulation usually means monthly shortfall.
        // Let's use the last point's gap for now, or total shortfall if wealth is negative.
        // Simpler: If wealthAtEnd < 0, that is the gap!
        const gap = wealthAtEnd < 0 ? Math.abs(wealthAtEnd) : 0;

        document.getElementById('stat-wealth').textContent = format(Math.max(0, wealthAtEnd));
        document.getElementById('stat-wealth').style.color = wealthAtEnd >= 0 ? '#16a34a' : '#dc2626';

        document.getElementById('stat-gap').textContent = gap > 0 ? format(gap) : '0,00 €';
        document.getElementById('stat-gap').style.color = gap > 0 ? '#dc2626' : '#16a34a';

        app.renderChart(data);
        app.renderTable(data);
    },

renderChart: (data) => {
    const canvas = document.getElementById('wealthChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const d = app.state.data;

    const datasets = d.pots.map((pot, i) => {
        const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];
        const c = colors[i % colors.length];
        return {
            label: pot.name,
            data: data.map(point => point.pots[i].value),
            backgroundColor: c + 'BB',
            borderColor: c,
            borderWidth: 1,
            fill: true,
            order: 2,
            stack: 'wealth'
        };
    });

    if (window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: data.map(p => p.age), datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    bottom: 20  // FIX: Mehr Platz für X-Achse
                }
            },
            scales: {
                x: { 
                    stacked: true,
                    ticks: {
                        maxRotation: 0,  // Keine Drehung
                        autoSkip: true,
                        maxTicksLimit: 20  // Maximal 20 Labels
                    }
                },
                y: {
                    stacked: true,
                    ticks: { callback: (v) => (v / 1000) + 'k €' }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('de-DE', { 
                                    style: 'currency', 
                                    currency: 'EUR' 
                                }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            xMin: d.retirementAge - d.currentAge,
                            xMax: d.retirementAge - d.currentAge,
                            borderColor: '#ef4444',
                            borderWidth: 3,
                            label: {
                                display: true,
                                content: 'Renteneintritt',
                                position: 'start',
                                backgroundColor: '#ef4444'
                            }
                        }
                    }
                }
            }
        }
    });
},

    renderTable: (data) => {
        const d = app.state.data;
        const format = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
        const tableBody = document.querySelector('#details-table tbody');
        if (!tableBody) return;

        // Update Headers
        const thead = document.querySelector('#details-table thead tr');
        thead.innerHTML = `
            <th>Alter</th>
            <th>Jahr</th>
            <th>Bedarf</th>
            <th>Ges. Rente</th>
            <th>Einzahlung</th>
            <th>Ges. Vermögen</th>
            <th>Lücke</th>
            <th>Aktion</th>`;

        tableBody.innerHTML = data.map(row => {
            const isRet = row.age >= d.retirementAge;
            const style = row.age === d.retirementAge ? 'background:var(--primary-light); font-weight:bold;' : '';
            const rowClass = row.isReal ? 'is-real' : '';

            return `
                <tr style="${style}" class="${rowClass}">
                    <td>${row.age}</td>
                    <td>${row.year}</td>
                    <td>${isRet ? format(row.expenses) : '-'}</td>
                    <td>${isRet ? format(row.pension) : '-'}</td>
                    <td>${format(row.cumulativeSavings)}</td>
                    <td style="font-weight:600;">${format(row.totalWealth)}</td>
                    <td style="color:${row.gap > 1 ? '#ef4444' : 'var(--primary)'};">${isRet ? format(row.gap) : '-'}</td>
                    <td>
                        <button class="btn btn-sm" title="Realitätscheck für Altersstufe ${row.age}" 
                                onclick="app.openRealityCheck(${row.age}, ${JSON.stringify(row.pots.map(p => p.value)).replace(/"/g, '&quot;')})">🎯</button>
                    </td>
                </tr>`;
        }).join('');
    },

    populateEditor: () => {
        const tabSparphase = document.getElementById('tab-sparphase');
        const tabRentenphase = document.getElementById('tab-rentenphase');
        const tabStrategie = document.getElementById('tab-strategie');

        if (!tabSparphase || !tabRentenphase || !tabStrategie) return;

        const d = app.state.data;

        // Helper to get or init savings phases
        const ensureSavingsPhases = (pot) => {
            if (!pot.savingsPhases || pot.savingsPhases.length === 0) {
                pot.savingsPhases = [{ fromAge: d.currentAge, toAge: d.retirementAge, amount: pot.monthlyContribution || 0 }];
            }
            return pot.savingsPhases;
        };

// KARUSSELL-VERSION - Zeigt nur einen Topf zur Zeit
        let htmlPots = '';
        if (d.pots && d.pots.length > 0) {
            // Stelle sicher, dass currentPotIndex gültig ist
            if (app.currentPotIndex >= d.pots.length) {
                app.currentPotIndex = d.pots.length - 1;
            }
            
            const currentPot = d.pots[app.currentPotIndex];
            const phases = ensureSavingsPhases(currentPot);
            
            // KARUSSELL HEADER mit Navigation
            htmlPots += `
            <div class="card" style="border-left:4px solid var(--primary); position:relative;">
                <!-- Karussell Navigation -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; padding-bottom:0.75rem; border-bottom:2px solid #e2e8f0;">
                    <button class="btn btn-icon" onclick="app.prevPot()" ${app.currentPotIndex === 0 ? 'disabled style="opacity:0.3;"' : ''}>
                        ◀
                    </button>
                    
                    <div style="text-align:center; flex:1;">
                        <input type="text" value="${currentPot.name}" 
                               onchange="app.updatePotParam(${app.currentPotIndex}, 'name', this.value)"
                               style="font-weight:bold; font-size:1.1rem; text-align:center; border:none; border-bottom:2px solid transparent; padding:4px; max-width:200px;"
                               onfocus="this.style.borderBottom='2px solid var(--primary)'"
                               onblur="this.style.borderBottom='2px solid transparent'">
                        <div style="font-size:0.75rem; color:#64748b; margin-top:4px;">
                            Topf ${app.currentPotIndex + 1} von ${d.pots.length}
                        </div>
                    </div>
                    
                    <button class="btn btn-icon" onclick="app.nextPot()" ${app.currentPotIndex === d.pots.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>
                        ▶
                    </button>
                </div>

                <!-- Spar-Phasen -->
                <div style="margin-bottom:12px;">
                    <div style="font-size:0.75rem; font-weight:600; color:#64748b; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.025em;">Spar-Phasen</div>`;
            
            // Phasen rendern
            phases.forEach((phase, pIdx) => {
                htmlPots += `
                <div style="display:grid; grid-template-columns: 1fr 1fr 1.2fr auto; gap:6px; align-items:end; margin-bottom:4px; padding-bottom:4px; border-bottom: 1px dotted #e2e8f0;">
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.65rem">Ab Alter ${app.tooltip('Alter, ab dem diese Sparrate gilt')}</label>
                        <input type="number" value="${phase.fromAge}" 
                               oninput="app.updateSavingsPhase(${app.currentPotIndex}, ${pIdx}, 'fromAge', this.value)" 
                               style="padding:2px 6px; font-size:0.8rem;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.65rem">Bis Alter ${app.tooltip('Alter, bis zu dem diese Sparrate gilt (nicht einschließlich)')}</label>
                        <input type="number" value="${phase.toAge}" 
                               oninput="app.updateSavingsPhase(${app.currentPotIndex}, ${pIdx}, 'toAge', this.value)" 
                               style="padding:2px 6px; font-size:0.8rem;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.65rem">Sparrate (€) ${app.tooltip('Monatlicher Betrag, der in dieser Phase eingezahlt wird')}</label>
                        <input type="number" value="${phase.amount}" 
                               oninput="app.updateSavingsPhase(${app.currentPotIndex}, ${pIdx}, 'amount', this.value)" 
                               style="padding:2px 6px; font-size:0.8rem;">
                    </div>
                    <button class="btn btn-icon delete" 
                            onclick="app.removeSavingsPhase(${app.currentPotIndex}, ${pIdx})" 
                            style="padding:2px;" ${phases.length === 1 ? 'disabled' : ''}>🗑️</button>
                </div>`;
            });

            htmlPots += `
                    <button class="btn btn-sm btn-outline" 
                            style="width:100%; font-size:0.75rem; padding:4px;" 
                            onclick="app.addSavingsPhase(${app.currentPotIndex})">+ Phase hinzufügen</button>
                </div>

                <!-- Parameter Grid -->
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:6px;">
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.65rem">Start (€) ${app.tooltip('Bereits vorhandenes Startkapital in diesem Topf')}</label>
                        <input type="number" value="${currentPot.value}" 
                               oninput="app.updatePotParam(${app.currentPotIndex}, 'value', this.value)" 
                               style="padding:2px 6px; font-size:0.8rem;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.65rem">± (%) ${app.tooltip('Jährliche Steigerung der Sparrate in Prozent (z.B. 2% bei Gehaltserhöhungen)')}</label>
                        <input type="number" step="0.1" value="${currentPot.contributionIncrease || 0}" 
                               oninput="app.updatePotParam(${app.currentPotIndex}, 'contributionIncrease', this.value)" 
                               style="padding:2px 6px; font-size:0.8rem;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.65rem">Zins Ansp. ${app.tooltip('Erwartete Rendite pro Jahr während der Ansparphase (z.B. 5% für ETFs, 3% für Festgeld)')}</label>
                        <input type="number" step="0.1" value="${currentPot.interestRate}" 
                               oninput="app.updatePotParam(${app.currentPotIndex}, 'interestRate', this.value)" 
                               style="padding:2px 6px; font-size:0.8rem;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.65rem">Zins Entn. ${app.tooltip('Erwartete Rendite pro Jahr während der Entnahmephase (meist konservativer)')}</label>
                        <input type="number" step="0.1" value="${currentPot.interestRateRetirement}" 
                               oninput="app.updatePotParam(${app.currentPotIndex}, 'interestRateRetirement', this.value)" 
                               style="padding:2px 6px; font-size:0.8rem;">
                    </div>
                </div>

                <!-- Aktions-Buttons -->
                <div style="display:flex; gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid #e2e8f0;">
                    <button class="btn btn-sm" 
                            onclick="app.addNewPot()" 
                            style="flex:1; background:var(--primary); color:white; font-size:0.75rem;">
                        ➕ Neuer Topf
                    </button>
                    <button class="btn btn-sm btn-outline" 
                            onclick="app.deletePot(${app.currentPotIndex})" 
                            style="font-size:0.75rem; color:#ef4444; border-color:#ef4444;"
                            ${d.pots.length === 1 ? 'disabled' : ''}>
                        🗑️ Löschen
                    </button>
                </div>
            </div>`;
        }

        // ONE-TIME DEPOSITS (Moved from Strategy)
        htmlPots += `
        <div class="card" style="background:#f0fdf4; border-left:4px solid #16a34a;">
            <div style="font-weight:600; font-size:0.9rem; margin-bottom:8px;">💰 Einmalige Einzahlungen</div>`;

        (d.oneTimePayments || []).forEach((otp, i) => {
            let potOptions = `<option value="all" ${otp.targetPotIndex === 'all' ? 'selected' : ''}>Alle Töpfe</option>`;
            d.pots.forEach((p, pIdx) => {
                potOptions += `<option value="${pIdx}" ${otp.targetPotIndex === pIdx ? 'selected' : ''}>${p.name}</option>`;
            });

            htmlPots += `
                <div style="display:grid; grid-template-columns: 0.5fr 1fr 1fr auto; gap:6px; align-items:end; margin-bottom:4px; padding:6px; background:white; border-radius:6px; border:1px solid #dcfce7;">
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.65rem">Alter ${app.tooltip('Alter, in dem diese Einzahlung erfolgt (z.B. Erbe, Bonus)')}</label>
                        <input type="number" value="${otp.age}" oninput="app.updateOneTimePayment(${i}, 'age', this.value)" style="padding:2px 6px; font-size:0.8rem;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.65rem">Betrag (€) ${app.tooltip('Höhe der einmaligen Einzahlung')}</label>
                        <input type="number" value="${otp.amount}" oninput="app.updateOneTimePayment(${i}, 'amount', this.value)" style="padding:2px 6px; font-size:0.8rem;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.65rem">Ziel-Topf ${app.tooltip('In welchen Topf die Einzahlung fließen soll. "Alle Töpfe" = proportional verteilt')}</label>
                        <select onchange="app.updateOneTimePayment(${i}, 'targetPotIndex', this.value)" style="padding:2px 6px; font-size:0.8rem;">
                            ${potOptions}
                        </select>
                    </div>
                    <button class="btn btn-icon delete" onclick="app.removeOneTimePayment(${i})" style="padding:2px; color:#16a34a;">🗑️</button>
                </div>`;
        });
        htmlPots += `<button class="btn btn-sm btn-outline" style="width:100%; font-size:0.8rem; padding:6px; color:#16a34a; border-color:#16a34a;" onclick="app.addOneTimePayment()">+ Einzahlung hinzufügen</button>
        </div>`;

        tabSparphase.innerHTML = htmlPots;

        // --- TAB 2: RENTE & AUSGABEN ---
        let htmlPension = '';

        // Expenses Card
        htmlPension += `
        <div class="card" style="background:#fff1f2; border-left:4px solid #e11d48; padding:0.75rem;">
            <div style="font-weight:600; font-size:0.85rem; margin-bottom:8px;">📉 Bedarf & Einmalausgaben</div>
            <div class="form-group" style="margin-bottom:8px;">
                <label style="font-size:0.7rem;">Monatlicher Bedarf ${app.tooltip('Gewünschter monatlicher Lebensstandard im Ruhestand (in heutiger Kaufkraft). Wird automatisch inflationsangepasst.')}</label>
                <input type="number" value="${d.retirementExpenses}" oninput="app.updateDataParam('retirementExpenses', this.value)" style="padding:2px 6px; font-size:0.85rem;">
            </div>
            
            <div style="font-weight:600; font-size:0.75rem; margin-bottom:6px; color:#e11d48; border-top:1px solid #fecaca; padding-top:6px;">💰 Einmalige Ausgaben</div>`;

        (d.oneTimeExpenses || []).forEach((exp, i) => {
            let potOptions = `<option value="all" ${exp.targetPotIndex === 'all' ? 'selected' : ''}>Alle Töpfe</option>`;
            d.pots.forEach((p, pIdx) => {
                potOptions += `<option value="${pIdx}" ${exp.targetPotIndex === pIdx ? 'selected' : ''}>${p.name}</option>`;
            });

            htmlPension += `
                <div style="display:grid; grid-template-columns: 0.5fr 1fr 1fr auto; gap:6px; align-items:end; margin-bottom:4px; padding:6px; background:white; border-radius:6px; border:1px solid #fecaca;">
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.65rem">Alter ${app.tooltip('Alter, in dem diese Ausgabe anfällt (z.B. neues Auto, Weltreise)')}</label>
                        <input type="number" value="${exp.age}" oninput="app.updateOneTimeExpense(${i}, 'age', this.value)" style="padding:2px 6px; font-size:0.8rem;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.65rem">Betrag (€) ${app.tooltip('Höhe der einmaligen Ausgabe (in heutiger Kaufkraft)')}</label>
                        <input type="number" value="${exp.amount}" oninput="app.updateOneTimeExpense(${i}, 'amount', this.value)" style="padding:2px 6px; font-size:0.8rem;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.65rem">Ziel-Topf ${app.tooltip('Aus welchem Topf die Ausgabe entnommen wird. "Alle Töpfe" = proportional verteilt')}</label>
                        <select onchange="app.updateOneTimeExpense(${i}, 'targetPotIndex', this.value)" style="padding:2px 6px; font-size:0.8rem; width:100%;">
                            ${potOptions}
                        </select>
                    </div>
                    <button class="btn btn-icon delete" onclick="app.removeOneTimeExpense(${i})" style="padding:2px; color:#e11d48;">🗑️</button>
                </div>`;
        });
        htmlPension += `<button class="btn btn-sm btn-outline" style="width:100%; font-size:0.75rem; padding:4px; color:#e11d48; border-color:#e11d48;" onclick="app.addOneTimeExpense()">+ Ausgabe hinzufügen</button>
        </div>`;

        // Pensions List
        htmlPension += `
        <div class="card" style="background:#f0fdfa; border-left:4px solid #0d9488; padding:0.75rem;">
            <div style="font-weight:600; font-size:0.85rem; margin-bottom:8px;">👴 Rentenquellen</div>`;
        (d.pensions || []).forEach((p, idx) => {
            htmlPension += `
                <div style="background:white; padding:6px; border-radius:6px; margin-bottom:6px; border:1px solid #e2e8f0;">
                    <div style="display:flex; gap:6px; margin-bottom:4px;">
                        <input type="text" value="${p.label}" onchange="app.updatePensionParam(${idx}, 'label', this.value)" style="flex:2; font-weight:600; font-size:0.8rem; padding: 2px 6px;">
                        <button class="btn-icon delete" onclick="app.removePension(${idx})" style="padding:2px;">🗑️</button>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1.2fr 1fr; gap:6px;">
                        <div class="form-group" style="margin:0;">
                            <label style="font-size:0.65rem;">Betrag (€) ${app.tooltip('Monatliche Einnahme (z.B. Mieteinnahmen, Dividenden)')}</label>
                            <input type="number" value="${p.amount}" oninput="app.updatePensionParam(${idx}, 'amount', this.value)" style="padding:2px 6px; font-size:0.8rem;">
                        </div>
                        <div class="form-group" style="margin:0;">
                             <label style="font-size:0.65rem;">Start / Trend ${app.tooltip('Links: Ab welchem Alter die Rente gezahlt wird. Rechts: Jährliche Steigerung in % (z.B. 0,5-2%)')}</label>
                            <div style="display:flex; gap:4px;">
                                <input type="number" value="${p.startAge || d.retirementAge}" oninput="app.updatePensionParam(${idx}, 'startAge', this.value)" style="padding:2px 4px; font-size:0.8rem; width:45%;">
                                <input type="number" step="0.1" value="${p.growth}" oninput="app.updatePensionParam(${idx}, 'growth', this.value)" style="padding:2px 4px; font-size:0.8rem; width:55%;">
                            </div>
                        </div>
                    </div>
                </div>`;
        });
        htmlPension += `<button class="btn btn-sm" style="background:#0d9488; width:100%; font-size:0.75rem; padding:4px;" onclick="app.addPension()">➕ Quelle hinzufügen</button>
        </div>`;
        tabRentenphase.innerHTML = htmlPension;

        // --- TAB 2b: ADDITIONAL INCOME (Rental, Dividends etc.) ---
        let htmlIncome = `
        <div class="card" style="background:#fefce8; border-left:4px solid #eab308; padding:0.75rem;">
            <div style="font-weight:600; font-size:0.85rem; margin-bottom:8px;">🏠 Miete, Dividenden & Sonstiges</div>`;
        (d.rentalIncomes || []).forEach((ri, idx) => {
            htmlIncome += `
                <div style="background:white; padding:6px; border-radius:6px; margin-bottom:6px; border:1px solid #fef08a;">
                    <div style="display:flex; gap:6px; margin-bottom:4px;">
                        <input type="text" value="${ri.label}" onchange="app.updateRentalIncomeParam(${idx}, 'label', this.value)" style="flex:2; font-weight:600; font-size:0.8rem; padding: 2px 6px;">
                        <button class="btn-icon delete" onclick="app.removeRentalIncome(${idx})" style="padding:2px; color:#eab308;">🗑️</button>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1.2fr 1fr; gap:6px;">
                        <div class="form-group" style="margin:0;">
                            <label style="font-size:0.65rem;">Betrag (€)</label>
                            <input type="number" value="${ri.amount}" oninput="app.updateRentalIncomeParam(${idx}, 'amount', this.value)" style="padding:2px 6px; font-size:0.8rem;">
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label style="font-size:0.65rem;">Start / Trend ${app.tooltip('Links: Ab welchem Alter die Einnahme beginnt. Rechts: Jährliche Steigerung in % (z.B. 2% Mieterhöhung / Dividensteigerung)')}</label>
                            <div style="display:flex; gap:4px;">
                                <input type="number" value="${ri.startAge || d.retirementAge}" oninput="app.updateRentalIncomeParam(${idx}, 'startAge', this.value)" style="padding:2px 4px; font-size:0.8rem; width:45%;">
                                <input type="number" step="0.1" value="${ri.growth || 0}" oninput="app.updateRentalIncomeParam(${idx}, 'growth', this.value)" style="padding:2px 4px; font-size:0.8rem; width:55%;">
                            </div>
                        </div>
                    </div>
                </div>`;
        });
        htmlIncome += `<button class="btn btn-sm" style="background:#eab308; width:100%; font-size:0.75rem; padding:4px; color:white;" onclick="app.addRentalIncome()">➕ Einnahme hinzufügen</button>
        </div>`;

        // --- TAB 2c: EXPENSE ADJUSTMENTS (Moved from Strategy) ---
        htmlIncome += `
        <div class="card" style="background:#fef2f2; border-left:4px solid #fee2e2;">
            <div style="font-weight:600; font-size:0.9rem; margin-bottom:8px;">📉 Ausgaben-Anpassungen (Rente)</div>`;
        (d.expenseAdjustments || []).forEach((ea, i) => {
            htmlIncome += `
                <div style="display:grid; grid-template-columns: 1fr 1fr auto; gap:8px; align-items:end; margin-bottom:8px; padding:8px; background:white; border-radius:6px; border:1px solid #fee2e2;">
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.7rem">Ab Alter ${app.tooltip('Ab diesem Alter gilt der neue monatliche Bedarf (z.B. geringerer Bedarf ab 75)')}</label>
                        <input type="number" value="${ea.fromAge}" oninput="app.updateExpenseAdjustment(${i}, 'fromAge', this.value)" style="padding:4px 8px; font-size:0.85rem;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.7rem">Betrag (€/mtl.) ${app.tooltip('Neuer monatlicher Bedarf ab diesem Alter (in heutiger Kaufkraft)')}</label>
                        <input type="number" value="${ea.monthlyAmount}" oninput="app.updateExpenseAdjustment(${i}, 'monthlyAmount', this.value)" style="padding:4px 8px; font-size:0.85rem;">
                    </div>
                    <button class="btn btn-icon delete" onclick="app.removeExpenseAdjustment(${i})" style="padding:2px; color:#ef4444;">🗑️</button>
                </div>`;
        });
        htmlIncome += `<button class="btn btn-sm btn-outline" style="width:100%; font-size:0.8rem; padding:6px; color:#ef4444; border-color:#ef4444;" onclick="app.addExpenseAdjustment()">+ Anpassung hinzufügen</button>
        </div>`;

        tabRentenphase.innerHTML += htmlIncome;

        // --- TAB 3: STRATEGIE ---
        let htmlAdvanced = '';

        // Alter & Planung
        htmlAdvanced += `
        <div class="card" style="background:var(--primary-light); border-left:4px solid var(--primary);">
            <div style="font-weight:600; font-size:0.9rem; margin-bottom:12px;">📅 Alter & Planung</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:0.7rem">Aktuelles Alter</label>
                    <input type="number" value="${d.currentAge}" oninput="app.updateDataParam('currentAge', this.value)" style="padding:4px 8px; font-size:0.9rem;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:0.7rem">Renteneintritt (global)</label>
                    <input type="number" value="${d.retirementAge}" oninput="app.updateDataParam('retirementAge', this.value)" style="padding:4px 8px; font-size:0.9rem;">
                </div>
            </div>
        </div>`;

        // --- Rentendeckungsgrad / Sicherheits-Check Logic ---
        // This is now purely placeholder HTML, updated by updateCoverageDisplay()
        htmlAdvanced += `
        <div id="coverage-card" class="card" style="background: white; border: 2px solid #3b82f6; border-radius:12px; position: relative; overflow: hidden; margin-bottom:15px;">
            <div id="coverage-accent" style="position: absolute; top:0; left:0; right:0; height:4px; background:#3b82f6;"></div>
            <div style="font-weight:700; font-size:1.1rem; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                <span>🛡️ Sicherheits-Check</span>
                <span id="coverage-ratio" style="color:#3b82f6; font-size:1.4rem;">-%</span>
            </div>
            
            <div id="coverage-status-box" style="text-align:center; padding:10px 0; margin-bottom:15px; background:#3b82f615; border-radius:8px;">
                <div style="font-size:0.85rem; color:#64748b;">Status</div>
                <div id="coverage-status" style="font-weight:600; color:#3b82f6;">Berechne...</div>
            </div>

            <div class="form-group" style="margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <label style="font-size:0.8rem; margin:0;">Angenommene Entnahmerate ${app.tooltip('Die jährliche Entnahmerate bestimmt, wie viel % deines Kapitals du pro Jahr entnehmen kannst. 3-4% gilt als sicher (Trinity-Studie). Niedriger = sicherer, höher = riskanter.')}</label>
                    <span id="coverage-rate-text" style="font-weight:600; color:#3b82f6;">3.5%</span>
                </div>
                <input type="range" min="2" max="5" step="0.1" value="${d.safeWithdrawalRate || 3.5}" 
                       oninput="app.updateDataParam('safeWithdrawalRate', this.value)" 
                       style="width:100%; cursor:pointer;">
                <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#94a3b8; margin-top:4px;">
                    <span>Max. Sicherheit (2%)</span>
                    <span>Offensiv (5%)</span>
                </div>
            </div>

            <div style="background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:15px;">
                <div style="font-size:0.75rem; font-weight:600; margin-bottom:8px; color:#475569;">📊 Erfolgs-Wahrscheinlichkeit (Monte Carlo)</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; font-size:0.75rem;">
                    <div style="color:#64748b;">100% Deckung:</div><div style="font-weight:600; text-align:right;">~ 80% Erfolg</div>
                    <div style="color:#64748b;">125% Deckung:</div><div style="font-weight:600; text-align:right;">~ 94% Erfolg</div>
                    <div style="color:#64748b;">>150% Deckung:</div><div style="font-weight:600; text-align:right;">> 98% Erfolg</div>
                </div>
            </div>
            <div id="coverage-hint-box"></div>
        </div>`;

        // KOMPAKTE 2-SPALTEN-ANSICHT: Inflation + Entnahme/Steuern nebeneinander
        htmlAdvanced += `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;">
            <!-- Inflation (Linke Spalte) -->
            <div class="card" style="padding:0.75rem;">
                <div style="font-weight:600; font-size:0.85rem; margin-bottom:8px;">📈 Inflation</div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:0.65rem;">Erwartete Inflation (%)</label>
                    <input type="number" step="0.1" value="${d.inflationRate}" oninput="app.updateDataParam('inflationRate', this.value)" style="padding:4px 8px; font-size:0.85rem; width:100%;">
                </div>
            </div>

            <!-- Entnahme & Steuern (Rechte Spalte) -->
            <div class="card" style="padding:0.75rem;">
                <div style="font-weight:600; font-size:0.85rem; margin-bottom:8px;">🚪 Entnahme & Steuern</div>
                <div class="form-group" style="margin-bottom:6px;">
                    <label style="font-size:0.65rem;">Strategie</label>
                    <select onchange="app.updateDataParam('withdrawalStrategy', this.value)" style="padding:2px 6px; font-size:0.8rem; width:100%;">
                        <option value="proportional" ${d.withdrawalStrategy === 'proportional' ? 'selected' : ''}>Proportional</option>
                        <option value="sequential" ${d.withdrawalStrategy === 'sequential' ? 'selected' : ''}>Sequenziell</option>
                    </select>
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:0.65rem;">Steuer (%) ${app.tooltip('Durchschnittliche Steuerbelastung auf Kapitaleinkünfte (Kapitalertragsteuer + Soli ≈ 26%). Bei Riester/Rürup volle Versteuerung.')}</label>
                    <input type="number" step="0.1" value="${d.withdrawalTaxRate || 18.5}" oninput="app.updateDataParam('withdrawalTaxRate', this.value)" style="padding:2px 6px; font-size:0.8rem;">	
                </div>
            </div>
        </div>`;

        htmlAdvanced += `</div>`;
        if (d.withdrawalStrategy === 'sequential') {
            htmlAdvanced += `
            <div class="card">
                <div style="font-weight:600; font-size:0.9rem; margin-bottom:8px;">🔢 Entnahme-Reihenfolge</div>
                <p style="font-size:0.75rem; color:#64748b; margin-bottom:10px;">Verschieben Sie die Töpfe in die gewünschte Reihenfolge (oben = zuerst).</p>
                <div style="display:flex; flex-direction:column; gap:5px;">`;

            const order = (d.withdrawalOrder && d.withdrawalOrder.length === d.pots.length)
                ? d.withdrawalOrder
                : d.pots.map((_, i) => i);

            order.forEach((potIdx, i) => {
                const pot = d.pots[potIdx];
                if (!pot) return;
                htmlAdvanced += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:8px 12px; border-radius:6px; border:1px solid #e2e8f0;">
                    <span style="font-size:0.85rem; font-weight:500;">${pot.name}</span>
                    <div style="display:flex; gap:4px;">
                        <button class="btn btn-sm btn-icon" onclick="app.movePotInOrder(${i}, -1)" ${i === 0 ? 'disabled' : ''} style="padding:2px 6px;">↑</button>
                        <button class="btn btn-sm btn-icon" onclick="app.movePotInOrder(${i}, 1)" ${i === order.length - 1 ? 'disabled' : ''} style="padding:2px 6px;">↓</button>
                    </div>
                </div>`;
            });
            htmlAdvanced += `</div></div>`;
        }


        tabStrategie.innerHTML = htmlAdvanced;
    },

    // --- One-Time Payments ---
    addOneTimePayment: () => {
        const d = app.state.data;
        d.oneTimePayments = d.oneTimePayments || [];
        d.oneTimePayments.push({ age: d.retirementAge, amount: 0, targetPotIndex: 'all', description: '' });
        app.handleUpdateParams(false); // Force editor refresh
    },
    removeOneTimePayment: (index) => {
        app.state.data.oneTimePayments.splice(index, 1);
        app.initDashboard();
    },
    updateOneTimePayment: (index, key, value) => {
        if (key === 'targetPotIndex') {
            app.state.data.oneTimePayments[index][key] = value === 'all' ? 'all' : +value;
        } else {
            app.state.data.oneTimePayments[index][key] = +value;
        }
        app.handleUpdateParams();
    },

    // --- One-Time Expenses ---
    addOneTimeExpense: () => {
        const d = app.state.data;
        d.oneTimeExpenses = d.oneTimeExpenses || [];
        d.oneTimeExpenses.push({ age: d.retirementAge, amount: 0, targetPotIndex: 'all', description: '' });
        app.initDashboard();
    },
    removeOneTimeExpense: (index) => {
        app.state.data.oneTimeExpenses.splice(index, 1);
        app.initDashboard();
    },
    updateOneTimeExpense: (index, key, value) => {
        if (key === 'targetPotIndex') {
            app.state.data.oneTimeExpenses[index][key] = value === 'all' ? 'all' : +value;
        } else {
            app.state.data.oneTimeExpenses[index][key] = +value;
        }
        app.handleUpdateParams();
    },

    // --- Expense Adjustments ---
    addExpenseAdjustment: () => {
        const d = app.state.data;
        d.expenseAdjustments = d.expenseAdjustments || [];
        d.expenseAdjustments.push({ fromAge: d.retirementAge + 10, monthlyAmount: d.retirementExpenses });
        app.handleUpdateParams(false); // Force editor refresh
    },
    removeExpenseAdjustment: (index) => {
        app.state.data.expenseAdjustments.splice(index, 1);
        app.initDashboard();
    },
    updateExpenseAdjustment: (index, key, value) => {
        app.state.data.expenseAdjustments[index][key] = +value;
        app.handleUpdateParams();
    },

    updateDataParam: (key, value) => {
        app.state.data[key] = (typeof app.state.data[key] === 'number') ? +value : value;
    
    // Bei Strategie-Änderung muss der Editor neu geladen werden
    if (key === 'withdrawalStrategy') {
        app.handleUpdateParams(false);  // false = Editor wird neu geladen
    } else {
        app.handleUpdateParams();  // true = Editor bleibt
    }
},

updatePotParam: (index, key, value) => {
    // 'name' ist ein String, alles andere sind Zahlen
    app.state.data.pots[index][key] = (key === 'name') ? value : +value;
    app.handleUpdateParams();
},

    updatePensionParam: (index, key, value) => {
        app.state.data.pensions[index][key] = (key === 'label') ? value : +value;
        app.handleUpdateParams();
    },

    // --- Savings Phases ---
    addSavingsPhase: (potIdx) => {
        const pot = app.state.data.pots[potIdx];
        if (!pot.savingsPhases) pot.savingsPhases = [{ fromAge: app.state.data.currentAge, toAge: app.state.data.retirementAge, amount: pot.monthlyContribution || 0 }];
        const lastPhase = pot.savingsPhases[pot.savingsPhases.length - 1];
        pot.savingsPhases.push({ fromAge: lastPhase.toAge, toAge: lastPhase.toAge + 5, amount: lastPhase.amount });
        app.handleUpdateParams(false);
    },
    removeSavingsPhase: (potIdx, phaseIdx) => {
        app.state.data.pots[potIdx].savingsPhases.splice(phaseIdx, 1);
        app.initDashboard();
    },
    updateSavingsPhase: (potIdx, phaseIdx, key, value) => {
        app.state.data.pots[potIdx].savingsPhases[phaseIdx][key] = +value;
        app.handleUpdateParams();
    },

    // --- Rental Income ---
    addRentalIncome: () => {
        const d = app.state.data;
        d.rentalIncomes = d.rentalIncomes || [];
        d.rentalIncomes.push({ id: 'rental_' + Date.now(), label: 'Miete / Dividende', amount: 0, growth: 0, startAge: d.retirementAge });
        app.initDashboard();
    },
    removeRentalIncome: (index) => {
        app.state.data.rentalIncomes.splice(index, 1);
        app.initDashboard();
    },
    updateRentalIncomeParam: (index, key, value) => {
        app.state.data.rentalIncomes[index][key] = (key === 'label') ? value : +value;
        app.handleUpdateParams();
    },

    updateParams: () => {
        app.initDashboard();
    },

    addPension: () => {
        const d = app.state.data;
        d.pensions = d.pensions || [];
        d.pensions.push({ id: 'custom_' + Date.now(), label: 'Neue Rente', amount: 0, growth: 0, startAge: d.retirementAge });
        app.initDashboard();
    },
    removePension: (index) => {
        app.state.data.pensions.splice(index, 1);
        app.initDashboard();
    },

    movePotInOrder: (index, direction) => {
        const order = app.state.data.withdrawalOrder;
        const target = index + direction;
        if (target < 0 || target >= order.length) return;
        [order[index], order[target]] = [order[target], order[index]];
        app.initDashboard();
    },

    // --- Debounced Updates ---
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    updateDataParamDebounced: null,
    updateParamsDebounced: null,

    handleUpdateParams: (skipEditor = true) => {
        if (!app.updateParamsDebounced) {
            app.updateParamsDebounced = app.debounce((skip) => app.initDashboard(skip), 600);
        }
        // Force immediate coverage check if in Strategie tab
        if (skipEditor) {
            const results = calculateSimulation(app.state.data);
            app.updateCoverageDisplay(results);
        }
        app.updateParamsDebounced(skipEditor);
    },

    updateCoverageDisplay: (results) => {
        const d = app.state.data;
        const elRatio = document.getElementById('coverage-ratio');
        const elStatus = document.getElementById('coverage-status');
        const elCard = document.getElementById('coverage-card');
        const elAccent = document.getElementById('coverage-accent');
        const elStatusBox = document.getElementById('coverage-status-box');
        const elRateText = document.getElementById('coverage-rate-text');
        const elHintBox = document.getElementById('coverage-hint-box');

        if (!elRatio) return;

        // --- CALCULATION LOGIC ---
        // 1. Current Assets (Today)
        let totalAssets = d.pots.reduce((sum, p) => sum + (p.value || p.startCapital || 0), 0);

        // 2. Discounted Future One-Time Payments
        (d.oneTimePayments || []).forEach(otp => {
            const yearsToPayment = otp.age - d.currentAge;
            if (yearsToPayment > 0) {
                const discountFactor = Math.pow(1 + (d.inflationRate / 100), yearsToPayment);
                totalAssets += otp.amount / discountFactor;
            } else if (yearsToPayment === 0) {
                totalAssets += otp.amount;
            }
        });

        // 3. Annual Income Sources
        const annualPensions = (d.pensions || []).reduce((sum, p) => sum + (p.amount * 12), 0);

        // 4. Annual Expenses
        const annualExpenses = d.retirementExpenses * 12;

        // 5. Withdrawal Rate (SWR) and Tax
        const swr = +d.safeWithdrawalRate || 3.5;
        const taxRate = +d.withdrawalTaxRate || 0;

        // 6. SAFETY INDEX FORMULA
        // Index = (Pensions + (Assets * WithdrawalRate * (1 - Tax))) / DesiredExpenses
        // 100% means current assets + pensions perfectly cover desired lifestyle forever (statistically).
        let safetyIndex = 0;
        if (annualExpenses > 0) {
            safetyIndex = (annualPensions + (totalAssets * (swr / 100) * (1 - (taxRate / 100)))) / annualExpenses * 100;
        } else {
            safetyIndex = 1000; // Unlimited safety if no expenses
        }

        // --- UI & STATUS ---
        // Simulation Depletion Check (The "Hard Check")
        const simulationDepleted = results.some(r => r.age >= d.retirementAge && r.totalWealth <= 0);

        let statusColor = '#f59e0b'; // Yellow/Orange
        let statusText = 'Sparen weiterhin notwendig';

        if (safetyIndex >= 100) {
            statusColor = '#10b981';
            statusText = 'Lebensstil gesichert';
        }
        if (safetyIndex >= 130) {
            statusColor = '#3b82f6';
            statusText = 'Finanzielle Freiheit / Überfinanziert';
        }

        if (annualPensions >= annualExpenses) {
            statusColor = '#10b981';
            statusText = 'Basisbedarf komplett durch Renten gedeckt';
        }

        // Simulation override (Red flag)
        if (simulationDepleted) {
            statusColor = '#e11d48'; // Red
            statusText = '⚠️ Simulation zeigt Versorgungslücke!';
        }

        // DOM Updates
        const coverageText = (safetyIndex > 999 ? '>1000' : safetyIndex.toFixed(1)) + '%';
        elRatio.textContent = coverageText;
        elRatio.style.color = statusColor;

        // Update new KPI Bar element if exists
        const kpiCov = document.getElementById('kpi-coverage');
        if (kpiCov) {
            kpiCov.textContent = coverageText;
            kpiCov.style.color = statusColor;
        }
        elStatus.textContent = statusText;
        elStatus.style.color = statusColor;
        elCard.style.borderColor = statusColor;
        elAccent.style.background = statusColor;
        elStatusBox.style.background = statusColor + '15';
        if (elRateText) elRateText.textContent = swr.toFixed(1) + '%';

        // Hint update
        let hintHtml = '';
        if (simulationDepleted && safetyIndex >= 100) {
            hintHtml = `<div style="background:#fff1f2; border-left:4px solid #e11d48; padding:10px; border-radius:4px; font-size:0.8rem; color:#9f1239; line-height:1.4; margin-top:10px;">
                🛑 <strong>Achtung:</strong> Trotz positivem Sicherheits-Index reicht das Geld in der Simulation nicht bis zum Ende. Grund: Inflation oder hohe Einmalausgaben.
            </div>`;
        } else if (annualPensions >= annualExpenses) {
            const formattedAssets = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalAssets);
            hintHtml = `<div style="background:#f0fdf4; border-left:4px solid #10b981; padding:10px; border-radius:4px; font-size:0.8rem; color:#166534; line-height:1.4; margin-top:10px;">
                🎉 <strong>Hervorragend:</strong> Allein deine Renten decken 100% deiner Ausgaben. Dein Vermögen (${formattedAssets}) ist reiner Luxuspuffer.
            </div>`;
        } else if (safetyIndex > 130) {
            hintHtml = `<div style="background:#eff6ff; border-left:4px solid #3b82f6; padding:10px; border-radius:4px; font-size:0.8rem; color:#1d4ed8; line-height:1.4; margin-top:10px;">
                💡 <strong>Tipp:</strong> Du bist deutlich übererfüllt. Du könntest entweder heute mehr ausgeben, die Sparrate senken oder Jahre früher in Rente gehen!
            </div>`;
        } else if (safetyIndex >= 100) {
            hintHtml = `<div style="background:#f0fdf4; border-left:4px solid #10b981; padding:10px; border-radius:4px; font-size:0.8rem; color:#166534; line-height:1.4; margin-top:10px;">
                ✅ <strong>Ziel erreicht:</strong> Dein aktueller Plan deckt 100% deines Rentenbedarfs ab.
            </div>`;
        }
        elHintBox.innerHTML = hintHtml;
    },

    switchView: (view) => {
        document.getElementById('view-chart').style.display = view === 'chart' ? 'block' : 'none';
        document.getElementById('view-table').style.display = view === 'table' ? 'block' : 'none';

        // Active button styling
        const chartBtn = document.querySelector('button[onclick*="chart"]');
        const tableBtn = document.querySelector('button[onclick*="table"]');
        if (chartBtn && tableBtn) {
            chartBtn.classList.toggle('btn-primary', view === 'chart');
            chartBtn.classList.toggle('btn-secondary', view !== 'chart');
            tableBtn.classList.toggle('btn-primary', view === 'table');
            tableBtn.classList.toggle('btn-secondary', view !== 'table');
        }
    },

    // --- Password Modal ---
    showPasswordModal: (title, desc, callback) => {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalDescription').textContent = desc;
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordModal').style.display = 'flex';
        document.getElementById('passwordInput').focus();
        app.passwordCallback = callback;
    },

    closePasswordModal: () => {
        document.getElementById('passwordModal').style.display = 'none';
        app.passwordCallback = null;
    },

    handlePasswordSubmit: () => {
        const pw = document.getElementById('passwordInput').value;
        if (!pw) {
            app.closePasswordModal();
            return;
        }
        const cb = app.passwordCallback;
        app.closePasswordModal();
        if (cb) cb(pw);
    },

    // --- Reality Check Modal ---
openRealityCheck: (age, potValues) => {
    const d = app.state.data;
    app.state.currentRCAge = age;

    document.getElementById('rcModalDescription').textContent = `Tatsächliche Portfoliowerte am Ende des Alters ${age} eingeben:`;
    const container = document.getElementById('rcInputsContainer');

    let html = '';
    d.pots.forEach((pot, i) => {
        const val = potValues[i] || 0;
        html += `
        <div class="form-group">
            <label>${pot.name} (€)</label>
            <input type="number" class="rc-pot-input" data-index="${i}" value="${Math.round(val)}">
        </div>`;
    });
    container.innerHTML = html;
    document.getElementById('realityCheckModal').style.display = 'flex';
},

    closeRealityCheckModal: () => {
        document.getElementById('realityCheckModal').style.display = 'none';
        app.state.currentRCAge = null;
    },

    saveRealityCheck: () => {
        const age = app.state.currentRCAge;
        if (age === null || age === undefined) return;

        const inputs = document.querySelectorAll('.rc-pot-input');
        const values = [];
        inputs.forEach(input => {
            values[+input.dataset.index] = +input.value;
        });

        app.state.data.realHistory[age] = values;
        app.closeRealityCheckModal();
        app.initDashboard();
        app.showToast('Realitätsdaten gespeichert!', 'success');
    },

    saveData: async () => {
        app.showPasswordModal('🔒 Verschlüsselt speichern', 'Wähle ein Passwort für deinen Plan:', async (pw) => {
            try {
                const encrypted = await encryptData(app.state.data, pw);
                const blob = new Blob([encrypted], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.download = `plan_${new Date().toISOString().split('T')[0]}.encrypted`;
                a.href = url;
                a.click();
                app.showToast('Plan erfolgreich gespeichert!', 'success');
            } catch (e) { app.showToast('Fehler: ' + e.message, 'error'); }
        });
    },

    loadData: async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        event.target.value = ''; // Reset input

        app.showPasswordModal('🔓 Plan laden', 'Bitte gib dein Passwort ein:', async (pw) => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const decrypted = await decryptData(new Uint8Array(arrayBuffer), pw);
                decrypted.step = 0; // Reset step if needed or just skip wizard
                app.state.data = decrypted;
                document.getElementById('wizard-container').style.display = 'none';
                document.getElementById('view-dashboard').style.display = 'grid';
                app.initDashboard();
                app.showToast('Plan erfolgreich geladen!', 'success');
            } catch (e) { app.showToast('Falsches Passwort oder beschädigte Datei!', 'error'); }
        });
    },

    reset: () => { if (confirm('Neu starten?')) location.reload(); }
};

window.addEventListener('DOMContentLoaded', app.init);
window.app = app;
