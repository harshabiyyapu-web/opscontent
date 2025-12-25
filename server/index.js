import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ============ CONFIGURATION ============
const config = {
    plausibleApiKey: process.env.PLAUSIBLE_API_KEY || 'vDQOG-F1Jtv3-4j_mFWtGjetQjPdlgN4cUJsJeGrUJdZSWWbDs9OKgJSjqX_jWhE',
    plausibleBaseUrl: 'https://gkdbmadmission.in'
};

// Helper to extract site_id (hostname) from a URL
function getSiteIdFromUrl(urlString) {
    try {
        const url = new URL(urlString);
        return url.hostname.replace(/^www\./, ''); // Remove www. prefix if present
    } catch {
        return urlString;
    }
}

// Helper to fetch Open Graph data (image, title) from a URL
async function fetchOgData(pageUrl) {
    try {
        const response = await fetch(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ChronoQuasar/1.0)'
            },
            timeout: 5000
        });

        if (!response.ok) return { image: null, title: null };

        const html = await response.text();

        // Extract og:image
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

        // Extract og:title
        const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i) ||
            html.match(/<title[^>]*>([^<]+)<\/title>/i);

        return {
            image: ogImageMatch ? ogImageMatch[1] : null,
            title: ogTitleMatch ? ogTitleMatch[1] : null
        };
    } catch (error) {
        console.error(`Failed to fetch OG data for ${pageUrl}:`, error.message);
        return { image: null, title: null };
    }
}

