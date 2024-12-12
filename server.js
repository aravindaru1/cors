const express = require('express');
const axios = require('axios');
const cors = require('cors');
const puppeteer = require('puppeteer');
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
        console.error('Error serving the request:', error.message);
        res.status(500).send('Error serving the request');
    }
});

// serve for the second API (HLS video)
app.get('/video/:code', async (req, res) => {
    const { code } = req.params;
    const teraboxUrl = `https://core.mdiskplay.com/box/terabox/${code}?aka=baka`;

    try {
        // Fetch the data from the terabox API
        const teraboxResponse = await axios.get(teraboxUrl);
        const sourceUrl = teraboxResponse.data.source;

        // Fetch the m3u8 content from the source URL
        const response = await axios.get(sourceUrl);
        const m3u8Content = response.data;

        // Proxy the inner segments of the m3u8 file
        const proxiedM3u8Content = m3u8Content.replace(
            /https?:\/\/[^\s/$.?#].[^\s]*/g,
            (match) => `https://corsreverse.vercel.app/serve?url=${encodeURIComponent(match)}`
        );

        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(proxiedM3u8Content);
    } catch (error) {
        console.error('Error serving the request:', error.message);
        res.status(500).send('Error serving the request');
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
        console.error('Error serving the request:', error.message);
        res.status(500).send('Error serving the request');
    }
});

// New endpoint to fetch and serve JSON data using Puppeteer
app.get('/info/:code', async (req, res) => {
    const { code } = req.params;
    const urli = `https://www.terabox.com/share/list?app_id=250528&shorturl=${code}&root=1`;
    const url = `https://corsreverse.vercel.app/serve?url=${encodeURIComponent(urli)}`

    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url);

        // Wait for the JSON data to be available in the page
        await page.waitForSelector('body');

        // Extract the JSON data from the page
        const jsonData = await page.evaluate(() => {
            const jsonElement = document.querySelector('body');
            return jsonElement ? jsonElement.innerText : null;
        });

        await browser.close();

        if (!jsonData) {
            return res.status(404).send('JSON data not found');
        }

        res.json(JSON.parse(jsonData));
    } catch (error) {
        console.error('Error serving the request:', error.message);
        res.status(500).send('Error serving the request');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
