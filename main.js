// main.js (Doğru Geri Sayım Mantığı ile Son Hali)

const SUPABASE_URL = 'https://muwqydzmponlsoagasnw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11d3F5ZHptcG9ubHNvYWdhc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDgzNzMsImV4cCI6MjA2ODc4NDM3M30.qvjVdeldF9xCHTyjd8u4AStg2cKCRpTXFmJr62wAbB0';
const TELEGRAM_BOT_USERNAME = '8216849159:AAFCsDsS9k97NuaTuU1l7i20SDRhLHgiuTA';

// main.js (Güncellenmiş Arayüz ve Konumlandırma)

const SYMBOLS = ['BTC/USDT', 'ETH/USDT'];
const CRYPTO_CARDS_CONTAINER = document.getElementById('crypto-cards-container');
let marketData = {};
let apiCallCounter = 0; // API çağrılarını yavaşlatmak için sayaç (her 10 saniyede bir)

function initializeCards() {
    CRYPTO_CARDS_CONTAINER.innerHTML = '';
    SYMBOLS.forEach(symbol => {
        const symbolId = symbol.replace('/', '-');
        const card = document.createElement('div');
        card.className = 'card';
        card.id = `card-${symbolId}`;
        card.innerHTML = `<div class="crypto-card-header"><span class="crypto-symbol">${symbol}</span><span class="crypto-price" id="price-${symbolId}">Yükleniyor...</span></div><div class="signal-status-container" id="status-${symbolId}"><div class="status-text">Veriler yükleniyor...</div></div>`;
        CRYPTO_CARDS_CONTAINER.appendChild(card);
        marketData[symbol] = { price: 0, lastPrice: 0, signal: null };
    });
    document.querySelector('.telegram-button').href = `https://t.me/${TELEGRAM_BOT_USERNAME}`;
}

async function fetchApiData() {
    try {
        const [pricePromises, signalsResponse] = await Promise.all([
            Promise.all(SYMBOLS.map(symbol => fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol.replace('/', '')}`).then(res => res.json()))),
            fetch(`${SUPABASE_URL}/rest/v1/signals?select=*&status=eq.active`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            })
        ]);

        pricePromises.forEach(data => {
            const symbol = SYMBOLS.find(s => s.replace('/', '') === data.symbol);
            if (symbol) {
                marketData[symbol].lastPrice = marketData[symbol].price;
                marketData[symbol].price = parseFloat(data.price);
            }
        });

        const activeSignals = await signalsResponse.json();
        SYMBOLS.forEach(symbol => {
            marketData[symbol].signal = activeSignals.find(s => s.symbol === symbol) || null;
        });

    } catch (error) {
        console.error("API verileri çekilirken hata:", error);
    }
}

function renderDashboard() {
    const nyTime = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
    const nyHour = nyTime.getHours();
    
    const isScanningTime = nyHour >= 4;

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
                
                // Fiyatları sırala ve en düşük/en yüksek fiyatı bul
                const allPrices = [stop_loss, entry_price, take_profit_2r, data.price];
                const minOverallPrice = Math.min(...allPrices);
                const maxOverallPrice = Math.max(...allPrices);
                const totalRange = maxOverallPrice - minOverallPrice;

                // Konum hesaplama fonksiyonu (0-100 arası yüzde)
                const calculatePosition = (price) => totalRange === 0 ? 50 : ((price - minOverallPrice) / totalRange) * 100;
                
                const slPos = calculatePosition(stop_loss);
                const entryPos = calculatePosition(entry_price);
                const tpPos = calculatePosition(take_profit_2r);
                let currentPos = calculatePosition(data.price);

                statusContainer.innerHTML = `
                    <div class="progress-bar-area">
                        <div class="progress-bar-track"></div>
                        
                        <div class="price-marker marker-top marker-sl" style="left: ${slPos}%;">
                            <span class="marker-label">SL</span><span class="marker-value">${stop_loss.toFixed(2)}</span>
                        </div>
                        <div class="price-marker marker-top marker-entry" style="left: ${entryPos}%;">
                            <span class="marker-label">Giriş</span><span class="marker-value">${entry_price.toFixed(2)}</span>
                        </div>
                        <div class="price-marker marker-top marker-tp" style="left: ${tpPos}%;">
                            <span class="marker-label">TP</span><span class="marker-value">${take_profit_2r.toFixed(2)}</span>
                        </div>
                        <div class="price-marker marker-bottom marker-current" style="left: ${currentPos}%;">
                             <span class="marker-value">${data.price.toFixed(2)}</span>
                        </div>
                    </div>`;
            }
            else if (!isScanningTime) {
                const targetTime = new Date(nyTime);
                targetTime.setHours(4, 0, 0, 0);
                const diff = targetTime - nyTime;
                const h = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
                const m = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
                const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
                
                statusContainer.innerHTML = `<div class="status-text">Tarama başlangıcına kalan süre:<div class="countdown">${h}:${m}:${s}</div></div>`;
            }
            else {
                statusContainer.innerHTML = `<div class="status-text">Sinyal Aranıyor...</div>`;
            }
        }
    });
}

async function masterLoop() {
    if (apiCallCounter % 10 === 0) {
        await fetchApiData();
    }
    renderDashboard();
    apiCallCounter++;
}

initializeCards();
fetchApiData().then(renderDashboard);
setInterval(masterLoop, 1000);