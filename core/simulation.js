export function calculateSimulation(data) {
    const results = [];
    const currentYear = new Date().getFullYear();

    // 0. Validation
    const curAge = Math.max(0, +data.currentAge || 35);
    const retAge = Math.max(curAge, +data.retirementAge || 67);
    const endAge = Math.max(retAge, +data.endAge || 90);
    const inflation = +data.inflationRate || 0;

    let currentPots = (data.pots || []).map(p => ({ ...p }));
    let cumulativeSavings = 0;

    for (let age = curAge; age <= endAge; age++) {
        const yearIndex = age - curAge;
        const year = currentYear + yearIndex;
        const isRetirement = age >= data.retirementAge;
        const inflationFactor = Math.pow(1 + data.inflationRate / 100, yearIndex);

        let yearlySavings = 0;
        let yearlyExpenses = 0;
        let yearlyPension = 0;
        let yearlyGap = 0;
        let yearlyWithdrawalNeeded = 0;
        let oneTimePayment = 0;

        // 1. Apply Interest
        currentPots.forEach(pot => {
            const interestRate = isRetirement ? pot.interestRateRetirement : pot.interestRate;
            pot.value += pot.value * (interestRate / 100);
        });

        // 2a. Process One-Time Deposits (Inflows)
        const paymentsThisYear = (data.oneTimePayments || []).filter(p => p.age === age);
        paymentsThisYear.forEach(payment => {
            const amount = Number(payment.amount) || 0;
            if (amount <= 0) return;

            const totalWealthBefore = currentPots.reduce((sum, p) => sum + p.value, 0);

            if (payment.targetPotIndex === 'all') {
                if (totalWealthBefore > 0) {
                    currentPots.forEach(pot => {
                        pot.value += amount * (pot.value / totalWealthBefore);
                    });
                } else {
                    // Fallback if wealth is 0: distribute equally
                    currentPots.forEach(pot => pot.value += amount / currentPots.length);
                }
            } else if (currentPots[payment.targetPotIndex]) {
                currentPots[payment.targetPotIndex].value += amount;
            }
            oneTimePayment += amount;
        });

        // 2b. Process One-Time Expenses (Outflows)
        const expensesThisYear = (data.oneTimeExpenses || []).filter(p => p.age === age);
        expensesThisYear.forEach(exp => {
            const amount = (Number(exp.amount) || 0) * inflationFactor; // Adjusted for inflation
            if (amount <= 0) return;

            const totalWealthBefore = currentPots.reduce((sum, p) => sum + p.value, 0);

            if (exp.targetPotIndex === 'all' || exp.targetPotIndex === undefined) {
                if (totalWealthBefore > 0) {
                    currentPots.forEach(pot => {
                        pot.value -= amount * (pot.value / totalWealthBefore);
                    });
                } else if (currentPots.length > 0) {
                    currentPots[0].value -= amount;
                }
            } else if (currentPots[exp.targetPotIndex]) {
                currentPots[exp.targetPotIndex].value -= amount;
            }
        });

        // 3. Savings (Work Phase)
        if (!isRetirement) {
            currentPots.forEach(pot => {
                let monthlySave = 0;

                // Tiered Savings Phases
                if (pot.savingsPhases && pot.savingsPhases.length > 0) {
                    const phase = pot.savingsPhases.find(p => age >= p.fromAge && age < p.toAge);
                    if (phase) monthlySave = Number(phase.amount) || 0;
                } else {
                    // Legacy fallback
                    monthlySave = pot.monthlyContribution || 0;
                }

                if (pot.contributionIncrease) {
                    monthlySave = monthlySave * Math.pow(1 + pot.contributionIncrease / 100, yearIndex);
                } else if (data.savingsDynamic) {
                    monthlySave = monthlySave * Math.pow(1.02, yearIndex);
                }
                const annualSave = monthlySave * 12;
                pot.value += annualSave;
                yearlySavings += annualSave;
                cumulativeSavings += annualSave;
            });
        }

        // 4. Expenses & Gap Calculation (Retirement Phase)
        if (isRetirement) {
            let currentExpenseLevel = data.retirementExpenses;
            if (data.expenseAdjustments && data.expenseAdjustments.length > 0) {
                const applicable = data.expenseAdjustments
                    .filter(a => a.fromAge <= age)
                    .sort((a, b) => b.fromAge - a.fromAge);
                if (applicable.length > 0) {
                    currentExpenseLevel = applicable[0].monthlyAmount;
                }
            }

            const nominalExpenses = (currentExpenseLevel * 12) * inflationFactor;
            yearlyExpenses = nominalExpenses;

            // Combine Pensions and Rental Incomes
            const allIncomes = [...(data.pensions || []), ...(data.rentalIncomes || [])];
            yearlyPension = allIncomes.reduce((sum, p) => {
                const startAge = p.startAge !== undefined ? +p.startAge : data.retirementAge;
                if (age < startAge) return sum;

                const growth = Number(p.growth) || 0;
                const pensionGrowthFactor = Math.pow(1 + growth / 100, yearIndex);
                const amount = Number(p.amount) || 0;
                return sum + (amount * 12) * pensionGrowthFactor;
            }, 0);

            yearlyGap = Math.max(0, nominalExpenses - yearlyPension);

            // Tax Logic: Gross up the withdrawal to cover effective taxes.
            // Assumption: The user needs 'yearlyGap' as net income. To get this net amount,
            // we must withdraw a larger gross amount: Gross = Net / (1 - TaxRate).
            // Example: 18.5% tax -> 1000€ net needs ~1227€ gross withdrawal.
            const taxRate = +data.withdrawalTaxRate || 0;
            yearlyWithdrawalNeeded = yearlyGap / (1 - (taxRate / 100));
        }

        // 5. Apply Withdrawals
        let totalWealth = currentPots.reduce((sum, p) => sum + p.value, 0);

        if (yearlyWithdrawalNeeded > 0 && totalWealth > 0) {
            if (data.withdrawalStrategy === 'proportional' || !data.withdrawalStrategy) {
                currentPots.forEach(pot => {
                    const share = pot.value / totalWealth;
                    pot.value -= yearlyWithdrawalNeeded * share;
                });
            } else if (data.withdrawalStrategy === 'sequential') {
                let remaining = yearlyWithdrawalNeeded;
                const order = (data.withdrawalOrder && data.withdrawalOrder.length > 0)
                    ? data.withdrawalOrder
                    : currentPots.map((_, i) => i);

                for (let idx of order) {
                    if (remaining <= 0) break;
                    const pot = currentPots[idx];
                    if (!pot) continue;
                    const take = Math.min(remaining, pot.value);
                    pot.value -= take;
                    remaining -= take;
                }
            }
        }

        totalWealth = currentPots.reduce((sum, p) => sum + p.value, 0);

        // Apply Real History Override (Reality Check)
        let isReal = false;
        if (data.realHistory && data.realHistory[age]) {
            const realValues = data.realHistory[age];
            currentPots.forEach((p, i) => {
                if (realValues[i] !== undefined) {
                    p.value = realValues[i];
                }
            });
            totalWealth = currentPots.reduce((sum, p) => sum + p.value, 0);
            isReal = true;
        }

        results.push({
            age,
            year,
            isReal,
            totalWealth,
            cumulativeSavings,
            inflationFactor,
            realWealth: totalWealth / inflationFactor,
            withdrawal: yearlyWithdrawalNeeded,
            pension: yearlyPension,
            expenses: yearlyExpenses,
            gap: yearlyGap,
            savings: yearlySavings,
            oneTimePayment,
            pots: JSON.parse(JSON.stringify(currentPots))
        });
    }

    return results;
}
