import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Auto-save middleware: trigger saveData() after any mutation (POST/PATCH/PUT/DELETE)
app.use((req, res, next) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
        const originalJson = res.json.bind(res);
        const originalSend = res.send.bind(res);
        res.json = function (data) {
            if (res.statusCode < 400 && typeof saveData === 'function') saveData();
            return originalJson(data);
        };
        res.send = function (data) {
            if (res.statusCode < 400 && typeof saveData === 'function') saveData();
            return originalSend(data);
        };
    }
    next();
});

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

// ============ PERSISTENT DATA STORE ============
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load persisted data from disk
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf-8');
            const saved = JSON.parse(raw);
            console.log(`✅ Loaded data from ${DATA_FILE} (${Object.keys(saved.sessions || {}).length} sessions, ${(saved.domains || []).length} domains)`);
            return saved;
        }
    } catch (err) {
        console.error('⚠️ Failed to load data file, starting fresh:', err.message);
    }
    return null;
}

// Save data to disk (debounced to avoid excessive writes)
let saveTimeout = null;
function saveData() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            const toSave = {
                domains: store.domains,
                urls: store.urls,
                sessions: store.sessions,
                blueprint: store.blueprint,
                settings: { plausibleApiKey: store.settings.plausibleApiKey }
            };
            fs.writeFileSync(DATA_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
            console.log(`💾 Data saved (${(toSave.domains || []).length} domains, ${Object.keys(toSave.sessions || {}).length} sessions)`);
        } catch (err) {
            console.error('❌ Failed to save data:', err.message);
        }
    }, 500); // Debounce 500ms
}

// Initialize store with saved data or defaults
const savedData = loadData();
const store = {
    domains: savedData?.domains || [],
    urls: savedData?.urls || {},
    sessions: savedData?.sessions || {},
    analyticsCache: {}, // Transient — not persisted
    blueprint: savedData?.blueprint || { countries: [] },
    settings: {
        plausibleApiKey: config.plausibleApiKey || savedData?.settings?.plausibleApiKey || ''
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
            contentGroups: [],    // Country-based article groups
            redirectionSets: [],  // Source → Redirected URL mappings
            // Legacy compatibility
            articles: [],
            focusGroups: []
        };
    }

    return store.sessions[sessionKey];
}

// Preset countries with flags
const PRESET_COUNTRIES = [
    { name: 'India', flag: '🇮🇳' },
    { name: 'Mexico', flag: '🇲🇽' },
    { name: 'Argentina', flag: '🇦🇷' },
    { name: 'Italy', flag: '🇮🇹' },
    { name: 'Ireland', flag: '🇮🇪' },
    { name: 'Greece', flag: '🇬🇷' },
    { name: 'USA', flag: '🇺🇸' }
];

// Color palette for redirection sets
const REDIR_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

