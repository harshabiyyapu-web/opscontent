import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import Modal from '../components/Modal'
import TodayContentCard from '../components/TodayContentCard'
import DateSelector from '../components/DateSelector'
import FocusGroupCard from '../components/FocusGroupCard'
import TabNavigation from '../components/TabNavigation'
import ArticleDetailModal from '../components/ArticleDetailModal'
import TrackingScreen from '../components/TrackingScreen'

function DomainView({ activeTab, setActiveTab }) {
    const { id } = useParams()
    const [domain, setDomain] = useState(null)
    const [session, setSession] = useState({ articles: [], focusGroups: [] })
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

    // Modals
    const [isAddUrlModalOpen, setIsAddUrlModalOpen] = useState(false)
    const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false)
    const [isFocusModalOpen, setIsFocusModalOpen] = useState(false)
    const [isCreateFocusModalOpen, setIsCreateFocusModalOpen] = useState(false)
    const [selectedArticles, setSelectedArticles] = useState([])
    const [selectedArticleDetail, setSelectedArticleDetail] = useState(null)

    const [formData, setFormData] = useState({ url: '', label: '' })
    const [bulkUrls, setBulkUrls] = useState('')
    const [focusFormData, setFocusFormData] = useState({ name: '', startTime: '' })
    const [submitting, setSubmitting] = useState(false)

    // Fetch session for selected date
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

    // Fetch domain info
    const fetchDomain = useCallback(async () => {
        try {
            const response = await fetch(`/api/domains/${id}`)
            if (response.ok) {
                const data = await response.json()
                setDomain(data)
            }
        } catch (error) {
            console.error('Failed to fetch domain:', error)
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => { fetchDomain() }, [fetchDomain])
    useEffect(() => { fetchSession() }, [fetchSession])

    // Article handlers
    const handleAddUrl = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const response = await fetch(`/api/domains/${id}/session/articles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, date: selectedDate })
            })
            if (response.ok) {
                const newArticle = await response.json()
                setSession(prev => ({ ...prev, articles: [...prev.articles, newArticle] }))
                setIsAddUrlModalOpen(false)
                setFormData({ url: '', label: '' })
            }
        } catch (error) {
            console.error('Failed to add article:', error)
        } finally {
            setSubmitting(false)
        }
    }

    // Bulk add URLs (one per line)
    const handleBulkAdd = async (e) => {
        e.preventDefault()
        const urls = bulkUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0)
        if (urls.length === 0) return

        setSubmitting(true)
        const newArticles = []

        for (const url of urls) {
            try {
                const response = await fetch(`/api/domains/${id}/session/articles`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, date: selectedDate })
                })
                if (response.ok) {
                    const newArticle = await response.json()
                    newArticles.push(newArticle)
                }
            } catch (error) {
                console.error(`Failed to add ${url}:`, error)
            }
        }

        setSession(prev => ({ ...prev, articles: [...prev.articles, ...newArticles] }))
        setIsBulkAddModalOpen(false)
        setBulkUrls('')
        setSubmitting(false)
    }

    const handleMarkIndexed = async (articleId) => {
        try {
            const response = await fetch(`/api/domains/${id}/session/articles/${articleId}/indexed`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: selectedDate })
            })
            if (response.ok) {
                const updated = await response.json()
                setSession(prev => ({
                    ...prev,
                    articles: prev.articles.map(a => a.id === articleId ? updated : a)
                }))
            }
        } catch (error) {
            console.error('Failed to mark indexed:', error)
        }
    }

    const handleDeleteArticle = async (articleId) => {
        if (!confirm('Delete this article?')) return
        try {
            const response = await fetch(`/api/domains/${id}/session/articles/${articleId}?date=${selectedDate}`, {
                method: 'DELETE'
            })
            if (response.ok || response.status === 204) {
                setSession(prev => ({
                    ...prev,
                    articles: prev.articles.filter(a => a.id !== articleId)
                }))
            }
        } catch (error) {
            console.error('Failed to delete article:', error)
        }
    }

    const toggleArticleSelection = (articleId) => {
        setSelectedArticles(prev =>
            prev.includes(articleId)
                ? prev.filter(id => id !== articleId)
                : [...prev, articleId]
        )
    }

    const handleViewArticleDetail = async (articleId) => {
        try {
            const response = await fetch(`/api/domains/${id}/session/articles/${articleId}?date=${selectedDate}`)
            if (response.ok) {
                const data = await response.json()
                setSelectedArticleDetail(data)
            }
        } catch (error) {
            console.error('Failed to fetch article detail:', error)
        }
    }

    // Focus group handlers
    const handleCreateFocusGroup = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const response = await fetch(`/api/domains/${id}/session/focus-groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...focusFormData, date: selectedDate })
            })
            if (response.ok) {
                const newFocusGroup = await response.json()
                setSession(prev => ({ ...prev, focusGroups: [...prev.focusGroups, newFocusGroup] }))
                setIsCreateFocusModalOpen(false)
                setFocusFormData({ name: '', startTime: '' })
            }
        } catch (error) {
            console.error('Failed to create focus group:', error)
        } finally {
            setSubmitting(false)
        }
    }

    const handleAddToFocus = async (focusGroupId) => {
        try {
            const response = await fetch(`/api/domains/${id}/session/focus-groups/${focusGroupId}/articles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ articleIds: selectedArticles, date: selectedDate })
            })
            if (response.ok) {
                const updatedFG = await response.json()
                setSession(prev => ({
                    ...prev,
                    focusGroups: prev.focusGroups.map(fg => fg.id === focusGroupId ? updatedFG : fg),
                    articles: prev.articles.map(a =>
                        selectedArticles.includes(a.id)
                            ? { ...a, focusGroupId, isTracking: true, focusStartedAt: new Date().toISOString() }
                            : a
                    )
                }))
                setSelectedArticles([])
                setIsFocusModalOpen(false)
            }
        } catch (error) {
            console.error('Failed to add to focus:', error)
        }
    }

    const handleMarkPush = async (focusGroupId) => {
        try {
            const response = await fetch(`/api/domains/${id}/session/focus-groups/${focusGroupId}/push`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ given: true, date: selectedDate })
            })
            if (response.ok) {
                const updatedFG = await response.json()
                setSession(prev => ({
                    ...prev,
                    focusGroups: prev.focusGroups.map(fg => fg.id === focusGroupId ? updatedFG : fg)
                }))
            }
        } catch (error) {
            console.error('Failed to mark push:', error)
        }
    }

    const handlePromote = async (articleId) => {
        setSession(prev => ({
            ...prev,
            articles: prev.articles.map(a =>
                a.id === articleId ? { ...a, isTracking: true } : a
            )
        }))
    }

    if (loading) {
        return <div className="empty-state"><div className="empty-state-icon">⏳</div><p>Loading...</p></div>
    }

    if (!domain) {
        return <div className="empty-state"><div className="empty-state-icon">❌</div><h3>Domain Not Found</h3><Link to="/" className="btn btn-primary">Back</Link></div>
    }

    return (
        <div>
            <Link to="/" className="back-link"><span>←</span><span>Back to Dashboard</span></Link>

            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">{domain.name}</h1>
                    <p className="page-subtitle">{domain.url}</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                    <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
                    <button className="btn btn-secondary" onClick={() => setIsBulkAddModalOpen(true)}>Bulk Add</button>
                    <button className="btn btn-primary" onClick={() => setIsAddUrlModalOpen(true)}>+ Add Article</button>
                </div>
            </div>

            {/* Tab Navigation */}
            <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Tab Content */}
            {activeTab === 'articles' && (
                <div className="content-section">
                    <div className="content-section-header">
                        <h2 className="content-section-title">📝 Today's Articles <span className="content-section-count">{session.articles.length}</span></h2>
                        {selectedArticles.length > 0 && (
                            <button className="btn btn-primary btn-sm" onClick={() => setIsFocusModalOpen(true)}>
                                Add {selectedArticles.length} to Focus →
                            </button>
                        )}
                    </div>
                    {session.articles.length === 0 ? (
                        <div className="section-empty"><div className="section-empty-icon">📝</div><p>No articles for this date</p></div>
                    ) : (
                        <div className="today-cards-list">
                            {session.articles.map(article => (
                                <div key={article.id} className="today-card-wrapper">
                                    <input type="checkbox" checked={selectedArticles.includes(article.id)} onChange={() => toggleArticleSelection(article.id)} className="article-checkbox" />
                                    <div className="clickable-article" onClick={() => handleViewArticleDetail(article.id)}>
                                        <TodayContentCard url={article} onMarkIndexed={handleMarkIndexed} onPromote={handlePromote} onDelete={handleDeleteArticle} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'focus' && (
                <div className="content-section">
                    <div className="content-section-header">
                        <h2 className="content-section-title" style={{ color: '#3b82f6' }}>🎯 Focus Groups <span className="content-section-count">{session.focusGroups.length}</span></h2>
                        <button className="btn btn-secondary btn-sm" onClick={() => setIsCreateFocusModalOpen(true)}>+ New Focus Set</button>
                    </div>
                    <div className="focus-groups-container">
                        {session.focusGroups.map(fg => (
                            <FocusGroupCard key={fg.id} focusGroup={fg} articles={session.articles} onMarkPush={handleMarkPush} />
                        ))}
                        {session.focusGroups.length === 0 && (
                            <button className="btn-create-focus" onClick={() => setIsCreateFocusModalOpen(true)}>
                                <span className="btn-create-focus-icon">🎯</span><span>Create First Focus Set</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'tracking' && (
                <TrackingScreen domainId={id} session={session} selectedDate={selectedDate} />
            )}

            {/* Modals */}
            <Modal isOpen={isAddUrlModalOpen} onClose={() => setIsAddUrlModalOpen(false)} title="Add Article">
                <form onSubmit={handleAddUrl}>
                    <div className="input-group">
                        <label className="input-label">URL</label>
                        <input className="input" type="url" placeholder="https://example.com/article" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} required />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsAddUrlModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding...' : 'Add'}</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isBulkAddModalOpen} onClose={() => setIsBulkAddModalOpen(false)} title="Bulk Add Articles">
                <form onSubmit={handleBulkAdd}>
                    <div className="input-group">
                        <label className="input-label">URLs (one per line)</label>
                        <textarea
                            className="input textarea-bulk"
                            placeholder="https://example.com/article-1&#10;https://example.com/article-2&#10;https://example.com/article-3"
                            value={bulkUrls}
                            onChange={(e) => setBulkUrls(e.target.value)}
                            rows={8}
                            required
                        />
                    </div>
                    <p className="text-muted" style={{ marginBottom: 'var(--spacing-md)' }}>
                        {bulkUrls.split('\n').filter(u => u.trim()).length} URLs detected
                    </p>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsBulkAddModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding...' : 'Add All'}</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isCreateFocusModalOpen} onClose={() => setIsCreateFocusModalOpen(false)} title="Create Focus Set">
                <form onSubmit={handleCreateFocusGroup}>
                    <div className="input-group">
                        <label className="input-label">Name</label>
                        <input className="input" type="text" placeholder="Focus Set 1" value={focusFormData.name} onChange={(e) => setFocusFormData({ ...focusFormData, name: e.target.value })} />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Start Time</label>
                        <input className="input" type="time" value={focusFormData.startTime} onChange={(e) => setFocusFormData({ ...focusFormData, startTime: e.target.value })} />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsCreateFocusModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create'}</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isFocusModalOpen} onClose={() => setIsFocusModalOpen(false)} title="Add to Focus Set">
                <p style={{ marginBottom: 'var(--spacing-md)' }}>Select a Focus Set for {selectedArticles.length} article(s):</p>
                <div className="focus-select-list">
                    {session.focusGroups.map(fg => (
                        <button key={fg.id} className="focus-select-option" onClick={() => handleAddToFocus(fg.id)}>
                            <div className="focus-select-color" style={{ backgroundColor: fg.color }}></div>
                            <span className="focus-select-name">{fg.name}</span>
                            <span className="text-muted">{fg.articles.length} articles</span>
                        </button>
                    ))}
                    {session.focusGroups.length === 0 && (
                        <button className="btn btn-primary" onClick={() => { setIsFocusModalOpen(false); setIsCreateFocusModalOpen(true); }}>Create Focus Set First</button>
                    )}
                </div>
            </Modal>

            {/* Article Detail Modal */}
            {selectedArticleDetail && (
                <ArticleDetailModal article={selectedArticleDetail} onClose={() => setSelectedArticleDetail(null)} />
            )}
        </div>
    )
}

export default DomainView
