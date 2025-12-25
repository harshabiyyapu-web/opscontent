function TrafficChart({ hourlyData = [] }) {
    if (!hourlyData || hourlyData.length === 0) {
        return (
            <div className="chart-empty">
                <span>No traffic data available</span>
            </div>
        );
    }

    // Process hourly data into chart-friendly format
    const maxValue = Math.max(...hourlyData.map(d => d.visitors || 0), 1);
    const chartWidth = 100;
    const chartHeight = 60;
    const padding = 5;

    const points = hourlyData.map((data, index) => {
        const x = padding + (index / (hourlyData.length - 1 || 1)) * (chartWidth - 2 * padding);
        const y = chartHeight - padding - ((data.visitors || 0) / maxValue) * (chartHeight - 2 * padding);
        return { x, y, visitors: data.visitors || 0, time: data.dimensions?.[0] || `Hour ${index}` };
    });

    const pathData = points.length > 0
        ? `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`
        : '';

    const areaData = points.length > 0
        ? `M ${points[0].x},${chartHeight - padding} ${points.map(p => `L ${p.x},${p.y}`).join(' ')} L ${points[points.length - 1].x},${chartHeight - padding} Z`
        : '';

    return (
        <div className="traffic-chart">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#2383e2" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#2383e2" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Area fill */}
                <path
                    d={areaData}
                    fill="url(#chartGradient)"
                    className="chart-area"
                />

                {/* Line - thin blue */}
                <path
                    d={pathData}
                    fill="none"
                    stroke="#2383e2"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="chart-line"
                />
            </svg>

            <div className="chart-labels">
                <span>24h ago</span>
                <span>Now</span>
            </div>
        </div>
    );
}

export default TrafficChart;
