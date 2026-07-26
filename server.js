const axios = require('axios');
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ======================
// CẤU HÌNH TỪ ENVIRONMENT (an toàn hơn)
// ======================
const BASE = process.env.BASE_URL || "https://aibcr.me";
const LOGIN_URL = `${BASE}/login`;
const LOBBY_URL = `${BASE}/ae/lobby`;
const GETNEWRESULT_URL = `${BASE}/baccarat/getnewresult`;

const USERNAME = process.env.USERNAME || "tiendatoce1232";
const PASSWORD = process.env.PASSWORD || "tiendatoceee1";

const PORT = process.env.PORT || 5000;
const UPDATE_INTERVAL = process.env.UPDATE_INTERVAL || 2000;

const agent = new https.Agent({ 
    rejectUnauthorized: false,
    keepAlive: true 
});

let cookieJar = '';
let baccaratData = [];
let lastUpdate = null;
let isLoggedIn = false;

// ======================
// SESSION AXIOS (đã tối ưu)
// ======================
const session = axios.create({
    baseURL: BASE,
    timeout: 30000,
    httpsAgent: agent,
    maxRedirects: 5,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br'
    }
});

// Cookie management
session.interceptors.request.use(config => {
    if (cookieJar) config.headers.Cookie = cookieJar;
    return config;
});

session.interceptors.response.use(res => {
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
        setCookie.forEach(cookie => {
            const [cookiePart] = cookie.split(';');
            const [name, ...value] = cookiePart.split('=');
            if (name && value.length > 0) {
                const cookieName = name.trim();
                const cookieValue = value.join('=').trim();
                cookieJar = updateCookie(cookieJar, cookieName, cookieValue);
            }
        });
    }
    return res;
}, error => {
    console.error('Request error:', error.message);
    return Promise.reject(error);
});

function updateCookie(jar, name, value) {
    const regex = new RegExp(`${name}=[^;]*;?\\s*`, 'g');
    return jar.replace(regex, '') + `${name}=${value}; `;
}

// ======================
// UTILS
// ======================
function getCsrfToken(html) {
    const match = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/);
    return match ? match[1] : null;
}

// ======================
// AUTH
// ======================
async function login(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[LOGIN] Attempt ${i + 1}/${retries}...`);
            
            const getResp = await session.get(LOGIN_URL);
            const token = getCsrfToken(getResp.data);
            
            if (!token) {
                console.error('[LOGIN] No CSRF token found');
                continue;
            }
            
            const formData = new URLSearchParams();
            formData.append('username', USERNAME);
            formData.append('password', PASSWORD);
            formData.append('_token', token);
            formData.append('action', 'Login');
            
            const headers = {
                'Referer': LOGIN_URL,
                'Origin': BASE,
                'Content-Type': 'application/x-www-form-urlencoded'
            };
            
            const loginResp = await session.post(LOGIN_URL, formData.toString(), { headers });
            
            if (loginResp.status === 200 && !loginResp.data.includes('error')) {
                isLoggedIn = true;
                console.log('[LOGIN] ✅ Success');
                return true;
            }
        } catch (error) {
            console.error(`[LOGIN] Error: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    return false;
}

async function goToLobby() {
    try {
        const resp = await session.get(LOBBY_URL);
        return resp.status === 200;
    } catch (error) {
        console.error('[LOBBY] Error:', error.message);
        return false;
    }
}

// ======================
// FETCH DATA
// ======================
async function fetchBaccaratData() {
    if (!isLoggedIn) return [];
    
    try {
        let xsrfToken = '';
        const xsrfMatch = cookieJar.match(/XSRF-TOKEN=([^;]+)/);
        if (xsrfMatch) xsrfToken = decodeURIComponent(xsrfMatch[1]);
        
        const headers = {
            'Referer': LOBBY_URL,
            'Origin': BASE,
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        };
        
        const formData = new URLSearchParams();
        formData.append('gameCode', 'ae');
        
        const resp = await session.post(GETNEWRESULT_URL, formData.toString(), { headers });
        
        if (resp.data && resp.data.data && Array.isArray(resp.data.data)) {
            baccaratData = resp.data.data.map(item => ({
                table: item.table_name || 'Unknown',
                result: item.result || '',
                shoeId: item.shoeId || '',
                round: item.round || ''
            }));
            lastUpdate = new Date().toISOString();
            console.log(`[DATA] Updated ${baccaratData.length} tables at ${lastUpdate}`);
        }
        
        return baccaratData;
    } catch (error) {
        console.error('[FETCH] Error:', error.message);
        
        // Nếu session expired, relogin
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.log('[FETCH] Session expired, re-logging in...');
            isLoggedIn = false;
            await login();
            await goToLobby();
        }
        return [];
    }
}

// ======================
// AUTO UPDATE LOOP
// ======================
async function autoUpdate() {
    while (true) {
        if (isLoggedIn) {
            await fetchBaccaratData();
        } else {
            console.log('[UPDATE] Not logged in, attempting login...');
            await login();
            await goToLobby();
        }
        await new Promise(resolve => setTimeout(resolve, UPDATE_INTERVAL));
    }
}

// ======================
// EXPRESS SERVER
// ======================
const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        loggedIn: isLoggedIn,
        lastUpdate: lastUpdate,
        tablesCount: baccaratData.length
    });
});

// API endpoints
app.get('/api/baccarat', (req, res) => {
    res.json({
        success: true,
        data: baccaratData,
        lastUpdate: lastUpdate,
        total: baccaratData.length
    });
});

app.get('/api/baccarat/:table', (req, res) => {
    const tableName = req.params.table;
    const found = baccaratData.find(item => item.table === tableName);
    
    if (found) {
        res.json({ success: true, data: found });
    } else {
        res.status(404).json({ 
            success: false, 
            message: `Table ${tableName} not found`,
            availableTables: baccaratData.map(t => t.table)
        });
    }
});

app.get('/api/latest', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const latest = [...baccaratData].sort((a, b) => {
        const numA = parseInt(a.table) || 0;
        const numB = parseInt(b.table) || 0;
        return numB - numA;
    });
    res.json({ 
        success: true, 
        data: latest.slice(0, limit), 
        lastUpdate: lastUpdate 
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'Baccarat API',
        version: '1.0.0',
        endpoints: {
            all: '/api/baccarat',
            byTable: '/api/baccarat/:table',
            latest: '/api/latest',
            health: '/health'
        }
    });
});

// ======================
// START
// ======================
async function start() {
    console.log('='.repeat(50));
    console.log('🎰 BACCARAT API SERVER');
    console.log('='.repeat(50));
    
    const loginOk = await login();
    if (!loginOk) {
        console.error('❌ Login failed! Starting server anyway...');
    }
    
    await goToLobby();
    await fetchBaccaratData();
    
    // Start auto update
    autoUpdate().catch(console.error);
    
    // Start server
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 Server running on port ${PORT}`);
        console.log(`📍 Health check: http://localhost:${PORT}/health`);
        console.log(`📍 API: http://localhost:${PORT}/api/baccarat`);
        console.log(`⏰ Auto-update every ${UPDATE_INTERVAL}ms\n`);
    });
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

// Start application
start().catch(console.error);
