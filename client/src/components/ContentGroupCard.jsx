import { useState } from 'react'

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

function ContentGroupCard({ group, onSelectArticles, onDeleteGroup, onDeleteArticle, onMarkIndexed }) {
    const [selectedIds, setSelectedIds] = useState([])

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    const selectAll = () => {
        if (selectedIds.length === group.articles.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(group.articles.map(a => a.id))
        }
    }

    const handleAddToRedirection = () => {
        if (selectedIds.length > 0) {
            onSelectArticles(group.id, selectedIds, group.country, group.countryFlag)
            setSelectedIds([])
        }
    }

    const handleGoogleCheck = (url) => {
        window.open(`https://www.google.com/search?q=site:${encodeURIComponent(url)}`, '_blank')
    }

    const shortenUrl = (url) => {
        try {
            const u = new URL(url)
            return u.pathname.length > 45 ? u.pathname.substring(0, 45) + '...' : u.pathname
        } catch { return url.length > 45 ? url.substring(0, 45) + '...' : url }
    }

    const isArticleIndexed = (article) => article.indexed || article.indexStatus === 'indexed'

    return (
        <div className="content-group-card">
            <div className="content-group-header">
                <div className="content-group-country">
                    <span className="country-flag-large">{group.countryFlag}</span>
                    <h3>{group.country}</h3>
                    <span className="content-group-count">{group.articles.length} articles</span>
                </div>
                <div className="content-group-actions">
                    {selectedIds.length > 0 && (
                        <>
                            <button className="btn btn-redir-add" onClick={handleAddToRedirection}>
                                🔀 Add to Redirection ({selectedIds.length})
                            </button>
                            <button className="btn btn-bulk-google" onClick={() => selectedIds.forEach(id => {
                                const art = group.articles.find(a => a.id === id)
                                if (art) handleGoogleCheck(art.url)
                            })}>
                                🔍 Bulk Google ({selectedIds.length})
                            </button>
                            <button className="btn btn-bulk-indexed" onClick={() => onMarkIndexed(group.id, selectedIds)}>
                                ✅ Bulk Index ({selectedIds.length})
                            </button>
                        </>
                    )}
                    <button className="btn btn-icon btn-danger-subtle" onClick={() => onDeleteGroup(group.id)} title="Delete group">🗑️</button>
                </div>
            </div>

            {group.articles.length > 0 && (
                <div className="content-group-select-bar">
                    <label className="setup-checkbox-row" style={{ marginBottom: 0 }}>
                        <input type="checkbox" checked={selectedIds.length === group.articles.length && group.articles.length > 0} onChange={selectAll} className="setup-checkbox" />
                        <span className="setup-checkbox-label">Select All</span>
                    </label>
                </div>
            )}

            <div className="content-group-articles">
                {group.articles.length === 0 ? (
                    <div className="section-empty"><p>No articles in this group</p></div>
                ) : (
                    group.articles.map(article => (
                        <div key={article.id} className={`content-article-row ${selectedIds.includes(article.id) ? 'selected' : ''} ${isArticleIndexed(article) ? 'article-indexed' : ''}`}>
                            <input type="checkbox" checked={selectedIds.includes(article.id)} onChange={() => toggleSelect(article.id)} className="setup-checkbox" />
                            <div className="content-article-info">
                                <span className={`index-dot ${isArticleIndexed(article) ? 'dot-green' : 'dot-gray'}`}></span>
                                <span className="content-article-title">{article.title}</span>
                                <span className="content-article-url">{shortenUrl(article.url)}</span>
                            </div>
                            <div className="content-article-badges">
                                {isArticleIndexed(article) && (
                                    <span className="indexed-badge" style={{ fontSize: '10px', padding: '2px 6px' }}>✅ Indexed</span>
                                )}
                                {article.pushStatus?.given && <span className="push-badge push-given-badge">Push Given</span>}
                                {article.pushStatus?.pushPassed && <span className="push-badge push-passed-badge">Push Passed</span>}
                            </div>
                            <div className="content-article-actions">
                                <button className="btn btn-sm btn-google-check" onClick={() => handleGoogleCheck(article.url)} title="Google Index Check">
                                    🔍
                                </button>
                                <button className="btn btn-sm btn-mark-indexed" onClick={() => onMarkIndexed(group.id, article.id)} title="Mark Indexed">
                                    {isArticleIndexed(article) ? '✅' : '○'}
                                </button>
                                <button className="btn btn-icon btn-danger-subtle" onClick={() => onDeleteArticle(group.id, article.id)} title="Delete">×</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export { PRESET_COUNTRIES }
export default ContentGroupCard
