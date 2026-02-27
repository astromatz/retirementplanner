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
                        <h3>Schichten-Modell</h3>
                        <p>Wir kombinieren deine <strong>fixen Renten</strong> mit deinem <strong>privaten Vermögen</strong>.</p>
                    </div>
                    <div class="wz-concept-card">
                        <div class="wz-concept-icon">💸</div>
                        <h3>Die Entnahme-Lücke</h3>
                        <p>Das Tool berechnet, wie viel Geld du monatlich aus deinem Ersparten entnehmen musst, um deinen Wunsch-Lebensstandard zu halten.</p>
                    </div>
                    <div class="wz-concept-card">
                        <div class="wz-concept-icon">📉</div>
                        <h3>Inflation & Steuern</h3>
                        <p>Wichtig: Wir berücksichtigen Inflation (Kaufkraftverlust) und Steuern auf Kapitalerträge, damit dein Plan realistisch bleibt.</p>
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
                        <input type="number" id="inp-currentAge" value="${data.currentAge}" min="18" max="100" oninput="app.updateWizardPreview()">
                    </div>
                    <div class="wz-field">
                        <label>Geplantes Rentenalter</label>
                        <input type="number" id="inp-retirementAge" value="${data.retirementAge}" min="50" max="100" oninput="app.updateWizardPreview()">
                    </div>
                    <div class="wz-field">
                        <label>Betrachtung bis Alter</label>
                        <input type="number" id="inp-endAge" value="${data.endAge}" min="70" max="120" oninput="app.updateWizardPreview()">
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
                if (data.rentalIncomes) {
                    data.rentalIncomes.forEach(r => { if (r.startAge === oldRetirementAge || r.startAge === 67) r.startAge = data.retirementAge; });
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

                if (data.pots.length > 1) {
                    html += `<div class="wz-pot-tabs" id="pot-tabs">` +
                        data.pots.map((pot, i) => `
                            <button class="wz-pot-tab ${i === 0 ? 'active' : ''}"
                                    onclick="app.switchPotTab(${i})" id="pot-tab-${i}">
                                ${pot.name || `Topf ${i + 1}`}
                            </button>`).join('') +
                        `</div>`;
                }

                html += `<div class="wz-carousel" id="pots-carousel">
                            <div class="wz-carousel-inner" id="pots-carousel-inner">`;

                data.pots.forEach((pot, i) => {
                    html += `
                    <div class="wz-carousel-slide" id="pot-slide-${i}">
                        <div class="wz-form-card" style="border-top: 3px solid var(--primary);">
                            <div class="wz-pot-title-row">
                                <input type="text" id="pot-name-${i}" value="${pot.name}"
                                       class="wz-pot-name-input" placeholder="Topf benennen (z.B. Aktien-Depot)…"
                                       oninput="app.updatePotTabLabel(${i})">
                            </div>
                            <div class="wz-two-col">
                                <div class="wz-field">
                                    <label>Guthaben (€)</label>
                                    <input type="number" id="pot-start-${i}" value="${pot.value}" oninput="app.updateWizardPreview()" onfocus="this.value = this.value">
                                </div>
                                <div class="wz-field">
                                    <label>Sparrate / Monat (€)</label>
                                    <input type="number" id="pot-saving-${i}" value="${pot.monthlyContribution}" oninput="app.updateWizardPreview()" onfocus="this.value = this.value">
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
                                    <input type="number" step="0.1" id="pot-interest-${i}" value="${pot.interestRate}" oninput="app.updateWizardPreview()" onfocus="this.value = this.value">
                                </div>
                                <div class="wz-field">
                                    <label>Zins in Rente (%)</label>
                                    <input type="number" step="0.1" id="pot-interest-ret-${i}" value="${pot.interestRateRetirement}" oninput="app.updateWizardPreview()" onfocus="this.value = this.value">
                                </div>
                            </div>
                        </div>
                    </div>`;
                });

                html += `</div></div>`;

                html += `
                <div class="wz-info-box">
                    <strong>💡 Tipp:</strong> Wähle eine Strategie oder passe die Zinsen manuell an. Du kannst die Werte später im Dashboard feinabstimmen.
                </div>`;
                return html;
            },
            save: (data) => {
                data.pots.forEach((pot, i) => {
                    pot.name = document.getElementById(`pot-name-${i}`).value;
                    pot.value = +document.getElementById(`pot-start-${i}`).value;
                    pot.interestRate = +document.getElementById(`pot-interest-${i}`).value;
                    pot.interestRateRetirement = +document.getElementById(`pot-interest-ret-${i}`).value;
                    pot.monthlyContribution = +document.getElementById(`pot-saving-${i}`).value;
                    pot.savingsPhases = [{ fromAge: data.currentAge, toAge: data.retirementAge, amount: pot.monthlyContribution }];
                });
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
                    <strong>Proportional</strong> erhält deine Anlagemischung länger ausgewogen. <strong>Sequenziell</strong> empfiehlt sich, wenn Topf 1 risikoreicher ist (z.B. Aktien) und du ihn zuerst aufbrauchen möchtest.
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
                <div class="wz-form-card" style="border-left: 3px solid var(--accent);">
                    <div class="wz-field">
                        <label>Wunsch-Budget im Ruhestand (€ / Monat)</label>
                        <input type="number" id="inp-retExpenses" value="${data.retirementExpenses}" min="0" oninput="app.updateWizardPreview()">
                        <span class="wz-hint">In heutiger Kaufkraft – Inflation wird automatisch berechnet.</span>
                    </div>
                </div>
                <div class="wz-form-card" style="border-top:3px solid #10b981;">
                    <div class="wz-two-col">
                        <div class="wz-field">
                            <label style="color:#10b981;">Staatliche Rente (€/Mo.)</label>
                            <input type="number" id="pension-amount-0" value="${data.pensions[0].amount}" oninput="app.updateWizardPreview()" onfocus="this.value = this.value">
                        </div>
                        <div class="wz-field">
                            <label style="color:#3b82f6;">Andere Renten (€/Mo.)</label>
                            <input type="number" id="pension-amount-1" value="${data.pensions[1] ? data.pensions[1].amount : 0}" oninput="app.updateWizardPreview()" onfocus="this.value = this.value">
                        </div>
                    </div>
                </div>
                <div class="wz-info-box">
                    <strong>💡 Die Lücke:</strong> Deine private Vorsorge muss die Differenz zwischen Wunsch-Budget und festen Renteneinnahmen schließen.
                </div>
            `,
            save: (data) => {
                data.retirementExpenses = +document.getElementById('inp-retExpenses').value;
                data.pensions[0].amount = +document.getElementById(`pension-amount-0`).value;
                if (!data.pensions[1]) {
                    data.pensions[1] = { id: 'private', label: 'Privat / Betrieblich', amount: 0, growth: 1.5, startAge: data.retirementAge };
                }
                data.pensions[1].amount = +document.getElementById(`pension-amount-1`).value;
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
                
                <div class="wz-summary-container">
                    <div class="wz-form-card" style="margin-bottom: 1rem; border-left: 4px solid var(--primary);">
                        <div class="wz-summary-item">
                            <span class="wz-summary-label">⏱ Zeitplan</span>
                            <div class="wz-summary-value">
                                Von ${data.currentAge} bis ${data.endAge} Jahre
                                <div class="wz-summary-sub">Rentenbeginn mit ${data.retirementAge}</div>
                            </div>
                        </div>
                    </div>

                    <div class="wz-form-card" style="margin-bottom: 1rem; border-left: 4px solid #10b981;">
                        <div class="wz-summary-item">
                            <span class="wz-summary-label">💰 Vermögen & Sparen</span>
                            <div class="wz-summary-value">
                                ${fmt(totalStartCapital)} Startkapital
                                <div class="wz-summary-sub">${fmt(totalMonthlySavings)} Sparrate/Monat (${data.pots.length} Töpfe)</div>
                            </div>
                        </div>
                    </div>

                    <div class="wz-form-card" style="margin-bottom: 1rem; border-left: 4px solid var(--accent);">
                        <div class="wz-summary-item">
                            <span class="wz-summary-label">🏝️ Ruhestand</span>
                            <div class="wz-summary-value">
                                ${fmt(data.retirementExpenses)} Wunsch-Budget
                                <div class="wz-summary-sub">${fmt(totalMonthlyPensions)} garantierte Renten</div>
                            </div>
                        </div>
                    </div>

                    <div class="wz-form-card" style="margin-bottom: 1rem; border-left: 4px solid #6366f1;">
                        <div class="wz-summary-item">
                            <span class="wz-summary-label">⚙️ Strategie</span>
                            <div class="wz-summary-value">
                                ${data.inflationRate}% Inflation
                                <div class="wz-summary-sub">Entnahme: ${data.withdrawalStrategy === 'proportional' ? 'Proportional' : 'Sequenziell'}</div>
                            </div>
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