// Helper: get IST time in 12-hour format
function getISTTime() {
    const now = new Date();
    return now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
}

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

        // Use ISO format - Plausible API accepts ISO 8601 format
        const formatDateTime = (date) => {
            return date.toISOString();
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

        // Get realtime source breakdown (last 5 minutes)
        let sources = [];
        try {
            const sourceData = await this.getRealtimeSourceBreakdown(apiKey, siteId, pagePath);
            sources = sourceData;
        } catch (e) {
            console.error('Failed to fetch source breakdown:', e.message);
        }

        return {
            realtime,           // Live visitors (last 5 min)
            hourlyData,         // Trend chart data (last 30 min)
            totals,             // Today's totals
            sources,            // Traffic source breakdown
            previousPeriod: { visitors: totals.visitors, pageviews: totals.pageviews }  // For comparison
        };
    },

    // Get traffic source breakdown for a specific page
    async getSourceBreakdown(apiKey, siteId, pagePath) {
        const sourceData = await this.query(apiKey, siteId, {
            metrics: ['visitors', 'pageviews'],
            date_range: 'day',
            dimensions: ['visit:source'],
            filters: [['is', 'event:page', [pagePath]]]
        });

        return (sourceData.results || []).map(r => ({
            source: r.dimensions?.[0] || 'Direct / None',
            visitors: r.metrics?.[0] || 0,
            pageviews: r.metrics?.[1] || 0
        })).sort((a, b) => b.visitors - a.visitors);
    },

    // Get realtime source breakdown (last 5 minutes)
    async getRealtimeSourceBreakdown(apiKey, siteId, pagePath) {
        const now = new Date();
        const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

        const sourceData = await this.query(apiKey, siteId, {
            metrics: ['visitors'],
            date_range: [fiveMinAgo.toISOString(), now.toISOString()],
            dimensions: ['visit:source'],
            filters: [['is', 'event:page', [pagePath]]]
        });

        return (sourceData.results || []).map(r => ({
            source: r.dimensions?.[0] || 'Direct / None',
            visitors: r.metrics?.[0] || 0
        })).sort((a, b) => b.visitors - a.visitors);
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
    const { name, url, googleTraffic, basicSetup, wpLogin } = req.body;

    if (!name || !url) {
        return res.status(400).json({ error: 'Name and URL are required' });
    }

    // Auto-generate wp-admin link
    const cleanUrl = url.replace(/\/$/, '');

    const domain = {
        id: uuidv4(),
        name,
        url,
        googleTraffic: googleTraffic || false,
        basicSetup: {
            apluPush: basicSetup?.apluPush || false,
            adsterraAd: basicSetup?.adsterraAd || false,
            taboolaContact: basicSetup?.taboolaContact || false
        },
        wpLogin: {
            adminUrl: `${cleanUrl}/wp-admin`,
            username: wpLogin?.username || '',
            password: wpLogin?.password || ''
        },
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

// Update domain basic setup
app.patch('/api/domains/:id/basic-setup', (req, res) => {
    const domain = store.domains.find(d => d.id === req.params.id);
    if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    const { googleTraffic, basicSetup, wpLogin } = req.body;

    if (googleTraffic !== undefined) domain.googleTraffic = googleTraffic;

    if (basicSetup) {
        if (!domain.basicSetup) domain.basicSetup = {};
        if (basicSetup.apluPush !== undefined) domain.basicSetup.apluPush = basicSetup.apluPush;
        if (basicSetup.adsterraAd !== undefined) domain.basicSetup.adsterraAd = basicSetup.adsterraAd;
        if (basicSetup.taboolaContact !== undefined) domain.basicSetup.taboolaContact = basicSetup.taboolaContact;
    }

    if (wpLogin) {
        if (!domain.wpLogin) domain.wpLogin = {};
        if (wpLogin.username !== undefined) domain.wpLogin.username = wpLogin.username;
        if (wpLogin.password !== undefined) domain.wpLogin.password = wpLogin.password;
    }

    res.json(domain);
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

// ============ SESSION & CONTENT GROUP ROUTES ============

// Get preset countries
app.get('/api/countries', (req, res) => {
    res.json(PRESET_COUNTRIES);
});

// Get session for a domain by date
app.get('/api/domains/:id/session/:date', (req, res) => {
    const { id: domainId, date } = req.params;
    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) return res.status(404).json({ error: 'Domain not found' });
    const session = getOrCreateSession(domainId, date);
    res.json(session);
});

// Get today's session
app.get('/api/domains/:id/session', (req, res) => {
    const domainId = req.params.id;
    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) return res.status(404).json({ error: 'Domain not found' });
    const session = getOrCreateSession(domainId);
    res.json(session);
});

// ---- Content Groups ----

// Create content group (country + articles)
app.post('/api/domains/:id/session/groups', async (req, res) => {
    const domainId = req.params.id;
    const { country, countryFlag, customCountryName, urls, date } = req.body;

    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) return res.status(404).json({ error: 'Domain not found' });

    const session = getOrCreateSession(domainId, date || getTodayDateString());

    const resolvedCountry = country === 'Custom' ? (customCountryName || 'Custom') : country;
    const resolvedFlag = country === 'Custom' ? '✏️' : (countryFlag || '🏳️');

    // Parse URLs
    const urlList = (urls || '').split('\n').map(u => u.trim()).filter(u => u.length > 0);

    // Fetch OG data for each URL
    const articles = [];
    for (const url of urlList) {
        const ogData = await fetchOgData(url);
        articles.push({
            id: uuidv4(),
            url,
            title: ogData.title || url,
            image: ogData.image,
            indexStatus: 'unchecked',
            addedAt: new Date().toISOString(),
            pushStatus: { given: false, siteName: '', email: '', time: '', givenAt: null }
        });
    }

    const group = {
        id: uuidv4(),
        country: resolvedCountry,
        countryFlag: resolvedFlag,
        articles,
        createdAt: new Date().toISOString()
    };

    session.contentGroups.push(group);

    // Legacy compat
    articles.forEach(a => {
        session.articles.push({ ...a, label: a.title, isTracking: false, focusGroupId: null, groupId: group.id });
    });

    res.status(201).json(group);
});

// Add articles to existing group
app.post('/api/domains/:id/session/groups/:gid/articles', async (req, res) => {
    const { id: domainId, gid } = req.params;
    const { urls, date } = req.body;

    const session = getOrCreateSession(domainId, date || getTodayDateString());
    const group = session.contentGroups.find(g => g.id === gid);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const urlList = (urls || '').split('\n').map(u => u.trim()).filter(u => u.length > 0);
    const newArticles = [];
    for (const url of urlList) {
        const ogData = await fetchOgData(url);
        const article = {
            id: uuidv4(),
            url,
            title: ogData.title || url,
            image: ogData.image,
            indexStatus: 'unchecked',
            addedAt: new Date().toISOString(),
            pushStatus: { given: false, siteName: '', email: '', time: '', givenAt: null }
        };
        group.articles.push(article);
        newArticles.push(article);
    }

    res.status(201).json(newArticles);
});

// Delete content group
app.delete('/api/domains/:id/session/groups/:gid', (req, res) => {
    const { id: domainId, gid } = req.params;
    const { date } = req.query;
    const session = getOrCreateSession(domainId, date || getTodayDateString());
    const idx = session.contentGroups.findIndex(g => g.id === gid);
    if (idx === -1) return res.status(404).json({ error: 'Group not found' });
    session.contentGroups.splice(idx, 1);
    res.status(204).send();
});

// Delete article from group
app.delete('/api/domains/:id/session/groups/:gid/articles/:aid', (req, res) => {
    const { id: domainId, gid, aid } = req.params;
    const { date } = req.query;
    const session = getOrCreateSession(domainId, date || getTodayDateString());
    const group = session.contentGroups.find(g => g.id === gid);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const aidx = group.articles.findIndex(a => a.id === aid);
    if (aidx === -1) return res.status(404).json({ error: 'Article not found' });
    group.articles.splice(aidx, 1);
    res.status(204).send();
});

// Mark article as indexed
app.patch('/api/domains/:id/session/groups/:gid/articles/:aid/indexed', (req, res) => {
    const { id: domainId, gid, aid } = req.params;
    const { date } = req.body;
    const session = getOrCreateSession(domainId, date || getTodayDateString());
    const group = session.contentGroups.find(g => g.id === gid);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const article = group.articles.find(a => a.id === aid);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    article.indexStatus = 'indexed';
    article.indexedAt = new Date().toISOString();
    res.json(article);
});

// ---- Redirection Sets ----

// Create redirection set
app.post('/api/domains/:id/session/redirections', async (req, res) => {
    const domainId = req.params.id;
    const { name, sourceUrls, redirectedArticleIds, groupId, date } = req.body;

    const session = getOrCreateSession(domainId, date || getTodayDateString());

    // Parse source URLs
    const sourceUrlList = (sourceUrls || '').split('\n').map(u => u.trim()).filter(u => u.length > 0);
    const sources = [];
    for (const url of sourceUrlList) {
        const ogData = await fetchOgData(url);
        sources.push({
            id: uuidv4(),
            url,
            title: ogData.title || url,
            pushStatus: { given: false, siteName: '', email: '', time: '', givenAt: null }
        });
    }

    const colorIndex = session.redirectionSets.length % REDIR_COLORS.length;

    const redirSet = {
        id: uuidv4(),
        name: name || `Redirection ${session.redirectionSets.length + 1}`,
        groupId: groupId || null,
        sourceUrls: sources,
        redirectedArticleIds: redirectedArticleIds || [],
        color: REDIR_COLORS[colorIndex],
        toggleOn: false,
        startTime: null,
        stopTime: null,
        duration: null,
        createdAt: new Date().toISOString()
    };

    session.redirectionSets.push(redirSet);
    res.status(201).json(redirSet);
});

// Delete redirection set
app.delete('/api/domains/:id/session/redirections/:rid', (req, res) => {
    const { id: domainId, rid } = req.params;
    const { date } = req.query;
    const session = getOrCreateSession(domainId, date || getTodayDateString());
    const idx = session.redirectionSets.findIndex(r => r.id === rid);
    if (idx === -1) return res.status(404).json({ error: 'Redirection not found' });
    session.redirectionSets.splice(idx, 1);
    res.status(204).send();
});

// Toggle redirection on/off (visual only)
app.patch('/api/domains/:id/session/redirections/:rid/toggle', (req, res) => {
    const { id: domainId, rid } = req.params;
    const { toggleOn, date } = req.body;
    const session = getOrCreateSession(domainId, date || getTodayDateString());
    const redir = session.redirectionSets.find(r => r.id === rid);
    if (!redir) return res.status(404).json({ error: 'Redirection not found' });
    redir.toggleOn = toggleOn !== undefined ? toggleOn : !redir.toggleOn;
    res.json(redir);
});

// Start/Stop timer
app.patch('/api/domains/:id/session/redirections/:rid/timer', (req, res) => {
    const { id: domainId, rid } = req.params;
    const { action, date } = req.body;
    const session = getOrCreateSession(domainId, date || getTodayDateString());
    const redir = session.redirectionSets.find(r => r.id === rid);
    if (!redir) return res.status(404).json({ error: 'Redirection not found' });

    const istTime = getISTTime();

    if (action === 'start') {
        redir.startTime = istTime;
        redir.stopTime = null;
        redir.duration = null;
    } else if (action === 'stop') {
        redir.stopTime = istTime;
        // Calculate duration
        if (redir.startTime) {
            const parseTime = (t) => {
                const match = t.match(/(\d+):(\d+)\s*(am|pm)/i);
                if (!match) return 0;
                let h = parseInt(match[1]);
                const m = parseInt(match[2]);
                const period = match[3].toLowerCase();
                if (period === 'pm' && h !== 12) h += 12;
                if (period === 'am' && h === 12) h = 0;
                return h * 60 + m;
            };
            const startMin = parseTime(redir.startTime);
            const stopMin = parseTime(redir.stopTime);
            let diff = stopMin - startMin;
            if (diff < 0) diff += 24 * 60;
            const hours = Math.floor(diff / 60);
            const mins = diff % 60;
            redir.duration = `${hours}h ${mins}m`;
        }
    }

    res.json(redir);
});

// ---- Aplu Push ----

// Give Aplu push to a source URL in a redirection set
app.patch('/api/domains/:id/session/redirections/:rid/push/source/:sid', (req, res) => {
    const { id: domainId, rid, sid } = req.params;
    const { siteName, email, time, date } = req.body;
    const session = getOrCreateSession(domainId, date || getTodayDateString());
    const redir = session.redirectionSets.find(r => r.id === rid);
    if (!redir) return res.status(404).json({ error: 'Redirection not found' });

    const source = redir.sourceUrls.find(s => s.id === sid);
    if (!source) return res.status(404).json({ error: 'Source URL not found' });

    source.pushStatus = {
        given: true,
        siteName: siteName || '',
        email: email || '',
        time: time || '',
        givenAt: new Date().toISOString()
    };

    // Propagate "Push Passed" to all redirected articles in this redirection set
    redir.redirectedArticleIds.forEach(articleId => {
        // Find article in content groups
        for (const group of session.contentGroups) {
            const article = group.articles.find(a => a.id === articleId);
            if (article && !article.pushStatus.given) {
                article.pushStatus.pushPassed = true;
                article.pushStatus.passedFrom = source.id;
                article.pushStatus.passedAt = new Date().toISOString();
            }
        }
    });

    res.json(redir);
});

// Give Aplu push to a redirected article
app.patch('/api/domains/:id/session/push/article/:aid', (req, res) => {
    const { id: domainId, aid } = req.params;
    const { siteName, email, time, date } = req.body;
    const session = getOrCreateSession(domainId, date || getTodayDateString());

    // Find article across all content groups
    for (const group of session.contentGroups) {
        const article = group.articles.find(a => a.id === aid);
        if (article) {
            article.pushStatus = {
                given: true,
                siteName: siteName || '',
                email: email || '',
                time: time || '',
                givenAt: new Date().toISOString()
            };
            return res.json(article);
        }
    }

    res.status(404).json({ error: 'Article not found' });
});

// Mark article(s) as indexed
app.patch('/api/domains/:id/session/mark-indexed', (req, res) => {
    const { id: domainId } = req.params;
    const { articleIds, date } = req.body;
    const session = getOrCreateSession(domainId, date || getTodayDateString());

    const marked = [];
    for (const group of session.contentGroups) {
        for (const article of group.articles) {
            if (articleIds.includes(article.id)) {
                article.indexed = true;
                article.indexedAt = new Date().toISOString();
                marked.push(article.id);
            }
        }
    }

    res.json({ marked, count: marked.length });
});

// Report endpoint — aggregated data for date range
app.get('/api/domains/:id/report', async (req, res) => {
    const { id: domainId } = req.params;
    const { from, to } = req.query;
    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) return res.status(404).json({ error: 'Domain not found' });

    // Generate array of dates from 'from' to 'to'
    const dates = [];
    const startDate = new Date(from || getTodayDateString());
    const endDate = new Date(to || getTodayDateString());
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
    }

    let totalArticles = 0;
    let totalIndexed = 0;
    let totalRedirections = 0;
    const dailyData = [];

    for (const dateStr of dates) {
        const sessionKey = `${domainId}_${dateStr}`;
        const session = store.sessions[sessionKey];
        if (!session) {
            dailyData.push({ date: dateStr, articles: 0, indexed: 0, redirections: 0, traffic: null });
            continue;
        }

        let dayArticles = 0;
        let dayIndexed = 0;
        for (const group of (session.contentGroups || [])) {
            dayArticles += group.articles.length;
            dayIndexed += group.articles.filter(a => a.indexed).length;
        }
        const dayRedirections = (session.redirectionSets || []).length;

        totalArticles += dayArticles;
        totalIndexed += dayIndexed;
        totalRedirections += dayRedirections;

        // Try to get traffic from Plausible for this date
        let traffic = null;
        if (domain.plausibleDomain) {
            try {
                const plausibleRes = await fetch('https://plausible.io/api/v2/query', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.PLAUSIBLE_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        site_id: domain.plausibleDomain,
                        metrics: ['visitors', 'pageviews'],
                        date_range: [dateStr, dateStr],
                        dimensions: ['visit:source']
                    })
                });
                if (plausibleRes.ok) {
                    const pData = await plausibleRes.json();
                    const results = pData.results || [];
                    let google = 0, direct = 0, other = 0, totalVisitors = 0, totalPv = 0;
                    for (const row of results) {
                        const src = (row.dimensions?.[0] || '').toLowerCase();
                        const vis = row.metrics?.[0] || 0;
                        const pv = row.metrics?.[1] || 0;
                        totalVisitors += vis;
                        totalPv += pv;
                        if (src === 'google') google += vis;
                        else if (src === 'direct / none' || src === '') direct += vis;
                        else other += vis;
                    }
                    traffic = { visitors: totalVisitors, pageviews: totalPv, google, direct, other };
                }
            } catch (e) { /* plausible unavailable */ }
        }

        dailyData.push({
            date: dateStr,
            articles: dayArticles,
            indexed: dayIndexed,
            redirections: dayRedirections,
            traffic
        });
    }

    res.json({
        domainId,
        domainName: domain.name,
        from: dates[0],
        to: dates[dates.length - 1],
        summary: { totalArticles, totalIndexed, totalRedirections },
        dailyData
    });
});

