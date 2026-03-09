#!/usr/bin/env python3
"""ETF Price Server - 前端 + API 代理合一"""
import json
import http.server
import socketserver
import urllib.request
import ssl
import os
from pathlib import Path

PORT = 10087
BASE_DIR = Path(__file__).parent

# 全局 SSL 上下文
SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE

class ETFHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/quote'):
            self.handle_quote_api()
        elif self.path == '/' or self.path == '':
            self.path = '/index.html'
            super().do_GET()
        else:
            # Serve static files
            super().do_GET()
    
    def handle_quote_api(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        from urllib.parse import urlparse, parse_qs
        query = urlparse(self.path).query
        params = parse_qs(query)
        symbols = params.get('symbols', [''])[0]
        
        if not symbols:
            self.wfile.write(json.dumps({'error': 'no symbols'}).encode())
            return
        
        symbol_list = symbols.split(',')
        results = []
        
        for symbol in symbol_list:
            symbol = symbol.strip()
            if not symbol:
                continue
            
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=5d"
            
            try:
                req = urllib.request.Request(url, headers={
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                })
                with urllib.request.urlopen(req, timeout=10, context=SSL_CONTEXT) as response:
                    data = json.loads(response.read().decode())
                    
                    if data.get('chart', {}).get('result'):
                        result = data['chart']['result'][0]
                        meta = result.get('meta', {})
                        price = meta.get('regularMarketPrice', 0)
                        prev_close = meta.get('chartPreviousClose', 0)
                        
                        if price and prev_close:
                            change = ((price - prev_close) / prev_close) * 100
                        else:
                            change = 0
                        
                        results.append({
                            'ticker': symbol,
                            'price': round(price, 2) if price else 0,
                            'chg': round(change, 2)
                        })
                    else:
                        results.append({'ticker': symbol, 'price': 0, 'chg': 0, 'error': 'no data'})
            except Exception as e:
                print(f"Error {symbol}: {e}")
                results.append({'ticker': symbol, 'price': 0, 'chg': 0, 'error': str(e)})
        
        self.wfile.write(json.dumps(results).encode())
    
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")

# 设置静态文件目录
os.chdir(BASE_DIR / "dist")

print(f"Starting ETF Terminal on port {PORT}...")
print(f"Web: http://192.168.3.224:{PORT}")
print(f"API: http://192.168.3.224:{PORT}/api/quote?symbols=VT,SPY")

socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("", PORT), ETFHandler) as httpd:
    httpd.serve_forever()
