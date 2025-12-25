import { useState, useEffect } from 'react';

function FocusGroupCard({ focusGroup, articles, onMarkPush, onRemoveArticle }) {
    const [timeLeft, setTimeLeft] = useState('');
    const [isPushDue, setIsPushDue] = useState(false);

    // Calculate push timer (2 hours from start time)
    useEffect(() => {
        const calculatePushStatus = () => {
            const today = new Date();
            const [hours, minutes] = focusGroup.startTime.split(':').map(Number);
            const startTime = new Date(today);
            startTime.setHours(hours, minutes, 0, 0);

            const pushDueTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // +2 hours
            const now = new Date();

            if (focusGroup.pushStatus.given) {
                setIsPushDue(false);
                setTimeLeft('');
                return;
            }

            if (now >= pushDueTime) {
                setIsPushDue(true);
                setTimeLeft('Push Due');
            } else {
                setIsPushDue(false);
                const diff = pushDueTime - now;
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                setTimeLeft(`Push in ${h}h ${m}m`);
            }
        };

        calculatePushStatus();
        const interval = setInterval(calculatePushStatus, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [focusGroup]);

    const formatTime = (time24) => {
        const [h, m] = time24.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    const getArticleById = (id) => articles.find(a => a.id === id);

    return (
        <div
            className="focus-group-card"
            style={{ borderColor: focusGroup.color }}
        >
            {/* Header */}
            <div className="focus-group-header" style={{ backgroundColor: focusGroup.color }}>
                <div className="focus-group-title">{focusGroup.name}</div>
                <div className="focus-group-time">{formatTime(focusGroup.startTime)}</div>
            </div>

            {/* Articles */}
            <div className="focus-group-articles">
                {focusGroup.articles.length === 0 ? (
                    <div className="focus-group-empty">
                        No articles assigned
                    </div>
                ) : (
                    focusGroup.articles.map(articleId => {
                        const article = getArticleById(articleId);
                        if (!article) return null;
                        return (
                            <div key={articleId} className="focus-article-item">
                                <span className="focus-article-title">{article.title || article.label}</span>
                                {onRemoveArticle && (
                                    <button
                                        className="focus-article-remove"
                                        onClick={() => onRemoveArticle(articleId)}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Push Status */}
            <div className="focus-group-footer">
                {focusGroup.pushStatus.given ? (
                    <div className="push-status push-given">
                        <span>✓ Pushed</span>
                        <span className="push-time">
                            {new Date(focusGroup.pushStatus.givenAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                ) : isPushDue ? (
                    <button
                        className="btn btn-push-due"
                        onClick={() => onMarkPush(focusGroup.id)}
                    >
                        🔔 Push Due - Mark Given
                    </button>
                ) : (
                    <div className="push-status push-waiting">
                        <span>⏱️ {timeLeft}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default FocusGroupCard;
