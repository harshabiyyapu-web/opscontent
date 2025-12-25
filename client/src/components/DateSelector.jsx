import { useState } from 'react';

function DateSelector({ selectedDate, onDateChange }) {
    const [showPicker, setShowPicker] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const formatDisplayDate = (dateStr) => {
        if (dateStr === today) return 'Today';
        if (dateStr === yesterday) return 'Yesterday';

        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="date-selector">
            <button
                className="date-selector-btn"
                onClick={() => setShowPicker(!showPicker)}
            >
                <span className="date-icon">📅</span>
                <span>{formatDisplayDate(selectedDate)}</span>
                <span className="date-arrow">▼</span>
            </button>

            {showPicker && (
                <div className="date-dropdown">
                    <button
                        className={`date-option ${selectedDate === today ? 'active' : ''}`}
                        onClick={() => { onDateChange(today); setShowPicker(false); }}
                    >
                        Today
                    </button>
                    <button
                        className={`date-option ${selectedDate === yesterday ? 'active' : ''}`}
                        onClick={() => { onDateChange(yesterday); setShowPicker(false); }}
                    >
                        Yesterday
                    </button>
                    <div className="date-divider"></div>
                    <input
                        type="date"
                        className="date-picker-input"
                        value={selectedDate}
                        onChange={(e) => { onDateChange(e.target.value); setShowPicker(false); }}
                    />
                </div>
            )}
        </div>
    );
}

export default DateSelector;
