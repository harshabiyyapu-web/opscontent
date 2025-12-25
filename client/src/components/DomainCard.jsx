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

    return (
        <div className="card domain-card" onClick={handleClick}>
            <div className="card-header">
                <div>
                    <h3 className="card-title">{domain.name}</h3>
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

            <div className="domain-stats">
                <div className="stat">
                    <div className="stat-value">{domain.urlCount || 0}</div>
                    <div className="stat-label">URLs Tracked</div>
                </div>
                <div className="stat">
                    <div className="stat-value">—</div>
                    <div className="stat-label">Indexed</div>
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
