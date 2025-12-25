import { useState } from 'react';

function ArticleDetailModal({ article, onClose }) {
    if (!article) return null;

    const formatTime = (isoString) => {
        if (!isoString) return '—';
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (isoString) => {
        if (!isoString) return '—';
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const timelineEvents = [
        { label: 'Added', time: article.addedAt, icon: '✅', done: !!article.addedAt },
        { label: 'Indexed', time: article.indexedAt, icon: '🔍', done: !!article.indexedAt },
        { label: 'Focus Started', time: article.focusStartedAt, icon: '🎯', done: !!article.focusStartedAt },
        { label: 'Push Given', time: article.pushGivenAt, icon: '🔔', done: !!article.pushGivenAt }
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="article-detail-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>

                {/* Header */}
                <div className="article-detail-header">
                    {article.featuredImage && (
                        <div
                            className="article-detail-image"
                            style={{ backgroundImage: `url(${article.featuredImage})` }}
                        />
                    )}
                    <h2 className="article-detail-title">{article.title || article.label}</h2>
                    <p className="article-detail-url">{article.url}</p>
                </div>

                {/* Timeline */}
                <div className="article-timeline">
                    <h3>Timeline</h3>
                    <div className="timeline-list">
                        {timelineEvents.map((event, i) => (
                            <div key={i} className={`timeline-item ${event.done ? 'done' : 'pending'}`}>
                                <div className="timeline-icon">{event.icon}</div>
                                <div className="timeline-content">
                                    <span className="timeline-label">{event.label}</span>
                                    <span className="timeline-time">
                                        {event.done ? `${formatDate(event.time)} at ${formatTime(event.time)}` : 'Pending'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Hourly Stats */}
                {article.hourlySnapshots && article.hourlySnapshots.length > 0 && (
                    <div className="article-hourly-stats">
                        <h3>Hourly Traffic (Last 10 Hours)</h3>
                        <table className="hourly-table">
                            <thead>
                                <tr>
                                    <th>Hour</th>
                                    <th>Visitors</th>
                                    <th>Δ Change</th>
                                    <th>% Change</th>
                                </tr>
                            </thead>
                            <tbody>
                                {article.hourlySnapshots.map((snap, i) => (
                                    <tr key={i}>
                                        <td>{new Date(snap.hour).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td>{snap.visitors}</td>
                                        <td className={snap.delta >= 0 ? 'positive' : 'negative'}>
                                            {snap.delta >= 0 ? '+' : ''}{snap.delta}
                                        </td>
                                        <td className={snap.percentChange >= 0 ? 'positive' : 'negative'}>
                                            {snap.percentChange >= 0 ? '+' : ''}{snap.percentChange}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Focus Group Info */}
                {article.focusGroup && (
                    <div className="article-focus-info">
                        <span
                            className="focus-badge"
                            style={{ backgroundColor: article.focusGroup.color }}
                        >
                            {article.focusGroup.name}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ArticleDetailModal;
