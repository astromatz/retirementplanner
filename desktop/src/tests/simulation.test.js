import { calculateSimulation } from '../core/simulation.js';

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function assertEquals(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`Assertion failed: ${message} (Expected ${expected}, got ${actual})`);
    }
}

const tests = {
    testCompoundInterestOnly: () => {
        const data = {
            currentAge: 35,
            retirementAge: 40,
            endAge: 40,
            inflationRate: 0,
            pots: [{
                name: 'Test Pot',
                value: 100000,
                interestRate: 5.0,
                interestRateRetirement: 5.0,
                monthlyContribution: 0
            }],
            pensions: [],
            rentalIncomes: [],
            retirementExpenses: 0
        };

        const results = calculateSimulation(data);
        // Year 0: 100,000 * 1.05 = 105,000
        // Year 1: 105,000 * 1.05 = 110,250
        // ... (5 years total: 35, 36, 37, 38, 39, 40)
        // results indices: 0 (age 35), 1 (age 36), ..., 5 (age 40)

        const expectedWealth35 = 105000;
        const expectedWealth40 = 100000 * Math.pow(1.05, 6); // 35 inclusive to 40 inclusive is 6 years of interest

        assertEquals(results[0].totalWealth, expectedWealth35, 1, 'Wealth at age 35');
        assertEquals(results[5].totalWealth, expectedWealth40, 1, 'Wealth at age 40');
    },

    testInflationEffectOnExpenses: () => {
        const data = {
            currentAge: 35,
            retirementAge: 35, // Already retired
            endAge: 45,
            inflationRate: 2.0,
            pots: [{ value: 1000000, interestRate: 0, interestRateRetirement: 0 }],
            retirementExpenses: 1000, // 12,000 annual
            pensions: []
        };

        const results = calculateSimulation(data);
        // Age 35 (Index 0): factor = 1.0 (pow(1.02, 0)) -> Expenses = 12,000
        // Age 36 (Index 1): factor = 1.02 -> Expenses = 12,240
        // Age 45 (Index 10): factor = 1.02^10 = 1.2189 -> Expenses = 14627.9

        assertEquals(results[0].expenses, 12000, 1, 'Expenses at age 35');
        assertEquals(results[10].expenses, 12000 * Math.pow(1.02, 10), 1, 'Expenses at age 45');
    },

    testWithdrawalsAndGap: () => {
        const data = {
            currentAge: 65,
            retirementAge: 65,
            endAge: 66,
            inflationRate: 0,
            retirementExpenses: 2000, // 24,000 annual
            pots: [{ value: 100000, interestRate: 0, interestRateRetirement: 0 }],
            pensions: [{ amount: 1000, growth: 0, startAge: 65 }], // 12,000 annual
            withdrawalTaxRate: 0
        };

        const results = calculateSimulation(data);
        // Annual Gap = 24,000 - 12,000 = 12,000
        // Index 0 (Age 65): Wealth = 100,000 - 12,000 = 88,000
        // Index 1 (Age 66): Wealth = 88,000 - 12,000 = 76,000

        assertEquals(results[0].gap, 12000, 1, 'Gap at age 65');
        assertEquals(results[0].totalWealth, 88000, 1, 'Wealth at age 65');
        assertEquals(results[1].totalWealth, 76000, 1, 'Wealth at age 66');
    },

    testTaxEffectOnWithdrawal: () => {
        const data = {
            currentAge: 65,
            retirementAge: 65,
            endAge: 65,
            inflationRate: 0,
            retirementExpenses: 2000, // 24,000 annual
            pots: [{ value: 100000, interestRate: 0, interestRateRetirement: 0 }],
            pensions: [], // Gap = 24,000
            withdrawalTaxRate: 20.0 // 20% Tax
        };

        const results = calculateSimulation(data);
        // Net needed = 24,000
        // Gross withdrawal = 24,000 / (1 - 0.20) = 24,000 / 0.8 = 30,000

        assertEquals(results[0].withdrawal, 30000, 1, 'Gross withdrawal with 20% tax');
        assertEquals(results[0].totalWealth, 70000, 1, 'Wealth after 30k withdrawal');
    },
    testPensionGrowthFromRetirementAge: () => {
        const data = {
            currentAge: 35,
            retirementAge: 65,
            endAge: 66,
            inflationRate: 0,
            pots: [{ value: 1000000, interestRate: 0, interestRateRetirement: 0 }],
            pensions: [{ amount: 1000, growth: 10.0, startAge: 65 }], // 12,000 annual, 10% growth
            retirementExpenses: 0
        };

        const results = calculateSimulation(data);
        // Age 65 (Retirement Start): growthIndex = 65 - 65 = 0. factor = 1.10^0 = 1.0. Pension = 12,000.
        // Age 66: growthIndex = 66 - 65 = 1. factor = 1.10^1 = 1.1. Pension = 13,200.

        assertEquals(results[30].pension, 12000, 1, 'Pension at age 65 (Start year)');
        assertEquals(results[31].pension, 13200, 1, 'Pension at age 66 (1 year after start)');
    },
    testEarlyRetirementPenalty: () => {
        const data = {
            currentAge: 60,
            retirementAge: 63, // 4 years early (67 - 63 = 4)
            endAge: 63,
            inflationRate: 0,
            pots: [{ value: 1000000, interestRate: 0, interestRateRetirement: 0 }],
            pensions: [{ id: 'state', amount: 1000, growth: 0, startAge: 63, applyPenalty: true }],
            retirementExpenses: 0
        };

        const results = calculateSimulation(data);
        // Penalty = 4 years * 3.6% = 14.4%
        // Expected Annual Pension = (1000 * 12) * (1 - 0.144) = 12000 * 0.856 = 10272

        assertEquals(results[3].pension, 10272, 1, 'Pension at age 63 with 14.4% penalty');
    }
};

console.log('--- Starting Simulation Engine Tests ---');
let passed = 0;
let total = 0;

for (const [name, test] of Object.entries(tests)) {
    total++;
    try {
        test();
        console.log(`✅ ${name} PASSED`);
        passed++;
    } catch (e) {
        console.error(`❌ ${name} FAILED: ${e.message}`);
    }
}

console.log('-----------------------------------------');
console.log(`Summary: ${passed}/${total} tests passed.`);

if (passed === total) {
    console.log('✅ ALL TESTS PASSED. Logic is stable.');
} else {
    console.error('⚠️ SOME TESTS FAILED. Check logic before refactoring!');
    process.exit(1);
}
