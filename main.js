// main.js

// ---- AYARLAR: BU BİLGİLERİ KENDİ SUPABASE PROJENİZDEN ALIN ----
const SUPABASE_URL = 'https://muwqydzmponlsoagasnw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11d3F5ZHptcG9ubHNvYWdhc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDgzNzMsImV4cCI6MjA2ODc4NDM3M30.qvjVdeldF9xCHTyjd8u4AStg2cKCRpTXFmJr62wAbB0';
// ----------------------------------------------------------------
const TELEGRAM_BOT_USERNAME = 'MarginGateBot'; // Örn: MySignalBot

const SYMBOLS = ['BTC/USDT', 'ETH/USDT'];
const CRYPTO_CARDS_CONTAINER = document.getElementById('crypto-cards-container');
let marketData = {};

function initializeCards() {
    CRYPTO_CARDS_CONTAINER.innerHTML = '';
    SYMBOLS.forEach(symbol => {
        const symbolId = symbol.replace('/', '-');
        const card = document.createElement('div');
        card.className = 'card';
        card.id = `card-${symbolId}`;
        card.innerHTML = `
            <div class="crypto-card-header">
                <span class="crypto-symbol">${symbol}</span>
                <span class="crypto-price" id="price-${symbolId}">Yükleniyor...</span>
            </div>
            <div class="signal-status-container" id="status-${symbolId}">
                <div class="searching-signal">Sinyal Aranıyor...</div>
            </div>
        `;
        CRYPTO_CARDS_CONTAINER.appendChild(card);
        marketData[symbol] = { price: 0, lastPrice: 0, signal: null };
    });
    document.querySelector('.telegram-button').href = `https://t.me/${TELEGRAM_BOT_USERNAME}`;
}

async function fetchLivePrices() {
    try {
        const promises = SYMBOLS.map(symbol => 
            fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol.replace('/', '')}`).then(res => res.json())
        );
        const results = await Promise.all(promises);
        results.forEach(data => {
            const symbol = SYMBOLS.find(s => s.replace('/', '') === data.symbol);
            if (symbol) {
                marketData[symbol].lastPrice = marketData[symbol].price;
                marketData[symbol].price = parseFloat(data.price);
            }
        });
    } catch (error) {
        console.error("Fiyatlar çekilirken hata:", error);
    }
}

async function fetchActiveSignals() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/signals?select=*&status=eq.active`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const activeSignals = await response.json();
        SYMBOLS.forEach(symbol => {
            marketData[symbol].signal = activeSignals.find(s => s.symbol === symbol) || null;
        });
    } catch (error) {
        console.error("Sinyaller çekilirken hata:", error);
    }
}

function updateUI() {
    SYMBOLS.forEach(symbol => {
        const symbolId = symbol.replace('/', '-');
        const priceElement = document.getElementById(`price-${symbolId}`);
        const statusContainer = document.getElementById(`status-${symbolId}`);
        const data = marketData[symbol];

        if (priceElement && data.price > 0) {
            priceElement.textContent = `$${data.price.toFixed(2)}`;
            priceElement.classList.toggle('price-up', data.price > data.lastPrice);
            priceElement.classList.toggle('price-down', data.price < data.lastPrice);
        }
        
        if (statusContainer) {
            if (data.signal) {
                const { entry_price, stop_loss, take_profit_2r } = data.signal;
                
                // Minimum ve maksimum fiyatı belirle
                const minPrice = Math.min(stop_loss, take_profit_2r);
                const maxPrice = Math.max(stop_loss, take_profit_2r);
                const totalRange = maxPrice - minPrice;

                // Marker'ların başlangıç pozisyonlarını hesapla
                const calculatePosition = (price) => {
                    if (totalRange === 0) return 0; // Sıfır bölme hatasını önle
                    return ((price - minPrice) / totalRange) * 100;
                };

                const slPos = calculatePosition(stop_loss);
                const entryPos = calculatePosition(entry_price);
                let currentPos = calculatePosition(data.price);
                const tpPos = calculatePosition(take_profit_2r);

                // Anlık fiyat marker'ının aralık dışına taşmasını engelle
                currentPos = Math.max(0, Math.min(100, currentPos));


                // --- YENİ HTML YAPISI ---
                statusContainer.innerHTML = `
                    <div class="progress-bar-area">
                        <div class="price-marker marker-top marker-sl" style="left: ${slPos.toFixed(2)}%;">
                            <span class="marker-label">SL</span>
                            <span class="marker-value">${stop_loss.toFixed(2)}</span>
                        </div>
                        <div class="price-marker marker-top marker-entry" style="left: ${entryPos.toFixed(2)}%;">
                            <span class="marker-label">Giriş</span>
                            <span class="marker-value">${entry_price.toFixed(2)}</span>
                        </div>
                        <div class="price-marker marker-top marker-tp" style="left: ${tpPos.toFixed(2)}%;">
                            <span class="marker-label">TP</span>
                            <span class="marker-value">${take_profit_2r.toFixed(2)}</span>
                        </div>

                        <div class="progress-bar-track"></div>

                        <div class="price-marker marker-bottom marker-current" style="left: ${currentPos.toFixed(2)}%;">
                             <span class="marker-value">${data.price.toFixed(2)}</span>
                        </div>
                    </div>
                `;
            } else {
                statusContainer.innerHTML = `<div class="searching-signal">Sinyal Aranıyor...</div>`;
            }
        }
    });
}

async function mainLoop() {
    await Promise.all([ fetchLivePrices(), fetchActiveSignals() ]);
    updateUI();
}

initializeCards();
mainLoop();
setInterval(mainLoop, 5000);