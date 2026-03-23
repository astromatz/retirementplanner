export const createWizard = (app) => ({
    steps: [
        {
            id: 'intro',
            render: () => `
                <div class="wz-hero">
                    <div class="wz-hero-icon">🌱</div>
                    <h1>Willkommen zu deiner Ruhestandsplanung</h1>
                    <p>In wenigen Schritten erstellst du deinen persönlichen Plan – komplett kostenlos und anonym.</p>
                </div>
                <div class="wz-steps-overview">
                    <div class="wz-step-pill">❓ Konzept</div>
                    <div class="wz-step-pill">👤 Basisdaten</div>
                    <div class="wz-step-pill">🏦 Vermögen</div>
                    <div class="wz-step-pill">📊 Strategie</div>
                </div>
                <div class="wz-info-box">
                    <strong>⏱ Dauer:</strong> ca. 3–5 Minuten &nbsp;·&nbsp; <strong>🔒 Daten bleiben lokal</strong>
                </div>
            `,
            validate: () => true
        },
        {
            id: 'concept',
            render: () => `
                <div class="wz-step-header">
                    <h2>Das Konzept</h2>
                    <p>Wie dieser Planer funktioniert:</p>
                </div>
                <div class="wz-concept-grid">
                    <div class="wz-concept-card">
                        <div class="wz-concept-icon">🏗️</div>
                        <div class="wz-concept-text">
                            <h3>Schichten-Modell</h3>
                            <p>Wir kombinieren deine <strong>fixen Renten</strong> mit deinem <strong>privaten Vermögen</strong>.</p>
                        </div>
                    </div>
                    <div class="wz-concept-card">
                        <div class="wz-concept-icon">💸</div>
                        <div class="wz-concept-text">
                            <h3>Entnahmelücke</h3>
                            <p>Das Tool berechnet, wie viel Geld du monatlich aus deinem Ersparten entnehmen musst, um deinen Wunsch-Lebensstandard zu halten.</p>
                        </div>
                    </div>
                    <div class="wz-concept-card">
                        <div class="wz-concept-icon">📉</div>
                        <div class="wz-concept-text">
                            <h3>Inflation & Steuern</h3>
                            <p>Wichtig: Wir berücksichtigen Inflation (Kaufkraftverlust) und Steuern auf Kapitalerträge, damit dein Plan realistisch bleibt.</p>
                        </div>
                    </div>
                </div>
                <div class="wz-info-box">
                    <strong>🛡️ Sicherheit:</strong> Alle Berechnungen finden nur in deinem Browser statt. Keine Daten werden an Server übertragen.
                </div>
            `,
            validate: () => true
        },
        {
            id: 'basics',
            render: (data) => `
                <div class="wz-step-header">
                    <h2>Basisdaten</h2>
                    <p>Dein zeitlicher Horizont ist der wichtigste Faktor für deinen Plan.</p>
                </div>
                <div class="wz-form-card">
                    <div class="wz-field">
                        <label>Dein aktuelles Alter</label>
                        <div class="hybrid-input-wrapper">
                            <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this, -1)">−</button>
                            <input type="number" id="inp-currentAge" value="${data.currentAge}" oninput="app.updateWizardPreview()" min="1" max="120">
                            <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this, 1)">+</button>
                        </div>
                    </div>
                    <div class="wz-field">
                        <label>Geplantes Rentenalter</label>
                        <div class="hybrid-input-wrapper">
                            <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this, -1)">−</button>
                            <input type="number" id="inp-retirementAge" value="${data.retirementAge}" oninput="app.updateWizardPreview()" min="1" max="120">
                            <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this, 1)">+</button>
                        </div>
                    </div>
                    <div class="wz-field">
                        <label>Betrachtung bis Alter</label>
                        <div class="hybrid-input-wrapper">
                            <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this, -1)">−</button>
                            <input type="number" id="inp-endAge" value="${data.endAge}" oninput="app.updateWizardPreview()" min="1" max="120">
                            <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this, 1)">+</button>
                        </div>
                        <span class="wz-hint">Für wie lange soll dein Geld reichen?</span>
                    </div>
                </div>

                <div class="wz-info-box">
                    <strong>💡 Zinseszins:</strong> Je länger deine Ansparphase, desto stärker wirkt der Zinseszins zu deinen Gunsten.
                </div>
            `,
            save: (data) => {
                const oldRetirementAge = data.retirementAge;
                data.currentAge = +document.getElementById('inp-currentAge').value;
                data.retirementAge = +document.getElementById('inp-retirementAge').value;
                data.endAge = +document.getElementById('inp-endAge').value;

                // Sync pensions and rental incomes if they were at the old retirementAge
                if (data.pensions) {
                    data.pensions.forEach(p => { if (p.startAge === oldRetirementAge || p.startAge === 67) p.startAge = data.retirementAge; });
                }
                // Sync savings phases end ages if they matched old retirementAge
                if (data.pots) {
                    data.pots.forEach(pot => {
                        if (pot.savingsPhases) {
                            pot.savingsPhases.forEach(ph => {
                                if (ph.toAge === oldRetirementAge || ph.toAge === 67) ph.toAge = data.retirementAge;
                            });
                        }
                    });
                }
            },
            validate: () => {
                const cur = +document.getElementById('inp-currentAge').value;
                const ret = +document.getElementById('inp-retirementAge').value;
                return ret > cur;
            }
        },
        {
            id: 'pots-intro',
            render: (data) => `
                <div class="wz-step-header">
                    <h2>Vermögenstöpfe</h2>
                    <p>Wie viele verschiedene Konten oder Depots möchtest du einbeziehen?</p>
                </div>
                <div class="wz-option-grid">
                    <div class="wz-option ${data.numPots === 1 ? 'selected' : ''}" onclick="app.setOption('numPots', 1, this); app.updateWizardPreview();">
                        <span class="wz-option-icon">🍯</span>
                        <strong>1 Topf</strong>
                        <span class="wz-option-desc">Einfachster Einstieg</span>
                    </div>
                    <div class="wz-option ${data.numPots === 2 ? 'selected' : ''}" onclick="app.setOption('numPots', 2, this); app.updateWizardPreview();">
                        <span class="wz-option-icon">🍯🍯</span>
                        <strong>2 Töpfe</strong>
                        <span class="wz-option-desc">z.B. Aktien + Cash</span>
                    </div>
                    <div class="wz-option ${data.numPots === 3 ? 'selected' : ''}" onclick="app.setOption('numPots', 3, this); app.updateWizardPreview();">
                        <span class="wz-option-icon">🏗️</span>
                        <strong>3 Töpfe</strong>
                        <span class="wz-option-desc">Komplette Strategie</span>
                    </div>
                </div>
                <div class="wz-info-box" style="line-height:1.4;">
                    <strong style="display:block; margin-bottom:4px;">🍯 Das Topf-Konzept einfach erklärt:</strong>
                    Stell dir Töpfe wie separate „Schubladen“ für dein Geld vor. 
                    Jede Schublade kann für einen anderen Zweck sein (z.B. Aktien für langfristiges Wachstum, Tagesgeld für Sicherheit).
                    <ul style="margin: 8px 0 0 16px; padding: 0;">
                        <li>Jeder Topf hat seine <strong>eigene Rendite</strong> (Zinsen).</li>
                        <li>Jeder Topf kann <strong>anders versteuert</strong> werden.</li>
                        <li>Du entscheidest, wie viel in welchen Topf fließt.</li>
                    </ul>
                </div>
            `,
            save: (data) => {
                if (data.pots.length !== data.numPots) {
                    data.pots = Array(data.numPots).fill().map((_, i) => ({
                        name: `Topf ${i + 1}`,
                        value: 0,
                        interestRate: 4.0,
                        interestRateRetirement: 3.0,
                        monthlyContribution: 0,
                        contributionIncrease: 0,
                        taxRate: 18.5
                    }));
                }
            },
            validate: () => true
        },
        {
            id: 'pots-config',
            render: (data) => {
                let html = `
                <div class="wz-step-header">
                    <h2>Töpfe konfigurieren</h2>
                    <p>Gib deinen Töpfen Namen, Werte und eine Renditeerwartung.</p>
                </div>`;

                html += `<div class="wz-pot-tabs" id="pot-tabs">` +
                    data.pots.map((pot, i) => `
                        <div class="wz-pot-tab pot-color-${i % 5} ${i === 0 ? 'active' : ''}" id="pot-tab-${i}" onclick="app.switchPotTab(${i})">
                            <input type="text" id="pot-name-${i}" value="${pot.name || `Topf ${i + 1}`}"
                                   class="wz-pot-tab-input" placeholder="Topf Name…"
                                   oninput="app.updatePotName(${i}, this.value)">
                        </div>`).join('') +
                    `</div>`;

                // Pot Card Slider Fix: Ensure consistent icons (pots already use 🗑️)

                html += `<div class="wz-carousel" id="pots-carousel">
                            <div class="wz-carousel-inner" id="pots-carousel-inner">`;

                data.pots.forEach((pot, i) => {
                    html += `
                    <div class="wz-carousel-slide" id="pot-slide-${i}">
                        <div class="wz-form-card pot-color-${i % 5}" style="border-top: none; border-radius: 0 0 16px 16px;">
                            <div class="wz-two-col">
                                <div class="wz-field">
                                    <label>Guthaben (€)</label>
                                    <div class="hybrid-input-wrapper">
                                        <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this, -500)">−</button>
                                        <input type="number" id="pot-start-${i}" value="${pot.value}" oninput="app.updateWizardPreview()" onfocus="this.value = this.value">
                                        <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this, 500)">+</button>
                                    </div>
                                </div>
                                <div class="wz-field">
                                    <label>Sparrate / Monat (€)</label>
                                    <div class="hybrid-input-wrapper">
                                        <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this, -50)">−</button>
                                        <input type="number" id="pot-saving-${i}" value="${pot.monthlyContribution || 0}" oninput="app.updateWizardPreview()" step="50">
                                        <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this, 50)">+</button>
                                    </div>
                                </div>
                            </div>

                            <div class="wz-field" style="margin-top:0.75rem;">
                                <label class="wz-section-label">Anlagestrategie / Rendite</label>
                                <div class="wz-preset-row">
                                    <button class="wz-preset wz-preset--cautious ${pot.interestRate <= 2.0 ? 'active' : ''}"
                                            onclick="app.setPreset('interest', 'vorsichtig', ${i})">
                                        🛡️ Konservativ <span>~1.5%</span>
                                    </button>
                                    <button class="wz-preset wz-preset--balanced ${pot.interestRate > 2.0 && pot.interestRate <= 5.0 ? 'active' : ''}"
                                            onclick="app.setPreset('interest', 'realistisch', ${i})">
                                        ⚖️ Ausgewogen <span>~4.0%</span>
                                    </button>
                                    <button class="wz-preset wz-preset--growth ${pot.interestRate > 5.0 ? 'active' : ''}"
                                            onclick="app.setPreset('interest', 'optimistisch', ${i})">
                                        🚀 Wachstum <span>~6.5%</span>
                                    </button>
                                </div>
                            </div>

                            <div class="wz-two-col wz-muted-inputs">
                                <div class="wz-field">
                                    <label>Zins Ansparphase (%)</label>
                                    <div class="hybrid-input-wrapper">
                                        <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this, -0.1)">−</button>
                                        <input type="number" id="pot-interest-${i}" value="${pot.interestRate}" oninput="app.updateWizardPreview()" step="0.1">
                                        <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this, 0.1)">+</button>
                                    </div>
                                </div>
                                <div class="wz-field">
                                    <label>Zins in Rente (%)</label>
                                    <div class="hybrid-input-wrapper">
                                        <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this, -0.1)">−</button>
                                        <input type="number" id="pot-interest-ret-${i}" value="${pot.interestRateRetirement}" oninput="app.updateWizardPreview()" step="0.1">
                                        <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this, 0.1)">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
                });

                html += `</div></div>`;

                if (data.pots.length > 1) {
                    html += `
                    <div class="wz-multi-pot-hint">
                        <span class="wz-multi-pot-hint-icon">💡</span>
                        <div class="wz-multi-pot-hint-text">
                            Du hast <strong>${data.pots.length} Töpfe</strong> angelegt. Nutze die Tabs oben, um die Werte und Renditen für jeden Topf einzeln festzulegen.
                        </div>
                    </div>`;
                }

                html += `
                <div class="wz-info-box">
                    <strong>💡 Tipp:</strong> Wähle eine Strategie oder passe die Zinsen manuell an. Du kannst die Werte später im Dashboard feinabstimmen.<br>
                    <span style="display:inline-block; margin-top:6px; opacity:0.8; font-size:0.85em;">
                        <strong>Hinweis:</strong> Erfasse hier nur dein Positiv-Vermögen. Kredite solltest du aufgrund der meist höheren Zinsen idealerweise vorrangig tilgen.
                    </span>
                </div>`;
                return html;
            },
            save: (data) => {
                data.pots.forEach((pot, i) => {
                    pot.name = document.getElementById(`pot-name-${i}`).value;
                    const valStr = document.getElementById(`pot-start-${i}`).value;
                    pot.value = parseFloat(valStr.replace(/\./g, '').replace(',', '.')) || 0;
                    pot.interestRate = +document.getElementById(`pot-interest-${i}`).value;
                    pot.interestRateRetirement = +document.getElementById(`pot-interest-ret-${i}`).value;
                    pot.monthlyContribution = +document.getElementById(`pot-saving-${i}`).value;
                    pot.savingsPhases = [{ fromAge: data.currentAge, toAge: data.retirementAge, amount: pot.monthlyContribution }];
                });
                // Explicitly notify state manager to ensure dashboard/simulation is in sync
                app.stateManager.notify();
            },
            validate: (data) => true
        },
        {
            id: 'withdrawal-strategy',
            render: (data) => `
                <div class="wz-step-header">
                    <h2>Entnahmestrategie</h2>
                    <p>Wie möchtest du dein Erspartes im Ruhestand aufbrauchen?</p>
                </div>
                <div class="wz-option-grid">
                    <div class="wz-option ${data.withdrawalStrategy === 'proportional' ? 'selected' : ''}" onclick="app.setOption('withdrawalStrategy', 'proportional', this); app.updateWizardPreview();">
                        <span class="wz-option-icon">⚖️</span>
                        <strong>Proportional</strong>
                        <span class="wz-option-desc">Aus allen Töpfen gleichzeitig entnehmen.</span>
                    </div>
                    <div class="wz-option ${data.withdrawalStrategy === 'sequential' ? 'selected' : ''}" onclick="app.setOption('withdrawalStrategy', 'sequential', this); app.updateWizardPreview();">
                        <span class="wz-option-icon">📊</span>
                        <strong>Sequenziell</strong>
                        <span class="wz-option-desc">Erst Topf 1 leeren, dann Topf 2.</span>
                    </div>
                </div>
                <div class="wz-info-box">
                    <strong>Wann ist was sinnvoll?</strong><br>
                    <strong>Proportional</strong> erhält deine Anlagemischung länger ausgewogen. <strong>Sequenziell</strong> empfiehlt sich, wenn ein Topf risikoreicher ist und du ihn zuerst aufbrauchen möchtest.
                </div>
            `,
            validate: () => true
        },
        {
            id: 'retirement-income',
            render: (data) => `
                <div class="wz-step-header">
                    <h2>Rente & Ausgaben</h2>
                    <p>Was brauchst du monatlich – und was kommt fest rein?</p>
                </div>
                <div class="wz-form-card" style="border-left: 4px solid var(--accent);">
                    <div class="wz-field">
                        <label>Wunsch-Budget im Ruhestand (€ / Monat)</label>
                        <div class="hybrid-input-wrapper">
                            <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this, -50)">−</button>
                            <input type="number" id="inp-retExpenses" value="${data.retirementExpenses}" oninput="app.updateWizardPreview()" step="50" min="0">
                            <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this, 50)">+</button>
                        </div>
                        <span class="wz-hint">In heutiger Kaufkraft – Inflation wird automatisch berechnet.</span>
                    </div>
                </div>

                <div class="wz-form-card" style="border-top:4px solid #10b981;">
                    <div class="wz-field">
                        <label style="color:#10b981;">Voraussichtliche Netto-Rente (€/Mo.)</label>
                        <div class="hybrid-input-wrapper">
                            <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this, -50)">−</button>
                            <input type="number" id="pension-amount-0" value="${data.pensions[0].amount}" oninput="app.updateWizardPreview()" step="50">
                            <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this, 50)">+</button>
                        </div>
                        <div class="wz-hint" style="margin-top: 4px; line-height: 1.3;">
                            Nutze den Wert der <strong>heutigen</strong> Rentenauskunft ("Voraussichtliche Rente"). 
                            Zieh ca. 11% für KV/PV ab.
                        </div>
                    </div>



                    <div class="wz-slider-container">
                        <div class="wz-slider-title">💡 Grobe Schätzung (falls keine Auskunft vorliegt)</div>
                        <input type="range" class="pension-slider" id="pension-est-slider" 
                               min="500" max="3000" step="100" value="1500" 
                               oninput="document.getElementById('pension-amount-0').value = this.value; app.updateWizardPreview();"
                               style="width: 100%; margin: 15px 0;">
                        <div class="slider-ticks" style="display: flex; justify-content: space-between; padding: 0 5px;">
                            <span style="font-size: 0.75rem; color: var(--text-muted);">500 €</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">1.500 €</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">3.000 €</span>
                        </div>
                    </div>

                    <div class="wz-hint-box" style="margin-top: 15px;">
                        <strong>💡 Woher kommen die Werte?</strong>
                        Schau in deine Rentenauskunft ("Voraussichtliche Altersrente"). 
                        Zieh ca. 11-12% für KV/PV ab. 
                        Benutze den <strong>heutigen</strong> Wert.
                    </div>
                </div>

                <div class="wz-form-card" style="border-top:4px solid #3b82f6; margin-top: 20px;">
                    <div class="wz-field">
                        <label style="color:#3b82f6;">Betriebliche / Private Rente (€/Mo.)</label>
                        <div class="hybrid-input-wrapper">
                            <button class="hybrid-spin-btn minus" onclick="app.adjustValue(this, -50)">−</button>
                            <input type="number" id="pension-amount-1" value="${data.pensions[1] ? data.pensions[1].amount : 0}" oninput="app.updateWizardPreview()" step="50">
                            <button class="hybrid-spin-btn plus" onclick="app.adjustValue(this, 50)">+</button>
                        </div>
                        <span class="wz-hint">Zusätzliche garantierte Einnahmen</span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 5px;">
                        ℹ️ Später können im Dashboard beliebig viele weitere Renten hinzugefügt werden.
                    </div>
                </div>

                <div class="wz-hint-box" style="background:#f1f5f9; border-left-color: var(--primary);">
                    <strong>💡 Wichtiger Hinweis zur Inflation</strong><br>
                    Gib hier deine <strong>heutige</strong> Kaufkraft an. Das Tool rechnet die künftige Inflation für deine Ausgaben automatisch ein, sodass die Rente rechnerisch ihren realen Wert behält.
                </div>
            `,
            save: (data) => {
                const val = +document.getElementById('inp-retExpenses').value;
                data.retirementExpenses = val;
                
                // Sync to retirementPhases for simulation engine
                data.retirementPhases = [
                    { fromAge: data.retirementAge, monthlyAmount: val }
                ];

                data.pensions[0].amount = +document.getElementById(`pension-amount-0`).value;
                if (!data.pensions[1]) data.pensions[1] = { id: 'private', label: 'Privat / Betrieblich', amount: 0, growth: 1.5, startAge: data.retirementAge };
                data.pensions[1].amount = +document.getElementById(`pension-amount-1`).value;
                data.pensions[1].startAge = data.retirementAge;

                if (data.pensions[0].growth === undefined) data.pensions[0].growth = 1.5;
            },
            validate: () => true
        },
        {
            id: 'inflation',
            render: (data) => `
                <div class="wz-step-header">
                    <h2>Inflation & Kaufkraft</h2>
                    <p>Wie stark soll die Inflation in deinem Plan berücksichtigt werden?</p>
                </div>
                <div class="wz-option-grid">
                    <button class="wz-option ${data.inflationRate === 0 ? 'selected' : ''}" onclick="app.setOption('inflationRate', 0, this); app.updateWizardPreview();">
                        <span class="wz-option-icon">🛑</span>
                        <strong>Keine Inflation</strong>
                        <span class="wz-option-desc">Preise bleiben wie heute.</span>
                    </button>
                    <button class="wz-option ${data.inflationRate === 2.0 ? 'selected' : ''}" onclick="app.setOption('inflationRate', 2.0, this); app.updateWizardPreview();">
                        <span class="wz-option-icon">⚖️</span>
                        <strong>2% (Realistisch)</strong>
                        <span class="wz-option-desc">Target der EZB.</span>
                    </button>
                    <button class="wz-option ${data.inflationRate === 3.0 ? 'selected' : ''}" onclick="app.setOption('inflationRate', 3.0, this); app.updateWizardPreview();">
                        <span class="wz-option-icon">📈</span>
                        <strong>3% (Konservativ)</strong>
                        <span class="wz-option-desc">Höhere Sicherheitsmarge.</span>
                    </button>
                </div>
                <div class="wz-info-box">
                    <strong>🛒 Das unsichtbare Risiko:</strong> Bei 2% Inflation benötigst du in 30 Jahren fast das Doppelte – für denselben Lebensstandard.
                </div>
            `,
            save: () => { },
            validate: () => true
        },
        {
            id: 'plan-overview',
            render: (data) => {
                const totalStartCapital = data.pots.reduce((sum, p) => sum + (p.value || 0), 0);
                const totalMonthlyPensions = data.pensions.reduce((sum, p) => sum + (p.amount || 0), 0);
                const totalMonthlySavings = data.pots.reduce((sum, p) => {
                    const currentPhase = p.savingsPhases?.find(ph => data.currentAge >= ph.fromAge && data.currentAge < ph.toAge);
                    return sum + (currentPhase ? currentPhase.amount : 0);
                }, 0);

                const fmt = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

                return `
                <div class="wz-step-header">
                    <h2>Dein Plan auf einen Blick</h2>
                    <p>Hier ist die Zusammenfassung deiner Strategie.</p>
                </div>
                
                <div class="wz-summary-container" style="text-align: left;">
                    <div class="wz-form-card" style="margin-bottom: 1rem; border-left: 4px solid var(--primary); display: flex; flex-direction: column; gap: 4px;">
                        <span class="wz-summary-label">⏱ Zeitplan</span>
                        <div class="wz-summary-value" style="text-align: left;">
                            Von ${data.currentAge} bis ${data.endAge} Jahre
                            <div class="wz-summary-sub">Rentenbeginn mit ${data.retirementAge}</div>
                        </div>
                    </div>

                    <div class="wz-form-card" style="margin-bottom: 1rem; border-left: 4px solid #10b981; display: flex; flex-direction: column; gap: 4px;">
                        <span class="wz-summary-label">💰 Vermögen & Sparen</span>
                        <div class="wz-summary-value" style="text-align: left;">
                            ${fmt(totalStartCapital)} Startkapital
                            <div class="wz-summary-sub">${fmt(totalMonthlySavings)} Sparrate/Monat (${data.pots.length} Töpfe)</div>
                        </div>
                    </div>

                    <div class="wz-form-card" style="margin-bottom: 1rem; border-left: 4px solid var(--accent); display: flex; flex-direction: column; gap: 4px;">
                        <span class="wz-summary-label">🏝️ Ruhestand</span>
                        <div class="wz-summary-value" style="text-align: left;">
                            ${fmt(data.retirementExpenses)} Wunsch-Budget
                            <div class="wz-summary-sub">${fmt(totalMonthlyPensions)} garantierte Renten</div>
                        </div>
                    </div>

                    <div class="wz-form-card" style="margin-bottom: 1rem; border-left: 4px solid #6366f1; display: flex; flex-direction: column; gap: 4px;">
                        <span class="wz-summary-label">⚙️ Strategie</span>
                        <div class="wz-summary-value" style="text-align: left;">
                            ${data.inflationRate}% Inflation
                            <div class="wz-summary-sub">Entnahme: ${data.withdrawalStrategy === 'proportional' ? 'Proportional' : 'Sequenziell'}</div>
                        </div>
                    </div>
                </div>

                <div class="wz-info-box" style="margin-top: 1.5rem;">
                    <strong>🚀 Bereit?</strong> Klicke auf "Zum Dashboard", um deine detaillierte Vermögensentwicklung und Simulation zu sehen.
                </div>
            `;
            },
            validate: () => true
        },
    ]
});
