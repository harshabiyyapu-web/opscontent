function TodayContentCard({ url, onMarkIndexed, onPromote, onDelete }) {
    // Index status icon
    const getIndexIcon = () => {
        return url.indexStatus === 'indexed' ? '🟢' : '⚪';
    };

    // Format timestamp
    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    // Shorten URL for display
    const shortenUrl = (fullUrl) => {
        try {
            const urlObj = new URL(fullUrl);
            const path = urlObj.pathname;
            return path.length > 50 ? path.substring(0, 50) + '...' : path;
        } catch {
            return fullUrl.length > 50 ? fullUrl.substring(0, 50) + '...' : fullUrl;
        }
    };

    // Open Google site: search in new tab
    const handleOpenGoogleCheck = (e) => {
        e.stopPropagation();
        const searchUrl = `https://www.google.com/search?q=site:${encodeURIComponent(url.url)}`;
        window.open(searchUrl, '_blank');
    };

    // Mark as indexed
    const handleMarkIndexed = (e) => {
        e.stopPropagation();
        onMarkIndexed(url.id);
    };

    return (
        <div className="today-card">
            {/* Index Status */}
            <div className="today-card-status">
                <span className="index-icon" title={`Index Status: ${url.indexStatus}`}>
                    {getIndexIcon()}
                </span>
            </div>

            {/* Content */}
            <div className="today-card-content">
                <h4 className="today-card-title">{url.label || url.ogTitle || 'Untitled'}</h4>
                <p className="today-card-url">{shortenUrl(url.url)}</p>
                <span className="today-card-time">Added: {formatTime(url.createdAt)}</span>
            </div>

            {/* Actions */}
            <div className="today-card-actions">
                {/* Google Check Button */}
                <button
                    className="btn btn-icon btn-google"
                    onClick={handleOpenGoogleCheck}
                    title="Check on Google (opens new tab)"
                >
                    G
                </button>

                {/* Mark as Indexed Button */}
                <button
                    className={`btn btn-sm ${url.indexStatus === 'indexed' ? 'btn-indexed' : 'btn-secondary'}`}
                    onClick={handleMarkIndexed}
                    title={url.indexStatus === 'indexed' ? 'Indexed' : 'Mark as Indexed'}
                >
                    {url.indexStatus === 'indexed' ? '✓ Indexed' : 'Mark Indexed'}
                </button>

                {/* Delete Button */}
                <button
                    className="btn btn-icon btn-danger-subtle"
                    onClick={(e) => { e.stopPropagation(); onDelete(url.id); }}
                    title="Delete"
                >
                    ×
                </button>
            </div>
        </div>
    );
}

export default TodayContentCard;
