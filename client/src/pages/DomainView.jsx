import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import Modal from '../components/Modal'
import ContentGroupCard, { PRESET_COUNTRIES } from '../components/ContentGroupCard'
import RedirectionCard from '../components/RedirectionCard'
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

    useEffect(() => { fetchDomain() }, [fetchDomain])
    useEffect(() => { fetchSession() }, [fetchSession])

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

    const handleMarkIndexed = async (groupId, articleId) => {
        try {
            const response = await fetch(`/api/domains/${id}/session/groups/${groupId}/articles/${articleId}/indexed`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: selectedDate })
            })
            if (response.ok) {
                const updated = await response.json()
                setSession(prev => ({
                    ...prev,
                    contentGroups: prev.contentGroups.map(g =>
                        g.id === groupId ? { ...g, articles: g.articles.map(a => a.id === articleId ? updated : a) } : g
                    )
                }))
            }
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
                <div className="content-section">
                    <div className="content-section-header">
                        <h2 className="content-section-title">📊 Analytics (Country-wise)</h2>
                    </div>

                    {(session.contentGroups || []).length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📊</div>
                            <h3 className="empty-state-title">No data</h3>
                            <p className="empty-state-text">Add content groups first to see analytics.</p>
                        </div>
                    ) : (
                        (session.contentGroups || []).map(group => {
                            const relatedRedirs = (session.redirectionSets || []).filter(r =>
                                r.groupId === group.id || r.redirectedArticleIds.some(aid => group.articles.some(a => a.id === aid))
                            )
                            return (
                                <div key={group.id} className="analytics-country-section">
                                    <div className="analytics-country-header">
                                        <span className="country-flag-large">{group.countryFlag}</span>
                                        <h3>{group.country}</h3>
                                        <span className="content-group-count">{group.articles.length} articles · {relatedRedirs.length} redirections</span>
                                    </div>

                                    {relatedRedirs.length > 0 ? (
                                        relatedRedirs.map(redir => (
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
                                        ))
                                    ) : (
                                        <p className="text-muted" style={{ padding: '0.75rem' }}>No redirections for this country</p>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
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
