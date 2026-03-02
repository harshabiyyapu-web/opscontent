import { useState } from 'react'
import ApluPushModal from './ApluPushModal'

function RedirectionCard({ redirSet, contentGroups, domainId, selectedDate, onUpdate, onDelete }) {
    const [pushModalOpen, setPushModalOpen] = useState(false)
    const [pushTarget, setPushTarget] = useState(null)
    const [pushDetailOpen, setPushDetailOpen] = useState(null) // articleId or sourceId to show push details

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

    const isOn = redirSet.toggleOn

    return (
        <div className={`redir-card ${isOn ? 'redir-on' : 'redir-off'}`}>
            {/* Header */}
            <div className={`redir-header ${isOn ? 'redir-header-on' : 'redir-header-off'}`}>
                <div className="redir-header-left">
                    <h4 className="redir-name">{redirSet.name}</h4>
                    <span className={`redir-status-label ${isOn ? 'status-on' : 'status-off'}`}>
                        {isOn ? '● REDIRECTION ON' : '○ REDIRECTION OFF'}
                    </span>
                </div>
                <div className="redir-header-right">
                    <label className="redir-toggle" title={isOn ? 'Redirection ON' : 'Redirection OFF'}>
                        <input type="checkbox" checked={isOn} onChange={handleToggle} />
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
                                    <span
                                        className="push-badge push-given-badge push-badge-clickable"
                                        onClick={() => setPushDetailOpen(pushDetailOpen === src.id ? null : src.id)}
                                    >
                                        Push Given ▾
                                    </span>
                                )}
                            </div>
                            {/* Push Detail Dropdown */}
                            {pushDetailOpen === src.id && src.pushStatus?.given && (
                                <div className="push-detail-dropdown">
                                    <div className="push-detail-row"><span className="push-detail-label">Site:</span> <span>{src.pushStatus.siteName}</span></div>
                                    <div className="push-detail-row"><span className="push-detail-label">Email:</span> <span>{src.pushStatus.email}</span></div>
                                    <div className="push-detail-row"><span className="push-detail-label">Time:</span> <span>{src.pushStatus.time}</span></div>
                                    <div className="push-detail-row"><span className="push-detail-label">Given At:</span> <span>{new Date(src.pushStatus.givenAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></div>
                                </div>
                            )}
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
                                {art.pushStatus?.given && (
                                    <span
                                        className="push-badge push-given-badge push-badge-clickable"
                                        onClick={() => setPushDetailOpen(pushDetailOpen === art.id ? null : art.id)}
                                    >
                                        Push Given ▾
                                    </span>
                                )}
                                {art.pushStatus?.pushPassed && !art.pushStatus?.given && <span className="push-badge push-passed-badge">Push Passed</span>}
                            </div>
                            {/* Push Detail Dropdown */}
                            {pushDetailOpen === art.id && art.pushStatus?.given && (
                                <div className="push-detail-dropdown">
                                    <div className="push-detail-row"><span className="push-detail-label">Site:</span> <span>{art.pushStatus.siteName}</span></div>
                                    <div className="push-detail-row"><span className="push-detail-label">Email:</span> <span>{art.pushStatus.email}</span></div>
                                    <div className="push-detail-row"><span className="push-detail-label">Time:</span> <span>{art.pushStatus.time}</span></div>
                                    <div className="push-detail-row"><span className="push-detail-label">Given At:</span> <span>{new Date(art.pushStatus.givenAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></div>
                                </div>
                            )}
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
                    {redirSet.startTime && <span className="timer-stamp start-stamp">▶ {redirSet.startTime}</span>}
                    {redirSet.stopTime && <span className="timer-stamp stop-stamp">⏹ {redirSet.stopTime}</span>}
                    {redirSet.duration && <span className="timer-duration">⏱ {redirSet.duration}</span>}
                </div>
                <div className="redir-controls">
                    <button className="btn btn-timer-start" onClick={() => handleTimer('start')} disabled={redirSet.startTime && !redirSet.stopTime}>▶ Start</button>
                    <button className="btn btn-timer-stop" onClick={() => handleTimer('stop')} disabled={!redirSet.startTime || redirSet.stopTime}>⏹ Stop</button>
                </div>
            </div>

            <ApluPushModal isOpen={pushModalOpen} onClose={() => setPushModalOpen(false)} onSubmit={handlePushSubmit} targetLabel={pushTarget?.label} />
        </div>
    )
}

export default RedirectionCard
