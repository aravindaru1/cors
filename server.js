
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());

// serve for the first API
app.get('/terabox/:code', async (req, res) => {
    const { code } = req.params;
    const url = `https://core.mdiskplay.com/box/terabox/${code}?aka=baka`;

    try {
        const response = await axios.get(url);
        res.send(response.data);
    } catch (error) {
        res.status(500).send('Error serveing the request');
    }
});

// serve for the second API (HLS video)
app.get('/video/:code', async (req, res) => {
    const { code } = req.params;
    const url = `https://video.mdiskplay.com/${code}.m3u8`;

    try {
        const response = await axios.get(url);
        const m3u8Content = response.data;

        // serve the inner segments of the m3u8 file
        const proxiedM3u8Content = m3u8Content.replace(
            /https?:\/\/[^\s/$.?#].[^\s]*/g,
            (match) => `https://corsreverse.vercel.app/serve?url=${encodeURIComponent(match)}`
        );

        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(proxiedM3u8Content);
    } catch (error) {
        res.status(500).send('Error serveing the request');
    }
});

// serve for the inner segments of the m3u8 file
app.get('/serve', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('URL parameter is missing');
    }

    try {
        const response = await axios.get(url, { responseType: 'stream' });
        response.data.pipe(res);
    } catch (error) {
        res.status(500).send('Error serveing the request');
    }
});

app.listen(PORT, () => {
});
