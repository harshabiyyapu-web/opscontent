import { useState, useEffect } from 'react'
import DomainCard from '../components/DomainCard'
import Modal from '../components/Modal'

function Dashboard() {
    const [domains, setDomains] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({
        name: '', url: '',
        googleTraffic: false,
        apluPush: false, adsterraAd: false, taboolaContact: false,
        wpUsername: '', wpPassword: ''
    })
    const [showWpPassword, setShowWpPassword] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        fetchDomains()
    }, [])

    const fetchDomains = async () => {
        try {
            const response = await fetch('/api/domains')
            const data = await response.json()
            setDomains(data)
        } catch (error) {
            console.error('Failed to fetch domains:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)

        try {
            const response = await fetch('/api/domains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    url: formData.url,
                    googleTraffic: formData.googleTraffic,
                    basicSetup: {
                        apluPush: formData.apluPush,
                        adsterraAd: formData.adsterraAd,
                        taboolaContact: formData.taboolaContact
                    },
                    wpLogin: {
                        username: formData.wpUsername,
                        password: formData.wpPassword
                    }
                })
            })

            if (response.ok) {
                const newDomain = await response.json()
                setDomains([...domains, newDomain])
                setIsModalOpen(false)
                setFormData({
                    name: '', url: '',
                    googleTraffic: false,
                    apluPush: false, adsterraAd: false, taboolaContact: false,
                    wpUsername: '', wpPassword: ''
                })
            }
        } catch (error) {
            console.error('Failed to add domain:', error)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id) => {
        try {
            const response = await fetch(`/api/domains/${id}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                setDomains(domains.filter(d => d.id !== id))
            }
        } catch (error) {
            console.error('Failed to delete domain:', error)
        }
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Manage and track your websites</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <span>+</span>
                    <span>Add Domain</span>
                </button>
            </div>

            {loading ? (
                <div className="empty-state">
                    <div className="empty-state-icon">⏳</div>
                    <p className="empty-state-text">Loading domains...</p>
                </div>
            ) : domains.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🌐</div>
                    <h3 className="empty-state-title">No domains yet</h3>
                    <p className="empty-state-text">
                        Start by adding your first domain to track its URLs and analytics.
                    </p>
                    <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                        <span>+</span>
                        <span>Add Your First Domain</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-3">
                    {domains.map(domain => (
                        <DomainCard
                            key={domain.id}
                            domain={domain}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add New Domain"
            >
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Domain Name</label>
                        <input
                            className="input"
                            type="text"
                            placeholder="My Website"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Website URL</label>
                        <input
                            className="input"
                            type="url"
                            placeholder="https://example.com"
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            required
                        />
                    </div>

                    {/* Google Traffic Section */}
                    <div className="modal-section">
                        <label className="setup-checkbox-row modal-checkbox-row">
                            <input
                                type="checkbox"
                                checked={formData.googleTraffic}
                                onChange={(e) => setFormData({ ...formData, googleTraffic: e.target.checked })}
                                className="setup-checkbox"
                            />
                            <span className="setup-checkbox-label">
                                <span className={`setup-status-dot ${formData.googleTraffic ? 'dot-green' : 'dot-gray'}`}></span>
                                Getting Google Traffic?
                            </span>
                        </label>

                        {formData.googleTraffic && (
                            <div className="modal-sub-checks">
                                <label className="setup-checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={formData.apluPush}
                                        onChange={(e) => setFormData({ ...formData, apluPush: e.target.checked })}
                                        className="setup-checkbox"
                                    />
                                    <span className="setup-checkbox-label">
                                        <span className={`setup-status-dot ${formData.apluPush ? 'dot-green' : 'dot-red'}`}></span>
                                        Aplu Push Configured
                                    </span>
                                </label>
                                <label className="setup-checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={formData.adsterraAd}
                                        onChange={(e) => setFormData({ ...formData, adsterraAd: e.target.checked })}
                                        className="setup-checkbox"
                                    />
                                    <span className="setup-checkbox-label">
                                        <span className={`setup-status-dot ${formData.adsterraAd ? 'dot-green' : 'dot-red'}`}></span>
                                        Adsterra Ad Code
                                    </span>
                                </label>
                                <label className="setup-checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={formData.taboolaContact}
                                        onChange={(e) => setFormData({ ...formData, taboolaContact: e.target.checked })}
                                        className="setup-checkbox"
                                    />
                                    <span className="setup-checkbox-label">
                                        <span className={`setup-status-dot ${formData.taboolaContact ? 'dot-green' : 'dot-red'}`}></span>
                                        Taboola Contact Pages
                                    </span>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* WP Login Section */}
                    <div className="modal-section">
                        <div className="modal-section-title">🔐 WP Admin Login</div>
                        {formData.url && (
                            <p className="wp-admin-preview">
                                Admin URL: <span>{formData.url.replace(/\/$/, '')}/wp-admin</span>
                            </p>
                        )}
                        <div className="input-group">
                            <label className="input-label">Username</label>
                            <input
                                className="input"
                                type="text"
                                placeholder="admin"
                                value={formData.wpUsername}
                                onChange={(e) => setFormData({ ...formData, wpUsername: e.target.value })}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    className="input"
                                    type={showWpPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={formData.wpPassword}
                                    onChange={(e) => setFormData({ ...formData, wpPassword: e.target.value })}
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowWpPassword(!showWpPassword)}
                                >
                                    {showWpPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setIsModalOpen(false)}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting}
                        >
                            {submitting ? 'Adding...' : 'Add Domain'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default Dashboard
