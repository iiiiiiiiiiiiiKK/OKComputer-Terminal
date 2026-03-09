#!/usr/bin/env python3
"""ETF Market Data API - 支持用户添加自定义ETF"""
import json
import http.server
import socketserver
import urllib.request
import ssl
import os
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import threading

PORT = 3001

# ETF 列表（默认）
ETF_DATA = {
    "VT": {"name": "Vanguard Total World Stock Index Fund ETF", "category": "Global Markets"},
    "ACWI": {"name": "iShares MSCI ACWI ETF", "category": "Global Markets"},
    "ACWX": {"name": "iShares MSCI ACWI ex US ETF", "category": "Global Markets"},
    "VTI": {"name": "Vanguard Total Stock Market Index Fund ETF", "category": "U.S. Market"},
    "SPY": {"name": "State Street SPDR S&P 500 ETF Trust", "category": "U.S. Market"},
    "QQQ": {"name": "Invesco QQQ Trust, Series 1", "category": "U.S. Market"},
    "EFA": {"name": "iShares MSCI EAFE ETF", "category": "Developed Markets"},
    "EZU": {"name": "iShares MSCI Eurozone ETF", "category": "Developed Markets"},
    "EWU": {"name": "iShares MSCI United Kingdom ETF", "category": "Developed Markets"},
    "EWG": {"name": "iShares MSCI Germany ETF", "category": "Developed Markets"},
    "EWJ": {"name": "iShares MSCI Japan ETF", "category": "Developed Markets"},
    "EEM": {"name": "iShares MSCI Emerging Markets ETF", "category": "Emerging Markets"},
    "MCHI": {"name": "iShares MSCI China ETF", "category": "China Market"},
    "FXI": {"name": "iShares China Large-Cap ETF", "category": "China Market"},
    "KWEB": {"name": "KraneShares CSI China Internet ETF", "category": "China Market"},
    "VNQ": {"name": "Vanguard Real Estate Index Fund ETF", "category": "Real Estate"},
    "SCHD": {"name": "Schwab US Dividend Equity ETF", "category": "High Dividends"},
    "JEPI": {"name": "JPMorgan Equity Premium Income ETF", "category": "Premium Income"},
    "BND": {"name": "Vanguard Total Bond Market Index Fund ETF", "category": "Broad Market"},
    "TLT": {"name": "iShares 20+ Year Treasury Bond ETF", "category": "Treasury Bonds"},
    "GLD": {"name": "SPDR Gold Trust", "category": "Commodities"},
    "IBIT": {"name": "iShares Bitcoin Trust ETF", "category": "Bitcoin"},
}

# 用户自定义 ETF
user_etfs = {}  # {symbol: {name, category}}

# SSL 上下文
SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE

# 刷新间隔（秒）
REFRESH_INTERVAL = 300  # 默认5分钟

# 缓存
cache = {}
cache_lock = threading.Lock()

# Telegram 配置
telegram_config = {'bot_token': '', 'chat_id': '', 'enabled': False}

def send_telegram_message(message):
    if not telegram_config['enabled'] or not telegram_config['bot_token'] or not telegram_config['chat_id']:
        return False
    url = f"https://api.telegram.org/bot{telegram_config['bot_token']}/sendMessage"
    data = {'chat_id': telegram_config['chat_id'], 'text': message, 'parse_mode': 'Markdown'}
    try:
        req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10, context=SSL_CONTEXT) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"Telegram error: {e}")
        return False

def fetch_quote(symbol):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=5d"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10, context=SSL_CONTEXT) as resp:
            data = json.loads(resp.read().decode())
            if data.get('chart', {}).get('result'):
                result = data['chart']['result'][0]
                meta = result.get('meta', {})
                price = meta.get('regularMarketPrice', 0)
                prev_close = meta.get('chartPreviousClose', 0)
                chg = ((price - prev_close) / prev_close * 100) if price and prev_close else 0
                return {'price': round(price, 2), 'changePercent24h': round(chg, 2)}
    except Exception as e:
        print(f"Error {symbol}: {e}")
    return {'price': 0, 'changePercent24h': 0}

def fetch_all():
    results = []
    # 合并默认ETF和用户自定义ETF
    all_etfs = {**ETF_DATA, **user_etfs}
    
    for symbol in all_etfs:
        info = all_etfs[symbol]
        quote = fetch_quote(symbol)
        results.append({
            'symbol': symbol,
            'name': info['name'],
            'category': info['category'],
            'price': quote['price'],
            'changePercent24h': quote['changePercent24h']
        })
    
    with cache_lock:
        cache['data'] = results
        cache['time'] = __import__('time').time()
    
    return results

