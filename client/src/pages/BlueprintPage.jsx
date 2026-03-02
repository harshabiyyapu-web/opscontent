import { useState, useEffect } from 'react'
import Modal from '../components/Modal'

const PRESET_COUNTRIES = [
    { name: 'India', flag: '🇮🇳' },
    { name: 'Mexico', flag: '🇲🇽' },
    { name: 'Argentina', flag: '🇦🇷' },
    { name: 'Italy', flag: '🇮🇹' },
    { name: 'Ireland', flag: '🇮🇪' },
    { name: 'Greece', flag: '🇬🇷' },
    { name: 'USA', flag: '🇺🇸' },
    { name: 'Custom', flag: '✏️' }
]

function BlueprintPage() {
    const [countries, setCountries] = useState([])
    const [selectedCountry, setSelectedCountry] = useState(null)
    const [articles, setArticles] = useState([])
    const [selectedArticles, setSelectedArticles] = useState([])
    const [loading, setLoading] = useState(true)
    const [articlesLoading, setArticlesLoading] = useState(false)

    // Modals
    const [isAddCountryModalOpen, setIsAddCountryModalOpen] = useState(false)
    const [isAddArticleModalOpen, setIsAddArticleModalOpen] = useState(false)
    const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false)
    const [selectedPreset, setSelectedPreset] = useState('India')
    const [customName, setCustomName] = useState('')
    const [articleUrl, setArticleUrl] = useState('')
    const [bulkUrls, setBulkUrls] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [copySuccess, setCopySuccess] = useState(false)

    useEffect(() => { fetchCountries() }, [])

    const fetchCountries = async () => {
        try {
            const response = await fetch('/api/blueprint/countries')
            const data = await response.json()
            setCountries(data)
        } catch (error) { console.error('Failed to fetch countries:', error) }
        finally { setLoading(false) }
    }

    const fetchArticles = async (countryId) => {
        setArticlesLoading(true)
        try {
            const response = await fetch(`/api/blueprint/countries/${countryId}/articles`)
            const data = await response.json()
            setArticles(data)
        } catch (error) { console.error('Failed to fetch articles:', error) }
        finally { setArticlesLoading(false) }
    }

    const handleSelectCountry = (country) => {
        setSelectedCountry(country)
        setSelectedArticles([])
        fetchArticles(country.id)
    }

    const handleAddCountry = async (e) => {
        e.preventDefault()
        const preset = PRESET_COUNTRIES.find(c => c.name === selectedPreset)
        const countryName = selectedPreset === 'Custom' ? customName.trim() : selectedPreset
        const flag = preset?.flag || '✏️'
        if (!countryName) return

        setSubmitting(true)
        try {
            const response = await fetch('/api/blueprint/countries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: `${flag} ${countryName}` })
            })
            if (response.ok) {
                const newCountry = await response.json()
                setCountries([...countries, newCountry])
                setIsAddCountryModalOpen(false)
                setSelectedPreset('India')
                setCustomName('')
            }
        } catch (error) { console.error('Failed to add country:', error) }
        finally { setSubmitting(false) }
    }

    const handleDeleteCountry = async (countryId) => {
        if (!confirm('Delete this country and all its articles?')) return
        try {
            const response = await fetch(`/api/blueprint/countries/${countryId}`, { method: 'DELETE' })
            if (response.ok || response.status === 204) {
                setCountries(countries.filter(c => c.id !== countryId))
                if (selectedCountry?.id === countryId) {
                    setSelectedCountry(null)
                    setArticles([])
                }
            }
        } catch (error) { console.error('Failed to delete country:', error) }
    }

    const handleAddArticle = async (e) => {
        e.preventDefault()
        if (!articleUrl.trim() || !selectedCountry) return
        setSubmitting(true)
        try {
            const response = await fetch(`/api/blueprint/countries/${selectedCountry.id}/articles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: articleUrl.trim() })
            })
            if (response.ok) {
                const newArticle = await response.json()
                setArticles([...articles, newArticle])
                setIsAddArticleModalOpen(false)
                setArticleUrl('')
            }
        } catch (error) { console.error('Failed to add article:', error) }
        finally { setSubmitting(false) }
    }

    const handleBulkAddArticles = async (e) => {
        e.preventDefault()
        const urls = bulkUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0)
        if (urls.length === 0 || !selectedCountry) return

        setSubmitting(true)
        try {
            const response = await fetch(`/api/blueprint/countries/${selectedCountry.id}/articles/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls })
            })
            if (response.ok) {
                const newArticles = await response.json()
                setArticles([...articles, ...newArticles])
                setIsBulkAddModalOpen(false)
                setBulkUrls('')
            }
        } catch (error) { console.error('Failed to bulk add articles:', error) }
        finally { setSubmitting(false) }
    }

    const handleDeleteArticle = async (articleId) => {
        if (!selectedCountry) return
        try {
            const response = await fetch(`/api/blueprint/countries/${selectedCountry.id}/articles/${articleId}`, { method: 'DELETE' })
            if (response.ok || response.status === 204) {
                setArticles(articles.filter(a => a.id !== articleId))
                setSelectedArticles(selectedArticles.filter(id => id !== articleId))
            }
        } catch (error) { console.error('Failed to delete article:', error) }
    }

    const toggleArticleSelection = (articleId) => {
        setSelectedArticles(prev => prev.includes(articleId) ? prev.filter(id => id !== articleId) : [...prev, articleId])
    }

    const handleSelectAll = () => {
        setSelectedArticles(selectedArticles.length === articles.length ? [] : articles.map(a => a.id))
    }

    const handleCopyLinks = () => {
        const links = articles.filter(a => selectedArticles.includes(a.id)).map(a => a.url).join('\n')
        navigator.clipboard.writeText(links).then(() => {
            setCopySuccess(true)
            setTimeout(() => setCopySuccess(false), 2000)
        })
    }

    return (
        <div className="blueprint-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">🗺️ Blueprint</h1>
                    <p className="page-subtitle">Country-wise article collections</p>
                </div>
            </div>

            <div className="blueprint-layout">
                {/* Country List */}
                <div className="blueprint-sidebar">
                    <div className="blueprint-sidebar-header">
                        <h3>Countries</h3>
                        <button className="btn btn-primary btn-sm" onClick={() => setIsAddCountryModalOpen(true)}>+ Add</button>
                    </div>
                    <div className="country-list">
                        {loading ? (
                            <div className="section-empty"><p>Loading...</p></div>
                        ) : countries.length === 0 ? (
                            <div className="section-empty">
                                <div className="section-empty-icon">🌍</div>
                                <p>No countries yet</p>
                            </div>
                        ) : (
                            countries.map(country => (
                                <div key={country.id} className={`country-item ${selectedCountry?.id === country.id ? 'active' : ''}`} onClick={() => handleSelectCountry(country)}>
                                    <div className="country-item-info">
                                        <span className="country-name">{country.name}</span>
                                        <span className="country-count">{country.articleCount || 0}</span>
                                    </div>
                                    <button className="country-delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteCountry(country.id) }}>×</button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Articles */}
                <div className="blueprint-main">
                    {!selectedCountry ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">👈</div>
                            <h3 className="empty-state-title">Select a Country</h3>
                            <p className="empty-state-text">Choose a country from the left to view its blueprint articles</p>
                        </div>
                    ) : (
                        <>
                            <div className="blueprint-articles-header">
                                <div>
                                    <h2 className="blueprint-country-title">{selectedCountry.name}</h2>
                                    <p className="text-muted">{articles.length} articles</p>
                                </div>
                                <div className="blueprint-actions">
                                    <button className="btn btn-secondary btn-sm" onClick={() => setIsBulkAddModalOpen(true)}>Bulk Add</button>
                                    <button className="btn btn-primary btn-sm" onClick={() => setIsAddArticleModalOpen(true)}>+ Add Article</button>
                                </div>
                            </div>

                            {articles.length > 0 && (
                                <div className="blueprint-selection-bar">
                                    <label className="setup-checkbox-row" style={{ marginBottom: 0 }}>
                                        <input type="checkbox" checked={selectedArticles.length === articles.length && articles.length > 0} onChange={handleSelectAll} className="setup-checkbox" />
                                        <span className="setup-checkbox-label">Select All</span>
                                    </label>
                                    {selectedArticles.length > 0 && (
                                        <button className={`btn btn-copy ${copySuccess ? 'btn-copy-success' : ''}`} onClick={handleCopyLinks}>
                                            {copySuccess ? '✅ Copied!' : `📋 Copy ${selectedArticles.length} Link${selectedArticles.length > 1 ? 's' : ''}`}
                                        </button>
                                    )}
                                </div>
                            )}

                            {articlesLoading ? (
                                <div className="section-empty"><p>Loading articles...</p></div>
                            ) : articles.length === 0 ? (
                                <div className="section-empty">
                                    <div className="section-empty-icon">📄</div>
                                    <p>No articles yet</p>
                                    <button className="btn btn-primary" onClick={() => setIsAddArticleModalOpen(true)} style={{ marginTop: '1rem' }}>+ Add First Article</button>
                                </div>
                            ) : (
                                <div className="blueprint-cards-grid">
                                    {articles.map(article => (
                                        <div key={article.id} className={`blueprint-card ${selectedArticles.includes(article.id) ? 'selected' : ''}`}>
                                            <div className="blueprint-card-select">
                                                <input type="checkbox" checked={selectedArticles.includes(article.id)} onChange={() => toggleArticleSelection(article.id)} className="setup-checkbox" />
                                            </div>
                                            {article.image ? (
                                                <div className="blueprint-card-image">
                                                    <img src={article.image} alt={article.title} onError={(e) => { e.target.style.display = 'none' }} />
                                                </div>
                                            ) : (
                                                <div className="blueprint-card-image blueprint-card-no-image"><span>📄</span></div>
                                            )}
                                            <div className="blueprint-card-body">
                                                <h4 className="blueprint-card-title" title={article.title}>{article.title}</h4>
                                                <a href={article.url} target="_blank" rel="noopener noreferrer" className="blueprint-card-url">
                                                    {(() => { try { return new URL(article.url).hostname } catch { return article.url } })()} ↗
                                                </a>
                                            </div>
                                            <button className="blueprint-card-delete" onClick={() => handleDeleteArticle(article.id)} title="Delete">🗑️</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Add Country Modal with Preset Buttons */}
            <Modal isOpen={isAddCountryModalOpen} onClose={() => setIsAddCountryModalOpen(false)} title="Add Country">
                <form onSubmit={handleAddCountry}>
                    <div className="input-group">
                        <label className="input-label">Select Country</label>
                        <div className="country-selector-grid">
                            {PRESET_COUNTRIES.map(c => (
                                <button
                                    key={c.name}
                                    type="button"
                                    className={`country-select-btn ${selectedPreset === c.name ? 'active' : ''}`}
                                    onClick={() => setSelectedPreset(c.name)}
                                >
                                    <span className="country-select-flag">{c.flag}</span>
                                    <span className="country-select-name">{c.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    {selectedPreset === 'Custom' && (
                        <div className="input-group">
                            <label className="input-label">Custom Country Name</label>
                            <input className="input" type="text" placeholder="Country name" value={customName} onChange={(e) => setCustomName(e.target.value)} required />
                        </div>
                    )}
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsAddCountryModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding...' : 'Add Country'}</button>
                    </div>
                </form>
            </Modal>

            {/* Add Article Modal */}
            <Modal isOpen={isAddArticleModalOpen} onClose={() => setIsAddArticleModalOpen(false)} title="Add Article">
                <form onSubmit={handleAddArticle}>
                    <div className="input-group">
                        <label className="input-label">Article URL</label>
                        <input className="input" type="url" placeholder="https://example.com/article" value={articleUrl} onChange={(e) => setArticleUrl(e.target.value)} required autoFocus />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsAddArticleModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Fetching...' : 'Add Article'}</button>
                    </div>
                </form>
            </Modal>

            {/* Bulk Add Modal */}
            <Modal isOpen={isBulkAddModalOpen} onClose={() => setIsBulkAddModalOpen(false)} title="Bulk Add Articles">
                <form onSubmit={handleBulkAddArticles}>
                    <div className="input-group">
                        <label className="input-label">Article URLs (one per line)</label>
                        <textarea className="input textarea-bulk" placeholder={"https://example.com/article-1\nhttps://example.com/article-2"} value={bulkUrls} onChange={(e) => setBulkUrls(e.target.value)} rows={8} required />
                    </div>
                    <p className="text-muted" style={{ marginBottom: '1rem' }}>{bulkUrls.split('\n').filter(u => u.trim()).length} URLs detected</p>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsBulkAddModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding...' : 'Add All'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default BlueprintPage
