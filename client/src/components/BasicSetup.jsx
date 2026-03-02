import { useState, useEffect } from 'react'

function BasicSetup({ domain, domainId }) {
    const [googleTraffic, setGoogleTraffic] = useState(domain?.googleTraffic || false)
    const [apluPush, setApluPush] = useState(domain?.basicSetup?.apluPush || false)
    const [adsterraAd, setAdsterraAd] = useState(domain?.basicSetup?.adsterraAd || false)
    const [taboolaContact, setTaboolaContact] = useState(domain?.basicSetup?.taboolaContact || false)
    const [username, setUsername] = useState(domain?.wpLogin?.username || '')
    const [password, setPassword] = useState(domain?.wpLogin?.password || '')
    const [showPassword, setShowPassword] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const wpAdminUrl = domain?.wpLogin?.adminUrl || (domain?.url ? `${domain.url.replace(/\/$/, '')}/wp-admin` : '')

    useEffect(() => {
        if (domain) {
            setGoogleTraffic(domain.googleTraffic || false)
            setApluPush(domain.basicSetup?.apluPush || false)
            setAdsterraAd(domain.basicSetup?.adsterraAd || false)
            setTaboolaContact(domain.basicSetup?.taboolaContact || false)
            setUsername(domain.wpLogin?.username || '')
            setPassword(domain.wpLogin?.password || '')
        }
    }, [domain])

    const handleSave = async () => {
        setSaving(true)
        try {
            const response = await fetch(`/api/domains/${domainId}/basic-setup`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    googleTraffic,
                    basicSetup: { apluPush, adsterraAd, taboolaContact },
                    wpLogin: { username, password }
                })
            })
            if (response.ok) {
                setSaved(true)
                setTimeout(() => setSaved(false), 2000)
            }
        } catch (error) {
            console.error('Failed to save setup:', error)
        } finally {
            setSaving(false)
        }
    }

    const handleToggle = async (field, value, setter) => {
        setter(value)
        // Auto-save toggles
        const body = {}
        if (field === 'googleTraffic') {
            body.googleTraffic = value
        } else {
            body.basicSetup = { [field]: value }
        }
        try {
            await fetch(`/api/domains/${domainId}/basic-setup`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
        } catch (error) {
            console.error('Failed to toggle:', error)
        }
    }

    return (
        <div className="basic-setup">
            {/* Google Traffic Section */}
            <div className="setup-card">
                <div className="setup-card-header">
                    <div className="setup-card-icon">🌐</div>
                    <h3 className="setup-card-title">Google Traffic Status</h3>
                </div>
                <div className="setup-card-body">
                    <label className="setup-toggle-row">
                        <span className="setup-toggle-label">
                            Getting Google Traffic
                            {googleTraffic && <span className="traffic-dot traffic-dot-green"></span>}
                        </span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={googleTraffic}
                                onChange={(e) => handleToggle('googleTraffic', e.target.checked, setGoogleTraffic)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </label>

                    {googleTraffic && (
                        <div className="setup-sub-checks">
                            <label className="setup-checkbox-row">
                                <input
                                    type="checkbox"
                                    checked={apluPush}
                                    onChange={(e) => handleToggle('apluPush', e.target.checked, setApluPush)}
                                    className="setup-checkbox"
                                />
                                <span className="setup-checkbox-label">
                                    <span className={`setup-status-dot ${apluPush ? 'dot-green' : 'dot-red'}`}></span>
                                    Aplu Push Configured
                                </span>
                            </label>
                            <label className="setup-checkbox-row">
                                <input
                                    type="checkbox"
                                    checked={adsterraAd}
                                    onChange={(e) => handleToggle('adsterraAd', e.target.checked, setAdsterraAd)}
                                    className="setup-checkbox"
                                />
                                <span className="setup-checkbox-label">
                                    <span className={`setup-status-dot ${adsterraAd ? 'dot-green' : 'dot-red'}`}></span>
                                    Adsterra Ad Code
                                </span>
                            </label>
                            <label className="setup-checkbox-row">
                                <input
                                    type="checkbox"
                                    checked={taboolaContact}
                                    onChange={(e) => handleToggle('taboolaContact', e.target.checked, setTaboolaContact)}
                                    className="setup-checkbox"
                                />
                                <span className="setup-checkbox-label">
                                    <span className={`setup-status-dot ${taboolaContact ? 'dot-green' : 'dot-red'}`}></span>
                                    Taboola Contact Pages
                                </span>
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {/* WP Admin Login Section */}
            <div className="setup-card">
                <div className="setup-card-header">
                    <div className="setup-card-icon">🔐</div>
                    <h3 className="setup-card-title">WP Admin Login</h3>
                </div>
                <div className="setup-card-body">
                    <div className="setup-login-link">
                        <label className="input-label">Admin URL</label>
                        <a href={wpAdminUrl} target="_blank" rel="noopener noreferrer" className="wp-admin-link">
                            {wpAdminUrl} <span className="link-arrow">↗</span>
                        </a>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Username</label>
                        <input
                            className="input"
                            type="text"
                            placeholder="admin"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Password</label>
                        <div className="password-input-wrapper">
                            <input
                                className="input"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="password-toggle-btn"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <button
                        className={`btn btn-primary setup-save-btn ${saved ? 'btn-saved' : ''}`}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save Login Details'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default BasicSetup
