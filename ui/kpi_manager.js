export class KpiManager {
    constructor(app) {
        this.app = app;
    }

    updateKpiBar(results) {
        if (!results || results.length === 0) return;
        const d = this.app.state.data;
        const last = results[results.length - 1];
        const fmt = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

        const wealthEl = document.getElementById('stat-wealth');
        if (wealthEl) {
            wealthEl.textContent = fmt(Math.max(0, last.totalWealth));
            wealthEl.style.color = last.totalWealth >= 0 ? '#16a34a' : '#dc2626';
        }

        const gapEl = document.getElementById('stat-gap');
        if (gapEl) {
            const gap = last.totalWealth < 0 ? Math.abs(last.totalWealth) : 0;
            gapEl.textContent = fmt(gap);
            gapEl.style.color = gap > 0 ? '#dc2626' : '#16a34a';
        }

        // Sparrate Total
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

    updateCoverageDisplay(results) {
        if (!results || results.length === 0) return;
        const d = this.app.state.data;
        const last = results[results.length - 1];
        const elKpi = document.getElementById('kpi-coverage');
        const elStatus = document.getElementById('coverage-status');
        if (!elKpi) return;

        const finalWealth = last.totalWealth;

        // Find the first age where wealth becomes negative (gap detection)
        const exhaustionRow = results.find(r => r.totalWealth < 0);
        const exhaustionAge = exhaustionRow ? exhaustionRow.age : null;

        // Calculate reserve years based on last simulated year's nominal expenses (Purchasing Power Bezug)
        const lastRow = results[results.length - 1];
        const lastYearExpenses = lastRow.expenses || 1;
        const yearsOfBuffer = finalWealth / lastYearExpenses;

        let statusText = 'Lücke';
        let statusColor = '#dc2626'; // Red (matching stat-gap)
        let kpiDisplay = '0 J.';

        if (exhaustionAge !== null) {
            statusText = `Lücke ab ${exhaustionAge}`;
            statusColor = '#dc2626';
            kpiDisplay = `Lücke ab ${exhaustionAge}`; // Show age directly in KPI bar
        } else if (finalWealth > 0) {
            if (yearsOfBuffer >= 3) {
                statusColor = '#10b981'; // Green (Standard green)
                statusText = 'Sicher';
            } else {
                statusColor = '#f59e0b'; // Amber
                statusText = 'Knapp';
            }
            kpiDisplay = Number.isFinite(yearsOfBuffer) ? yearsOfBuffer.toFixed(1) + ' J.' : '>50 J.';
        }

        elKpi.textContent = kpiDisplay;
        elKpi.style.color = statusColor;

        if (elStatus) {
            elStatus.textContent = statusText;
            elStatus.style.color = statusColor;
        }
    }
}
