import { useState } from 'react';

function TabNavigation({ activeTab, onTabChange }) {
    const tabs = [
        { id: 'articles', label: '📝 Articles', color: null },
        { id: 'redirection', label: '🔀 Redirection', color: '#3b82f6' },
        { id: 'analytics', label: '📊 Analytics', color: '#10b981' },
        { id: 'setup', label: '⚙️ Setup', color: '#6b7280' }
    ];

    return (
        <div className="tab-navigation">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                    style={activeTab === tab.id && tab.color ? { borderColor: tab.color, color: tab.color } : {}}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

export default TabNavigation;
