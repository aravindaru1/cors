

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
    const url = `https://corsreverse.vercel.app/serve?url=https://www.1024terabox.com/api/shorturlinfo?app_id=250528&web=1&channel=dubox&clienttype=0&jsToken=6AA124E7CCFBCDF411EF530A6C0949ABDF8A281CEAE373584815D693A04F470819CD03A9765D1B673E4F019BAC8D6857951362D57F6A883C5E98478D1996EA917356C9984AEE598FEA2D34CC52743336ED740F79766B1247A339BC7B979F9C96&dp-logid=56716800478506330002&shorturl=1${code}&root=1&scene=`;

    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        // Set necessary headers and cookies
        await page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.1024terabox.com/',
            'Origin': 'https://www.1024terabox.com'
        });

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
