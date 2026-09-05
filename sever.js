// ============================================================
// SERVER.JS - TUNG LINH BYPASS + AI CHỐNG DDOS
// ============================================================

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// AI CHỐNG DDOS - RATE LIMIT + IP BLOCK
// ============================================================
class AIDDoSProtection {
    constructor() {
        this.requests = new Map();
        this.blockedIPs = new Map();
        this.suspiciousIPs = new Map();
        this.totalRequests = 0;
        this.blockedCount = 0;
    }

    // Kiểm tra IP có bị block không
    isBlocked(ip) {
        const blocked = this.blockedIPs.get(ip);
        if (!blocked) return false;
        if (Date.now() > blocked.until) {
            this.blockedIPs.delete(ip);
            return false;
        }
        return true;
    }

    // Block IP
    blockIP(ip, durationMs) {
        this.blockedIPs.set(ip, {
            until: Date.now() + durationMs,
            reason: 'Rate limit exceeded',
        });
        this.blockedCount++;
    }

    // Kiểm tra rate limit
    checkRateLimit(ip) {
        // Nếu IP đã block
        if (this.isBlocked(ip)) {
            return { allowed: false, reason: 'IP blocked' };
        }

        const now = Date.now();
        const windowMs = 60000; // 1 phút
        const maxRequests = 10; // 10 requests/phút

        // Lấy lịch sử request của IP
        let history = this.requests.get(ip);
        if (!history) {
            history = [];
            this.requests.set(ip, history);
        }

        // Xóa request cũ
        history = history.filter(time => now - time < windowMs);
        this.requests.set(ip, history);

        // Kiểm tra số lượng
        if (history.length >= maxRequests) {
            this.blockIP(ip, 300000); // Block 5 phút
            return { allowed: false, reason: 'Rate limit exceeded - blocked 5 min' };
        }

        // Thêm request mới
        history.push(now);
        this.requests.set(ip, history);
        this.totalRequests++;

        return { allowed: true };
    }

    // Phát hiện bất thường
    detectAnomaly(ip) {
        const history = this.requests.get(ip) || [];
        if (history.length < 3) return false;

        // Kiểm tra thời gian giữa các request
        const intervals = [];
        for (let i = 1; i < history.length; i++) {
            intervals.push(history[i] - history[i-1]);
        }

        // Nếu interval quá nhỏ -> bất thường
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        if (avgInterval < 100) {
            this.suspiciousIPs.set(ip, { count: (this.suspiciousIPs.get(ip)?.count || 0) + 1 });
            return true;
        }

        return false;
    }

    // Lấy IP từ request
    getIP(req) {
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               req.socket.remoteAddress ||
               'unknown';
    }

    // Stats
    getStats() {
        return {
            totalRequests: this.totalRequests,
            blockedCount: this.blockedCount,
            activeBlocked: this.blockedIPs.size,
            suspicious: this.suspiciousIPs.size,
            memoryUsage: process.memoryUsage().heapUsed,
        };
    }
}

const aiProtection = new AIDDoSProtection();

// ============================================================
// MIDDLEWARE CHỐNG DDOS
// ============================================================
app.use((req, res, next) => {
    const ip = aiProtection.getIP(req);
    
    const result = aiProtection.checkRateLimit(ip);
    
    if (!result.allowed) {
        console.log(`[DDOS] Blocked ${ip}: ${result.reason}`);
        return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            reason: result.reason,
            retryAfter: 300,
        });
    }
    
    // Phát hiện bất thường
    if (aiProtection.detectAnomaly(ip)) {
        console.log(`[DDOS] Anomaly detected from ${ip}`);
    }
    
    next();
});

// ============================================================
// CAPTCHA XÁC MINH
// ============================================================
const captchaStore = new Map();

function generateCaptcha() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

app.get('/captcha', (req, res) => {
    const ip = aiProtection.getIP(req);
    const captchaId = crypto.randomUUID();
    const captchaCode = generateCaptcha();
    
    captchaStore.set(captchaId, {
        code: captchaCode,
        ip: ip,
        expires: Date.now() + 300000, // 5 phút
        attempts: 0,
    });
    
    res.json({
        success: true,
        captchaId: captchaId,
        // Không trả về code thực - client tự vẽ captcha
    });
});

