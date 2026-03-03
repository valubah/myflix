# TheNkiri Movie Scraper

A Netflix-styled web application that scrapes and displays movie download links from TheNkiri.com.

## 🎬 Features

- **Netflix-Inspired UI**: Beautiful dark theme with smooth animations
- **Real-time Scraping**: Fetches actual download links from TheNkiri.com
- **Multiple Categories**: Movies, K-Drama, TV Series, Bollywood, Korean Movies
- **Search Functionality**: Search for specific movies or series
- **Caching System**: 10-minute cache to reduce server load
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Download Links**: Direct access to movie download links

## 🛠️ Tech Stack

### Frontend
- React 18
- Tailwind CSS
- Modern ES6+ JavaScript

### Backend
- Node.js
- Express.js
- Axios (HTTP client)
- Cheerio (Web scraping)
- CORS enabled

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Step 1: Install Dependencies

```bash
npm install
```

This will install:
- express
- axios
- cheerio
- cors

### Step 2: Start the Server

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Step 3: Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## 🚀 API Endpoints

### Get Movies by Category
```
GET /api/movies?category={category}
```

**Categories:**
- `home` - Homepage movies
- `movies` - International movies
- `kdrama` - Korean dramas
- `series` - TV series
- `korean` - Korean movies
- `bollywood` - Bollywood movies

**Response:**
```json
{
  "success": true,
  "movies": [
    {
      "title": "Movie Title",
      "url": "https://thenkiri.com/...",
      "image": "https://...",
      "id": "movie-slug"
    }
  ],
  "cached": false
}
```

### Get Movie Details
```
GET /api/movie/:id?url={movieUrl}
```

**Response:**
```json
{
  "success": true,
  "movie": {
    "title": "Movie Title",
    "synopsis": "Movie description...",
    "downloadLinks": [
      {
        "url": "https://downloadwella.com/...",
        "text": "Download Link",
        "quality": "HD"
      }
    ],
    "fileSize": "283 MB",
    "image": "https://...",
    "genres": ["Action", "Thriller"],
    "url": "https://thenkiri.com/..."
  }
}
```

### Search Movies
```
GET /api/search?q={query}
```

**Response:**
```json
{
  "success": true,
  "movies": [...],
  "query": "search term"
}
```

### Health Check
```
GET /api/health
```

**Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "cache_size": 5
}
```

## 📁 Project Structure

```
thenkiri_backend/
├── server.js           # Express server with scraping logic
├── package.json        # Dependencies and scripts
├── public/
│   └── index.html     # React frontend
└── README.md          # This file
```

## 🎨 Frontend Features

- **Category Navigation**: Switch between different movie categories
- **Search Bar**: Search for specific movies
- **Movie Cards**: Hover effects and smooth animations
- **Movie Modal**: Detailed view with download links
- **Responsive Grid**: Adapts to different screen sizes
- **Loading States**: Skeleton loaders and spinners
- **Error Handling**: User-friendly error messages

## ⚙️ Configuration

### Change Backend Port

Edit `server.js`:
```javascript
const PORT = 3000; // Change to your preferred port
```

### Adjust Cache Duration

Edit `server.js`:
```javascript
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
```

## 🔒 Important Notes

### Legal Disclaimer
This tool is for educational purposes only. Always respect:
- Copyright laws
- Website terms of service
- Intellectual property rights
- Fair use policies

### CORS
The backend enables CORS for all origins. In production, you should restrict this:

```javascript
app.use(cors({
  origin: 'https://yourdomain.com'
}));
```

### Rate Limiting
Consider adding rate limiting to prevent abuse:

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

## 🐛 Troubleshooting

### Server won't start
- Make sure port 3000 is not in use
- Check that all dependencies are installed: `npm install`

### Can't fetch movies
- Check your internet connection
- TheNkiri.com might be down or blocked
- Try clearing the cache by restarting the server

### CORS errors
- Make sure the backend server is running
- Check the `API_URL` in the frontend matches your backend URL

### No download links found
- The movie page structure might have changed
- Check the console for scraping errors
- Try visiting the movie URL manually to verify it exists

## 🚀 Deployment

### Deploy Backend (Heroku)

1. Create a `Procfile`:
```
web: node server.js
```

2. Deploy:
```bash
git init
heroku create your-app-name
git add .
git commit -m "Initial commit"
git push heroku master
```

### Deploy Frontend (Netlify/Vercel)

1. Update `API_URL` in `index.html` to your backend URL
2. Deploy the `public` folder to your hosting service

## 📝 TODO / Future Improvements

- [ ] Add pagination for movie lists
- [ ] Implement user accounts for favorites
- [ ] Add movie ratings and reviews
- [ ] Support for downloading subtitles
- [ ] Add video quality selection
- [ ] Implement advanced filtering
- [ ] Add torrent magnet links
- [ ] Support for more movie sites

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT License - feel free to use this project for learning purposes.

## ⚠️ Disclaimer

This project is for educational purposes only. The developers are not responsible for any misuse of this tool. Always respect copyright laws and the terms of service of websites you scrape.