// Helper to check if URL is indexed by Google
async function checkGoogleIndex(pageUrl) {
    try {
        const searchQuery = encodeURIComponent(`site:${pageUrl}`);
        const response = await fetch(`https://www.google.com/search?q=${searchQuery}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!response.ok) {
            console.error(`Google search failed: ${response.status}`);
            return 'unknown';
        }

        const html = await response.text();

        // Check if URL appears in search results
        // Google shows "did not match any documents" if not indexed
        const notIndexed = html.includes('did not match any documents') ||
            html.includes('No results found') ||
            !html.includes(pageUrl.replace(/https?:\/\//, '').split('/')[0]);

        return notIndexed ? 'not-indexed' : 'indexed';
    } catch (error) {
        console.error(`Failed to check Google index for ${pageUrl}:`, error.message);
        return 'unknown';
    }
}

// ============ IN-MEMORY DATA STORE ============
const store = {
    domains: [],
    urls: {}, // { domainId: [urls] } - legacy, keeping for compatibility
    sessions: {}, // { "domainId_YYYY-MM-DD": { date, articles[], focusGroups[] } }
    analyticsCache: {}, // { urlId: { data, timestamp } }
    settings: {
        plausibleApiKey: config.plausibleApiKey
    }
};

// Helper to get today's date string
function getTodayDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Helper to get or create a session for a domain + date
function getOrCreateSession(domainId, dateStr = getTodayDateString()) {
    const sessionKey = `${domainId}_${dateStr}`;

    if (!store.sessions[sessionKey]) {
        store.sessions[sessionKey] = {
            date: dateStr,
            domainId: domainId,
            articles: [],
            focusGroups: []
        };
    }

    return store.sessions[sessionKey];
}

// Focus group color palette
const FOCUS_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

// ============ PLAUSIBLE SERVICE ============
const PlausibleService = {
    async query(apiKey, siteId, requestBody) {
        const response = await fetch(`${config.plausibleBaseUrl}/api/v2/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                site_id: siteId,
                ...requestBody
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Plausible API error: ${response.status} - ${error}`);
        }

        return response.json();
    },

    // Get current realtime visitors (site-wide)
    async getRealtimeVisitors(apiKey, siteId) {
        const response = await fetch(`${config.plausibleBaseUrl}/api/v1/stats/realtime/visitors?site_id=${siteId}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            return 0;
        }

        return response.json(); // Returns just a number
    },

    async getUrlAnalytics(apiKey, siteId, pageUrl) {
        // Extract path from URL
        let pagePath;
        try {
            const url = new URL(pageUrl);
            pagePath = url.pathname;
        } catch {
            pagePath = pageUrl;
        }

        // Get current time for realtime query (last 5 minutes = current visitors)
        const now = new Date();
        const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

        // Format for IST timezone - Plausible expects site's reporting timezone
        const formatDateTime = (date) => {
            // Format: YYYY-MM-DDTHH:MM:SS+05:30
            const pad = (n) => n.toString().padStart(2, '0');
            const year = date.getFullYear();
            const month = pad(date.getMonth() + 1);
            const day = pad(date.getDate());
            const hours = pad(date.getHours());
            const minutes = pad(date.getMinutes());
            const seconds = pad(date.getSeconds());
            return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`;
        };

        // Get REALTIME data (last 5 minutes) - matches Plausible "current visitors" for the page
        const realtimeData = await this.query(apiKey, siteId, {
            metrics: ['visitors', 'pageviews'],
            date_range: [formatDateTime(fiveMinAgo), formatDateTime(now)],
            filters: [['is', 'event:page', [pagePath]]]
        });

        // Get trend data (hourly) for chart - time:minute not supported
        const trendData = await this.query(apiKey, siteId, {
            metrics: ['visitors', 'pageviews'],
            date_range: 'day',
            dimensions: ['time:hour'],
            filters: [['is', 'event:page', [pagePath]]]
        });

        // Get today's totals for comparison
        const todayData = await this.query(apiKey, siteId, {
            metrics: ['visitors', 'pageviews', 'bounce_rate', 'visit_duration'],
            date_range: 'day',
            filters: [['is', 'event:page', [pagePath]]]
        });

        // Parse API v2 response format: metrics come as arrays [visitors, pageviews, ...]
        const parseMetrics = (result, metricNames) => {
            if (!result || !result.metrics) return null;
            const parsed = {};
            metricNames.forEach((name, index) => {
                parsed[name] = result.metrics[index] || 0;
            });
            return parsed;
        };

        // Parse realtime metrics (live now)
        const realtimeMetrics = parseMetrics(realtimeData.results?.[0], ['visitors', 'pageviews']);
        const realtime = realtimeMetrics || { visitors: 0, pageviews: 0 };

        // Parse trend data for chart (last 30 min by minute)
        const hourlyData = (trendData.results || []).map(r => ({
            time: r.dimensions?.[0] || '',
            visitors: r.metrics?.[0] || 0,
            pageviews: r.metrics?.[1] || 0
        }));

        // Parse today's totals
        const totalMetrics = parseMetrics(todayData.results?.[0], ['visitors', 'pageviews', 'bounce_rate', 'visit_duration']);
        const totals = totalMetrics || { visitors: 0, pageviews: 0, bounce_rate: 0, visit_duration: 0 };

        return {
            realtime,           // Live visitors (last 5 min)
            hourlyData,         // Trend chart data (last 30 min)
            totals,             // Today's totals
            previousPeriod: { visitors: totals.visitors, pageviews: totals.pageviews }  // For comparison
        };
    },

    calculatePercentageChange(current, previous) {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    }
};

// ============ ANALYTICS CACHE ============
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCachedAnalytics(urlId) {
    const cached = store.analyticsCache[urlId];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
}

function setCachedAnalytics(urlId, data) {
    store.analyticsCache[urlId] = {
        data,
        timestamp: Date.now()
    };
}

async function refreshAllTrackedUrls() {
    const apiKey = store.settings.plausibleApiKey;
    if (!apiKey) {
        console.log('⚠️ No Plausible API key configured, skipping refresh');
        return;
    }

    console.log('🔄 Refreshing analytics for all tracked URLs...');

    for (const domainId of Object.keys(store.urls)) {
        const domain = store.domains.find(d => d.id === domainId);
        if (!domain) continue;

        const siteId = getSiteIdFromUrl(domain.url);
        const urls = store.urls[domainId];

        for (const url of urls) {
            if (url.isTracking) {
                try {
                    const analytics = await PlausibleService.getUrlAnalytics(
                        apiKey,
                        siteId,
                        url.url
                    );

                    const percentChange = PlausibleService.calculatePercentageChange(
                        analytics.totals.visitors || 0,
                        analytics.previousPeriod.visitors || 0
                    );

                    const processedData = {
                        ...analytics,
                        percentChange,
                        lastUpdated: new Date().toISOString()
                    };

                    setCachedAnalytics(url.id, processedData);
                    console.log(`✅ Refreshed: ${url.label}`);
                } catch (error) {
                    console.error(`❌ Failed to refresh ${url.label}:`, error.message);
                }
            }
        }
    }

    console.log('✅ Analytics refresh complete');
}

// Schedule refresh every 30 minutes
cron.schedule('*/30 * * * *', () => {
    refreshAllTrackedUrls();
});

// ============ DOMAIN ROUTES ============

// Get all domains
app.get('/api/domains', (req, res) => {
    res.json(store.domains);
});

// Create new domain
app.post('/api/domains', (req, res) => {
    const { name, url } = req.body;

    if (!name || !url) {
        return res.status(400).json({ error: 'Name and URL are required' });
    }

    const domain = {
        id: uuidv4(),
        name,
        url,
        createdAt: new Date().toISOString(),
        urlCount: 0
    };

    store.domains.push(domain);
    store.urls[domain.id] = [];

    res.status(201).json(domain);
});

// Get single domain
app.get('/api/domains/:id', (req, res) => {
    const domain = store.domains.find(d => d.id === req.params.id);

    if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    res.json(domain);
});

// Delete domain
app.delete('/api/domains/:id', (req, res) => {
    const index = store.domains.findIndex(d => d.id === req.params.id);

    if (index === -1) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    // Clean up analytics cache for domain URLs
    const urls = store.urls[req.params.id] || [];
    urls.forEach(url => delete store.analyticsCache[url.id]);

    store.domains.splice(index, 1);
    delete store.urls[req.params.id];

    res.status(204).send();
});

// ============ URL ROUTES ============

// Get URLs for a domain
app.get('/api/domains/:id/urls', (req, res) => {
    const domainId = req.params.id;

    if (!store.urls[domainId]) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    res.json(store.urls[domainId]);
});

// Add URL to domain (async to fetch OG data)
app.post('/api/domains/:id/urls', async (req, res) => {
    const domainId = req.params.id;
    const { url, label, contentType = 'today' } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    // Fetch OG data (image and title) from the URL
    const ogData = await fetchOgData(url);

    const newUrl = {
        id: uuidv4(),
        url,
        label: label || ogData.title || url,
        featuredImage: ogData.image,
        ogTitle: ogData.title,
        contentType: contentType, // 'today' or 'tracked'
        indexStatus: 'unchecked', // 'unchecked', 'checking', 'indexed', 'not-indexed'
        isTracking: contentType === 'tracked', // Only tracked content has analytics
        promotedAt: null,
        createdAt: new Date().toISOString()
    };

    store.urls[domainId].push(newUrl);
    domain.urlCount = store.urls[domainId].length;

    res.status(201).json(newUrl);
});

// Toggle URL tracking
app.patch('/api/domains/:id/urls/:urlId', (req, res) => {
    const { id: domainId, urlId } = req.params;
    const { isTracking } = req.body;

    if (!store.urls[domainId]) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    const url = store.urls[domainId].find(u => u.id === urlId);
    if (!url) {
        return res.status(404).json({ error: 'URL not found' });
    }

    if (typeof isTracking === 'boolean') {
        url.isTracking = isTracking;
    }

    // Handle index status update (for manual marking)
    if (req.body.indexStatus) {
        url.indexStatus = req.body.indexStatus;
    }

    res.json(url);
});

// Delete URL from domain
app.delete('/api/domains/:id/urls/:urlId', (req, res) => {
    const { id: domainId, urlId } = req.params;

    if (!store.urls[domainId]) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    const urlIndex = store.urls[domainId].findIndex(u => u.id === urlId);

    if (urlIndex === -1) {
        return res.status(404).json({ error: 'URL not found' });
    }

    // Clean up cache
    delete store.analyticsCache[urlId];

    store.urls[domainId].splice(urlIndex, 1);

    const domain = store.domains.find(d => d.id === domainId);
    if (domain) {
        domain.urlCount = store.urls[domainId].length;
    }

    res.status(204).send();
});

// ============ SESSION & FOCUS GROUP ROUTES ============

// Get session for a domain by date
app.get('/api/domains/:id/session/:date', (req, res) => {
    const { id: domainId, date } = req.params;

    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    const session = getOrCreateSession(domainId, date);
    res.json(session);
});

// Get today's session (convenience endpoint)
app.get('/api/domains/:id/session', (req, res) => {
    const domainId = req.params.id;

    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    const session = getOrCreateSession(domainId);
    res.json(session);
});

// Add article to session (today's content)
app.post('/api/domains/:id/session/articles', async (req, res) => {
    const domainId = req.params.id;
    const { url, label, date } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    const session = getOrCreateSession(domainId, date || getTodayDateString());

    // Fetch OG data
    const ogData = await fetchOgData(url);

    const article = {
        id: uuidv4(),
        url,
        label: label || ogData.title || url,
        title: ogData.title || label || url,
        featuredImage: ogData.image,
        indexStatus: 'unchecked',
        isTracking: false,
        focusGroupId: null,
        // Timestamps for timeline
        addedAt: new Date().toISOString(),
        indexedAt: null,
        focusStartedAt: null,
        pushGivenAt: null,
        // Hourly analytics snapshots (last 10 hours)
        hourlySnapshots: []
    };

    session.articles.push(article);

    // Also add to legacy urls store for compatibility
    if (!store.urls[domainId]) store.urls[domainId] = [];
    store.urls[domainId].push({ ...article, contentType: 'today' });

    res.status(201).json(article);
});

// Create a focus group
app.post('/api/domains/:id/session/focus-groups', (req, res) => {
    const domainId = req.params.id;
    const { name, startTime, date } = req.body;

    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    const session = getOrCreateSession(domainId, date || getTodayDateString());

    const colorIndex = session.focusGroups.length % FOCUS_COLORS.length;

    const focusGroup = {
        id: uuidv4(),
        name: name || `Focus Set ${session.focusGroups.length + 1}`,
        startTime: startTime || new Date().toTimeString().slice(0, 5),
        color: FOCUS_COLORS[colorIndex],
        articles: [],
        pushStatus: {
            due: false,
            given: false,
            givenAt: null
        },
        createdAt: new Date().toISOString()
    };

    session.focusGroups.push(focusGroup);
    res.status(201).json(focusGroup);
});

// Add articles to a focus group
app.post('/api/domains/:id/session/focus-groups/:fgId/articles', (req, res) => {
    const { id: domainId, fgId } = req.params;
    const { articleIds, date } = req.body;

    const session = getOrCreateSession(domainId, date || getTodayDateString());

    const focusGroup = session.focusGroups.find(fg => fg.id === fgId);
    if (!focusGroup) {
        return res.status(404).json({ error: 'Focus group not found' });
    }

    // Add articles to focus group
    articleIds.forEach(articleId => {
        const article = session.articles.find(a => a.id === articleId);
        if (article && !focusGroup.articles.includes(articleId)) {
            focusGroup.articles.push(articleId);
            article.focusGroupId = fgId;
            article.isTracking = true; // Enable tracking when added to focus
            article.focusStartedAt = new Date().toISOString(); // Record focus start time

            // Update legacy store
            if (store.urls[domainId]) {
                const legacyUrl = store.urls[domainId].find(u => u.id === articleId);
                if (legacyUrl) {
                    legacyUrl.isTracking = true;
                    legacyUrl.focusGroupId = fgId;
                    legacyUrl.focusStartedAt = article.focusStartedAt;
                }
            }
        }
    });

    res.json(focusGroup);
});

// Mark push as given for a focus group
app.patch('/api/domains/:id/session/focus-groups/:fgId/push', (req, res) => {
    const { id: domainId, fgId } = req.params;
    const { given, givenAt, date } = req.body;

    const session = getOrCreateSession(domainId, date || getTodayDateString());

    const focusGroup = session.focusGroups.find(fg => fg.id === fgId);
    if (!focusGroup) {
        return res.status(404).json({ error: 'Focus group not found' });
    }

    const pushTime = givenAt || new Date().toISOString();
    focusGroup.pushStatus.given = given !== undefined ? given : true;
    focusGroup.pushStatus.givenAt = pushTime;

    // Also update pushGivenAt on all articles in this focus group
    focusGroup.articles.forEach(articleId => {
        const article = session.articles.find(a => a.id === articleId);
        if (article) {
            article.pushGivenAt = pushTime;
        }
    });

    res.json(focusGroup);
});

// Get all sessions for a domain (for history)
app.get('/api/domains/:id/sessions', (req, res) => {
    const domainId = req.params.id;

    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    // Find all sessions for this domain
    const domainSessions = Object.entries(store.sessions)
        .filter(([key]) => key.startsWith(domainId))
        .map(([, session]) => ({
            date: session.date,
            articleCount: session.articles.length,
            focusGroupCount: session.focusGroups.length
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

    res.json(domainSessions);
});

// Get article detail with timeline
app.get('/api/domains/:id/session/articles/:articleId', (req, res) => {
    const { id: domainId, articleId } = req.params;
    const { date } = req.query;

    const session = getOrCreateSession(domainId, date || getTodayDateString());
    const article = session.articles.find(a => a.id === articleId);

    if (!article) {
        return res.status(404).json({ error: 'Article not found' });
    }

    // Get focus group info if assigned
    let focusGroup = null;
    if (article.focusGroupId) {
        focusGroup = session.focusGroups.find(fg => fg.id === article.focusGroupId);
    }

    res.json({
        ...article,
        focusGroup: focusGroup ? { id: focusGroup.id, name: focusGroup.name, color: focusGroup.color } : null
    });
});

// Mark article as indexed (with timestamp)
app.patch('/api/domains/:id/session/articles/:articleId/indexed', (req, res) => {
    const { id: domainId, articleId } = req.params;
    const { date } = req.body;

    const session = getOrCreateSession(domainId, date || getTodayDateString());
    const article = session.articles.find(a => a.id === articleId);

    if (!article) {
        return res.status(404).json({ error: 'Article not found' });
    }

    article.indexStatus = 'indexed';
    article.indexedAt = new Date().toISOString();

    res.json(article);
});

// Delete article from session
app.delete('/api/domains/:id/session/articles/:articleId', (req, res) => {
    const { id: domainId, articleId } = req.params;
    const { date } = req.query;

    const session = getOrCreateSession(domainId, date || getTodayDateString());
    const articleIndex = session.articles.findIndex(a => a.id === articleId);

    if (articleIndex === -1) {
        return res.status(404).json({ error: 'Article not found' });
    }

    // Remove from session
    session.articles.splice(articleIndex, 1);

    // Also remove from legacy store
    if (store.urls[domainId]) {
        const legacyIndex = store.urls[domainId].findIndex(u => u.id === articleId);
        if (legacyIndex !== -1) {
            store.urls[domainId].splice(legacyIndex, 1);
        }
    }

    // Clean up analytics cache
    delete store.analyticsCache[articleId];

    res.status(204).send();
});

// Get tracking data by focus group
app.get('/api/domains/:id/tracking', async (req, res) => {
    const domainId = req.params.id;
    const { focusGroupId, date } = req.query;

    const session = getOrCreateSession(domainId, date || getTodayDateString());

    // Filter articles by focus group if specified
    let articles = session.articles.filter(a => a.isTracking);
    if (focusGroupId) {
        articles = articles.filter(a => a.focusGroupId === focusGroupId);
    }

    // Get focus group info
    const focusGroup = focusGroupId ? session.focusGroups.find(fg => fg.id === focusGroupId) : null;

    res.json({
        focusGroup,
        articles: articles.map(a => ({
            ...a,
            hourlySnapshots: a.hourlySnapshots || []
        }))
    });
});

// ============ INDEXING & PROMOTION ROUTES ============

// Check Google indexing status for a single URL
app.post('/api/domains/:id/urls/:urlId/check-index', async (req, res) => {
    const { id: domainId, urlId } = req.params;

    if (!store.urls[domainId]) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    const url = store.urls[domainId].find(u => u.id === urlId);
    if (!url) {
        return res.status(404).json({ error: 'URL not found' });
    }

    // Set to checking
    url.indexStatus = 'checking';

    // Check Google index
    const indexStatus = await checkGoogleIndex(url.url);
    url.indexStatus = indexStatus;

    res.json(url);
});

// Check Google indexing status for ALL today's content URLs
app.post('/api/domains/:id/check-all-index', async (req, res) => {
    const domainId = req.params.id;

    if (!store.urls[domainId]) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    const todayUrls = store.urls[domainId].filter(u => u.contentType === 'today');

    // Set all to checking
    todayUrls.forEach(url => url.indexStatus = 'checking');

    // Check all in parallel (with some delay to avoid rate limiting)
    const results = [];
    for (const url of todayUrls) {
        const indexStatus = await checkGoogleIndex(url.url);
        url.indexStatus = indexStatus;
        results.push({ id: url.id, indexStatus });
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    res.json({ checked: results.length, results });
});

// Promote URL from Today's Content to Tracked Content
app.post('/api/domains/:id/urls/:urlId/promote', async (req, res) => {
    const { id: domainId, urlId } = req.params;

    if (!store.urls[domainId]) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    const url = store.urls[domainId].find(u => u.id === urlId);
    if (!url) {
        return res.status(404).json({ error: 'URL not found' });
    }

    // Promote to tracked
    url.contentType = 'tracked';
    url.isTracking = true;
    url.promotedAt = new Date().toISOString();

    // Immediately fetch analytics for this URL
    try {
        const domain = store.domains.find(d => d.id === domainId);
        if (domain) {
            const siteId = getSiteIdFromUrl(domain.url);
            const analytics = await PlausibleService.getUrlAnalytics(
                store.settings.plausibleApiKey,
                siteId,
                url.url
            );
            store.analyticsCache[url.id] = {
                data: analytics,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error(`Failed to fetch initial analytics for ${url.url}:`, error.message);
    }

    res.json(url);
});

// ============ ANALYTICS ROUTES ============

// Get analytics for domain's tracked URLs
app.get('/api/domains/:id/analytics', async (req, res) => {
    const domainId = req.params.id;
    const forceRefresh = req.query.force === 'true';
    const apiKey = store.settings.plausibleApiKey;

    if (!store.urls[domainId]) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    if (!apiKey) {
        return res.status(400).json({
            error: 'Plausible API key not configured',
            needsApiKey: true
        });
    }

    // Get the domain to extract site_id
    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
    }
    const siteId = getSiteIdFromUrl(domain.url);

    // Collect tracked articles from sessions + legacy store
    let trackedUrls = [];

    // From legacy store
    if (store.urls[domainId]) {
        trackedUrls = store.urls[domainId].filter(u => u.isTracking);
    }

    // Also from sessions (to cover new session-based articles)
    Object.values(store.sessions).forEach(session => {
        if (session.domainId === domainId) {
            session.articles.filter(a => a.isTracking).forEach(article => {
                // Add if not already in list (by ID or URL)
                if (!trackedUrls.find(u => u.id === article.id || u.url === article.url)) {
                    trackedUrls.push(article);
                }
            });
        }
    });

    // If force refresh, clear cache for all tracked URLs
    if (forceRefresh) {
        trackedUrls.forEach(url => delete store.analyticsCache[url.id]);
        console.log(`🔄 Force refreshing analytics for ${trackedUrls.length} tracked URLs`);
    }

    const analyticsResults = {};

    for (const url of trackedUrls) {
        // Check cache first (skip if force refresh)
        if (!forceRefresh) {
            const cached = getCachedAnalytics(url.id);
            if (cached) {
                analyticsResults[url.id] = cached;
                continue;
            }
        }

        // Fetch fresh data
        try {
            const analytics = await PlausibleService.getUrlAnalytics(
                apiKey,
                siteId,
                url.url
            );

            const percentChange = PlausibleService.calculatePercentageChange(
                analytics.totals.visitors || 0,
                analytics.previousPeriod.visitors || 0
            );

            const processedData = {
                ...analytics,
                percentChange,
                lastUpdated: new Date().toISOString()
            };

            setCachedAnalytics(url.id, processedData);
            analyticsResults[url.id] = processedData;
        } catch (error) {
            console.error(`Failed to fetch analytics for ${url.label}:`, error.message);
            analyticsResults[url.id] = { error: error.message };
        }
    }

    res.json({
        analytics: analyticsResults,
        cacheInfo: {
            ttlMinutes: CACHE_TTL / 60000,
            nextRefresh: new Date(Date.now() + CACHE_TTL).toISOString()
        }
    });
});

// Manual refresh analytics
app.post('/api/domains/:id/analytics/refresh', async (req, res) => {
    const domainId = req.params.id;
    const apiKey = store.settings.plausibleApiKey;

    if (!store.urls[domainId]) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    if (!apiKey) {
        return res.status(400).json({
            error: 'Plausible API key not configured',
            needsApiKey: true
        });
    }

    // Clear cache for this domain's URLs
    const urls = store.urls[domainId];
    urls.forEach(url => delete store.analyticsCache[url.id]);

    // Get the domain to extract site_id
    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
    }
    const siteId = getSiteIdFromUrl(domain.url);

    // Trigger fresh fetch
    const trackedUrls = urls.filter(u => u.isTracking);
    const analyticsResults = {};

    for (const url of trackedUrls) {
        try {
            const analytics = await PlausibleService.getUrlAnalytics(
                apiKey,
                siteId,
                url.url
            );

            const percentChange = PlausibleService.calculatePercentageChange(
                analytics.totals.visitors || 0,
                analytics.previousPeriod.visitors || 0
            );

            const processedData = {
                ...analytics,
                percentChange,
                lastUpdated: new Date().toISOString()
            };

            setCachedAnalytics(url.id, processedData);
            analyticsResults[url.id] = processedData;
        } catch (error) {
            console.error(`Failed to refresh analytics for ${url.label}:`, error.message);
            analyticsResults[url.id] = { error: error.message };
        }
    }

    res.json({
        message: 'Analytics refreshed',
        analytics: analyticsResults
    });
});

// ============ SETTINGS ROUTES ============

// Get settings
app.get('/api/settings', (req, res) => {
    res.json({
        hasApiKey: !!store.settings.plausibleApiKey,
        plausibleSiteId: config.plausibleSiteId
    });
});

// Update settings
app.post('/api/settings', (req, res) => {
    const { plausibleApiKey } = req.body;

    if (plausibleApiKey !== undefined) {
        store.settings.plausibleApiKey = plausibleApiKey;
    }

    res.json({
        hasApiKey: !!store.settings.plausibleApiKey,
        message: 'Settings updated'
    });
});

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Plausible site: ${config.plausibleSiteId}`);
    console.log(`🔑 API Key: ${store.settings.plausibleApiKey ? 'Configured' : 'Not configured'}`);
    console.log(`⏰ Analytics auto-refresh: Every 30 minutes`);
    console.log(`📈 Hourly snapshot: Every hour`);
});

