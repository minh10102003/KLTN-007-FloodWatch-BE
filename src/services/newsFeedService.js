const { XMLParser } = require('fast-xml-parser');

const FEEDS = [
    { url: 'https://vnexpress.net/rss/thoi-su.rss', label: 'VnExpress' },
    { url: 'https://tuoitre.vn/rss/thoi-su.rss', label: 'Tuổi Trẻ' },
    { url: 'https://nld.com.vn/rss/thoi-su.rss', label: 'Người Lao Động' },
];

const KEYWORDS = [
    'ngập',
    'triều cường',
    'mưa',
    'lũ',
    'thoát nước',
    'tphcm',
    'sài gòn',
    'hồ chí minh',
    'thời tiết',
];

function stripCDATA(s) {
    return String(s || '')
        .replace(/<!\[CDATA\[/gi, '')
        .replace(/\]\]>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim();
}

function coerceText(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v !== null && '#text' in v) {
        return String(v['#text'] ?? '');
    }
    return String(v);
}

function matchesKeyword(text) {
    const t = String(text).toLowerCase();
    return KEYWORDS.some((k) => t.includes(k.toLowerCase()));
}

function normalizeItems(raw, source, { requireKeyword = true } = {}) {
    if (raw == null) return [];
    const items = Array.isArray(raw) ? raw : [raw];
    const out = [];
    for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const o = item;
        const titleRaw = o.title ?? o.Title;
        const linkRaw = o.link ?? o.Link ?? o.guid;
        const descRaw = o.description ?? o.Description ?? '';
        const pubRaw = o.pubDate ?? o.pubdate ?? o.Date ?? '';
        const title = stripCDATA(coerceText(titleRaw));
        let link = coerceText(linkRaw).trim();
        if (link.includes('<')) link = stripCDATA(link);
        link = link.replace(/<!\[CDATA\[(.*?)\]\]>/gis, '$1').trim();
        const pubDate = coerceText(pubRaw).trim();
        const descText = stripCDATA(coerceText(descRaw));
        if (!title || !link) continue;
        if (requireKeyword && !matchesKeyword(`${title} ${descText}`)) continue;
        out.push({ title, link, pubDate, source });
    }
    return out;
}

function parseRssXml(xml, source, opts) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        trimValues: false,
    });
    let parsed;
    try {
        parsed = parser.parse(xml);
    } catch {
        return [];
    }
    const root = parsed || {};
    const rss = root.rss ?? root.Rss;
    const channel = rss && typeof rss === 'object' ? rss.channel : undefined;
    if (!channel || typeof channel !== 'object') return [];
    return normalizeItems(channel.item, source, opts);
}

function parsePubDate(d) {
    const t = Date.parse(d);
    return Number.isFinite(t) ? t : 0;
}

async function fetchOne(feed, { requireKeyword = true } = {}) {
    try {
        const res = await fetch(feed.url, {
            headers: {
                'User-Agent': 'FloodWatchNews/1.0 (+https://floodsight)',
                Accept: 'application/rss+xml, application/xml, text/xml, */*',
            },
            signal: AbortSignal.timeout(Math.min(20_000, Math.max(5000, parseInt(process.env.NEWS_RSS_TIMEOUT_MS || '15000', 10) || 15000))),
        });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRssXml(xml, feed.label, { requireKeyword });
    } catch {
        return [];
    }
}

let cacheEntry = null;

function getCacheTtlMs() {
    return Math.max(60_000, (parseInt(process.env.NEWS_CACHE_SECONDS, 10) || 900) * 1000);
}

function getStaleMaxMs() {
    const sec = parseInt(process.env.NEWS_STALE_MAX_SECONDS, 10);
    if (Number.isFinite(sec) && sec > 0) return sec * 1000;
    return 86_400_000;
}

function dedupeAndLimit(merged, limit = 15) {
    merged.sort((a, b) => parsePubDate(b.pubDate) - parsePubDate(a.pubDate));
    const seen = new Set();
    const unique = [];
    for (const a of merged) {
        const k = `${a.title}|${a.link}`;
        if (seen.has(k)) continue;
        seen.add(k);
        unique.push(a);
        if (unique.length >= limit) break;
    }
    return unique;
}

async function fetchAllFeeds({ requireKeyword = true } = {}) {
    const settled = await Promise.allSettled(FEEDS.map((f) => fetchOne(f, { requireKeyword })));
    const merged = [];
    for (const s of settled) {
        if (s.status === 'fulfilled') merged.push(...s.value);
    }
    return merged;
}

/**
 * @returns {Promise<Array<{ title: string, link: string, pubDate: string, source: string }>>}
 */
async function getFloodRelatedNews() {
    const now = Date.now();
    const cacheTtlMs = getCacheTtlMs();
    if (cacheEntry && now - cacheEntry.ts < cacheTtlMs) {
        return cacheEntry.articles;
    }

    try {
        const filtered = dedupeAndLimit(await fetchAllFeeds());
        let articles = filtered;
        if (articles.length === 0) {
            const relaxed = dedupeAndLimit(await fetchAllFeeds({ requireKeyword: false }), 10);
            if (relaxed.length > 0) articles = relaxed;
        }
        cacheEntry = { ts: now, articles };
        return articles;
    } catch (err) {
        if (cacheEntry && now - cacheEntry.ts < getStaleMaxMs()) {
            return cacheEntry.articles;
        }
        throw err;
    }
}

module.exports = {
    getFloodRelatedNews,
    FEEDS,
};
