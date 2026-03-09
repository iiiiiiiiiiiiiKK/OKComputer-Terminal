#!/usr/bin/env python3
"""ETF Price Proxy Server - Yahoo Finance API v8"""
import json
import http.server
import socketserver
import urllib.request
import urllib.parse
import ssl

PORT = 3002

# 全局 SSL 上下文
SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if '/api/quote' in self.path:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # 解析 symbols 参数
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
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
                    
                # 使用 v8 chart API
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
                            
                            # 计算涨跌幅
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
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")

print(f"Starting proxy server on port {PORT}...")
print(f"API endpoint: http://localhost:{PORT}/api/quote?symbols=VT,SPY,QQQ")

with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
    httpd.serve_forever()
