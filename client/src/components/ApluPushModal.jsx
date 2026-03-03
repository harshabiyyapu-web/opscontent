import { useState } from 'react'

function ApluPushModal({ isOpen, onClose, onSubmit, targetLabel }) {
    const [siteName, setSiteName] = useState('')
    const [email, setEmail] = useState('')
    const [hour, setHour] = useState('12')
    const [minute, setMinute] = useState('00')
    const [period, setPeriod] = useState('AM')
    const [submitting, setSubmitting] = useState(false)

    if (!isOpen) return null

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        await onSubmit({
            siteName,
            email,
            time: `${hour}:${minute} ${period}`
        })
        setSubmitting(false)
        setSiteName('')
        setEmail('')
        setHour('12')
        setMinute('00')
        setPeriod('AM')
        onClose()
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal push-modal-white" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title" style={{ color: '#1a1209' }}>🔔 Give Aplu Push</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                {targetLabel && <p style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#6b5838' }}>For: {targetLabel}</p>}
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label" style={{ color: '#1a1209' }}>Push Site Name</label>
                        <input className="input push-modal-input" type="text" placeholder="e.g. mysite-push" value={siteName} onChange={e => setSiteName(e.target.value)} required autoFocus />
                    </div>
                    <div className="input-group">
                        <label className="input-label" style={{ color: '#1a1209' }}>Account Email</label>
                        <input className="input push-modal-input" type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="input-group">
                        <label className="input-label" style={{ color: '#1a1209' }}>Push Time</label>
                        <div className="time-picker-row">
                            <select className="input time-select push-modal-input" value={hour} onChange={e => setHour(e.target.value)}>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                    <option key={h} value={h.toString()}>{h.toString().padStart(2, '0')}</option>
                                ))}
                            </select>
                            <span className="time-separator">:</span>
                            <select className="input time-select push-modal-input" value={minute} onChange={e => setMinute(e.target.value)}>
                                {['00', '15', '30', '45'].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            <div className="period-toggle">
                                <button type="button" className={`period-btn ${period === 'AM' ? 'active' : ''}`} onClick={() => setPeriod('AM')}>AM</button>
                                <button type="button" className={`period-btn ${period === 'PM' ? 'active' : ''}`} onClick={() => setPeriod('PM')}>PM</button>
                            </div>
                        </div>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ color: '#1a1209' }}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Give Push'}</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default ApluPushModal