// ============ HOURLY SNAPSHOT SCHEDULER ============
async function captureHourlySnapshots() {
    console.log('📸 Capturing hourly snapshots...');
    const apiKey = store.settings.plausibleApiKey;
    if (!apiKey) {
        console.log('No API key configured, skipping snapshots');
        return;
    }

    const currentHour = new Date().toISOString().slice(0, 13) + ':00'; // YYYY-MM-DDTHH:00

    // Go through all sessions and their tracked articles
    for (const session of Object.values(store.sessions)) {
        const domain = store.domains.find(d => d.id === session.domainId);
        if (!domain) continue;

        const siteId = getSiteIdFromUrl(domain.url);

        for (const article of session.articles) {
            if (!article.isTracking) continue;

            try {
                // Fetch current visitors
                const analytics = await PlausibleService.getUrlAnalytics(apiKey, siteId, article.url);
                const visitors = analytics?.totals?.visitors || 0;

                // Initialize hourlySnapshots if needed
                if (!article.hourlySnapshots) {
                    article.hourlySnapshots = [];
                }

                // Calculate delta from previous hour
                const previousSnapshot = article.hourlySnapshots[0];
                const previousVisitors = previousSnapshot?.visitors || 0;
                const delta = visitors - previousVisitors;
                const percentChange = previousVisitors > 0
                    ? ((delta / previousVisitors) * 100).toFixed(1)
                    : (visitors > 0 ? '+100' : '0');

                // Add new snapshot at beginning
                article.hourlySnapshots.unshift({
                    hour: currentHour,
                    visitors,
                    delta,
                    percentChange: parseFloat(percentChange)
                });

                // Keep only last 10 hours
                if (article.hourlySnapshots.length > 10) {
                    article.hourlySnapshots = article.hourlySnapshots.slice(0, 10);
                }

                console.log(`✅ Snapshot: ${article.title?.slice(0, 30)} - ${visitors} visitors (+${delta})`);
            } catch (error) {
                console.error(`Failed to snapshot ${article.url}:`, error.message);
            }
        }
    }
    console.log('📸 Hourly snapshots complete');
}

// Run hourly snapshot every hour (at XX:00)
function scheduleHourlySnapshot() {
    const now = new Date();
    const msUntilNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000;

    // First snapshot at next hour
    setTimeout(() => {
        captureHourlySnapshots();
        // Then every hour
        setInterval(captureHourlySnapshots, 60 * 60 * 1000);
    }, msUntilNextHour);

    console.log(`⏰ Next hourly snapshot in ${Math.round(msUntilNextHour / 60000)} minutes`);
}

// Start hourly snapshot scheduler
scheduleHourlySnapshot();
