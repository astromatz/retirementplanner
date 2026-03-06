export class ChartRenderer {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.chart = null;
    }

    render(data, appState) {
        const canvas = document.getElementById(this.canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const d = appState;

        const datasets = d.pots.map((pot, i) => {
            const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];
            const c = colors[i % colors.length];
            const isPurchasingPower = d.showPurchasingPower;

            return {
                label: pot.name,
                data: data.map(point => isPurchasingPower ? (point.pots[i].value / point.inflationFactor) : point.pots[i].value),
                backgroundColor: isPurchasingPower ? c : c + 'BB',
                borderColor: c,
                borderWidth: 1,
                fill: true,
                stack: 'wealth',
                borderRadius: 0
            };
        });

        if (d.showPurchasingPower) {
            datasets.push({
                label: 'Inflationsverlust',
                data: data.map(point => point.totalWealth - point.realWealth),
                backgroundColor: '#f1f5f9',
                borderColor: '#cbd5e1',
                borderWidth: 1,
                stack: 'wealth',
                borderRadius: 0
            });
        }

        // Handle Custom Legend in Header
        const legendContainer = document.getElementById('chart-legend');
        if (legendContainer) {
            const newLegendHtml = d.showPurchasingPower ? `
                <div class="legend-item">
                    <span class="legend-dot" style="background:#10b981;"></span>
                    <span>Echte Kaufkraft (Realwert)</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot" style="background:#f1f5f9; border:1px solid #cbd5e1;"></span>
                    <span>Inflationsanteil (Nominal-Bonus)</span>
                </div>
            ` : '';

            if (legendContainer.innerHTML !== newLegendHtml) {
                legendContainer.innerHTML = newLegendHtml;
            }
        }

        // The category-scale annotation plugin positions lines by 0-based index,
        // so (retirementAge - currentAge) gives the correct column index.
        const markerIndex = d.retirementAge - d.currentAge;

        const chartConfig = {
            type: 'bar',
            data: { labels: data.map(p => p.age), datasets },
            options: {
                responsive: true,
                animation: { duration: 300 },
                maintainAspectRatio: false,
                layout: { padding: { bottom: 20 } },
                scales: {
                    x: {
                        stacked: true,
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 20
                        }
                    },
                    y: {
                        stacked: true,
                        ticks: { callback: (v) => (v / 1000) + 'k €' }
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('de-DE', {
                                        style: 'currency',
                                        currency: 'EUR'
                                    }).format(context.parsed.y);
                                }
                                return label;
                            },
                            footer: (items) => {
                                if (!d.showPurchasingPower) return '';
                                let totalNominal = 0;
                                items.forEach(i => totalNominal += i.raw);
                                return 'Gesamt (Nominal): ' + new Intl.NumberFormat('de-DE', {
                                    style: 'currency',
                                    currency: 'EUR'
                                }).format(totalNominal);
                            }
                        }
                    },
                    annotation: {
                        annotations: {
                            line1: {
                                type: 'line',
                                xMin: markerIndex,
                                xMax: markerIndex,
                                borderColor: '#ef4444',
                                borderWidth: 3,
                                label: {
                                    display: true,
                                    content: 'Renteneintritt',
                                    position: 'start',
                                    backgroundColor: '#ef4444'
                                }
                            }
                        }
                    }
                }
            }
        };

        // Destroy and recreate the chart on every render.
        // Chart.js v4 normalises options into an internal copy; patching
        // this.chart.options externally does not reliably update annotations.
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        this.chart = new Chart(ctx, chartConfig);
    }
}
