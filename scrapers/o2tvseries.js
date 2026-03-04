const axios = require('axios');
const cheerio = require('cheerio');

const scraper = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    timeout: 10000
});

async function searchO2TvSeries(query) {
    try {
        const searchUrl = `https://o2tvseries.app/search/list_all_tv_series`; // O2TvSeries often uses custom search or a direct A-Z list. 
        // For dynamic search, typically their endpoint is /search.php?sq=<query>
        const queryUrl = `https://o2tvseries.app/search.php?sq=${encodeURIComponent(query)}`;

        let data;
        try {
            const res = await scraper.get(queryUrl);
            data = res.data;
        } catch (e) {
            console.log("Fallback to list search for O2TvSeries");
            // Fallback to fetching index if search block is failing
            const fallbackRes = await scraper.get(`https://o2tvseries.app`);
            data = fallbackRes.data;
        }

        const $ = cheerio.load(data);
        const movies = [];

        // Parse search results - usually divs with class 'data' or lists
        $('div.data, div.data_list, a').each((i, el) => {
            const $el = $(el);
            let title = $el.text().trim();
            let url = $el.attr('href') || $el.find('a').attr('href');

            // If we're parsing all links (fallback), only take those that look like series links
            if (url && url.includes('/') && title && !title.includes('Download') && !title.includes('Home') && (title.toLowerCase().includes(query.toLowerCase()))) {
                const fullUrl = url.startsWith('http') ? url : `https://o2tvseries.app${url.startsWith('/') ? '' : '/'}${url}`;

                movies.push({
                    id: Buffer.from(fullUrl).toString('base64'),
                    title: title,
                    url: fullUrl,
                    image: 'https://via.placeholder.com/200x300/1a1a1a/ffffff?text=O2TvSeries', // O2 often doesn't have cover images in search
                    source: 'o2tvseries'
                });
            }
        });

        // Deduplicate movies by URL
        const uniqueMovies = Array.from(new Map(movies.map(m => [m.url, m])).values());
        return uniqueMovies.slice(0, 15); // Return top 15 matches

    } catch (error) {
        console.error('O2TvSeries Search Error:', error.message);
        return [];
    }
}

async function getO2TvSeriesDetails(seriesUrl) {
    try {
        const { data } = await scraper.get(seriesUrl);
        const $ = cheerio.load(data);

        const title = $('div.header, h1, h2').first().text().trim() || 'O2TvSeries Download';
        const image = $('img').first().attr('src') || 'https://via.placeholder.com/200x300/1a1a1a/ffffff?text=O2TvSeries';

        let synopsis = 'TV Series from O2TvSeries.';
        $('div.summary, p').each((i, el) => {
            const text = $(el).text();
            if (text.length > 50 && !text.includes('Download')) synopsis = text.trim();
        });

        const downloadLinks = [];
        const seenLinks = new Set();

        // O2TvSeries usually lists seasons then episodes. If we're on an episode page, find the d/l link.
        $('a[href*=".mp4"], a[href*=".mkv"], a[href*=".avi"], a[href*="download"]').each((i, el) => {
            const $link = $(el);
            const text = $link.text().trim();
            const href = $link.attr('href');

            if (!href) return;

            const fullUrl = href.startsWith('http') ? href : `https://o2tvseries2.com/${href.startsWith('/') ? href.substring(1) : href}`;

            if (!seenLinks.has(fullUrl)) {
                seenLinks.add(fullUrl);

                let quality = 'Standard';
                if (text.toLowerCase().includes('hd') || fullUrl.includes('HD')) quality = 'HD';
                else if (text.toLowerCase().includes('hdtv')) quality = 'HDTV';

                downloadLinks.push({
                    text: text || 'Download Episode',
                    url: fullUrl,
                    quality,
                    group: 'O2TvSeries Direct Download'
                });
            }
        });

        // If it's a season/show page, grab links to the seasons/episodes
        if (downloadLinks.length === 0) {
            $('div.data a, div.data_list a').each((i, el) => {
                const $link = $(el);
                const text = $link.text().trim();
                const href = $link.attr('href');

                if (href && !href.includes('.jpg') && !href.includes('.png')) {
                    const fullUrl = href.startsWith('http') ? href : `https://o2tvseries2.com/${href.startsWith('/') ? href.substring(1) : href}`;
                    downloadLinks.push({
                        text: `Go To: ${text}`,
                        url: fullUrl,
                        quality: 'Folder',
                        group: 'Seasons & Episodes'
                    });
                }
            });
        }

        return {
            title,
            image,
            synopsis,
            downloadLinks,
            source: 'o2tvseries',
            url: seriesUrl
        };
    } catch (error) {
        console.error('O2TvSeries Details Error:', error.message);
        throw new Error('Failed to fetch O2TvSeries details.');
    }
}

async function getLatestO2TvSeries(page = 1) {
    try {
        const url = page > 1 ? `https://o2tvseries2.com/top-downloads/page/${page}/` : 'https://o2tvseries2.com';
        const { data } = await scraper.get(url);
        const $ = cheerio.load(data);
        const movies = [];

        $('div.data, div.data_list, a').each((i, el) => {
            const $el = $(el);
            let title = $el.text().trim();
            let url = $el.attr('href') || $el.find('a').attr('href');

            if (url && url.includes('/') && title && title.length > 3 && !title.includes('Download') && !title.includes('Home')) {
                const fullUrl = url.startsWith('http') ? url : `https://o2tvseries2.com${url.startsWith('/') ? '' : '/'}${url}`;

                if (!movies.find(m => m.url === fullUrl)) {
                    // Premium branded placeholder for O2TvSeries
                    const placeholder = `https://via.placeholder.com/400x600/121212/e50914?text=O2TvSeries+%7C+${encodeURIComponent(title.split(' ').slice(0, 3).join('+'))}`;

                    movies.push({
                        id: Buffer.from(fullUrl).toString('base64'),
                        title: title,
                        url: fullUrl,
                        image: placeholder,
                        source: 'o2tvseries'
                    });
                }
            }
        });

        return movies;
    } catch (error) {
        console.error('O2TvSeries Latest Error:', error.message);
        return [];
    }
}

module.exports = { searchO2TvSeries, getO2TvSeriesDetails, getLatestO2TvSeries };
