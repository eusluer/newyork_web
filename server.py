
import http.server
import socketserver
import os

# Railway'in bize atayacağı portu kullan, eğer yoksa lokal test için 8080 kullan
PORT = int(os.environ.get('PORT', 8080))

# Bu, klasördeki dosyaları sunmamızı sağlayan basit bir sunucu yöneticisidir
Handler = http.server.SimpleHTTPRequestHandler

# Sunucuyu başlat ve sonsuza kadar çalıştır
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Sunucu port {PORT} üzerinde başlatıldı.")
    httpd.serve_forever()