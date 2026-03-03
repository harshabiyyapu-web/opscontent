import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import Modal from '../components/Modal'
import ContentGroupCard, { PRESET_COUNTRIES } from '../components/ContentGroupCard'
import RedirectionCard from '../components/RedirectionCard'
import ApluPushModal from '../components/ApluPushModal'
import ArticleDetailModal from '../components/ArticleDetailModal'
import DateSelector from '../components/DateSelector'
import TabNavigation from '../components/TabNavigation'
import BasicSetup from '../components/BasicSetup'

function DomainView({ activeTab, setActiveTab }) {
    const { id } = useParams()
    const [domain, setDomain] = useState(null)
    const [session, setSession] = useState({ contentGroups: [], redirectionSets: [], articles: [], focusGroups: [] })
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

    // Modals
    const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false)
    const [isRedirModalOpen, setIsRedirModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Add group form
    const [groupCountry, setGroupCountry] = useState('India')
    const [groupCustomName, setGroupCustomName] = useState('')
    const [groupUrls, setGroupUrls] = useState('')

    // Redirection form
    const [redirName, setRedirName] = useState('')
    const [redirSourceUrls, setRedirSourceUrls] = useState('')
    const [redirArticleIds, setRedirArticleIds] = useState([])
    const [redirGroupId, setRedirGroupId] = useState(null)

    // Analytics state
    const [analyticsData, setAnalyticsData] = useState([])
    const [analyticsLoading, setAnalyticsLoading] = useState(false)
    const [analyticsPushModal, setAnalyticsPushModal] = useState(false)
    const [analyticsPushTarget, setAnalyticsPushTarget] = useState(null)
    const [pushDetailOpen, setPushDetailOpen] = useState(null)
    const [articleSearchQuery, setArticleSearchQuery] = useState('')
    const [articleDetailOpen, setArticleDetailOpen] = useState(null)
    const [selectedForIndex, setSelectedForIndex] = useState(new Set())

    // Fetch session
    const fetchSession = useCallback(async () => {
        try {
            const response = await fetch(`/api/domains/${id}/session/${selectedDate}`)
            if (response.ok) {
                const data = await response.json()
                setSession(data)
            }
        } catch (error) {
            console.error('Failed to fetch session:', error)
        }
    }, [id, selectedDate])

    // Fetch domain
    const fetchDomain = useCallback(async () => {
        try {
            const response = await fetch(`/api/domains/${id}`)
            if (response.ok) setDomain(await response.json())
        } catch (error) {
            console.error('Failed to fetch domain:', error)
        } finally {
            setLoading(false)
        }
    }, [id])

    // Fetch analytics (Plausible realtime)
    const fetchAnalytics = useCallback(async () => {
        setAnalyticsLoading(true)
        try {
            const response = await fetch(`/api/domains/${id}/analytics-groups?date=${selectedDate}&realtime=true`)
            if (response.ok) {
                const data = await response.json()
                setAnalyticsData(data)
            }
        } catch (error) {
            console.error('Failed to fetch analytics:', error)
        } finally {
            setAnalyticsLoading(false)
        }
    }, [id, selectedDate])

    // Save traffic snapshot
    const handleSaveSnapshot = async (groupId, articleId, visitors, pageviews) => {
        try {
            const response = await fetch(`/api/domains/${id}/session/groups/${groupId}/articles/${articleId}/snapshot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visitors, pageviews, date: selectedDate })
            })
            if (response.ok) {
                // Refresh analytics to get updated snapshots
                fetchAnalytics()
            }
        } catch (error) { console.error('Failed to save snapshot:', error) }
    }

    // Analytics push handler
    const handleAnalyticsPush = async (pushData) => {
        if (!analyticsPushTarget) return
        try {
            const res = await fetch(`/api/domains/${id}/session/push/article/${analyticsPushTarget.articleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...pushData, date: selectedDate })
            })
            if (res.ok) {
                fetchAnalytics()
                fetchSession()
            }
        } catch (e) { console.error(e) }
    }

    // Google index check — open site:url in new tab
    const handleGoogleCheck = (url) => {
        window.open(`https://www.google.com/search?q=site:${encodeURIComponent(url)}`, '_blank')
    }

    // Bulk Google check — opens multiple tabs
    const handleBulkGoogleCheck = () => {
        const allArticles = (analyticsData || []).flatMap(g => g.articles)
        const selected = allArticles.filter(a => selectedForIndex.has(a.id))
        selected.forEach(a => {
            window.open(`https://www.google.com/search?q=site:${encodeURIComponent(a.url)}`, '_blank')
        })
    }

    // Mark indexed
    const handleMarkIndexed = async (articleIds) => {
        try {
            await fetch(`/api/domains/${id}/session/mark-indexed`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ articleIds, date: selectedDate })
            })
            fetchSession()
            fetchAnalytics()
            setSelectedForIndex(new Set())
        } catch (e) { console.error(e) }
    }

    // Toggle select for index
    const toggleSelectForIndex = (articleId) => {
        setSelectedForIndex(prev => {
            const next = new Set(prev)
            if (next.has(articleId)) next.delete(articleId)
            else next.add(articleId)
            return next
        })
    }

    // Select all articles for index
    const selectAllForIndex = () => {
        const allIds = (analyticsData || []).flatMap(g => g.articles.map(a => a.id))
        if (selectedForIndex.size === allIds.length) {
            setSelectedForIndex(new Set())
        } else {
            setSelectedForIndex(new Set(allIds))
        }
    }

    useEffect(() => { fetchDomain() }, [fetchDomain])
    useEffect(() => { fetchSession() }, [fetchSession])

    // Auto-refresh analytics every 30s when on analytics tab
    useEffect(() => {
        if (activeTab === 'analytics' && (session.contentGroups || []).length > 0) {
            fetchAnalytics()
            const interval = setInterval(fetchAnalytics, 30000)
            return () => clearInterval(interval)
        }
    }, [activeTab, fetchAnalytics, session.contentGroups])

    // --- Content Group Handlers ---
    const handleAddGroup = async (e) => {
        e.preventDefault()
        if (!groupUrls.trim()) return
        setSubmitting(true)

        const preset = PRESET_COUNTRIES.find(c => c.name === groupCountry)

        try {
            const response = await fetch(`/api/domains/${id}/session/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    country: groupCountry,
                    countryFlag: preset?.flag || '✏️',
                    customCountryName: groupCountry === 'Custom' ? groupCustomName : undefined,
                    urls: groupUrls,
                    date: selectedDate
                })
            })
            if (response.ok) {
                const newGroup = await response.json()
                setSession(prev => ({ ...prev, contentGroups: [...prev.contentGroups, newGroup] }))
                setIsAddGroupModalOpen(false)
                setGroupUrls('')
                setGroupCountry('India')
                setGroupCustomName('')
            }
        } catch (error) {
            console.error('Failed to add group:', error)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteGroup = async (groupId) => {
        if (!confirm('Delete this group and all its articles?')) return
        try {
            await fetch(`/api/domains/${id}/session/groups/${groupId}?date=${selectedDate}`, { method: 'DELETE' })
            setSession(prev => ({ ...prev, contentGroups: prev.contentGroups.filter(g => g.id !== groupId) }))
        } catch (error) { console.error(error) }
    }

    const handleDeleteArticle = async (groupId, articleId) => {
        try {
            await fetch(`/api/domains/${id}/session/groups/${groupId}/articles/${articleId}?date=${selectedDate}`, { method: 'DELETE' })
            setSession(prev => ({
                ...prev,
                contentGroups: prev.contentGroups.map(g =>
                    g.id === groupId ? { ...g, articles: g.articles.filter(a => a.id !== articleId) } : g
                )
            }))
        } catch (error) { console.error(error) }
    }

    // Open redirection modal with pre-selected articles
    const handleSelectArticlesForRedir = (groupId, articleIds, country, flag) => {
        setRedirArticleIds(articleIds)
        setRedirGroupId(groupId)
        setRedirName(`${flag} ${country} Redirection`)
        setIsRedirModalOpen(true)
    }

    // --- Redirection Handlers ---
    const handleCreateRedirection = async (e) => {
        e.preventDefault()
        if (!redirSourceUrls.trim() || redirArticleIds.length === 0) return
        setSubmitting(true)

        try {
            const response = await fetch(`/api/domains/${id}/session/redirections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: redirName,
                    sourceUrls: redirSourceUrls,
                    redirectedArticleIds: redirArticleIds,
                    groupId: redirGroupId,
                    date: selectedDate
                })
            })
            if (response.ok) {
                const newRedir = await response.json()
                setSession(prev => ({ ...prev, redirectionSets: [...prev.redirectionSets, newRedir] }))
                setIsRedirModalOpen(false)
                setRedirSourceUrls('')
                setRedirName('')
                setRedirArticleIds([])
                setRedirGroupId(null)
                setActiveTab('redirection')
            }
        } catch (error) {
            console.error('Failed to create redirection:', error)
        } finally {
            setSubmitting(false)
        }
    }

    const handleUpdateRedirection = (updated) => {
        setSession(prev => ({
            ...prev,
            redirectionSets: prev.redirectionSets.map(r => r.id === updated.id ? updated : r)
        }))
        // Also refetch to get updated push propagation
        fetchSession()
    }

    const handleDeleteRedirection = async (redirId) => {
        if (!confirm('Delete this redirection?')) return
        try {
            await fetch(`/api/domains/${id}/session/redirections/${redirId}?date=${selectedDate}`, { method: 'DELETE' })
            setSession(prev => ({ ...prev, redirectionSets: prev.redirectionSets.filter(r => r.id !== redirId) }))
        } catch (error) { console.error(error) }
    }

    // Helper: get all articles across all groups
    const getAllArticles = () => {
        return (session.contentGroups || []).flatMap(g => g.articles.map(a => ({ ...a, groupId: g.id, country: g.country, flag: g.countryFlag })))
    }

    if (loading) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">⏳</div>
                <p className="empty-state-text">Loading domain...</p>
            </div>
        )
    }

    if (!domain) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">❌</div>
                <h3 className="empty-state-title">Domain not found</h3>
                <Link to="/" className="btn btn-primary">Back to Dashboard</Link>
            </div>
        )
    }

    return (
        <div>
            {/* Domain Header */}
            <div className="page-header">
                <div>
                    <div className="domain-name-row">
                        <h1 className="page-title">{domain.name}</h1>
                        {domain.googleTraffic && <span className="traffic-dot traffic-dot-green"></span>}
                    </div>
                    <p className="page-subtitle">{domain.url}</p>
                </div>
                <DateSelector selectedDate={selectedDate} onChange={setSelectedDate} />
            </div>

            {/* Tabs */}
            <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

            {/* ===== ARTICLES TAB ===== */}
            {activeTab === 'articles' && (
                <div className="content-section">
                    <div className="content-section-header">
                        <h2 className="content-section-title">📝 Content Groups</h2>
                        <button className="btn btn-primary" onClick={() => setIsAddGroupModalOpen(true)}>+ Add Group</button>
                    </div>

                    {(session.contentGroups || []).length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📄</div>
                            <h3 className="empty-state-title">No content groups yet</h3>
                            <p className="empty-state-text">Add a country group with article URLs to get started.</p>
                            <button className="btn btn-primary" onClick={() => setIsAddGroupModalOpen(true)} style={{ marginTop: '1rem' }}>+ Add First Group</button>
                        </div>
                    ) : (
                        (session.contentGroups || []).map(group => (
                            <ContentGroupCard
                                key={group.id}
                                group={group}
                                onSelectArticles={handleSelectArticlesForRedir}
                                onDeleteGroup={handleDeleteGroup}
                                onDeleteArticle={handleDeleteArticle}
                                onMarkIndexed={handleMarkIndexed}
                            />
                        ))
                    )}
                </div>
            )}

            {/* ===== REDIRECTION TAB ===== */}
            {activeTab === 'redirection' && (
                <div className="content-section">
                    <div className="content-section-header">
                        <h2 className="content-section-title">🔀 Redirection Sets</h2>
                    </div>

                    {(session.redirectionSets || []).length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🔀</div>
                            <h3 className="empty-state-title">No redirections yet</h3>
                            <p className="empty-state-text">Go to Articles tab, select articles from a group, and click "Add to Redirection".</p>
                        </div>
                    ) : (
                        <div className="redir-list">
                            {(session.redirectionSets || []).map(redir => (
                                <RedirectionCard
                                    key={redir.id}
                                    redirSet={redir}
                                    contentGroups={session.contentGroups || []}
                                    domainId={id}
                                    selectedDate={selectedDate}
                                    onUpdate={handleUpdateRedirection}
                                    onDelete={handleDeleteRedirection}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ===== ANALYTICS TAB ===== */}
            {activeTab === 'analytics' && (
                <>
                    <div className="content-section">
                        <div className="content-section-header">
                            <h2 className="content-section-title">📊 Analytics</h2>
                            <div className="analytics-search-bar">
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="🔍 Search articles..."
                                    value={articleSearchQuery}
                                    onChange={e => setArticleSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {(session.contentGroups || []).length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📊</div>
                                <h3 className="empty-state-title">No data</h3>
                                <p className="empty-state-text">Add content groups first to see analytics.</p>
                            </div>
                        ) : (
                            (analyticsData || []).map(group => {
                                const filteredArticles = articleSearchQuery
                                    ? group.articles.filter(a =>
                                        (a.title || a.url || '').toLowerCase().includes(articleSearchQuery.toLowerCase())
                                    )
                                    : group.articles
                                if (filteredArticles.length === 0 && articleSearchQuery) return null
                                return (
                                    <div key={group.groupId} className="analytics-country-section">
                                        <div className="analytics-country-header">
                                            <span className="country-flag-large">{group.countryFlag}</span>
                                            <h3>{group.country}</h3>
                                            <span className="content-group-count">{group.articles.length} articles</span>
                                            <button className="btn btn-primary btn-sm" onClick={fetchAnalytics} style={{ marginLeft: 'auto' }} disabled={analyticsLoading}>
                                                {analyticsLoading ? '⏳' : '🔄'} Refresh
                                            </button>
                                        </div>

                                        {/* Bulk Actions Bar */}
                                        {selectedForIndex.size > 0 && (
                                            <div className="bulk-actions-bar">
                                                <label className="bulk-select-all">
                                                    <input type="checkbox" onChange={selectAllForIndex} checked={selectedForIndex.size === (analyticsData || []).flatMap(g => g.articles).length} />
                                                    Select All
                                                </label>
                                                <span className="bulk-count">{selectedForIndex.size} selected</span>
                                                <button className="btn btn-bulk-google" onClick={handleBulkGoogleCheck}>🔍 Bulk Google Check</button>
                                                <button className="btn btn-bulk-indexed" onClick={() => handleMarkIndexed([...selectedForIndex])}>✅ Bulk Mark Indexed</button>
                                            </div>
                                        )}

                                        <div className="analytics-articles-list">
                                            {filteredArticles.map(article => {
                                                const a = article.analytics || {}
                                                const rt = a.realtime || {}
                                                const totals = a.totals || {}
                                                const hourlyData = a.hourlyData || []
                                                const maxVal = Math.max(...hourlyData.map(d => d.visitors || 0), 1)
                                                const snapshots = article.trafficSnapshots || []
                                                const sources = a.sources || []

                                                return (
                                                    <div key={article.id} className={`analytics-article-card ${article.indexed ? 'article-indexed' : ''}`}>
                                                        {/* Article Header with Image */}
                                                        <div className="analytics-article-header">
                                                            {/* Checkbox for bulk select */}
                                                            <div className="index-checkbox-wrap">
                                                                <input
                                                                    type="checkbox"
                                                                    className="index-checkbox"
                                                                    checked={selectedForIndex.has(article.id)}
                                                                    onChange={() => toggleSelectForIndex(article.id)}
                                                                />
                                                            </div>
                                                            <div className="analytics-article-img-wrap">
                                                                {article.image ? (
                                                                    <img src={article.image} alt="" className="analytics-article-img" onError={e => { e.target.style.display = 'none' }} />
                                                                ) : (
                                                                    <div className="analytics-article-img-placeholder">📄</div>
                                                                )}
                                                            </div>
                                                            <div className="analytics-article-info-col">
                                                                <h4 className="analytics-article-title analytics-article-clickable" onClick={() => setArticleDetailOpen(article)}>
                                                                    {article.title}
                                                                    {article.indexed && <span className="indexed-badge">✅ Indexed</span>}
                                                                </h4>
                                                                <div className="article-url-row">
                                                                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="analytics-article-link">
                                                                        {(() => { try { return new URL(article.url).hostname + new URL(article.url).pathname.slice(0, 30) } catch { return article.url.slice(0, 50) } })()}
                                                                    </a>
                                                                    <button className="btn-google-check" onClick={() => handleGoogleCheck(article.url)} title="Check if indexed on Google">
                                                                        🔍
                                                                    </button>
                                                                    {!article.indexed && (
                                                                        <button className="btn-mark-indexed" onClick={() => handleMarkIndexed([article.id])} title="Mark as indexed">
                                                                            ✅
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <div className="analytics-push-row">
                                                                    {article.pushStatus?.given ? (
                                                                        <span
                                                                            className="push-badge push-given-badge push-badge-clickable"
                                                                            onClick={() => setPushDetailOpen(pushDetailOpen === article.id ? null : article.id)}
                                                                        >
                                                                            🔔 Push Given ▾
                                                                        </span>
                                                                    ) : (
                                                                        <button className="btn btn-push-sm" onClick={() => {
                                                                            setAnalyticsPushTarget({ articleId: article.id, label: article.title })
                                                                            setAnalyticsPushModal(true)
                                                                        }}>
                                                                            🔔 Push
                                                                        </button>
                                                                    )}
                                                                    {article.pushStatus?.pushPassed && <span className="push-badge push-passed-badge">✓ Passed</span>}
                                                                </div>
                                                                {/* Push Detail Dropdown */}
                                                                {pushDetailOpen === article.id && article.pushStatus?.given && (
                                                                    <div className="push-detail-dropdown">
                                                                        <div className="push-detail-row"><span className="push-detail-label">Site:</span> <span>{article.pushStatus.siteName}</span></div>
                                                                        <div className="push-detail-row"><span className="push-detail-label">Email:</span> <span>{article.pushStatus.email}</span></div>
                                                                        <div className="push-detail-row"><span className="push-detail-label">Time:</span> <span>{article.pushStatus.time}</span></div>
                                                                        <div className="push-detail-row"><span className="push-detail-label">Given:</span> <span>{new Date(article.pushStatus.givenAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {/* Realtime Visitors Big Number */}
                                                            <div className="analytics-realtime-big">
                                                                <div className="realtime-live-indicator">
                                                                    <span className="live-dot-pulse"></span>
                                                                    <span className="live-text">LIVE</span>
                                                                </div>
                                                                <div className="realtime-big-number">{rt.visitors || 0}</div>
                                                                <div className="realtime-big-label">visitors now</div>
                                                            </div>
                                                        </div>

                                                        {/* Traffic Chart */}
                                                        {hourlyData.length > 0 && (
                                                            <div className="analytics-mini-chart">
                                                                <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mini-chart-svg">
                                                                    <defs>
                                                                        <linearGradient id={`grad-${article.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                                                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                                                        </linearGradient>
                                                                    </defs>
                                                                    <path
                                                                        d={`M ${hourlyData.map((d, i) => `${(i / (hourlyData.length - 1 || 1)) * 100},${40 - ((d.visitors || 0) / maxVal) * 35}`).join(' L ')}`}
                                                                        fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"
                                                                    />
                                                                    <path
                                                                        d={`M 0,40 ${hourlyData.map((d, i) => `L ${(i / (hourlyData.length - 1 || 1)) * 100},${40 - ((d.visitors || 0) / maxVal) * 35}`).join(' ')} L 100,40 Z`}
                                                                        fill={`url(#grad-${article.id})`}
                                                                    />
                                                                </svg>
                                                                <div className="mini-chart-labels">
                                                                    <span>24h ago</span>
                                                                    <span>Now</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Today's Totals */}
                                                        <div className="analytics-totals-row">
                                                            <div className="analytics-metric">
                                                                <span className="analytics-metric-val">{totals.visitors || 0}</span>
                                                                <span className="analytics-metric-lbl">Today</span>
                                                            </div>
                                                            <div className="analytics-metric">
                                                                <span className="analytics-metric-val">{totals.pageviews || 0}</span>
                                                                <span className="analytics-metric-lbl">Views</span>
                                                            </div>
                                                            <div className="analytics-metric">
                                                                <span className="analytics-metric-val">{totals.bounce_rate ? `${Math.round(totals.bounce_rate)}%` : '0%'}</span>
                                                                <span className="analytics-metric-lbl">Bounce</span>
                                                            </div>
                                                            <div className="analytics-metric">
                                                                <span className="analytics-metric-val">{totals.visit_duration ? `${Math.floor(totals.visit_duration / 60)}m` : '0s'}</span>
                                                                <span className="analytics-metric-lbl">Avg Time</span>
                                                            </div>
                                                        </div>

                                                        {/* Realtime Traffic Sources (Last 5 min) */}
                                                        {sources.length > 0 && (
                                                            <div className="analytics-sources-section">
                                                                <div className="analytics-sources-label">📡 Live Sources <span className="sources-live-tag">last 5 min</span></div>
                                                                <div className="analytics-sources-list">
                                                                    {sources.slice(0, 6).map((src, idx) => {
                                                                        const maxSrcVisitors = sources[0]?.visitors || 1
                                                                        const barPercent = Math.max(5, (src.visitors / maxSrcVisitors) * 100)
                                                                        const sourceColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899']
                                                                        return (
                                                                            <div key={idx} className="source-bar-row">
                                                                                <span className="source-bar-name">{src.source}</span>
                                                                                <div className="source-bar-track">
                                                                                    <div
                                                                                        className="source-bar-fill"
                                                                                        style={{ width: `${barPercent}%`, backgroundColor: sourceColors[idx % sourceColors.length] }}
                                                                                    ></div>
                                                                                </div>
                                                                                <span className="source-bar-count">{src.visitors}</span>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Action Buttons — Snapshot + Push side by side */}
                                                        <div className="analytics-action-row">
                                                            <button
                                                                className="btn btn-snapshot-compact"
                                                                onClick={() => handleSaveSnapshot(group.groupId, article.id, rt.visitors || 0, totals.pageviews || 0)}
                                                            >
                                                                📸 Snapshot
                                                            </button>
                                                            {!article.pushStatus?.given && (
                                                                <button className="btn btn-push-compact" onClick={() => {
                                                                    setAnalyticsPushTarget({ articleId: article.id, label: article.title })
                                                                    setAnalyticsPushModal(true)
                                                                }}>
                                                                    🔔 Push
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Saved Snapshots */}
                                                        {snapshots.length > 0 && (
                                                            <div className="snapshot-list">
                                                                {snapshots.map(snap => (
                                                                    <div key={snap.id} className="snapshot-item">
                                                                        <span className="snapshot-time">🕐 {snap.timestamp}</span>
                                                                        <span className="snapshot-visitors"><strong>{snap.visitors}</strong> live</span>
                                                                        <span className="snapshot-views">{snap.pageviews} views</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {a.lastUpdated && (
                                                            <div className="analytics-updated">
                                                                Updated: {new Date(a.lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Redirection Summary below articles */}
                                        {(group.redirectionSets || []).length > 0 && (
                                            <div className="analytics-redir-summary">
                                                {group.redirectionSets.map(redir => (
                                                    <div key={redir.id} className="analytics-redir-card">
                                                        <div className="analytics-redir-name">
                                                            <span className={`redir-status-dot ${redir.toggleOn ? 'dot-green' : 'dot-red'}`}></span>
                                                            {redir.name}
                                                            {redir.duration && <span className="analytics-duration">⏱ {redir.duration}</span>}
                                                        </div>
                                                        <div className="analytics-lists">
                                                            <div className="analytics-source-list">
                                                                <div className="analytics-list-label source-label">Source</div>
                                                                {redir.sourceUrls.map(s => (
                                                                    <div key={s.id} className="analytics-url-item source-item">
                                                                        <span>{s.title || s.url}</span>
                                                                        {s.pushStatus?.given && <span className="push-badge push-given-badge">Push</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="analytics-arrow">→</div>
                                                            <div className="analytics-dest-list">
                                                                <div className="analytics-list-label dest-label">Redirected</div>
                                                                {redir.redirectedArticleIds.map(aid => {
                                                                    const art = group.articles.find(a => a.id === aid)
                                                                    if (!art) return null
                                                                    return (
                                                                        <div key={aid} className="analytics-url-item dest-item">
                                                                            <span>{art.title || art.url}</span>
                                                                            {art.pushStatus?.given && <span className="push-badge push-given-badge">Push</span>}
                                                                            {art.pushStatus?.pushPassed && <span className="push-badge push-passed-badge">Passed</span>}
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>

                    <ApluPushModal
                        isOpen={analyticsPushModal}
                        onClose={() => setAnalyticsPushModal(false)}
                        onSubmit={handleAnalyticsPush}
                        targetLabel={analyticsPushTarget?.label}
                    />
                    <ArticleDetailModal
                        isOpen={!!articleDetailOpen}
                        onClose={() => setArticleDetailOpen(null)}
                        article={articleDetailOpen}
                        domainId={id}
                        selectedDate={selectedDate}
                    />
                </>
            )}

            {/* ===== SETUP TAB ===== */}
            {activeTab === 'setup' && (
                <div className="content-section">
                    <div className="content-section-header">
                        <h2 className="content-section-title">⚙️ Basic Setup</h2>
                    </div>
                    <BasicSetup domain={domain} domainId={id} />
                </div>
            )}

            {/* ===== MODALS ===== */}

            {/* Add Group Modal */}
            <Modal isOpen={isAddGroupModalOpen} onClose={() => setIsAddGroupModalOpen(false)} title="Add Content Group">
                <form onSubmit={handleAddGroup}>
                    <div className="input-group">
                        <label className="input-label">Country</label>
                        <div className="country-selector-grid">
                            {PRESET_COUNTRIES.map(c => (
                                <button
                                    key={c.name}
                                    type="button"
                                    className={`country-select-btn ${groupCountry === c.name ? 'active' : ''}`}
                                    onClick={() => setGroupCountry(c.name)}
                                >
                                    <span className="country-select-flag">{c.flag}</span>
                                    <span className="country-select-name">{c.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {groupCountry === 'Custom' && (
                        <div className="input-group">
                            <label className="input-label">Custom Country Name</label>
                            <input className="input" type="text" placeholder="Country name" value={groupCustomName} onChange={e => setGroupCustomName(e.target.value)} required />
                        </div>
                    )}

                    <div className="input-group">
                        <label className="input-label">Article URLs (one per line)</label>
                        <textarea
                            className="input textarea-bulk"
                            placeholder={"https://example.com/article-1\nhttps://example.com/article-2\nhttps://example.com/article-3"}
                            value={groupUrls}
                            onChange={e => setGroupUrls(e.target.value)}
                            rows={8}
                            required
                        />
                        <p className="text-muted" style={{ marginTop: '0.5rem' }}>
                            {groupUrls.split('\n').filter(u => u.trim()).length} URLs detected
                        </p>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsAddGroupModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding...' : 'Add Group'}</button>
                    </div>
                </form>
            </Modal>

            {/* Redirection Modal */}
            <Modal isOpen={isRedirModalOpen} onClose={() => setIsRedirModalOpen(false)} title="Create Redirection">
                <form onSubmit={handleCreateRedirection}>
                    <div className="input-group">
                        <label className="input-label">Redirection Name</label>
                        <input className="input" type="text" placeholder="e.g. India Redirection 1" value={redirName} onChange={e => setRedirName(e.target.value)} />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Source URLs (one per line)</label>
                        <textarea
                            className="input textarea-bulk"
                            placeholder={"https://source-site.com/page-1\nhttps://source-site.com/page-2"}
                            value={redirSourceUrls}
                            onChange={e => setRedirSourceUrls(e.target.value)}
                            rows={5}
                            required
                        />
                    </div>

                    <div className="redir-modal-selected">
                        <label className="input-label">Redirected Articles ({redirArticleIds.length} selected)</label>
                        <div className="redir-selected-list">
                            {redirArticleIds.map(aid => {
                                const allArts = getAllArticles()
                                const art = allArts.find(a => a.id === aid)
                                return art ? (
                                    <div key={aid} className="redir-selected-item">
                                        <span className="redir-selected-flag">{art.flag}</span>
                                        <span>{art.title}</span>
                                    </div>
                                ) : null
                            })}
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsRedirModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create Redirection'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default DomainView
