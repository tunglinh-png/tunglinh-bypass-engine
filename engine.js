// ============================================================
// TUNG LINH BYPASS ENGINE v1.0.0
// File: engine.js - KHÔNG dùng GM_* APIs
// Chạy trên web thường + GitHub Pages + CDN
// ============================================================

(function(root) {
    'use strict';

    // ============================================================
    // CONFIG
    // ============================================================
    const BT_BUILD_INFO = {
        code: "TL",
        version: "1.0.0",
        label: "TUNG LINH ENGINE"
    };

    const BT_APIS = [
        'https://bypass.tools/bypass?url={URL}',
        'https://evade.bypass.tools/bypass?url={URL}',
        'https://etel.bypass.tools/bypass?url={URL}',
    ];

    const CORS_PROXIES = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?url=',
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://thingproxy.freeboard.io/fetch/',
    ];

    // ============================================================
    // LOG
    // ============================================================
    function log(msg, type) {
        console.log('[TUNG LINH] ' + msg);
        
        // Tự động hiện log trên web nếu có element
        if (typeof document !== 'undefined') {
            const logBox = document.getElementById('bt-log');
            if (logBox) {
                const div = document.createElement('div');
                div.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
                div.style.color = type === 'success' ? '#00ff88' : type === 'error' ? '#ff4444' : '#888';
                logBox.appendChild(div);
                logBox.scrollTop = logBox.scrollHeight;
            }
        }
    }

    // ============================================================
    // UTILS
    // ============================================================
    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    async function fetchWithTimeout(url, options, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout || 15000);
        
        try {
            const response = await fetch(url, { 
                ...options, 
                signal: controller.signal 
            });
            clearTimeout(timeoutId);
            return response;
        } catch(e) {
            clearTimeout(timeoutId);
            throw e;
        }
    }

    // ============================================================
    // TRÍCH XUẤT KEY
    // ============================================================
    function extractKey(text) {
        const patterns = [
            /FREE_[a-f0-9]{32}/gi,
            /key["\s:=]+([a-zA-Z0-9_-]{16,128})/i,
            /"key"\s*:\s*"([a-zA-Z0-9_-]{16,128})"/i,
            /result["\s:=]+([a-zA-Z0-9_-]{16,128})/i,
            /url["\s:=]+(https?:\/\/[^\s"']+)/i,
            /link["\s:=]+(https?:\/\/[^\s"']+)/i,
        ];
        
        for (const p of patterns) {
            const m = text.match(p);
            if (m) return Array.isArray(m) ? m[0] : m[1];
        }
        
        return text.substring(0, 300);
    }

    // ============================================================
    // BYPASS CHÍNH
    // ============================================================
    async function bypassLink(targetUrl) {
        log('Bắt đầu bypass: ' + targetUrl.substring(0, 60));
        
        let result = '';
        
        for (const api of BT_APIS) {
            const url = api.replace('{URL}', encodeURIComponent(targetUrl));
            log('Gọi API: ' + url.substring(0, 60));
            
            // Thử trực tiếp
            try {
                const response = await fetchWithTimeout(url, { mode: 'cors' }, 15000);
                if (response.ok) {
                    const text = await response.text();
                    result = extractKey(text);
                    if (result && result.length > 5) {
                        log('Thành công với API trực tiếp!', 'success');
                        return result;
                    }
                }
            } catch(e) {
                log('CORS chặn - thử proxy...');
            }
            
            // Thử qua proxy
            for (const proxy of CORS_PROXIES) {
                try {
                    const proxyUrl = proxy + encodeURIComponent(url);
                    const response = await fetchWithTimeout(proxyUrl, { mode: 'cors' }, 15000);
                    if (response.ok) {
                        const text = await response.text();
                        result = extractKey(text);
                        if (result && result.length > 5) {
                            log('Thành công với proxy!', 'success');
                            return result;
                        }
                    }
                } catch(e) {
                    log('Proxy lỗi: ' + proxy.substring(0, 30));
                }
            }
            
            await sleep(500);
        }
        
        // Fallback: Fetch link gốc
        log('Thử fetch link gốc...');
        try {
            const response = await fetchWithTimeout(targetUrl, { mode: 'cors' }, 15000);
            if (response.ok) {
                const text = await response.text();
                result = extractKey(text);
                if (result && result.length > 5) {
                    log('Thành công từ link gốc!', 'success');
                    return result;
                }
            }
        } catch(e) {
            log('Không fetch được link gốc');
        }
        
        log('KHÔNG bypass được', 'error');
        return '';
    }

    // ============================================================
    // TẠO UI NẾU CHẠY TRÊN WEB
    // ============================================================
    function createUI() {
        if (typeof document === 'undefined') return;
        
        // Kiểm tra đã có UI chưa
        if (document.getElementById('bt-ui')) return;
        
        const ui = document.createElement('div');
        ui.id = 'bt-ui';
        ui.innerHTML = `
            <style>
                #bt-ui {
                    position: fixed;
                    top: 15px;
                    right: 15px;
                    z-index: 999999;
                    font-family: 'Courier New', monospace;
                }
                .bt-btn {
                    background: linear-gradient(135deg, #00ff88, #00cc66);
                    color: #000;
                    border: none;
                    border-radius: 10px;
                    padding: 12px 20px;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    letter-spacing: 1px;
                    box-shadow: 0 4px 15px rgba(0, 255, 136, 0.4);
                }
                .bt-btn:hover {
                    box-shadow: 0 4px 25px rgba(0, 255, 136, 0.7);
                }
                .bt-result {
                    background: #111;
                    border: 2px solid #ffcc00;
                    border-radius: 10px;
                    padding: 15px;
                    margin-top: 10px;
                    max-width: 350px;
                    display: none;
                    font-size: 12px;
                    color: #fff;
                }
                .bt-result.show { display: block; }
                .bt-key {
                    background: #fff;
                    color: #000;
                    padding: 10px;
                    border-radius: 6px;
                    word-break: break-all;
                    font-weight: 700;
                    margin-top: 8px;
                }
                .bt-copy-btn {
                    width: 100%;
                    padding: 8px;
                    background: #ffcc00;
                    border: none;
                    border-radius: 6px;
                    color: #000;
                    font-weight: 700;
                    cursor: pointer;
                    margin-top: 8px;
                    font-family: 'Courier New', monospace;
                }
                .bt-log {
                    background: rgba(0, 0, 0, 0.9);
                    border: 1px solid #333;
                    border-radius: 8px;
                    padding: 10px;
                    margin-top: 10px;
                    max-width: 350px;
                    max-height: 150px;
                    overflow-y: auto;
                    font-size: 10px;
                    color: #888;
                }
            </style>
            <button class="bt-btn" onclick="window.__btBypass()">⚡ VƯỢT LINK</button>
            <div class="bt-result" id="bt-result">
                <div style="color:#00ff88;font-weight:700;">✅ KẾT QUẢ:</div>
                <div class="bt-key" id="bt-key">...</div>
                <button class="bt-copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('bt-key').textContent)">📋 SAO CHÉP</button>
            </div>
            <div class="bt-log" id="bt-log"></div>
        `;
        
        document.body.appendChild(ui);
        
        // Gán hàm bypass toàn cục
        window.__btBypass = async function() {
            const currentUrl = window.location.href;
            const result = await bypassLink(currentUrl);
            
            const resultBox = document.getElementById('bt-result');
            const keyBox = document.getElementById('bt-key');
            
            if (result && result.length > 5) {
                keyBox.textContent = result;
                resultBox.classList.add('show');
                navigator.clipboard.writeText(result).then(() => {
                    log('Đã tự copy!', 'success');
                }).catch(() => {});
            } else {
                keyBox.textContent = 'Không bypass được';
                resultBox.classList.add('show');
            }
        };
        
        // Tự bypass nếu là link cần vượt
        const currentUrl = window.location.href;
        if (currentUrl.includes('linkvertise') || 
            currentUrl.includes('loot-labs') || 
            currentUrl.includes('loot-link') ||
            currentUrl.includes('rekonise') ||
            currentUrl.includes('boost.ink') ||
            currentUrl.includes('work.ink')) {
            
            log('Phát hiện link cần bypass!');
            setTimeout(() => window.__btBypass(), 2000);
        }
    }

    // ============================================================
    // EXPORT
    // ============================================================
    root.BT_BUILD_INFO = BT_BUILD_INFO;
    root.BT_BYPASS = bypassLink;
    root.BT_createUI = createUI;

    // Tự tạo UI khi load xong
    if (typeof document !== 'undefined') {
        if (document.body) {
            createUI();
        } else {
            document.addEventListener('DOMContentLoaded', createUI);
        }
    }

    log('TUNG LINH ENGINE v' + BT_BUILD_INFO.version + ' đã load!', 'success');

})(typeof window !== 'undefined' ? window : globalThis);