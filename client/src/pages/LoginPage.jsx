import { useState } from 'react'

function LoginPage({ onLogin }) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        setTimeout(() => {
            if (username === 'Harsha' && password === '2008') {
                localStorage.setItem('ops_auth', 'true')
                onLogin()
            } else {
                setError('Invalid username or password')
            }
            setLoading(false)
        }, 400)
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo">🔥</div>
                    <h1 className="login-title">Harsha Operations</h1>
                    <p className="login-subtitle">Sign in to continue</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="login-field">
                        <label className="login-label">Username</label>
                        <input
                            type="text"
                            className="login-input"
                            placeholder="Enter username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="login-field">
                        <label className="login-label">Password</label>
                        <input
                            type="password"
                            className="login-input"
                            placeholder="Enter password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? '⏳ Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="login-footer">
                    Content Operations Dashboard
                </div>
            </div>
        </div>
    )
}

export default LoginPage
