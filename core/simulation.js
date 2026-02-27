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
        let yearlyRentalIncome = 0;
        let yearlyGap = 0;
        let yearlyWithdrawalNeeded = 0;
        let oneTimePayment = 0;
        let totalWealth = 0;

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

                // Tiered Savings Phases (Open-ended)
                if (pot.savingsPhases && pot.savingsPhases.length > 0) {
                    const applicable = [...pot.savingsPhases]
                        .filter(p => age >= p.fromAge)
                        .sort((a, b) => b.fromAge - a.fromAge);
                    if (applicable.length > 0) monthlySave = Number(applicable[0].amount) || 0;
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

            // Check retirementPhases first (Open-ended)
            if (data.retirementPhases && data.retirementPhases.length > 0) {
                const applicable = [...data.retirementPhases]
                    .filter(p => age >= p.fromAge)
                    .sort((a, b) => b.fromAge - a.fromAge);
                if (applicable.length > 0) {
                    currentExpenseLevel = applicable[0].monthlyAmount;
                }
            } else if (data.expenseAdjustments && data.expenseAdjustments.length > 0) {
                // Legacy fallback
                const applicable = data.expenseAdjustments
                    .filter(a => a.fromAge <= age)
                    .sort((a, b) => b.fromAge - a.fromAge);
                if (applicable.length > 0) {
                    currentExpenseLevel = applicable[0].monthlyAmount;
                }
            }

            const nominalExpenses = (currentExpenseLevel * 12) * inflationFactor;
            yearlyExpenses = nominalExpenses;

            // Combine Pensions
            yearlyPension = (data.pensions || []).reduce((sum, p) => {
                const startAge = p.startAge !== undefined ? +p.startAge : data.retirementAge;
                if (age < startAge) return sum;
                const growth = Number(p.growth) || 0;
                const pensionGrowthFactor = Math.pow(1 + growth / 100, yearIndex);
                const amount = Number(p.amount) || 0;
                return sum + (amount * 12) * pensionGrowthFactor;
            }, 0);

            // Separate Rental Incomes (for dynamic table)
            const rentalDetails = (data.rentalIncomes || []).map(p => {
                const startAge = p.startAge !== undefined ? +p.startAge : data.retirementAge;
                let nominalAmount = 0;
                let netAmount = 0;
                if (age >= startAge) {
                    const growth = Number(p.growth) || 0;
                    const pensionGrowthFactor = Math.pow(1 + growth / 100, yearIndex);
                    const amount = Number(p.amount) || 0;
                    nominalAmount = (amount * 12) * pensionGrowthFactor;
                    const taxRate = Number(p.taxRate) || 0;
                    netAmount = nominalAmount * (1 - taxRate / 100);
                }
                return { label: p.label, nominalAmount, netAmount };
            });

            yearlyRentalIncome = rentalDetails.reduce((sum, r) => sum + r.netAmount, 0);
            yearlyGap = Math.max(0, nominalExpenses - (yearlyPension + yearlyRentalIncome));

            // Per-pot Tax Logic
            // If we have a net gap, we need to withdraw a gross amount that covers it after tax.
            // Since different pots have different tax rates, the total gross withdrawal depends on the strategy.
            if (yearlyGap > 0) {
                const totalWealthBeforeWithdrawal = currentPots.reduce((sum, p) => sum + p.value, 0);
                if (totalWealthBeforeWithdrawal > 0) {
                    const globalTaxRate = +data.withdrawalTaxRate || 0;

                    if (data.withdrawalStrategy === 'proportional' || !data.withdrawalStrategy) {
                        // Net = Sum(Gross_i * (1 - TaxRate_i))
                        // Gross_i = TotalGross * (PotValue_i / TotalWealth)
                        // Net = TotalGross * Sum((PotValue_i / TotalWealth) * (1 - TaxRate_i))
                        // TotalGross = Net / Sum(Share_i * NetFactor_i)

                        let weightedNetFactor = 0;
                        currentPots.forEach(pot => {
                            const potTax = pot.taxRate !== undefined ? +pot.taxRate : globalTaxRate;
                            const share = pot.value / totalWealthBeforeWithdrawal;
                            weightedNetFactor += share * (1 - (potTax / 100));
                        });

                        if (weightedNetFactor > 0) {
                            yearlyWithdrawalNeeded = yearlyGap / weightedNetFactor;
                        } else {
                            yearlyWithdrawalNeeded = yearlyGap; // Fallback
                        }
                    } else if (data.withdrawalStrategy === 'sequential') {
                        // For sequential, we iterate through pots and take until we have enough NET.
                        let netRemaining = yearlyGap;
                        let grossTotal = 0;
                        const order = (data.withdrawalOrder && data.withdrawalOrder.length > 0)
                            ? data.withdrawalOrder
                            : currentPots.map((_, i) => i);

                        for (let idx of order) {
                            if (netRemaining <= 0) break;
                            const pot = currentPots[idx];
                            if (!pot || pot.value <= 0) continue;

                            const potTax = pot.taxRate !== undefined ? +pot.taxRate : globalTaxRate;
                            const netFactor = (1 - (potTax / 100));
                            if (netFactor <= 0) { // Tax 100% or more (impossible but safeguard)
                                grossTotal += pot.value;
                                pot.value = 0;
                                continue;
                            }

                            const maxNetFromPot = pot.value * netFactor;
                            const netToTake = Math.min(netRemaining, maxNetFromPot);
                            const grossToTake = netToTake / netFactor;

                            pot.value -= grossToTake;
                            netRemaining -= netToTake;
                            grossTotal += grossToTake;
                        }
                        yearlyWithdrawalNeeded = grossTotal;
                    }
                }
            }
        }

        // 5. Apply Withdrawals (only for proportional, sequential is handled above)
        if (yearlyWithdrawalNeeded > 0) {
            const totalWealthBeforeWithdrawal = currentPots.reduce((sum, p) => sum + p.value, 0);
            if (totalWealthBeforeWithdrawal > 0 && (data.withdrawalStrategy === 'proportional' || !data.withdrawalStrategy)) {
                currentPots.forEach(pot => {
                    const share = pot.value / totalWealthBeforeWithdrawal;
                    pot.value -= yearlyWithdrawalNeeded * share;
                });
            }
        }

        totalWealth = currentPots.reduce((sum, p) => sum + p.value, 0);

        // Apply Real History Override (Reality Check)
        let isReal = false;
        if (data.realHistory && data.realHistory.length > 0) {
            const realEntry = data.realHistory.find(h => h.age === age);
            if (realEntry) {
                currentPots.forEach((p, i) => {
                    if (realEntry.pots[i] !== undefined) {
                        p.value = realEntry.pots[i];
                    }
                });
                totalWealth = currentPots.reduce((sum, p) => sum + p.value, 0);
                isReal = true;
            }
        }

        // Pre-calculate details for the table
        const incomeDetails = [];
        if (isRetirement) {
            const allIncomes = [...(data.pensions || []), ...(data.rentalIncomes || [])];
            allIncomes.forEach(p => {
                const startAge = p.startAge !== undefined ? +p.startAge : data.retirementAge;
                if (age >= startAge) {
                    const growth = Number(p.growth) || 0;
                    const pensionGrowthFactor = Math.pow(1 + growth / 100, yearIndex);
                    const amount = Number(p.amount) || 0;
                    incomeDetails.push({
                        label: p.label,
                        baseAmount: amount * 12,
                        nominalAmount: (amount * 12) * pensionGrowthFactor
                    });
                }
            });
        }

        const wealthBefore = results.length > 0 ? results[results.length - 1].totalWealth : data.pots.reduce((sum, p) => sum + (p.value || 0), 0);

        // Calculate Interest Gain for this year (simplified estimate based on end-of-year value minus inputs)
        // A better way is to track it during the steps.
        let yearlyInterest = 0;
        currentPots.forEach((pot, i) => {
            const potBefore = (results.length > 0 ? results[results.length - 1].pots[i].value : (data.pots[i].value || 0));
            const interestRate = isRetirement ? pot.interestRateRetirement : pot.interestRate;
            yearlyInterest += potBefore * (interestRate / 100);
        });

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
            rentalIncome: yearlyRentalIncome,
            expenses: yearlyExpenses,
            gap: yearlyGap,
            savings: yearlySavings,
            oneTimePayment,
            pots: JSON.parse(JSON.stringify(currentPots)),
            // New Detail Fields
            incomeDetails,
            expenseBreakdown: {
                base: (isRetirement ? (data.retirementExpenses * 12) : 0),
                inflationEffect: yearlyExpenses - (isRetirement ? (data.retirementExpenses * 12) : 0)
            },
            wealthChange: {
                start: wealthBefore,
                interest: yearlyInterest,
                savings: yearlySavings,
                withdrawal: yearlyWithdrawalNeeded,
                oneTime: oneTimePayment,
                end: totalWealth
            }
        });
    }

    return results;
}