// ---- Legacy compat routes ----

app.get('/api/domains/:id/sessions', (req, res) => {
    const domainId = req.params.id;
    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) return res.status(404).json({ error: 'Domain not found' });
    const domainSessions = Object.entries(store.sessions)
        .filter(([key]) => key.startsWith(domainId))
        .map(([, session]) => ({
            date: session.date,
            groupCount: session.contentGroups.length,
            redirectionCount: session.redirectionSets.length
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
    res.json(domainSessions);
});

// Get tracking/analytics data grouped by country (with Plausible realtime)
app.get('/api/domains/:id/analytics-groups', async (req, res) => {
    const domainId = req.params.id;
    const { date, realtime } = req.query;
    const apiKey = store.settings.plausibleApiKey;
    const session = getOrCreateSession(domainId, date || getTodayDateString());

    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) return res.status(404).json({ error: 'Domain not found' });

    const siteId = getSiteIdFromUrl(domain.url);

    // Fetch Plausible realtime data for each article if requested
    const analyticsMap = {};
    if (realtime === 'true' && apiKey) {
        for (const group of session.contentGroups) {
            for (const article of group.articles) {
                try {
                    const cached = getCachedAnalytics(article.id);
                    if (cached) {
                        analyticsMap[article.id] = cached;
                        continue;
                    }
                    const analytics = await PlausibleService.getUrlAnalytics(apiKey, siteId, article.url);
                    const processedData = {
                        ...analytics,
                        percentChange: PlausibleService.calculatePercentageChange(
                            analytics.totals?.visitors || 0,
                            analytics.previousPeriod?.visitors || 0
                        ),
                        lastUpdated: new Date().toISOString()
                    };
                    setCachedAnalytics(article.id, processedData);
                    analyticsMap[article.id] = processedData;
                } catch (error) {
                    analyticsMap[article.id] = { error: error.message, realtime: { visitors: 0 }, totals: {}, hourlyData: [] };
                }
            }
        }
    }

    const countryData = session.contentGroups.map(group => {
        const groupArticleIds = group.articles.map(a => a.id);
        const relatedRedirections = session.redirectionSets.filter(r =>
            r.redirectedArticleIds.some(id => groupArticleIds.includes(id)) || r.groupId === group.id
        );

        return {
            country: group.country,
            countryFlag: group.countryFlag,
            groupId: group.id,
            articles: group.articles.map(a => ({
                ...a,
                analytics: analyticsMap[a.id] || null,
                trafficSnapshots: a.trafficSnapshots || []
            })),
            redirectionSets: relatedRedirections
        };
    });

    res.json(countryData);
});

// Get comprehensive article detail (timeline, traffic, push, snapshots)
app.get('/api/domains/:id/session/article-detail/:aid', async (req, res) => {
    const { id: domainId, aid } = req.params;
    const { date } = req.query;
    const session = getOrCreateSession(domainId, date || getTodayDateString());

    // Find the article across all content groups
    let foundArticle = null;
    let foundGroup = null;
    for (const group of session.contentGroups) {
        const art = group.articles.find(a => a.id === aid);
        if (art) {
            foundArticle = art;
            foundGroup = group;
            break;
        }
    }

    if (!foundArticle) return res.status(404).json({ error: 'Article not found' });

    // Find redirection info
    let redirectionStarted = null, redirectionStopped = null, redirectionDuration = null;
    for (const redir of session.redirectionSets || []) {
        if (redir.redirectedArticleIds.includes(aid)) {
            redirectionStarted = redir.startTime || null;
            redirectionStopped = redir.stopTime || null;
            redirectionDuration = redir.duration || null;
            break;
        }
    }

    // Fetch Plausible traffic if API key available
    let todayVisitors = 0, todayPageviews = 0, realtimeVisitors = 0;
    const apiKey = store.settings.plausibleApiKey;
    if (apiKey) {
        const domain = store.domains.find(d => d.id === domainId);
        if (domain) {
            const siteId = getSiteIdFromUrl(domain.url);
            try {
                const analytics = await PlausibleService.getUrlAnalytics(apiKey, siteId, foundArticle.url);
                todayVisitors = analytics.totals?.visitors || 0;
                todayPageviews = analytics.totals?.pageviews || 0;
                realtimeVisitors = analytics.realtime?.visitors || 0;
            } catch (e) { /* skip */ }
        }
    }

    res.json({
        id: foundArticle.id,
        title: foundArticle.title,
        url: foundArticle.url,
        image: foundArticle.image,
        country: foundGroup.country,
        countryFlag: foundGroup.countryFlag,
        addedAt: foundArticle.addedAt || foundArticle.createdAt || null,
        redirectionStarted,
        redirectionStopped,
        redirectionDuration,
        todayVisitors,
        todayPageviews,
        realtimeVisitors,
        pushStatus: foundArticle.pushStatus || { given: false, pushPassed: false },
        snapshots: foundArticle.trafficSnapshots || []
    });
});

// Force refresh analytics for a specific article
app.get('/api/domains/:id/analytics-article/:aid', async (req, res) => {
    const { id: domainId, aid } = req.params;
    const apiKey = store.settings.plausibleApiKey;
    if (!apiKey) return res.status(400).json({ error: 'Plausible API key not configured' });

    const domain = store.domains.find(d => d.id === domainId);
    if (!domain) return res.status(404).json({ error: 'Domain not found' });

    const siteId = getSiteIdFromUrl(domain.url);
    const session = getOrCreateSession(domainId, req.query.date || getTodayDateString());

    // Find article across all groups
    let articleUrl = null;
    for (const group of session.contentGroups) {
        const art = group.articles.find(a => a.id === aid);
        if (art) { articleUrl = art.url; break; }
    }
    if (!articleUrl) return res.status(404).json({ error: 'Article not found' });

    try {
        delete store.analyticsCache[aid]; // clear cache
        const analytics = await PlausibleService.getUrlAnalytics(apiKey, siteId, articleUrl);
        const processedData = {
            ...analytics,
            percentChange: PlausibleService.calculatePercentageChange(
                analytics.totals?.visitors || 0,
                analytics.previousPeriod?.visitors || 0
            ),
            lastUpdated: new Date().toISOString()
        };
        setCachedAnalytics(aid, processedData);
        res.json(processedData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Save traffic snapshot (timestamp the realtime traffic)
app.post('/api/domains/:id/session/groups/:gid/articles/:aid/snapshot', (req, res) => {
    const { id: domainId, gid, aid } = req.params;
    const { visitors, pageviews, date } = req.body;
    const session = getOrCreateSession(domainId, date || getTodayDateString());

    const group = session.contentGroups.find(g => g.id === gid);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const article = group.articles.find(a => a.id === aid);
    if (!article) return res.status(404).json({ error: 'Article not found' });

    if (!article.trafficSnapshots) article.trafficSnapshots = [];

    const snapshot = {
        id: uuidv4(),
        visitors: visitors || 0,
        pageviews: pageviews || 0,
        timestamp: getISTTime(),
        isoTimestamp: new Date().toISOString()
    };

    article.trafficSnapshots.push(snapshot);
    res.status(201).json(snapshot);
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

// Debug endpoint to check Plausible API configuration
app.get('/api/debug/plausible', async (req, res) => {
    const apiKey = store.settings.plausibleApiKey;
    const result = {
        hasApiKey: !!apiKey,
        apiKeyPreview: apiKey ? `${apiKey.slice(0, 10)}...${apiKey.slice(-5)}` : 'NOT SET',
        plausibleBaseUrl: config.plausibleBaseUrl,
        domainsCount: store.domains.length,
        testConnection: null
    };

    // Test the Plausible API connection
    if (apiKey && store.domains.length > 0) {
        try {
            const domain = store.domains[0];
            const siteId = getSiteIdFromUrl(domain.url);
            const response = await fetch(`${config.plausibleBaseUrl}/api/v1/stats/realtime/visitors?site_id=${siteId}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            if (response.ok) {
                const visitors = await response.json();
                result.testConnection = { success: true, realtimeVisitors: visitors, siteId };
            } else {
                const error = await response.text();
                result.testConnection = { success: false, status: response.status, error };
            }
        } catch (error) {
            result.testConnection = { success: false, error: error.message };
        }
    }

    res.json(result);
});

// Debug endpoint to check tracked articles
app.get('/api/debug/articles', (req, res) => {
    const result = {
        domainsCount: store.domains.length,
        domains: store.domains.map(d => ({
            id: d.id,
            name: d.name,
            url: d.url
        })),
        sessionsCount: Object.keys(store.sessions).length,
        sessions: Object.entries(store.sessions).map(([key, session]) => ({
            key,
            date: session.date,
            articlesCount: session.articles.length,
            trackedArticles: session.articles.filter(a => a.isTracking).map(a => ({
                id: a.id,
                url: a.url,
                title: a.title?.slice(0, 50),
                isTracking: a.isTracking,
                focusGroupId: a.focusGroupId
            }))
        })),
        legacyUrls: Object.entries(store.urls).map(([domainId, urls]) => ({
            domainId,
            urlsCount: urls.length,
            trackedUrls: urls.filter(u => u.isTracking).map(u => ({
                id: u.id,
                url: u.url,
                label: u.label?.slice(0, 50),
                isTracking: u.isTracking
            }))
        })),
        analyticsCache: Object.keys(store.analyticsCache).length
    };

    res.json(result);
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

// ============ BLUEPRINT ROUTES ============

// Get all countries
app.get('/api/blueprint/countries', (req, res) => {
    const countries = store.blueprint.countries.map(c => ({
        ...c,
        articleCount: c.articles.length
    }));
    res.json(countries);
});

// Add a new country
app.post('/api/blueprint/countries', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Country name is required' });

    // Check for duplicates
    const exists = store.blueprint.countries.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) return res.status(409).json({ error: 'Country already exists' });

    const country = {
        id: uuidv4(),
        name,
        articles: [],
        createdAt: new Date().toISOString()
    };

    store.blueprint.countries.push(country);
    res.status(201).json({ ...country, articleCount: 0 });
});

// Delete a country
app.delete('/api/blueprint/countries/:id', (req, res) => {
    const index = store.blueprint.countries.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Country not found' });

    store.blueprint.countries.splice(index, 1);
    res.status(204).send();
});

// Get articles for a country
app.get('/api/blueprint/countries/:id/articles', (req, res) => {
    const country = store.blueprint.countries.find(c => c.id === req.params.id);
    if (!country) return res.status(404).json({ error: 'Country not found' });

    res.json(country.articles);
});

// Add article to a country
app.post('/api/blueprint/countries/:id/articles', async (req, res) => {
    const country = store.blueprint.countries.find(c => c.id === req.params.id);
    if (!country) return res.status(404).json({ error: 'Country not found' });

    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // Fetch OG data
    const ogData = await fetchOgData(url);

    const article = {
        id: uuidv4(),
        url,
        title: ogData.title || url,
        image: ogData.image || null,
        createdAt: new Date().toISOString()
    };

    country.articles.push(article);
    res.status(201).json(article);
});

// Bulk add articles to a country
app.post('/api/blueprint/countries/:id/articles/bulk', async (req, res) => {
    const country = store.blueprint.countries.find(c => c.id === req.params.id);
    if (!country) return res.status(404).json({ error: 'Country not found' });

    const { urls } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'URLs array is required' });
    }

    const newArticles = [];
    for (const url of urls) {
        const ogData = await fetchOgData(url);
        const article = {
            id: uuidv4(),
            url,
            title: ogData.title || url,
            image: ogData.image || null,
            createdAt: new Date().toISOString()
        };
        country.articles.push(article);
        newArticles.push(article);
    }

    res.status(201).json(newArticles);
});

// Delete article from a country
app.delete('/api/blueprint/countries/:countryId/articles/:articleId', (req, res) => {
    const country = store.blueprint.countries.find(c => c.id === req.params.countryId);
    if (!country) return res.status(404).json({ error: 'Country not found' });

    const articleIndex = country.articles.findIndex(a => a.id === req.params.articleId);
    if (articleIndex === -1) return res.status(404).json({ error: 'Article not found' });

    country.articles.splice(articleIndex, 1);
    res.status(204).send();
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
