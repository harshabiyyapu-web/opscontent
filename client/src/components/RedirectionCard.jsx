import { useState } from 'react'
import ApluPushModal from './ApluPushModal'

function RedirectionCard({ redirSet, contentGroups, domainId, selectedDate, onUpdate, onDelete }) {
    const [pushModalOpen, setPushModalOpen] = useState(false)
    const [pushTarget, setPushTarget] = useState(null) // { type: 'source'|'article', id, redirId, label }

    // Get redirected articles from content groups
    const getRedirectedArticles = () => {
        const articles = []
        for (const group of contentGroups) {
            for (const article of group.articles) {
                if (redirSet.redirectedArticleIds.includes(article.id)) {
                    articles.push({ ...article, groupCountry: group.country, groupFlag: group.countryFlag })
                }
            }
        }
        return articles
    }

    const redirectedArticles = getRedirectedArticles()

    const handleToggle = async () => {
        try {
            const res = await fetch(`/api/domains/${domainId}/session/redirections/${redirSet.id}/toggle`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toggleOn: !redirSet.toggleOn, date: selectedDate })
            })
            if (res.ok) onUpdate(await res.json())
        } catch (e) { console.error(e) }
    }

    const handleTimer = async (action) => {
        try {
            const res = await fetch(`/api/domains/${domainId}/session/redirections/${redirSet.id}/timer`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, date: selectedDate })
            })
            if (res.ok) onUpdate(await res.json())
        } catch (e) { console.error(e) }
    }

    const handlePushSource = (sourceId, label) => {
        setPushTarget({ type: 'source', id: sourceId, redirId: redirSet.id, label })
        setPushModalOpen(true)
    }

    const handlePushArticle = (articleId, label) => {
        setPushTarget({ type: 'article', id: articleId, label })
        setPushModalOpen(true)
    }

    const handlePushSubmit = async (pushData) => {
        try {
            let url
            if (pushTarget.type === 'source') {
                url = `/api/domains/${domainId}/session/redirections/${pushTarget.redirId}/push/source/${pushTarget.id}`
            } else {
                url = `/api/domains/${domainId}/session/push/article/${pushTarget.id}`
            }
            const res = await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...pushData, date: selectedDate })
            })
            if (res.ok) {
                // Refetch session to get updated data
                const sessionRes = await fetch(`/api/domains/${domainId}/session/${selectedDate}`)
                if (sessionRes.ok) {
                    const session = await sessionRes.json()
                    const updated = session.redirectionSets.find(r => r.id === redirSet.id)
                    if (updated) onUpdate(updated)
                }
            }
        } catch (e) { console.error(e) }
    }

    const shortenUrl = (url) => {
        try {
            const u = new URL(url)
            return u.hostname + (u.pathname.length > 30 ? u.pathname.substring(0, 30) + '...' : u.pathname)
        } catch { return url.length > 50 ? url.substring(0, 50) + '...' : url }
    }

    return (
        <div className={`redir-card ${redirSet.toggleOn ? 'redir-on' : 'redir-off'}`} style={{ borderColor: redirSet.color }}>
            {/* Header */}
            <div className="redir-header" style={{ backgroundColor: redirSet.color }}>
                <div className="redir-header-left">
                    <h4 className="redir-name">{redirSet.name}</h4>
                </div>
                <div className="redir-header-right">
                    {/* Toggle */}
                    <label className="redir-toggle" title={redirSet.toggleOn ? 'Redirection ON' : 'Redirection OFF'}>
                        <input type="checkbox" checked={redirSet.toggleOn} onChange={handleToggle} />
                        <span className="redir-toggle-slider"></span>
                    </label>
                    <button className="btn btn-icon redir-delete" onClick={() => onDelete(redirSet.id)} title="Delete">×</button>
                </div>
            </div>

            {/* Source → Redirected Layout */}
            <div className="redir-body">
                {/* Source URLs (Red) */}
                <div className="redir-source-panel">
                    <div className="redir-panel-label source-label">SOURCE URLs</div>
                    {redirSet.sourceUrls.map(src => (
                        <div key={src.id} className="redir-url-item source-item">
                            <div className="redir-url-info">
                                <span className="redir-url-text" title={src.url}>{shortenUrl(src.url)}</span>
                                {src.pushStatus?.given && (
                                    <span className="push-badge push-given-badge">Push Given</span>
                                )}
                            </div>
                            {!src.pushStatus?.given && (
                                <button className="btn btn-push-sm" onClick={() => handlePushSource(src.id, shortenUrl(src.url))}>
                                    🔔 Push
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Arrow */}
                <div className="redir-arrow">
                    <div className="redir-arrow-line"></div>
                    <span className="redir-arrow-icon">→</span>
                    <div className="redir-arrow-line"></div>
                </div>

                {/* Redirected Articles (Green) */}
                <div className="redir-dest-panel">
                    <div className="redir-panel-label dest-label">REDIRECTED</div>
                    {redirectedArticles.map(art => (
                        <div key={art.id} className="redir-url-item dest-item">
                            <div className="redir-url-info">
                                <span className="redir-url-flag">{art.groupFlag}</span>
                                <span className="redir-url-text" title={art.url}>{art.title || shortenUrl(art.url)}</span>
                                {art.pushStatus?.given && <span className="push-badge push-given-badge">Push Given</span>}
                                {art.pushStatus?.pushPassed && !art.pushStatus?.given && <span className="push-badge push-passed-badge">Push Passed</span>}
                            </div>
                            {!art.pushStatus?.given && !art.pushStatus?.pushPassed && (
                                <button className="btn btn-push-sm" onClick={() => handlePushArticle(art.id, art.title)}>
                                    🔔 Push
                                </button>
                            )}
                        </div>
                    ))}
                    {redirectedArticles.length === 0 && (
                        <div className="redir-empty">No redirected articles</div>
                    )}
                </div>
            </div>

            {/* Footer: Timer & Controls */}
            <div className="redir-footer">
                <div className="redir-timer">
                    {redirSet.startTime && (
                        <span className="timer-stamp start-stamp">▶ {redirSet.startTime}</span>
                    )}
                    {redirSet.stopTime && (
                        <span className="timer-stamp stop-stamp">⏹ {redirSet.stopTime}</span>
                    )}
                    {redirSet.duration && (
                        <span className="timer-duration">⏱ {redirSet.duration}</span>
                    )}
                </div>
                <div className="redir-controls">
                    <button
                        className="btn btn-timer-start"
                        onClick={() => handleTimer('start')}
                        disabled={redirSet.startTime && !redirSet.stopTime}
                    >
                        ▶ Start
                    </button>
                    <button
                        className="btn btn-timer-stop"
                        onClick={() => handleTimer('stop')}
                        disabled={!redirSet.startTime || redirSet.stopTime}
                    >
                        ⏹ Stop
                    </button>
                </div>
            </div>

            <ApluPushModal
                isOpen={pushModalOpen}
                onClose={() => setPushModalOpen(false)}
                onSubmit={handlePushSubmit}
                targetLabel={pushTarget?.label}
            />
        </div>
    )
}

export default RedirectionCard
