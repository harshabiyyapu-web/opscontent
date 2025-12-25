import TrafficChart from './TrafficChart';

function AnalyticsCard({ url, analytics }) {
    if (!analytics) {
        return (
            <div className="analytics-card analytics-card--loading">
                <div className="analytics-loading">
                    <span className="loading-spinner">⏳</span>
                    <span>Loading analytics...</span>
                </div>
            </div>
        );
    }

    if (analytics.error) {
        return (
            <div className="analytics-card analytics-card--error">
                <div className="analytics-error">
                    <span className="error-icon">⚠️</span>
                    <span>{analytics.error}</span>
                </div>
            </div>
        );
    }

    const { realtime = {}, totals = {}, hourlyData = [], percentChange = 0, lastUpdated } = analytics;
    const isPositive = percentChange >= 0;

    const formatDuration = (seconds) => {
        if (!seconds) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const formatTime = (isoString) => {
        if (!isoString) return 'Unknown';
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="analytics-card">
            <div className="analytics-header">
                <h4 className="analytics-title">{url.label}</h4>
                <div className="live-indicator">
                    <span className="live-dot"></span>
                    <span className="live-text">LIVE</span>
                </div>
            </div>

            <div className="analytics-url">{url.url}</div>

            {/* Realtime Stats - Current Visitors */}
            <div className="realtime-section realtime-single">
                <div className="realtime-stat">
                    <div className="realtime-value">{realtime.visitors || 0}</div>
                    <div className="realtime-label">Current Visitors</div>
                </div>
            </div>

            <div className="analytics-chart">
                <TrafficChart hourlyData={hourlyData} />
            </div>

            {/* Today's Totals */}
            <div className="analytics-metrics">
                <div className="metric">
                    <div className="metric-value">{totals.visitors || 0}</div>
                    <div className="metric-label">Today</div>
                </div>
                <div className="metric">
                    <div className="metric-value">{totals.pageviews || 0}</div>
                    <div className="metric-label">Views</div>
                </div>
                <div className="metric">
                    <div className="metric-value">{totals.bounce_rate ? `${Math.round(totals.bounce_rate)}%` : '0%'}</div>
                    <div className="metric-label">Bounce</div>
                </div>
                <div className="metric">
                    <div className="metric-value">{formatDuration(totals.visit_duration)}</div>
                    <div className="metric-label">Avg Time</div>
                </div>
            </div>

            <div className="analytics-footer">
                <span className="last-updated">Updated: {formatTime(lastUpdated)}</span>
            </div>
        </div>
    );
}

export default AnalyticsCard;

