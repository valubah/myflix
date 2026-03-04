const axios = require('axios');
const cheerio = require('cheerio');

const scraper = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    timeout: 10000
});

async function getLatestThenkiri(baseUrl = 'https://thenkiri.com/', page = 1) {
    try {
        let url = baseUrl;
        if (page > 1) {
            url = baseUrl.endsWith('/') ? `${baseUrl}page/${page}/` : `${baseUrl}/page/${page}/`;
        }

        const { data } = await scraper.get(url);
        const $ = cheerio.load(data);
        const movies = [];

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
                        source: baseUrl.includes('.ng') ? 'thenkiri.ng' : 'thenkiri'
                    });
                }
            }
        });

        return movies;
    } catch (error) {
        console.error(`Thenkiri (${baseUrl}) Latest Error:`, error.message);
        return [];
    }
}

module.exports = { getLatestThenkiri };
