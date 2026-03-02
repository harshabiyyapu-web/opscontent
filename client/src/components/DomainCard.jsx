import { useNavigate } from 'react-router-dom'

function DomainCard({ domain, onDelete }) {
    const navigate = useNavigate()

    const handleClick = () => {
        navigate(`/domain/${domain.id}`)
    }

    const handleDelete = (e) => {
        e.stopPropagation()
        if (confirm('Are you sure you want to delete this domain?')) {
            onDelete(domain.id)
        }
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    const setupComplete = domain.basicSetup
        ? [domain.basicSetup.apluPush, domain.basicSetup.adsterraAd, domain.basicSetup.taboolaContact].filter(Boolean).length
        : 0

    return (
        <div className="card domain-card" onClick={handleClick}>
            <div className="card-header">
                <div>
                    <div className="domain-name-row">
                        <h3 className="card-title">{domain.name}</h3>
                        {domain.googleTraffic && (
                            <span className="traffic-dot traffic-dot-green" title="Getting Google Traffic"></span>
                        )}
                    </div>
                    <p className="domain-url">{domain.url}</p>
                </div>
                <button
                    className="btn btn-icon btn-danger"
                    onClick={handleDelete}
                    title="Delete domain"
                >
                    🗑️
                </button>
            </div>

            {/* Setup Status Badges */}
            {domain.googleTraffic && (
                <div className="domain-setup-badges">
                    <span className={`setup-badge ${domain.basicSetup?.apluPush ? 'badge-done' : 'badge-pending'}`}>
                        Aplu
                    </span>
                    <span className={`setup-badge ${domain.basicSetup?.adsterraAd ? 'badge-done' : 'badge-pending'}`}>
                        Adsterra
                    </span>
                    <span className={`setup-badge ${domain.basicSetup?.taboolaContact ? 'badge-done' : 'badge-pending'}`}>
                        Taboola
                    </span>
                </div>
            )}

            <div className="domain-stats">
                <div className="stat">
                    <div className="stat-value">{domain.urlCount || 0}</div>
                    <div className="stat-label">URLs Tracked</div>
                </div>
                <div className="stat">
                    <div className="stat-value">{setupComplete}/3</div>
                    <div className="stat-label">Setup</div>
                </div>
                <div className="stat">
                    <div className="stat-value">{formatDate(domain.createdAt)}</div>
                    <div className="stat-label">Added</div>
                </div>
            </div>
        </div>
    )
}

export default DomainCard
