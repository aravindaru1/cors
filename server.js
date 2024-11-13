const express = require('express');
const axios = require('axios');
const cors = require('cors');
const url = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors());

app.get('/serve', async (req, res) => {
    const { url: targetUrl } = req.query;

    if (!targetUrl) {
        return res.status(400).send('URL is required');
    }

    try {
        const response = await axios.get(targetUrl, {
            responseType: 'stream',
            headers: {
                'Referer': 'http://127.0.0.1:5500',
                'Origin': 'http://127.0.0.1:5500',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
            }
        });

        // Forward headers from the response, especially for CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

        // Check if the response is an M3U8 playlist
        if (response.headers['content-type'] && response.headers['content-type'].includes('application/vnd.apple.mpegurl')) {
            // Read the playlist content
            const playlistContent = await new Promise((resolve, reject) => {
                let data = '';
                response.data.on('data', chunk => data += chunk);
                response.data.on('end', () => resolve(data));
                response.data.on('error', reject);
            });

            // Modify the playlist to use the proxy for each segment
            const modifiedPlaylist = playlistContent.replace(/https?:\/\/[^\s]+/g, (match) => {
                const parsedUrl = new URL(match);
                return `${req.protocol}://${req.get('host')}/proxy?url=${encodeURIComponent(parsedUrl.toString())}`;
            });

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.send(modifiedPlaylist);
        } else {
            // Forward the stream for individual segments
            response.data.pipe(res);
        }
    } catch (error) {
        console.error('Error fetching the URL:', error.message);
        res.status(500).send('Error fetching the URL');
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server is running on port ${PORT}`);
});
