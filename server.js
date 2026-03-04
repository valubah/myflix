const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
// Import new scrapers
const { searchFzMovies, getFzMovieDetails, getLatestFzMovies } = require('./scrapers/fzmovies');
const { searchO2TvSeries, getO2TvSeriesDetails, getLatestO2TvSeries } = require('./scrapers/o2tvseries');
const { searchNaijaPrey, getNaijaPreyDetails, getLatestNaijaPrey } = require('./scrapers/naijaprey');
const { getLatestThenkiri } = require('./scrapers/thenkiri');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Visitor tracking state
const stats = {
    totalPageViews: 0,
    uniqueVisitors: new Set(),
};

// Middleware to track visitors
app.use((req, res, next) => {
    // Only track API requests to stats, movies, and search
    if (req.path.startsWith('/api') && !req.path.includes('health') && !req.path.includes('stats')) {
        stats.totalPageViews++;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        stats.uniqueVisitors.add(ip);
    }
    next();
});

// Cache to store scraped data temporarily
const cache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Helper function to get cached data
function getCachedData(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

// Helper function to set cached data
function setCachedData(key, data) {
    cache.set(key, {
        data,
        timestamp: Date.now()
    });
}

// Fetch movies from homepage or category or source
app.get('/api/movies', async (req, res) => {
    try {
        const category = req.query.category || 'home';
        const source = req.query.source;
        const page = parseInt(req.query.page) || 1;

        console.log(`[API] /api/movies - Category: ${category}, Source: ${source}, Page: ${page}`);

        const cacheKey = `movies_${category}_source_${source}_page_${page}`;

        // Check cache first
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
            return res.json({ success: true, movies: cachedData, cached: true });
        }

        const categoryUrls = {
            'home': 'https://thenkiri.com/',
            'movies': 'https://thenkiri.com/category/international/',
            'kdrama': 'https://nkiri.ink/korean-drama-menu/',
            'series': 'https://nkiri.ink/tv-series-menu/',
            'korean': 'https://thenkiri.com/category/asian-movies/download-korean-movies/',
            'bollywood': 'https://thenkiri.com/category/asian-movies/download-bollywood-movies/',
            'animation': 'https://nkiri.ink/tag/animation/',
            'nollywood': 'https://thenkiri.ng/category/nollywood/',
            'southafrica': 'https://thenkiri.ng/category/south-africa/',
            'adult': 'https://thenkiri.ng/tag/filipino/', // Filipino movies are often tagged this way, or use adult-archives
        };

        let movies = [];

        // If a specific source is requested, use that scraper
        if (source) {
            if (source === 'fzmovies') {
                movies = await getLatestFzMovies(page);
            } else if (source === 'o2tvseries') {
                movies = await getLatestO2TvSeries(page);
            } else if (source === 'naijaprey') {
                movies = await getLatestNaijaPrey(page);
            } else if (source === 'thenkiri') {
                movies = await getLatestThenkiri('https://thenkiri.com/', page);
            } else if (source === 'thenkiri.ng') {
                movies = await getLatestThenkiri('https://thenkiri.ng/', page);
            } else if (source === 'adult') {
                // Filipinos movies on thenkiri.ng are 18+, searching for 'Filipino' is most reliable
                const { searchThenkiri } = require('./scrapers/thenkiri');
                movies = await searchThenkiri('https://thenkiri.ng/', 'Filipino');
            }
        } else if (category === 'adult') {
            // Filipinos movies on thenkiri.ng are 18+
            // Try the tag first as it's more accurate
            movies = await getLatestThenkiri('https://thenkiri.ng/tag/filipino/', page);
            
            // Fallback to search if tag is empty
            if (movies.length === 0) {
                const { searchThenkiri } = require('./scrapers/thenkiri');
                movies = await searchThenkiri('https://thenkiri.ng/', 'Filipino');
            }
        } else if (category === 'home' && page === 1) {
            // Default home aggregation if no source specified
            const results = await Promise.allSettled([
                getLatestThenkiri('https://thenkiri.com/'),
                getLatestThenkiri('https://thenkiri.ng/'),
                getLatestFzMovies(),
                getLatestO2TvSeries(),
                getLatestNaijaPrey()
            ]);

            results.forEach(res => {
                if (res.status === 'fulfilled') {
                    movies = movies.concat(res.value);
                }
            });

            // Shuffle results for variety
            movies = movies.sort(() => Math.random() - 0.5);
        } else {
            // Standard category scraping (backward compatibility or full category view)
            let url = categoryUrls[category] || categoryUrls['home'];

            // Special case for adult category if it needs specific handling
            if (category === 'adult') {
                url = 'https://thenkiri.ng/tag/filipino/';
            }

            // Handle pagination for thenkiri-style URLs
            if (page > 1) {
                if (url.endsWith('/')) {
                    url += `page/${page}/`;
                } else {
                    url += `/page/${page}/`;
                }
            }

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const $ = cheerio.load(response.data);

            $('article').each((index, element) => {
                const $article = $(element);
                const $title = $article.find('h2 a, h5 a').first();
                const $image = $article.find('img').first();

                if ($title.length) {
                    const title = $title.text().trim();
                    const movieUrl = $title.attr('href');
                    let imageUrl = $image.attr('src') || $image.attr('data-src') || '';

                    if (!imageUrl || imageUrl.includes('lazy')) {
                        imageUrl = $image.attr('data-lazy-src') || $image.attr('data-src') || '';
                    }

                    if (movieUrl && title) {
                        movies.push({
                            title,
                            url: movieUrl,
                            image: imageUrl,
                            id: movieUrl.split('/').filter(Boolean).pop(),
                            source: url.includes('.ng') ? 'thenkiri.ng' : 'thenkiri'
                        });
                    }
                }
            });
        }

        // Cache the results
        setCachedData(cacheKey, movies);

        res.json({ success: true, movies, cached: false });
    } catch (error) {
        console.error('Error fetching movies:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});


// Fetch download links for a specific movie
app.get('/api/movie/:id', async (req, res) => {
    try {
        const movieId = req.params.id;
        const movieUrl = req.query.url;

        if (!movieUrl) {
            return res.status(400).json({ success: false, error: 'Movie URL is required' });
        }

        const source = req.query.source || 'thenkiri'; // Identify scraper to use
        const cacheKey = `movie_${source}_${movieId}`;

        // Check cache first
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
            return res.json({ success: true, movie: cachedData, cached: true });
        }

        let movieData;

        if (source === 'fzmovies') {
            movieData = await getFzMovieDetails(movieUrl);
        } else if (source === 'o2tvseries') {
            movieData = await getO2TvSeriesDetails(movieUrl);
        } else if (source === 'naijaprey') {
            movieData = await getNaijaPreyDetails(movieUrl);
        } else if (source === 'thenkiri.ng' || source === 'thenkiri') {
            // Both .com and .ng use same structure mostly
            const response = await axios.get(movieUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const $ = cheerio.load(response.data);

            // Extract movie details
            const title = $('h1').first().text().trim() || $('title').text().trim();

            // Enhanced synopsis extraction
            let synopsis = '';
            const synopsisHeader = $('h2:contains("Synopsis"), h3:contains("Synopsis"), p strong:contains("Synopsis")').first();
            if (synopsisHeader.length) {
                let current = synopsisHeader.parent().is('h2, h3') ? synopsisHeader : synopsisHeader.parent();
                current = current.next();
                while (current.length && !current.is('h2, h3, div.elementor-widget')) {
                    if (current.is('p')) {
                        const text = current.text().trim();
                        if (text && !text.toLowerCase().includes('download')) {
                            synopsis += text + '\n\n';
                        }
                    }
                    current = current.next();
                }
            }

            if (!synopsis) {
                synopsis = $('.entry-content p').first().text().trim();
            }

            // Extract trailer
            let trailerUrl = '';
            const videoWidget = $('.elementor-widget-video').first();
            if (videoWidget.length) {
                try {
                    const settings = JSON.parse(videoWidget.attr('data-settings') || '{}');
                    if (settings.youtube_url) {
                        trailerUrl = settings.youtube_url;
                    }
                } catch (e) {
                    console.error('Error parsing video settings:', e.message);
                }
            }

            if (!trailerUrl) {
                const ytIframe = $('iframe[src*="youtube.com"], iframe[src*="youtu.be"]').first();
                if (ytIframe.length) {
                    trailerUrl = ytIframe.attr('src');
                }
            }

            // Convert trailer URL to embed format if needed
            if (trailerUrl && trailerUrl.includes('watch?v=')) {
                const videoId = trailerUrl.split('v=')[1]?.split('&')[0];
                if (videoId) trailerUrl = `https://www.youtube.com/embed/${videoId}`;
            } else if (trailerUrl && trailerUrl.includes('youtu.be/')) {
                const videoId = trailerUrl.split('youtu.be/')[1]?.split('?')[0];
                if (videoId) trailerUrl = `https://www.youtube.com/embed/${videoId}`;
            }

            // Extract download links
            const downloadLinks = [];
            const seenLinks = new Set();

            $('a').each((index, element) => {
                const $link = $(element);
                const href = $link.attr('href');
                if (!href) return;

                const text = $link.text().trim();
                const parentText = $link.parent().text().trim();
                const combinedText = (text + ' ' + parentText).toLowerCase();

                // Strict filtering: must be a known download host or have specific path
                const isDownloadHost = href.includes('downloadwella.com') ||
                    href.includes('nkiri.com/download') ||
                    href.includes('nkiri.ink/download') ||
                    href.includes('dl.thenkiri.com') ||
                    href.includes('sabishares.com') ||
                    href.includes('sabimesh.com');
                const isDownloadText = combinedText.includes('download') || combinedText.includes('episode') || combinedText.includes('server') || combinedText.includes('quality') || combinedText.includes('mirror');
                const isFileDownload = href.toLowerCase().endsWith('.mkv') || href.toLowerCase().endsWith('.mp4');

                if (
                    (isDownloadHost || isFileDownload) &&
                    isDownloadText &&
                    !href.includes('how-to-download') &&
                    !combinedText.includes('how to download') &&
                    !combinedText.includes('telegram') &&
                    !combinedText.includes('join') &&
                    !combinedText.includes('contact') &&
                    !href.endsWith('.png') && !href.endsWith('.jpg') && !href.endsWith('.jpeg')
                ) {
                    if (!seenLinks.has(href)) {
                        seenLinks.add(href);

                        let label = text || 'Download Source';
                        let group = 'Movie';

                        // Better episode detection
                        const epMatch = combinedText.match(/episode\s*(\d+)/i) || parentText.match(/Episode\s*(\d+)/i);
                        if (epMatch) {
                            group = `Episode ${epMatch[1]}`;
                            label = `Download Episode ${epMatch[1]}`;
                        }

                        downloadLinks.push({
                            url: href,
                            text: label,
                            group: group,
                            quality: extractQuality(combinedText, href)
                        });
                    }
                }
            });

            // Extract file size
            let fileSize = '';
            $('p, div, span').each((index, element) => {
                const text = $(element).text();
                const sizeMatch = text.match(/(\d+\.?\d*\s?(MB|GB|KB))/i);
                if (sizeMatch && !fileSize) {
                    fileSize = sizeMatch[0];
                }
            });

            // Extract image
            const image = $('.wp-post-image, article img, .entry-content img').first().attr('src') || '';

            // Extract genres/tags
            const genres = [];
            $('.post-tags a, .tags a, a[rel="tag"]').each((index, element) => {
                const genre = $(element).text().trim();
                if (genre) genres.push(genre);
            });

            if (source === 'thenkiri' || !movieData) {
                movieData = {
                    title,
                    synopsis: synopsis.trim(),
                    trailerUrl,
                    downloadLinks,
                    fileSize,
                    image,
                    genres: genres.slice(0, 5),
                    url: movieUrl,
                    source: source === 'thenkiri.ng' ? 'thenkiri.ng' : 'thenkiri'
                };
            }
        }

        // Cache the results
        setCachedData(cacheKey, movieData);

        res.json({ success: true, movie: movieData, cached: false });
    } catch (error) {
        console.error('Error fetching movie details:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Search movies
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;

        if (!query) {
            return res.status(400).json({ success: false, error: 'Search query is required' });
        }

        const searchUrl = `https://thenkiri.com/?s=${encodeURIComponent(query)}`;

        const [nkiriResponse, fzMovies, o2TvSeries, naijaPrey] = await Promise.allSettled([
            axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            }),
            getLatestThenkiri('https://thenkiri.ng/'), // Search .ng too
            searchFzMovies(query),
            searchO2TvSeries(query),
            searchNaijaPrey(query)
        ]);

        let movies = [];

        // Parse TheNkiri Results
        if (nkiriResponse.status === 'fulfilled') {
            const $ = cheerio.load(nkiriResponse.value.data);
            $('article').each((index, element) => {
                const $article = $(element);
                const $title = $article.find('h2 a, h5 a').first();
                const $image = $article.find('img').first();
                if ($title.length) {
                    const title = $title.text().trim();
                    const movieUrl = $title.attr('href');
                    let imageUrl = $image.attr('src') || $image.attr('data-src') || '';
                    if (movieUrl && title) {
                        movies.push({
                            title,
                            url: movieUrl,
                            image: imageUrl,
                            id: movieUrl.split('/').filter(Boolean).pop(),
                            source: 'thenkiri'
                        });
                    }
                }
            });
        }

        // Aggregate results from FzMovies, O2TvSeries, NaijaPrey, and Thenkiri.ng
        if (fzMovies.status === 'fulfilled') movies = movies.concat(fzMovies.value);
        if (o2TvSeries.status === 'fulfilled') movies = movies.concat(o2TvSeries.value);
        if (naijaPrey.status === 'fulfilled') movies = movies.concat(naijaPrey.value);
        if (nkiriResponse.status === 'fulfilled' && Array.isArray(nkiriResponse.value)) {
            // If nkiriResponse returned an array (from getLatestThenkiri call in search)
            movies = movies.concat(nkiriResponse.value);
        }

        res.json({ success: true, movies, query });
    } catch (error) {
        console.error('Error searching movies:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function to extract quality from text
function extractQuality(text, url) {
    const combined = (text + ' ' + url).toLowerCase();

    if (combined.includes('4k') || combined.includes('2160p')) return '4K';
    if (combined.includes('1080p')) return '1080p';
    if (combined.includes('720p')) return '720p';
    if (combined.includes('480p')) return '480p';
    if (combined.includes('360p')) return '360p';
    if (combined.includes('hd')) return 'HD';

    return 'Standard';
}

// Resolve intermediate download links to final file URLs
app.get('/api/resolve-download', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

        console.log(`Resolving link: ${url}`);

        // Handle DownloadWella
        if (url.includes('downloadwella.com')) {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            const form = $('form[name="F1"]');

            if (form.length) {
                const formData = new URLSearchParams();
                form.find('input[type="hidden"]').each((i, el) => {
                    const name = $(el).attr('name');
                    const value = $(el).attr('value') || '';
                    if (name) formData.append(name, value);
                });

                // Sometimes we need to click the "Free Download" button or wait
                // but let's try a direct POST first
                const postResponse = await axios.post(url, formData.toString(), {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    maxRedirects: 0,
                    validateStatus: (status) => status >= 200 && status < 400
                });

                // If redirected, that might be the file
                if (postResponse.status === 302 && postResponse.headers.location) {
                    return res.json({ success: true, directUrl: postResponse.headers.location });
                }

                // Check the response HTML for a direct link or a button with the direct link
                const $post = cheerio.load(postResponse.data);

                // Look for links that usually point to the file
                const potentialLinks = [];
                $post('a').each((i, el) => {
                    const h = $post(el).attr('href');
                    if (h) {
                        const hLow = h.toLowerCase();
                        // Ignore base domains or non-file links
                        if (hLow === 'https://downloadwella.com' || hLow === 'https://downloadwella.com/') return;

                        if (h.includes('dl.thenkiri.com') || h.includes('/dl/') || h.endsWith('.mkv') || h.endsWith('.mp4')) {
                            potentialLinks.push(h);
                        }
                    }
                });

                if (potentialLinks.length > 0) {
                    // Prioritize dl.thenkiri.com
                    const direct = potentialLinks.find(l => l.includes('dl.thenkiri.com')) || potentialLinks[0];
                    return res.json({ success: true, directUrl: direct, resolved: true });
                }
            }
        }

        // Fallback: Return original URL if resolution fails
        res.json({ success: true, directUrl: url, resolved: false });
    } catch (error) {
        console.error('Error resolving download link:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Visitor stats endpoint
app.get('/api/stats', (req, res) => {
    res.json({
        success: true,
        totalPageViews: stats.totalPageViews,
        uniqueVisitors: stats.uniqueVisitors.size
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server is running', cache_size: cache.size });
});

// Serve static frontend
app.use(express.static('public'));

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 TheNkiri Scraper API running on http://localhost:${PORT}`);
        console.log(`📡 API endpoints:`);
        console.log(`   - GET /api/movies?category=home`);
        console.log(`   - GET /api/movie/:id?url=<movie_url>`);
        console.log(`   - GET /api/resolve-download?url=<download_url>`);
        console.log(`   - GET /api/search?q=<query>`);
        console.log(`   - GET /api/health`);
    });
}

// Export for serverless integration
module.exports = app;
