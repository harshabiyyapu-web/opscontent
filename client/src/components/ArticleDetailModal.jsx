import { useState, useEffect } from 'react'

function ArticleDetailModal({ isOpen, onClose, article, domainId, selectedDate }) {
    const [details, setDetails] = useState(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!isOpen || !article) return
        setLoading(true)
        fetch(`/api/domains/${domainId}/session/article-detail/${article.id}?date=${selectedDate}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                setDetails(data)
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [isOpen, article, domainId, selectedDate])

    if (!isOpen || !article) return null

    const d = details || {}

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal article-detail-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <div className="modal-header">
                    <h3 className="modal-title">📋 Article Details</h3>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 32, color: '#b09a7a' }}>⏳ Loading...</div>
                ) : (
                    <div className="article-detail-body">
                        <div className="detail-card">
                            <div className="detail-card-label">Article</div>
                            <h4 className="detail-article-title">{article.title || 'Untitled'}</h4>
                            <a href={article.url} target="_blank" rel="noopener noreferrer" className="detail-article-url">
                                🔗 {article.url}
                            </a>
                        </div>

                        <div className="detail-card">
                            <div className="detail-card-label">Timeline</div>
                            <div className="detail-timeline">
                                <div className="detail-timeline-item">
                                    <span className="dt-icon">📥</span>
                                    <span className="dt-label">Added</span>
                                    <span className="dt-value">{d.addedAt ? new Date(d.addedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}</span>
                                </div>
                                {d.redirectionStarted && (
                                    <div className="detail-timeline-item">
                                        <span className="dt-icon">▶</span>
                                        <span className="dt-label">Redirect Started</span>
                                        <span className="dt-value">{d.redirectionStarted}</span>
                                    </div>
                                )}
                                {d.redirectionStopped && (
                                    <div className="detail-timeline-item">
                                        <span className="dt-icon">⏹</span>
                                        <span className="dt-label">Redirect Stopped</span>
                                        <span className="dt-value">{d.redirectionStopped}</span>
                                    </div>
                                )}
                                {d.redirectionDuration && (
                                    <div className="detail-timeline-item">
                                        <span className="dt-icon">⏱</span>
                                        <span className="dt-label">Duration</span>
                                        <span className="dt-value">{d.redirectionDuration}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="detail-card">
                            <div className="detail-card-label">Traffic ({selectedDate})</div>
                            <div className="detail-stats-grid">
                                <div className="detail-stat">
                                    <span className="detail-stat-val">{d.todayVisitors ?? '—'}</span>
                                    <span className="detail-stat-lbl">Visitors</span>
                                </div>
                                <div className="detail-stat">
                                    <span className="detail-stat-val">{d.todayPageviews ?? '—'}</span>
                                    <span className="detail-stat-lbl">Pageviews</span>
                                </div>
                                <div className="detail-stat">
                                    <span className="detail-stat-val">{d.realtimeVisitors ?? '—'}</span>
                                    <span className="detail-stat-lbl">Live Now</span>
                                </div>
                            </div>
                        </div>

                        {d.pushStatus && (
                            <div className="detail-card">
                                <div className="detail-card-label">Push Status</div>
                                {d.pushStatus.given ? (
                                    <div className="detail-timeline">
                                        <div className="detail-timeline-item"><span className="dt-icon">🔔</span><span className="dt-label">Push Given</span><span className="dt-value">Yes</span></div>
                                        <div className="detail-timeline-item"><span className="dt-icon">🌐</span><span className="dt-label">Site</span><span className="dt-value">{d.pushStatus.siteName}</span></div>
                                        <div className="detail-timeline-item"><span className="dt-icon">📧</span><span className="dt-label">Email</span><span className="dt-value">{d.pushStatus.email}</span></div>
                                        <div className="detail-timeline-item"><span className="dt-icon">🕐</span><span className="dt-label">Time</span><span className="dt-value">{d.pushStatus.time}</span></div>
                                        <div className="detail-timeline-item"><span className="dt-icon">📅</span><span className="dt-label">Given At</span><span className="dt-value">{new Date(d.pushStatus.givenAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></div>
                                    </div>
                                ) : d.pushStatus.pushPassed ? (
                                    <div className="detail-push-badge passed">✓ Push Passed</div>
                                ) : (
                                    <div className="detail-push-badge none">No push yet</div>
                                )}
                            </div>
                        )}

                        {d.snapshots && d.snapshots.length > 0 && (
                            <div className="detail-card">
                                <div className="detail-card-label">Traffic Snapshots</div>
                                <div className="detail-snapshots">
                                    {d.snapshots.map((snap, idx) => (
                                        <div key={idx} className="detail-snap-item">
                                            <span>🕐 {snap.timestamp}</span>
                                            <span><strong>{snap.visitors}</strong> live</span>
                                            <span>{snap.pageviews} views</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default ArticleDetailModal
