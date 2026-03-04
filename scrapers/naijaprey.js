const axios = require('axios');
const cheerio = require('cheerio');

const scraper = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    timeout: 10000
});

async function searchNaijaPrey(query) {
    try {
        const searchUrl = `https://naijaprey.tv/?s=${encodeURIComponent(query)}`;
        const { data } = await scraper.get(searchUrl);
        const $ = cheerio.load(data);
        const movies = [];

        // Parse search results based on NaijaPrey structure (usually standard WP theme or similar)
        $('article, div.post, div.item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('h2 a, h3 a, a.post-url, a.title').first();
            const title = $link.text().trim() || $el.find('h2, h3').text().trim();
            const url = $link.attr('href') || $el.find('a').first().attr('href');
            const image = $el.find('img').attr('src') || $el.find('img').attr('data-src');

            if (url && title && (title.toLowerCase().includes('movie') || title.toLowerCase().includes('season') || title.toLowerCase().includes('download'))) {
                const fullUrl = url.startsWith('http') ? url : `https://naijaprey.tv${url.startsWith('/') ? '' : '/'}${url}`;

                movies.push({
                    id: Buffer.from(fullUrl).toString('base64'),
                    title: title.replace('Download', '').trim(),
                    url: fullUrl,
                    image: image || 'https://via.placeholder.com/200x300/1a1a1a/ffffff?text=NaijaPrey',
                    source: 'naijaprey'
                });
            }
        });

        // Deduplicate movies by URL
        const uniqueMovies = Array.from(new Map(movies.map(m => [m.url, m])).values());
        return uniqueMovies.slice(0, 5); // Return top 5 matches to avoid overwhelming

    } catch (error) {
        console.error('NaijaPrey Search Error:', error.message);
        return [];
    }
}

async function getNaijaPreyDetails(movieUrl) {
    try {
        const { data } = await scraper.get(movieUrl);
        const $ = cheerio.load(data);

        const title = $('h1').first().text().trim() || 'NaijaPrey Download';
        const image = $('img[class*="wp-post-image"], img[class*="poster"], article img').first().attr('src') || 'https://via.placeholder.com/200x300/1a1a1a/ffffff?text=NaijaPrey';

        let synopsis = 'Movie/Series from NaijaPrey.';
        $('p').each((i, el) => {
            const text = $(el).text();
            if (text.length > 80 && !text.includes('Download') && !text.includes('Click Here')) synopsis = text.trim();
        });

        const downloadLinks = [];
        const seenLinks = new Set();

        $('a[href*="download"], a[href*=".mp4"], a[href*=".mkv"], a.btn, a.download-button').each((i, el) => {
            const $link = $(el);
            const text = $link.text().trim();
            const href = $link.attr('href');

            if (!href) return;

            if (href.includes('google') || href.includes('ads') || href.includes('t.me')) return;

            const fullUrl = href.startsWith('http') ? href : `https://naijaprey.tv/${href}`;

            if (!seenLinks.has(fullUrl)) {
                seenLinks.add(fullUrl);

                let quality = 'Standard';
                if (text.toLowerCase().includes('1080p') || fullUrl.includes('1080')) quality = '1080p';
                else if (text.toLowerCase().includes('720p') || fullUrl.includes('720')) quality = '720p';

                downloadLinks.push({
                    text: text || 'Download Now',
                    url: fullUrl,
                    quality,
                    group: 'NaijaPrey Fast Download'
                });
            }
        });

        return {
            title,
            image,
            synopsis,
            downloadLinks,
            source: 'naijaprey',
            url: movieUrl
        };
    } catch (error) {
        console.error('NaijaPrey Details Error:', error.message);
        throw new Error('Failed to fetch NaijaPrey details.');
    }
}

async function getLatestNaijaPrey() {
    try {
        const { data } = await scraper.get('https://naijaprey.tv/');
        const $ = cheerio.load(data);
        const movies = [];

        $('article, div.post, div.item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('h2 a, h3 a, a.post-url, a.title').first();
            const title = $link.text().trim() || $el.find('h2, h3').text().trim();
            const url = $link.attr('href') || $el.find('a').first().attr('href');
            const image = $el.find('img').attr('src') || $el.find('img').attr('data-src');

            if (url && title) {
                const fullUrl = url.startsWith('http') ? url : `https://naijaprey.tv${url.startsWith('/') ? '' : '/'}${url}`;

                movies.push({
                    id: Buffer.from(fullUrl).toString('base64'),
                    title: title.replace('Download', '').trim(),
                    url: fullUrl,
                    image: image || 'https://via.placeholder.com/200x300/1a1a1a/ffffff?text=NaijaPrey',
                    source: 'naijaprey'
                });
            }
        });

        return movies.slice(0, 10);
    } catch (error) {
        console.error('NaijaPrey Latest Error:', error.message);
        return [];
    }
}

module.exports = { searchNaijaPrey, getNaijaPreyDetails, getLatestNaijaPrey };
