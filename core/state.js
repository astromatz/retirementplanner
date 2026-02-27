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
                taxRate: 18.5, // Standard for ETF with Teilfreistellung
                savingsPhases: [
                    { fromAge: 35, amount: 500 },
                    { fromAge: 50, amount: 1000 }
                ]
            }
        ],
        retirementPhases: [
            { fromAge: 67, monthlyAmount: 2800 },
            { fromAge: 80, monthlyAmount: 2200 }
        ],
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
        expenseAdjustments: [], // Replaced by retirementPhases, keeping for legacy if needed
        savingsDynamic: false,
        retirementExpenses: 2800, // Kept as primary for simplicity if only 1 phase
        safeWithdrawalRate: 3.5,
        withdrawalTaxRate: 18.5, // Global fallback
        pensions: [
            { id: 'state', label: 'Gesetzlich', amount: 1200, growth: 1.5, startAge: 67 },
            { id: 'company', label: 'Betrieblich', amount: 300, growth: 0.5, startAge: 67 }
        ],
        rentalIncomes: [
            { id: 'rental_1', label: 'Mieteinnahme', amount: 800, growth: 1.0, startAge: 67 }
        ],
        hasExpenseChanges: false,
        hasOneTimePayments: false,
        showPurchasingPower: false,
        realHistory: {} // age -> [val0, val1, ...]
    }
};

export const emptyState = {
    step: 0,
    data: {
        currentAge: 35,
        retirementAge: 67,
        endAge: 90,
        inflationRate: 2.0,
        pots: [],
        retirementPhases: [],
        numPots: 1,
        withdrawalStrategy: 'proportional',
        withdrawalOrder: [],
        oneTimePayments: [],
        oneTimeExpenses: [],
        expenseAdjustments: [],
        savingsDynamic: false,
        retirementExpenses: 2000,
        safeWithdrawalRate: 3.5,
        withdrawalTaxRate: 18.5,
        pensions: [
            { id: 'state', label: 'Gesetzlich', amount: 0, growth: 1.5, startAge: 67 },
            { id: 'private', label: 'Privat / Betrieblich', amount: 0, growth: 1.5, startAge: 67 }
        ],
        rentalIncomes: [],
        hasExpenseChanges: false,
        hasOneTimePayments: false,
        showPurchasingPower: false,
        realHistory: {}
    }
};
