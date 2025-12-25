import { useState } from 'react';

function TabNavigation({ activeTab, onTabChange }) {
    const tabs = [
        { id: 'articles', label: '📝 Articles', color: null },
        { id: 'focus', label: '🎯 Focus', color: '#3b82f6' },
        { id: 'tracking', label: '📊 Tracking', color: '#10b981' }
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
