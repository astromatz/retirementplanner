export const initialState = {
    step: 0,
    data: {
        currentAge: 35,
        retirementAge: 67,
        endAge: 90,
        inflationRate: 2.0, // percent
        pots: [
            {
                name: 'ETF Depot',
                value: 50000,
                interestRate: 5.0,
                interestRateRetirement: 4.0,
                contributionIncrease: 2.0,
                savingsPhases: [
                    { fromAge: 35, toAge: 50, amount: 500 },
                    { fromAge: 50, toAge: 67, amount: 1000 }
                ]
            }
        ],
        phases: [],
        numPots: 1,
        // Advanced features
        withdrawalStrategy: 'proportional', // 'proportional' | 'sequential'
        withdrawalOrder: [0], // for sequential: array of pot indices
        oneTimePayments: [
            { age: 55, amount: 20000, targetPotIndex: 0, description: 'Erbe/Bonus' }
        ],
        oneTimeExpenses: [
            { age: 75, amount: 15000, targetPotIndex: 'all', description: 'Weltreise' }
        ],
        expenseAdjustments: [
            { fromAge: 80, monthlyAmount: 2000 }
        ],
        savingsDynamic: false,
        retirementExpenses: 2800,
        safeWithdrawalRate: 3.5,
        withdrawalTaxRate: 18.5,
        pensions: [
            { id: 'state', label: 'Gesetzlich', amount: 1200, growth: 1.5, startAge: 67 },
            { id: 'company', label: 'Betrieblich', amount: 300, growth: 0.5, startAge: 67 }
        ],
        rentalIncomes: [
            { id: 'rental_1', label: 'Mieteinnahme', amount: 800, growth: 1.0, startAge: 67 }
        ],
        hasExpenseChanges: false,
        hasOneTimePayments: false,
        realHistory: {} // age -> [val0, val1, ...]
    }
};
