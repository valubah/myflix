const axios = require('axios');
const cheerio = require('cheerio');

// Create an axios instance with headers to mimic a real browser
const scraper = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 10000
});

async function searchFzMovies(query) {
    try {
        const searchUrl = `https://www.fzmovies.net/csearch.php?searchname=${encodeURIComponent(query)}&searchby=Name`;
        const { data } = await scraper.get(searchUrl);
        const $ = cheerio.load(data);
        const movies = [];

        // FzMovies typically uses tables or specific divs for search results
        $('.moviefilm').each((i, el) => {
            const $movie = $(el);
            const titleElement = $movie.find('a').first();
            const title = titleElement.text().trim();
            const url = titleElement.attr('href');
            let image = $movie.find('img').attr('src');

            if (url && title) {
                // Fix relative URLs
                const fullUrl = url.startsWith('http') ? url : `https://www.fzmovies.net/${url}`;
                if (image && !image.startsWith('http')) {
                    image = `https://www.fzmovies.net/${image}`;
                }

                movies.push({
                    id: Buffer.from(fullUrl).toString('base64'), // Use base64 URL as ID for safe routing
                    title: title.replace('...', '').trim(),
                    url: fullUrl,
                    image: image || 'https://via.placeholder.com/200x300/1a1a1a/ffffff?text=No+Image',
                    source: 'fzmovies'
                });
            }
        });

        // Fallback parser if .moviefilm gives no results (fzmovies changes DOM often)
        if (movies.length === 0) {
            $('div[style*="text-align:left;"], div.movies').each((i, el) => {
                const $link = $(el).find('a').first();
                if ($link.length) {
                    const title = $link.text().trim();
                    const url = $link.attr('href');
                    if (title && url && url.includes('movie')) {
                        const fullUrl = url.startsWith('http') ? url : `https://www.fzmovies.net/${url}`;
                        movies.push({
                            id: Buffer.from(fullUrl).toString('base64'),
                            title,
                            url: fullUrl,
                            image: 'https://via.placeholder.com/200x300/1a1a1a/ffffff?text=FzMovies',
                            source: 'fzmovies'
                        });
                    }
                }
            });
        }

        return movies;
    } catch (error) {
        console.error('FzMovies Search Error:', error.message);
        return [];
    }
}

async function getFzMovieDetails(movieUrl) {
    try {
        const { data } = await scraper.get(movieUrl);
        const $ = cheerio.load(data);

        const title = $('h1').first().text().trim() || $('title').text().replace('Fzmovies', '').trim();
        let image = $('img[alt*="cover"], img[src*="posters"]').first().attr('src');
        if (image && !image.startsWith('http')) {
            image = `https://www.fzmovies.net/${image}`;
        }

        let synopsis = '';
        $('div, span, p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Plot:') || text.includes('Synopsis:')) {
                synopsis = text.replace('Plot:', '').replace('Synopsis:', '').trim();
            }
        });

        const downloadLinks = [];
        const seenLinks = new Set();

        $('a[id*="download"], a[href*="download"], a').each((i, el) => {
            const $link = $(el);
            const text = $link.text().trim().toLowerCase();
            const href = $link.attr('href');

            if (!href) return;

            // FzMovies specific download patterns
            const isDownloadHost = href.includes('fzdn') || href.includes('bdu02') || href.includes('dl') || href.includes('fzmovies.net/download');
            const isQualityText = text.includes('720p') || text.includes('480p') || text.includes('1080p') || text.includes('mp4') || text.includes('mkv');

            if (isDownloadHost || isQualityText || text.includes('download')) {
                // Ensure absolute URL
                const fullUrl = href.startsWith('http') ? href : `https://www.fzmovies.net/${href}`;

                if (!seenLinks.has(fullUrl) && !fullUrl.includes('google') && !fullUrl.includes('ads')) {
                    seenLinks.add(fullUrl);

                    let quality = 'Standard';
                    if (text.includes('1080p') || fullUrl.includes('1080')) quality = '1080p';
                    else if (text.includes('720p') || fullUrl.includes('720')) quality = '720p';
                    else if (text.includes('480p') || fullUrl.includes('480')) quality = '480p';

                    downloadLinks.push({
                        text: $link.text().trim() || `Download ${quality}`,
                        url: fullUrl,
                        quality,
                        group: 'FzMovies Direct Download' // USP: Direct downloads
                    });
                }
            }
        });

        return {
            title,
            image: image || 'https://via.placeholder.com/200x300/1a1a1a/ffffff?text=No+Image',
            synopsis,
            downloadLinks,
            source: 'fzmovies',
            url: movieUrl
        };
    } catch (error) {
        console.error('FzMovies Details Error:', error.message);
        throw new Error('Failed to fetch FzMovies details.');
    }
}

async function getLatestFzMovies() {
    try {
        const { data } = await scraper.get('https://www.fzmovies.net/');
        const $ = cheerio.load(data);
        const movies = [];

        $('.moviefilm').each((i, el) => {
            const $movie = $(el);
            const titleElement = $movie.find('a').first();
            const title = titleElement.text().trim();
            const url = titleElement.attr('href');
            let image = $movie.find('img').attr('src');

            if (url && title) {
                const fullUrl = url.startsWith('http') ? url : `https://www.fzmovies.net/${url}`;
                if (image && !image.startsWith('http')) {
                    image = `https://www.fzmovies.net/${image}`;
                }

                movies.push({
                    id: Buffer.from(fullUrl).toString('base64'),
                    title: title.replace('...', '').trim(),
                    url: fullUrl,
                    image: image || 'https://via.placeholder.com/200x300/1a1a1a/ffffff?text=FzMovies',
                    source: 'fzmovies'
                });
            }
        });

        return movies.slice(0, 10);
    } catch (error) {
        console.error('FzMovies Latest Error:', error.message);
        return [];
    }
}

module.exports = { searchFzMovies, getFzMovieDetails, getLatestFzMovies };
