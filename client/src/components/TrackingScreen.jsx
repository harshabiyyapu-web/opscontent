import { useState, useEffect, useCallback } from 'react';
import UrlCard from './UrlCard';
import AnalyticsCard from './AnalyticsCard';

function TrackingScreen({ domainId, session, selectedDate }) {
    const [selectedFocusGroup, setSelectedFocusGroup] = useState('all');
    const [analytics, setAnalytics] = useState({});
    const [loading, setLoading] = useState(false);

    // Fetch analytics with force refresh option
    const fetchAnalytics = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        try {
            const url = forceRefresh
                ? `/api/domains/${domainId}/analytics?force=true&t=${Date.now()}`
                : `/api/domains/${domainId}/analytics`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setAnalytics(data.analytics || {});
            }
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    }, [domainId]);

    useEffect(() => {
        const trackedArticles = session.articles.filter(a => a.isTracking);
        if (trackedArticles.length > 0) {
            fetchAnalytics();
            // Auto-refresh every 30 seconds
            const interval = setInterval(() => fetchAnalytics(true), 30000);
            return () => clearInterval(interval);
        }
    }, [session, fetchAnalytics]);

    // Filter articles by focus group
    const getFilteredArticles = () => {
        let articles = session.articles.filter(a => a.isTracking);
        if (selectedFocusGroup !== 'all') {
            articles = articles.filter(a => a.focusGroupId === selectedFocusGroup);
        }
        return articles;
    };

    const filteredArticles = getFilteredArticles();

    const getFocusGroupColor = (focusGroupId) => {
        const fg = session.focusGroups.find(g => g.id === focusGroupId);
        return fg?.color || '#6b7280';
    };

    const getFocusGroupName = (focusGroupId) => {
        const fg = session.focusGroups.find(g => g.id === focusGroupId);
        return fg?.name || 'Unassigned';
    };

    return (
        <div className="tracking-screen">
            {/* Header with Focus Group Filter */}
            <div className="tracking-header">
                <h3>📊 Tracked Content</h3>
                <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                    <select
                        className="focus-filter"
                        value={selectedFocusGroup}
                        onChange={(e) => setSelectedFocusGroup(e.target.value)}
                    >
                        <option value="all">All Focus Groups</option>
                        {session.focusGroups.map(fg => (
                            <option key={fg.id} value={fg.id}>{fg.name}</option>
                        ))}
                    </select>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => fetchAnalytics(true)}
                        disabled={loading}
                    >
                        {loading ? 'Refreshing...' : '🔄 Refresh'}
                    </button>
                </div>
            </div>

            {loading && filteredArticles.length === 0 ? (
                <div className="loading-state">Loading analytics...</div>
            ) : filteredArticles.length === 0 ? (
                <div className="section-empty">
                    <div className="section-empty-icon">📊</div>
                    <p>No tracked articles. Enable tracking by clicking "Track" on articles or adding to Focus Groups.</p>
                </div>
            ) : (
                <div className="url-analytics-list">
                    {filteredArticles.map(article => (
                        <div key={article.id} className="url-analytics-row">
                            {/* Article Card */}
                            <div className="url-analytics-card">
                                <div
                                    className="tracking-focus-badge"
                                    style={{
                                        backgroundColor: getFocusGroupColor(article.focusGroupId),
                                        marginBottom: 'var(--spacing-sm)'
                                    }}
                                >
                                    {getFocusGroupName(article.focusGroupId)}
                                </div>
                                <UrlCard
                                    url={article}
                                    onToggleTracking={() => { }}
                                    onDelete={() => { }}
                                />
                            </div>

                            {/* Analytics Card */}
                            <div className="url-analytics-data">
                                {analytics[article.id] ? (
                                    <AnalyticsCard
                                        url={article}
                                        analytics={analytics[article.id]}
                                    />
                                ) : (
                                    <div className="analytics-placeholder">
                                        <span>Loading analytics...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default TrackingScreen;
