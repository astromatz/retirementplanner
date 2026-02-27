export class TableRenderer {
    constructor(tableSelector) {
        this.tableSelector = tableSelector;
    }

    render(data, appState, toggleRowCallback, openDetailModalCallback) {
        const d = appState;
        const format = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
        const tableBody = document.querySelector(`${this.tableSelector} tbody`);
        if (!tableBody) return;

        const rentalIncomes = appState.rentalIncomes || [];
        const thead = document.querySelector(`${this.tableSelector} thead tr`);
        if (thead) {
            let rentalHeaders = rentalIncomes.map(ri => `<th class="hide-mobile">${ri.label}</th>`).join('');
            thead.innerHTML = `
                <th class="col-alter">Alter</th>
                <th class="hide-mobile">Jahr</th>
                <th class="col-wealth">Vermögen</th>
                <th class="hide-mobile hide-small">Rente</th>
                ${rentalHeaders}
                <th class="hide-mobile">Saldo</th>
                <th class="col-info">Info</th>`;
        }

        tableBody.innerHTML = data.map(row => {
            const isRet = row.age >= d.retirementAge;
            const rowClass = [
                row.age === d.retirementAge ? 'retirement-row' : '',
                isRet ? 'retirement-phase-row' : '',
                row.isReal ? 'is-real' : ''
            ].join(' ');

            // Calculate or extract these from simulation row
            const pensionVal = row.pension || 0;
            const withdrawalVal = isRet ? (row.withdrawal || 0) : 0;

            // Extract individual rental values using mapping
            const rentalCols = rentalIncomes.map(ri => {
                const riVal = (row.incomeDetails || []).find(id => id.label === ri.label);
                return `<td class="hide-mobile" style="color:#3b82f6;">${isRet && riVal ? format(riVal.nominalAmount / 12) : '-'}</td>`;
            }).join('');

            const totalIncomes = pensionVal + (row.rentalIncome || 0);
            const netSaldo = totalIncomes - row.expenses;

            return `
                <tr class="${rowClass}" data-age="${row.age}">
                    <td class="col-alter"><span class="expand-icon">▶</span> ${row.age}</td>
                    <td class="hide-mobile">${row.year}</td>
                    <td class="col-wealth" style="font-weight:600;">${format(row.totalWealth)}</td>
                    <td class="hide-mobile hide-small" style="color:#10b981;">${isRet ? format(pensionVal / 12) : '-'}</td>
                    ${rentalCols}
                    <td class="hide-mobile" style="color:${netSaldo >= 0 ? '#10b981' : '#ef4444'};">${isRet ? format(netSaldo / 12) : '-'}</td>
                    <td class="col-info">
                        <button class="btn btn-sm btn-details" data-age="${row.age}">🔍 <span class="hide-mobile">Details</span></button>
                    </td>
                </tr>
                <tr class="detail-row" id="detail-${row.age}">
                    <td colspan="50">
                        <div class="detail-content">
                            <div class="detail-grid">
                                <div class="detail-section">
                                    <h3>📥 Einnahmen${isRet ? ' (Rente)' : ' (Sparen)'}</h3>
                                    ${!isRet ? `
                                        <div class="detail-line"><span class="detail-label">Sparrate:</span><span class="detail-value">${format(row.savings / 12)} / Mo.</span></div>
                                        <div class="detail-line"><span class="detail-label">Gesamt Jahr:</span><span class="detail-value">${format(row.savings)}</span></div>
                                    ` : `
                                        ${row.incomeDetails.map(inc => `
                                            <div class="detail-line">
                                                <span class="detail-label">${inc.label}:</span>
                                                <span class="detail-value">${format(inc.nominalAmount / 12)} <span class="growth-note">(${format(inc.baseAmount / 12)})</span></span>
                                            </div>
                                        `).join('')}
                                        <div class="detail-line" style="border-top: 1px solid #e2e8f0; margin-top: 5px; padding-top: 5px;">
                                            <span class="detail-label">Einnahmen Gesamt:</span>
                                            <span class="detail-value" style="color:#10b981;">${format(totalIncomes / 12)} / Mo.</span>
                                        </div>
                                    `}
                                </div>
                                <div class="detail-section">
                                    <h3>📉 Ausgaben & Saldo</h3>
                                    <div class="detail-line">
                                        <span class="detail-label">${isRet ? 'Bedarf (Nominal):' : 'Bedarf:'}</span>
                                        <span class="detail-value">${isRet ? format(row.expenses / 12) + ' / Mo.' : '-'}</span>
                                    </div>
                                    <div class="detail-line">
                                        <span class="detail-label">Inflationsanteil:</span>
                                        <span class="detail-value inflation-note">${isRet ? format(row.expenseBreakdown.inflationEffect / 12) + ' / Mo.' : '-'}</span>
                                    </div>
                                    ${isRet ? `
                                        <div class="detail-line" style="border-top: 1px solid #e2e8f0; margin-top: 5px; padding-top: 5px;">
                                            <span class="detail-label">Monatl. Saldo:</span>
                                            <span class="detail-value" style="color:${netSaldo >= 0 ? '#10b981' : '#ef4444'}; font-weight:700;">${format(netSaldo / 12)}</span>
                                        </div>
                                        ${netSaldo < 0 ? `
                                            <div class="detail-line" style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">
                                                <span>Deckung durch Entnahme:</span>
                                                <span style="color:#ef4444;">${format(Math.abs(netSaldo) / 12)}</span>
                                            </div>
                                        ` : ''}
                                    ` : ''}
                                </div>
                                <div class="detail-section">
                                    <h3>💰 Vermögensentwicklung</h3>
                                    <div class="detail-line"><span class="detail-label">Start (Jan):</span><span class="detail-value">${format(row.wealthChange.start)}</span></div>
                                    <div class="detail-line"><span class="detail-label">Zinsen:</span><span class="detail-value">${format(row.wealthChange.interest)}</span></div>
                                    ${row.wealthChange.savings > 0 ? `<div class="detail-line"><span class="detail-label">Sparrate:</span><span class="detail-value">${format(row.wealthChange.savings)}</span></div>` : ''}
                                    ${row.wealthChange.withdrawal > 0 ? `<div class="detail-line"><span class="detail-label">Entnahme (Brutto):</span><span class="detail-value" style="color:#ef4444;">-${format(row.wealthChange.withdrawal)}</span></div>` : ''}
                                    ${row.wealthChange.oneTime !== 0 ? `<div class="detail-line"><span class="detail-label">Sondereffekt:</span><span class="detail-value">${format(row.wealthChange.oneTime)}</span></div>` : ''}
                                    <div class="detail-line" style="border-top: 1px solid #e2e8f0; margin-top: 5px; padding-top: 5px;">
                                        <span class="detail-label">Ende (Dez):</span>
                                        <span class="detail-value" style="font-weight:700;">${format(row.wealthChange.end)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        // Attach event listeners
        document.querySelectorAll(`${this.tableSelector} tbody tr[data-age]`).forEach(tr => {
            tr.onclick = () => toggleRowCallback(tr);
        });

        document.querySelectorAll('.btn-details').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                openDetailModalCallback(parseInt(btn.getAttribute('data-age')));
            };
        });
    }
}
