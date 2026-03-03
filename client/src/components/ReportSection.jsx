import { useState, useCallback } from 'react'

function ReportSection({ domainId }) {
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

    const [fromDate, setFromDate] = useState(weekAgo)
    const [toDate, setToDate] = useState(today)
    const [report, setReport] = useState(null)
    const [loading, setLoading] = useState(false)

    const fetchReport = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/domains/${domainId}/report?from=${fromDate}&to=${toDate}`)
            if (res.ok) {
                setReport(await res.json())
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }, [domainId, fromDate, toDate])

    return (
        <div className="content-section">
            <div className="content-section-header">
                <h2 className="content-section-title">📋 Report</h2>
            </div>

            {/* Date Range Selector */}
            <div className="report-date-range">
                <div className="report-date-field">
                    <label className="report-date-label">From</label>
                    <input type="date" className="report-date-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
                <div className="report-date-field">
                    <label className="report-date-label">To</label>
                    <input type="date" className="report-date-input" value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
                <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
                    {loading ? '⏳ Loading...' : '📊 Generate Report'}
                </button>
            </div>

            {/* Report Content */}
            {report && (
                <div className="report-content">
                    {/* Summary Cards */}
                    <div className="report-summary-grid">
                        <div className="report-summary-card">
                            <div className="report-summary-icon">📝</div>
                            <div className="report-summary-val">{report.summary.totalArticles}</div>
                            <div className="report-summary-lbl">Articles Published</div>
                        </div>
                        <div className="report-summary-card report-summary-indexed">
                            <div className="report-summary-icon">✅</div>
                            <div className="report-summary-val">{report.summary.totalIndexed}</div>
                            <div className="report-summary-lbl">Indexed</div>
                        </div>
                        <div className="report-summary-card report-summary-redir">
                            <div className="report-summary-icon">🔀</div>
                            <div className="report-summary-val">{report.summary.totalRedirections}</div>
                            <div className="report-summary-lbl">Redirections</div>
                        </div>
                    </div>

                    {/* Daily Breakdown */}
                    <div className="report-daily-section">
                        <h3 className="report-daily-title">Daily Breakdown</h3>
                        <div className="report-daily-list">
                            {report.dailyData.map(day => (
                                <div key={day.date} className="report-day-card">
                                    <div className="report-day-header">
                                        <span className="report-day-date">📅 {day.date}</span>
                                        <div className="report-day-badges">
                                            <span className="report-day-badge badge-articles">{day.articles} articles</span>
                                            <span className="report-day-badge badge-indexed">{day.indexed} indexed</span>
                                            <span className="report-day-badge badge-redir">{day.redirections} redirections</span>
                                        </div>
                                    </div>

                                    {day.traffic ? (
                                        <div className="report-traffic-section">
                                            <div className="report-traffic-grid">
                                                <div className="report-traffic-stat traffic-total">
                                                    <span className="report-traffic-val">{day.traffic.visitors}</span>
                                                    <span className="report-traffic-lbl">Total Visitors</span>
                                                </div>
                                                <div className="report-traffic-stat traffic-pv">
                                                    <span className="report-traffic-val">{day.traffic.pageviews}</span>
                                                    <span className="report-traffic-lbl">Pageviews</span>
                                                </div>
                                                <div className="report-traffic-stat traffic-google">
                                                    <span className="report-traffic-val">{day.traffic.google}</span>
                                                    <span className="report-traffic-lbl">🔍 Google</span>
                                                </div>
                                                <div className="report-traffic-stat traffic-direct">
                                                    <span className="report-traffic-val">{day.traffic.direct}</span>
                                                    <span className="report-traffic-lbl">➡️ Direct</span>
                                                </div>
                                                <div className="report-traffic-stat traffic-other">
                                                    <span className="report-traffic-val">{day.traffic.other}</span>
                                                    <span className="report-traffic-lbl">🌐 Other</span>
                                                </div>
                                            </div>

                                            {/* Traffic source bar */}
                                            <div className="report-source-bar">
                                                {day.traffic.visitors > 0 && (
                                                    <>
                                                        <div
                                                            className="source-segment google-seg"
                                                            style={{ width: `${(day.traffic.google / day.traffic.visitors) * 100}%` }}
                                                            title={`Google: ${day.traffic.google}`}
                                                        ></div>
                                                        <div
                                                            className="source-segment direct-seg"
                                                            style={{ width: `${(day.traffic.direct / day.traffic.visitors) * 100}%` }}
                                                            title={`Direct: ${day.traffic.direct}`}
                                                        ></div>
                                                        <div
                                                            className="source-segment other-seg"
                                                            style={{ width: `${(day.traffic.other / day.traffic.visitors) * 100}%` }}
                                                            title={`Other: ${day.traffic.other}`}
                                                        ></div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="report-source-legend">
                                                <span className="legend-item"><span className="legend-dot google-dot"></span> Google</span>
                                                <span className="legend-item"><span className="legend-dot direct-dot"></span> Direct</span>
                                                <span className="legend-item"><span className="legend-dot other-dot"></span> Other</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="report-no-traffic">No traffic data available</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {!report && !loading && (
                <div className="report-empty">
                    <div className="report-empty-icon">📋</div>
                    <p>Select a date range and click "Generate Report" to see your domain performance.</p>
                </div>
            )}
        </div>
    )
}

export default ReportSection
