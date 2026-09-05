const fs = require('fs');
const https = require('https');

const BYPASS_APIS = [
    'https://bypass.tools/bypass?url={URL}',
    'https://evade.bypass.tools/bypass?url={URL}',
    'https://etel.bypass.tools/bypass?url={URL}',
];

// ĐỌC LINK TỪ FILE link.txt
let TARGET_URL = '';
try {
    TARGET_URL = fs.readFileSync('link.txt', 'utf8').trim();
} catch(e) {
    console.log('Không có link.txt');
    process.exit(0);
}

if (!TARGET_URL || TARGET_URL === 'THAY_LINK_CUA_BAN' || TARGET_URL.length < 10) {
    console.log('Chưa có link hợp lệ');
    process.exit(0);
}

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
    });
}

function extractKey(text) {
    const patterns = [
        /FREE_[a-f0-9]{32}/gi,
        /key["\s:=]+([a-zA-Z0-9_-]{16,128})/i,
        /"key"\s*:\s*"([a-zA-Z0-9_-]{16,128})"/i,
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return Array.isArray(m) ? m[0] : m[1];
    }
    return '';
}

async function bypassLink(targetUrl) {
    for (const api of BYPASS_APIS) {
        try {
            const url = api.replace('{URL}', encodeURIComponent(targetUrl));
            const { status, data } = await fetchUrl(url);
            if (status === 200) {
                const key = extractKey(data);
                if (key) return key;
            }
        } catch(e) {}
    }
    return '';
}

async function main() {
    console.log('[TUNG LINH] Link: ' + TARGET_URL.substring(0, 60));
    const key = await bypassLink(TARGET_URL);
    
    const output = {
        date: new Date().toISOString().split('T')[0],
        url: TARGET_URL,
        key: key || 'KHÔNG BYPASS ĐƯỢC',
        timestamp: new Date().toISOString(),
    };
    
    fs.writeFileSync('results.json', JSON.stringify(output, null, 2));
    console.log('[TUNG LINH] Kết quả: ' + (key || 'Thất bại'));
}

main();
