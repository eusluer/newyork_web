// main.js

// ---- AYARLAR: BU BİLGİLERİ KENDİ SUPABASE PROJENİZDEN ALIN ----
const SUPABASE_URL = 'https://muwqydzmponlsoagasnw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11d3F5ZHptcG9ubHNvYWdhc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDgzNzMsImV4cCI6MjA2ODc4NDM3M30.qvjVdeldF9xCHTyjd8u4AStg2cKCRpTXFmJr62wAbB0';
// ----------------------------------------------------------------
const TELEGRAM_BOT_USERNAME = 'MarginGateBot'; // Örn: MySignalBot

// Takip edilecek pariteler
const SYMBOLS = ['BTC/USDT', 'ETH/USDT'];
const CRYPTO_CARDS_CONTAINER = document.getElementById('crypto-cards-container');

// Anlık fiyatları ve sinyalleri tutmak için bir obje
let marketData = {};

/**
 * Sayfa ilk yüklendiğinde parite kartlarını oluşturur
 */
function initializeCards() {
    CRYPTO_CARDS_CONTAINER.innerHTML = '';
    SYMBOLS.forEach(symbol => {
        const symbolId = symbol.replace('/', '-'); // BTC/USDT -> BTC-USDT
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
    // Telegram butonunu ayarla
    document.querySelector('.telegram-button').href = `https://t.me/${TELEGRAM_BOT_USERNAME}`;
}


/**
 * Binance'ten anlık fiyatları çeker
 */
async function fetchLivePrices() {
    try {
        const promises = SYMBOLS.map(symbol => 
            fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol.replace('/', '')}`)
            .then(res => res.json())
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

/**
 * Supabase'den aktif sinyalleri çeker
 */
async function fetchActiveSignals() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/signals?select=*&status=eq.active`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const activeSignals = await response.json();
        
        // Sinyalleri ilgili pariteye ata
        SYMBOLS.forEach(symbol => {
            marketData[symbol].signal = activeSignals.find(s => s.symbol === symbol) || null;
        });

    } catch (error) {
        console.error("Sinyaller çekilirken hata:", error);
    }
}

/**
 * Arayüzü gelen yeni verilere göre günceller
 */
function updateUI() {
    SYMBOLS.forEach(symbol => {
        const symbolId = symbol.replace('/', '-');
        const priceElement = document.getElementById(`price-${symbolId}`);
        const statusContainer = document.getElementById(`status-${symbolId}`);
        
        const data = marketData[symbol];

        // Fiyatı güncelle ve renk ver
        if (priceElement && data.price > 0) {
            priceElement.textContent = `$${data.price.toFixed(2)}`;
            if(data.price > data.lastPrice) {
                priceElement.className = 'crypto-price price-up';
            } else if (data.price < data.lastPrice) {
                priceElement.className = 'crypto-price price-down';
            }
        }
        
        // Sinyal durumunu güncelle
        if (statusContainer) {
            if (data.signal) {
                // Sinyal varsa progress bar'ı göster
                const { entry_price, stop_loss, take_profit_2r } = data.signal;
                const totalRange = Math.abs(take_profit_2r - stop_loss);
                const currentProgress = Math.abs(data.price - stop_loss);
                const progressPercent = (currentProgress / totalRange) * 100;
                
                // Anlık fiyatın Stop Loss'a olan uzaklığı
                const currentPosPercent = (Math.abs(data.price - stop_loss) / totalRange) * 100;
                // Giriş fiyatının Stop Loss'a olan uzaklığı
                const entryPosPercent = (Math.abs(entry_price - stop_loss) / totalRange) * 100;

                statusContainer.innerHTML = `
                    <div class="progress-bar-container">
                        <div class="price-marker marker-sl" style="left: 0%;">SL<br>${stop_loss.toFixed(2)}</div>
                        <div class="price-marker marker-entry" style="left: ${entryPosPercent.toFixed(2)}%;">Giriş<br>${entry_price.toFixed(2)}</div>
                        <div class="price-marker marker-current" style="left: ${currentPosPercent.toFixed(2)}%;">Anlık<br>${data.price.toFixed(2)}</div>
                        <div class="price-marker marker-tp" style="left: 100%;">TP<br>${take_profit_2r.toFixed(2)}</div>
                        <div class="progress-bar-track"></div>
                    </div>
                `;
            } else {
                // Sinyal yoksa "Sinyal Aranıyor" göster
                statusContainer.innerHTML = `<div class="searching-signal">Sinyal Aranıyor...</div>`;
            }
        }
    });
}


/**
 * Ana döngüyü başlatan fonksiyon
 */
async function mainLoop() {
    await Promise.all([
        fetchLivePrices(),
        fetchActiveSignals()
    ]);
    updateUI();
}

// Sayfa ilk yüklendiğinde kartları oluştur ve döngüyü başlat
initializeCards();
mainLoop();
setInterval(mainLoop, 5000); // Her 5 saniyede bir tüm verileri güncelle