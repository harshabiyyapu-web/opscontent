import { Link, useLocation } from 'react-router-dom'

function Sidebar({ activeTab, onTabChange }) {
    const location = useLocation()
    const isDomainView = location.pathname.startsWith('/domain/')

    return (
        <aside className="sidebar sidebar-blue">
            <div className="sidebar-header">
                <h1 className="sidebar-title">Harsha Management</h1>
            </div>

            <nav className="sidebar-nav">
                {/* Main Navigation */}
                <div className="nav-section">
                    <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
                        <span>Dashboard</span>
                    </Link>
                </div>

                {/* Tab Navigation - Only show when in domain view */}
                {isDomainView && (
                    <div className="nav-section">
                        <div className="nav-section-title">Content</div>
                        <button
                            className={`nav-item ${activeTab === 'articles' ? 'active' : ''}`}
                            onClick={() => onTabChange?.('articles')}
                        >
                            <span>📝 Articles</span>
                        </button>
                        <button
                            className={`nav-item ${activeTab === 'focus' ? 'active' : ''}`}
                            onClick={() => onTabChange?.('focus')}
                        >
                            <span>🎯 Focus</span>
                        </button>
                        <button
                            className={`nav-item ${activeTab === 'tracking' ? 'active' : ''}`}
                            onClick={() => onTabChange?.('tracking')}
                        >
                            <span>📊 Tracking</span>
                        </button>
                    </div>
                )}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-version">v1.0</div>
            </div>
        </aside>
    )
}

export default Sidebar
