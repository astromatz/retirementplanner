export const createWizard = (app) => ({
    steps: [
        {
            id: 'intro',
            render: () => `
                <h1>Willkommen zu Ihrer Ruhestandsplanung</h1>
                <p>Lassen Sie uns gemeinsam herausfinden, wie Ihre finanzielle Zukunft aussieht. Wir stellen Ihnen ein paar Fragen, um Ihren persönlichen Plan zu erstellen.</p>
                <div style="font-size: 4rem; margin: 2rem 0;">🚀</div>
                <div style="display:flex; justify-content:center; gap:1rem;">
                    <button class="btn btn-secondary" onclick="document.getElementById('wizard-load-file').click()">📂 Plan laden</button>
                    <input type="file" id="wizard-load-file" style="display:none" onchange="app.loadData(event)">
                </div>
            `,
            validate: () => true
        },
        {
            id: 'basics',
            render: (data) => `
                <h2>Basisdaten</h2>
                <p>Starten wir mit Ihrem zeitlichen Horizont.</p>
                <div class="form-group">
                    <label>Ihr aktuelles Alter</label>
                    <input type="number" id="inp-currentAge" value="${data.currentAge}" min="18" max="100">
                </div>
                <div class="form-group">
                    <label>Geplantes Rentenalter</label>
                    <input type="number" id="inp-retirementAge" value="${data.retirementAge}" min="50" max="100">
                </div>
                <div class="form-group">
                    <label>Betrachtung bis Alter</label>
                    <input type="number" id="inp-endAge" value="${data.endAge}" min="70" max="120">
                </div>
            `,
            save: (data) => {
                data.currentAge = +document.getElementById('inp-currentAge').value;
                data.retirementAge = +document.getElementById('inp-retirementAge').value;
                data.endAge = +document.getElementById('inp-endAge').value;
            },
            validate: () => {
                const cur = +document.getElementById('inp-currentAge').value;
                const ret = +document.getElementById('inp-retirementAge').value;
                return ret > cur;
            }
        },
        {
            id: 'inflation',
            render: (data) => `
                <h2>Inflation & Kaufkraft</h2>
                <p>Soll eine jährliche Geldentwertung (Inflation) berücksichtigt werden?</p>
                <div class="option-grid">
                    <div class="option-card ${data.inflationRate === 0 ? 'selected' : ''}" onclick="app.setOption('inflationRate', 0, this)">
                        <span class="option-icon">🛑</span>
                        <strong>Keine Inflation</strong>
                    </div>
                    <div class="option-card ${data.inflationRate === 2.0 ? 'selected' : ''}" onclick="app.setOption('inflationRate', 2.0, this)">
                        <span class="option-icon">⚖️</span>
                        <strong>2% (Standard)</strong>
                    </div>
                </div>
            `,
            validate: () => true
        },
        {
            id: 'pots-intro',
            render: (data) => `
                <h2>Vermögenstöpfe</h2>
                <div class="option-grid">
                    <div class="option-card ${data.numPots === 1 ? 'selected' : ''}" onclick="app.setOption('numPots', 1, this)"><strong>1 Topf</strong></div>
                    <div class="option-card ${data.numPots === 2 ? 'selected' : ''}" onclick="app.setOption('numPots', 2, this)"><strong>2 Töpfe</strong></div>
                    <div class="option-card ${data.numPots === 3 ? 'selected' : ''}" onclick="app.setOption('numPots', 3, this)"><strong>3 Töpfe</strong></div>
                </div>
            `,
            save: (data) => {
                if (data.pots.length !== data.numPots) {
                    data.pots = Array(data.numPots).fill().map((_, i) => ({
                        name: `Topf ${i + 1}`,
                        value: 0,
                        interestRate: 5.0,
                        interestRateRetirement: 4.0,
                        monthlyContribution: 0,
                        contributionIncrease: 0
                    }));
                }
            },
            validate: () => true
        },
        {
            id: 'pots-config',
            render: (data) => {
                let html = `<h2>Töpfe konfigurieren</h2><p>Geben Sie Ihren Töpfen Namen und Startwerte.</p>`;
                html += `<div class="option-grid">`;
                data.pots.forEach((pot, i) => {
                    html += `
                    <div class="card" style="text-align:left;">
                        <div class="summary-label" style="color:var(--primary); margin-bottom:1rem;">Topf ${i + 1}</div>
                        <div class="form-group">
                            <label>Name</label>
                            <input type="text" id="pot-name-${i}" value="${pot.name}">
                        </div>
                        <div class="form-group">
                            <label>Startkapital (€)</label>
                            <input type="number" id="pot-start-${i}" value="${pot.value}">
                        </div>
                        <div class="form-group">
                            <label>Zinssatz Ansparphase (%)</label>
                            <input type="number" step="0.1" id="pot-interest-${i}" value="${pot.interestRate}">
                        </div>
                        <div class="form-group">
                            <label>Zinssatz Entnahmephase (%)</label>
                            <input type="number" step="0.1" id="pot-interest-ret-${i}" value="${pot.interestRateRetirement}">
                        </div>
                        <div class="form-group">
                            <label>Monatliche Sparrate (€)</label>
                            <input type="number" id="pot-saving-${i}" value="${pot.monthlyContribution}">
                        </div>
                    </div>`;
                });
                html += `</div>`;
                return html;
            },
            save: (data) => {
                data.pots.forEach((pot, i) => {
                    pot.name = document.getElementById(`pot-name-${i}`).value;
                    pot.value = +document.getElementById(`pot-start-${i}`).value;
                    pot.interestRate = +document.getElementById(`pot-interest-${i}`).value;
                    pot.interestRateRetirement = +document.getElementById(`pot-interest-ret-${i}`).value;
                    pot.monthlyContribution = +document.getElementById(`pot-saving-${i}`).value;
                    // Support new tiered savings structure
                    pot.savingsPhases = [{ fromAge: data.currentAge, toAge: data.retirementAge, amount: pot.monthlyContribution }];
                });
            },
            validate: (data) => {
                let isValid = true;
                data.pots.forEach((pot, i) => {
                    if (pot.value < 0) isValid = false;
                    if (pot.interestRate < 0) isValid = false;
                    if (pot.monthlyContribution < 0) isValid = false;
                });
                return isValid;
            }
        },
        {
            id: 'withdrawal-strategy',
            render: (data) => `
                <h2>Entnahmestrategie</h2>
                <div class="option-grid">
                    <div class="option-card ${data.withdrawalStrategy === 'proportional' ? 'selected' : ''}" onclick="app.setOption('withdrawalStrategy', 'proportional', this)">
                        <span class="option-icon">⚖️</span>
                        <strong>Proportional</strong>
                    </div>
                    <div class="option-card ${data.withdrawalStrategy === 'sequential' ? 'selected' : ''}" onclick="app.setOption('withdrawalStrategy', 'sequential', this)">
                        <span class="option-icon">📊</span>
                        <strong>Sequenziell</strong>
                    </div>
                </div>
            `,
            save: (data) => {
                const sel = document.querySelector('.option-card.selected');
                data.withdrawalStrategy = sel && sel.innerText.includes('Sequenziell') ? 'sequential' : 'proportional';
            },
            validate: () => true
        },
        {
            id: 'retirement-income',
            render: (data) => {
                let html = `
                <h2>Rente & Ausgaben</h2>
                <p>Wie viel werden Sie in der Rente erhalten und ausgeben?</p>
                <div class="card" style="text-align:left; margin-bottom:1rem;">
                    <div class="form-group">
                        <label>Monatliche Ausgaben in der Rente (€, heutiger Wert)</label>
                        <input type="number" id="inp-retExpenses" value="${data.retirementExpenses}" min="0">
                    </div>
                </div>
                <h3>Rentenquellen</h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:1rem; margin-bottom:1.5rem;">`;

                (data.pensions || []).forEach((p, i) => {
                    html += `
                    <div class="card" style="text-align:left; background:#f8fafc;">
                        <h4 style="margin-top:0; color:var(--primary); font-size:0.9rem;">${p.label}</h4>
                        <div class="form-group" style="margin-bottom:10px;">
                            <label style="font-size:0.8rem;">Betrag (€/Monat)</label>
                            <input type="number" id="pension-amount-${i}" value="${p.amount}">
                        </div>
                    </div>`;
                });

                html += `</div>
                <h3>Miete, Dividenden & Sonstiges</h3>
                <div class="card" style="text-align:left;">
                    <div class="form-group">
                        <label>Summe monatlicher Nebeneinkünfte (€)</label>
                        <input type="number" id="inp-rentalAmount" value="${data.rentalIncomes?.reduce((s, r) => s + r.amount, 0) || 0}" min="0">
                    </div>
                </div>`;
                return html;
            },
            save: (data) => {
                data.retirementExpenses = +document.getElementById('inp-retExpenses').value;
                (data.pensions || []).forEach((p, i) => {
                    p.amount = +document.getElementById(`pension-amount-${i}`).value;
                });
                const rentalAmt = +document.getElementById('inp-rentalAmount').value;
                if (rentalAmt > 0) {
                    data.rentalIncomes = [{ id: 'wizard_rental', label: 'Wizard Miete', amount: rentalAmt, growth: 0, startAge: data.retirementAge }];
                } else {
                    data.rentalIncomes = [];
                }
            },
            validate: () => true
        },
        {
            id: 'finish',
            render: () => `<h1>Fertig!</h1><div style="font-size:4rem;">🎉</div><p>Ihr Plan ist bereit.</p>`,
            validate: () => true
        }
    ]
});