app.post('/verify-captcha', (req, res) => {
    const { captchaId, code } = req.body;
    
    if (!captchaId || !code) {
        return res.status(400).json({ success: false, error: 'Thiếu captchaId hoặc code' });
    }
    
    const captcha = captchaStore.get(captchaId);
    
    if (!captcha) {
        return res.status(404).json({ success: false, error: 'Captcha không tồn tại' });
    }
    
    if (Date.now() > captcha.expires) {
        captchaStore.delete(captchaId);
        return res.status(410).json({ success: false, error: 'Captcha hết hạn' });
    }
    
    captcha.attempts++;
    
    if (captcha.attempts > 5) {
        captchaStore.delete(captchaId);
        return res.status(429).json({ success: false, error: 'Quá nhiều lần thử' });
    }
    
    if (captcha.code === code.toUpperCase()) {
        captchaStore.delete(captchaId);
        return res.json({ success: true });
    }
    
    return res.status(400).json({ success: false, error: 'Sai mã captcha' });
});

// ============================================================
// BYPASS APIS
// ============================================================
const BYPASS_APIS = [
    'https://bypass.tools/bypass?url={URL}',
    'https://evade.bypass.tools/bypass?url={URL}',
    'https://etel.bypass.tools/bypass?url={URL}',
];

function extractKey(text) {
    const patterns = [
        /FREE_[a-f0-9]{32}/gi,
        /key["\s:=]+([a-zA-Z0-9_-]{16,128})/i,
        /"key"\s*:\s*"([a-zA-Z0-9_-]{16,128})"/i,
        /result["\s:=]+([a-zA-Z0-9_-]{16,128})/i,
        /url["\s:=]+(https?:\/\/[^\s"']+)/i,
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return Array.isArray(m) ? m[0] : m[1];
    }
    return text.substring(0, 300);
}

async function bypassLink(targetUrl) {
    console.log(`[BYPASS] ${targetUrl.substring(0, 60)}`);
    
    for (const api of BYPASS_APIS) {
        try {
            const url = api.replace('{URL}', encodeURIComponent(targetUrl));
            const response = await axios.get(url, {
                timeout: 20000,
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });
            
            const text = typeof response.data === 'string' 
                ? response.data 
                : JSON.stringify(response.data);
            
            const key = extractKey(text);
            if (key && key.length > 5) return key;
        } catch(e) {
            console.log(`[BYPASS] Lỗi: ${e.message}`);
        }
    }
    
    return '';
}

// ============================================================
// ROUTES
// ============================================================

app.get('/bypass', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ success: false, error: 'Thiếu url' });
    
    try {
        const key = await bypassLink(url);
        if (key) {
            res.json({ success: true, key });
        } else {
            res.status(404).json({ success: false, error: 'Không bypass được' });
        }
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/bypass', async (req, res) => {
    const url = req.body.url;
    if (!url) return res.status(400).json({ success: false, error: 'Thiếu url' });
    
    try {
        const key = await bypassLink(url);
        if (key) {
            res.json({ success: true, key });
        } else {
            res.status(404).json({ success: false, error: 'Không bypass được' });
        }
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'TUNG LINH BYPASS API 24/7',
        time: new Date().toISOString(),
        ai: aiProtection.getStats(),
    });
});

app.get('/stats', (req, res) => {
    res.json(aiProtection.getStats());
});

app.get('/', (req, res) => {
    res.json({
        service: 'TUNG LINH BYPASS API',
        version: '1.0.0',
        endpoints: {
            bypass: '/bypass?url=LINK',
            health: '/health',
            stats: '/stats',
            captcha: '/captcha',
        },
    });
});

// ============================================================
// TỰ PING GIỮ SERVER SỐNG
// ============================================================
setInterval(() => {
    console.log('[PING] Server alive');
}, 300000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[SERVER] TUNG LINH BYPASS API chạy tại cổng ${PORT}`);
    console.log('[AI] DDOS Protection đã kích hoạt');
});