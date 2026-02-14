import { calculateSimulation } from '../core/simulation.js';

function runTests() {
    console.log('🚀 Starte Simulation-Engine Tests...');

    const baseData = {
        currentAge: 35,
        retirementAge: 65,
        endAge: 90,
        inflationRate: 0,
        pots: [{ name: 'Test', startCapital: 100000, interestSaving: 5, interestRetirement: 5, monthlySavings: 0 }],
        withdrawalStrategy: 'proportional',
        pension: 0,
        retirementExpenses: 0
    };

    // Test 1: Basis Zinsrechnung
    const results1 = calculateSimulation(baseData);
    const wealthAfter1Year = results1[1].totalWealth;
    const expected = 110250; // 100k + 5% (Year 0) -> 105k + 5% (Year 1)
    if (Math.abs(wealthAfter1Year - expected) < 1) {
        console.log('✅ Test 1 bestanden: Zinsrechnung korrekt.');
    } else {
        console.error(`❌ Test 1 fehlgeschlagen: Erwartet ${expected}, Erhalten ${wealthAfter1Year}`);
    }

    // Test 2: Inflation
    const dataWithInflation = { ...baseData, inflationRate: 2, retirementExpenses: 1000, retirementAge: 35 };
    const results2 = calculateSimulation(dataWithInflation);
    const exp10Years = (1000 * 12) * Math.pow(1.02, 10);
    if (Math.abs(results2[10].expenses - exp10Years) < 1) {
        console.log('✅ Test 2 bestanden: Inflation wird korrekt auf Ausgaben angewendet.');
    } else {
        console.error(`❌ Test 2 fehlgeschlagen: Inflation falsch.`);
    }

    console.log('🏁 Alle Tests abgeschlossen.');
}

runTests();