def add_user_etf(symbol, name, category):
    """添加用户自定义ETF"""
    symbol = symbol.upper()
    if symbol in ETF_DATA:
        return {'success': False, 'message': f'ETF {symbol} 已存在'}
    
    # 验证是否能获取数据
    quote = fetch_quote(symbol)
    if quote['price'] == 0:
        return {'success': False, 'message': f'无法获取 {symbol} 的数据，可能不是有效的ETF代码'}
    
    user_etfs[symbol] = {'name': name, 'category': category}
    # 刷新缓存
    fetch_all()
    return {'success': True, 'message': f'ETF {symbol} 添加成功'}

def generate_market_report():
    with cache_lock:
        data = cache.get('data', [])
    if not data:
        return None
    sorted_data = sorted(data, key=lambda x: x['changePercent24h'], reverse=True)
    up_count = len([d for d in data if d['changePercent24h'] > 0])
    down_count = len([d for d in data if d['changePercent24h'] < 0])
    top5 = sorted_data[:5]
    bottom5 = sorted_data[-5:]
    
    report = f"📊 *OKComputer 市场日报*\n━━━━━━━━━━━━━━━━━━━━━━\n📈 上涨: {up_count} | 📉 下跌: {down_count}\n\n*🔥 领涨 TOP5:*\n"
    for i, d in enumerate(top5, 1):
        report += f"{i}. {d['symbol']} ${d['price']} ({d['changePercent24h']:+.2f}%)\n"
    report += f"\n*💧 领跌 TOP5:*\n"
    for i, d in enumerate(bottom5, 1):
        report += f"{i}. {d['symbol']} ${d['price']} ({d['changePercent24h']:+.2f}%)\n"
    return report

class APIHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/market-data':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            with cache_lock:
                data = cache.get('data', [])
            if not data:
                data = fetch_all()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
        
        elif self.path == '/api/refresh':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            data = fetch_all()
            self.wfile.write(json.dumps({'status': 'ok', 'count': len(data)}, ensure_ascii=False).encode())
        
        elif self.path.startswith('/api/interval'):
            from urllib.parse import parse_qs, urlparse
            query = urlparse(self.path).query
            params = parse_qs(query)
            global REFRESH_INTERVAL
            interval = int(params.get('value', [60])[0])
            REFRESH_INTERVAL = max(30, min(300, interval))
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'interval': REFRESH_INTERVAL}).encode())
        
        elif self.path.startswith('/api/etf/add'):
            # 添加用户ETF: /api/etf/add?symbol=XXX&name=XXX&category=XXX
            from urllib.parse import parse_qs, urlparse
            query = urlparse(self.path).query
            params = parse_qs(query)
            symbol = params.get('symbol', [''])[0]
            name = params.get('name', [''])[0]
            category = params.get('category', ['Custom'])[0]
            
            result = add_user_etf(symbol, name, category)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        
        elif self.path.startswith('/api/etf/list'):
            # 获取用户自定义ETF列表
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(user_etfs).encode())
        
        elif self.path.startswith('/api/telegram/set'):
            from urllib.parse import parse_qs, urlparse
            query = urlparse(self.path).query
            params = parse_qs(query)
            token = params.get('token', [''])[0]
            chat_id = params.get('chat_id', [''])[0]
            if token and chat_id:
                telegram_config['bot_token'] = token
                telegram_config['chat_id'] = chat_id
                telegram_config['enabled'] = True
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'ok', 'message': 'Telegram configured'}).encode())
            else:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Missing token or chat_id'}).encode())
        
        elif self.path == '/api/telegram/send':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            report = generate_market_report()
            if report:
                success = send_telegram_message(report)
                self.wfile.write(json.dumps({'status': 'ok', 'sent': success}).encode())
            else:
                self.wfile.write(json.dumps({'error': 'No data'}).encode())
        
        elif self.path == '/api/telegram/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'enabled': telegram_config['enabled'], 'configured': bool(telegram_config['bot_token'] and telegram_config['chat_id'])}).encode())
        
        else:
            self.send_error(404)
    
    def log_message(self, f, *args):
        print(f"[{self.log_date_time_string()}] {f % args}")

def background_fetch():
    import time
    last_report_time = 0
    while True:
        print(f"[{time.strftime('%H:%M:%S')}] Fetching ETF data...")
        try:
            fetch_all()
            print(f"[{time.strftime('%H:%M:%S')}] Done. {len(cache.get('data', []))} items")
            
            # 每天收盘发送报告
            current_hour_utc = time.gmtime().tm_hour
            if current_hour_utc in [21, 22] and time.time() - last_report_time > 3600:
                report = generate_market_report()
                if report:
                    if send_telegram_message(report):
                        print(f"[{time.strftime('%H:%M:%S')}] Report sent")
                        last_report_time = time.time()
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(REFRESH_INTERVAL)

# 启动后台刷新线程
fetcher = threading.Thread(target=background_fetch, daemon=True)
fetcher.start()

print(f"Starting ETF API Server on port {PORT}...")
print(f"ETF Count: {len(ETF_DATA)} (default) + user custom")
print(f"API: http://192.168.3.224:{PORT}/api/market-data")

socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("", PORT), APIHandler) as httpd:
    httpd.serve_forever()
