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

        const style = getComputedStyle(document.documentElement);
        const getVar = (name) => style.getPropertyValue(name).trim();

        const datasets = d.pots.map((pot, i) => {
            const c = window.app.getPotColor(i);
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
            const infColor = getVar('--chart-inf') || '#f1f5f9';
            const infBorder = getVar('--chart-inf-border') || '#cbd5e1';
            datasets.push({
                label: 'Inflationsverlust',
                data: data.map(point => point.totalWealth - point.realWealth),
                backgroundColor: infColor,
                borderColor: infBorder,
                borderWidth: 1,
                stack: 'wealth',
                borderRadius: 0
            });
        }

        // Handle Custom Legend in Header
        const legendContainer = document.getElementById('chart-legend');
        if (legendContainer) {
            const primaryColor = getVar('--chart-1');
            const infColor = getVar('--chart-inf') || '#f1f5f9';
            const infBorder = getVar('--chart-inf-border') || '#cbd5e1';

            const newLegendHtml = d.showPurchasingPower ? `
                <div class="legend-item">
                    <span class="legend-dot" style="background:${primaryColor};"></span>
                    <span>Echte Kaufkraft (Realwert)</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot" style="background:${infColor}; border:1px solid ${infBorder};"></span>
                    <span>Inflationsanteil (Nominal-Bonus)</span>
                </div>
            ` : '';

            if (legendContainer.innerHTML !== newLegendHtml) {
                legendContainer.innerHTML = newLegendHtml;
            }
        }

        // The category-scale annotation plugin positions lines by 0-based index,
        // so (retirementAge - currentAge) gives the correct column index.
        // Robustly determine the marker index by matching the age in the labels
        const markerIndex = data.findIndex(p => p.age === d.retirementAge);

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

        // Use update() instead of destroy/recreate for smoother transitions
        if (this.chart) {
            this.chart.data.labels = data.map(p => p.age);
            this.chart.data.datasets = datasets;
            this.chart.options.plugins.annotation.annotations.line1.xMin = markerIndex;
            this.chart.options.plugins.annotation.annotations.line1.xMax = markerIndex;
            this.chart.update('none'); // Update without animation for immediate sync
        } else {
            this.chart = new Chart(ctx, chartConfig);
        }
    }
}
