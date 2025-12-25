function UrlCard({ url, onToggleTracking, onDelete }) {
    // Shorten the URL for display
    const shortenUrl = (fullUrl) => {
        try {
            const urlObj = new URL(fullUrl);
            const path = urlObj.pathname;
            return path.length > 40 ? path.substring(0, 40) + '...' : path;
        } catch {
            return fullUrl.length > 40 ? fullUrl.substring(0, 40) + '...' : fullUrl;
        }
    };

    // Default gradient for cards without images (black/gray)
    const defaultGradient = 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)';

    return (
        <div className="url-card">
            {/* Featured Image */}
            <div
                className="url-card-image"
                style={{
                    backgroundImage: url.featuredImage
                        ? `url(${url.featuredImage})`
                        : defaultGradient
                }}
            >
                {/* Tracking Badge */}
                {url.isTracking && (
                    <span className="url-card-badge">Tracking</span>
                )}
            </div>

            {/* Card Content */}
            <div className="url-card-content">
                <h4 className="url-card-title">{url.label || url.ogTitle || 'Untitled'}</h4>
                <p className="url-card-link">{shortenUrl(url.url)}</p>
            </div>

            {/* Card Actions */}
            <div className="url-card-actions">
                <label className="toggle-switch toggle-sm">
                    <input
                        type="checkbox"
                        checked={url.isTracking || false}
                        onChange={() => onToggleTracking(url.id, url.isTracking)}
                    />
                    <span className="toggle-slider"></span>
                </label>

                <a
                    href={url.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="url-card-action"
                    title="Open URL"
                >
                    ↗
                </a>

                <button
                    className="url-card-action url-card-action--danger"
                    onClick={() => onDelete(url.id)}
                    title="Delete"
                >
                    ×
                </button>
            </div>
        </div>
    );
}

export default UrlCard;
