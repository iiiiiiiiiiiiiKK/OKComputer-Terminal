#!/usr/bin/env python3
"""ETF Price Server - 静态页面 + TradingView 实时行情"""
import json
import http.server
import urllib.request
import ssl
import os
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone

PORT = 10090
BASE_DIR = Path(__file__).parent / "dist"
ASSETS_DIR = BASE_DIR / "assets"

SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE

os.chdir(BASE_DIR)


def load_symbols_from_dist():
    symbols = set()
    js_files = sorted(ASSETS_DIR.glob("index-*.js"))
    if not js_files:
        return []
    text = js_files[0].read_text(encoding="utf-8", errors="ignore")
    for s in re.findall(r"([A-Z][A-Z0-9.-]{0,9})\t", text):
        symbols.add(s)
    return sorted(symbols)


SYMBOLS = load_symbols_from_dist()
PREFIXES = ["AMEX", "NASDAQ", "NYSE", "NYSEARCA", "BATS", "CBOE"]


def tv_scan(prefixed_tickers):
    url = "https://scanner.tradingview.com/america/scan"
    payload = {
        "symbols": {"tickers": prefixed_tickers, "query": {"types": []}},
        "columns": ["close", "change"]
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=15, context=SSL_CONTEXT) as resp:
        return json.loads(resp.read().decode())


def fetch_quotes_by_tv(symbols):
    unresolved = set(symbols)
    out = {}

    # 逐前缀尝试，先命中的优先（减少重复覆盖）
    for prefix in PREFIXES:
        if not unresolved:
            break
        sym_list = sorted(unresolved)
        chunk_size = 80
        for i in range(0, len(sym_list), chunk_size):
            chunk = sym_list[i:i+chunk_size]
            tickers = [f"{prefix}:{s}" for s in chunk]
            try:
                res = tv_scan(tickers)
            except Exception:
                continue
            for item in res.get("data", []):
                raw = item.get("s", "")
                vals = item.get("d", [])
                if ":" not in raw or len(vals) < 2:
                    continue
                symbol = raw.split(":", 1)[1]
                price, chg = vals[0], vals[1]
                if symbol in unresolved and price is not None and chg is not None:
                    out[symbol] = {
                        "price": round(float(price), 2),
                        "chg": round(float(chg), 2),
                        "ex": raw.split(":", 1)[0]
                    }
                    unresolved.discard(symbol)
    return out


class ETFHandler(http.server.SimpleHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode())

    def do_GET(self):
        if self.path.startswith("/api/indices"):
            self.handle_indices()
        elif self.path.startswith("/api/market-data"):
            self.handle_market_data()
        elif self.path.startswith("/api/quote"):
            self.handle_quote()
        elif self.path.startswith("/api/chart"):
            self.handle_chart()
        elif self.path.startswith("/api/etf/add"):
            self.handle_etf_add()
        elif self.path.startswith("/api/etf/list"):
            self.handle_etf_list()
        else:
            super().do_GET()

    def handle_etf_add(self):
        from urllib.parse import parse_qs
        query = urlparse(self.path).query
        params = parse_qs(query)
        symbol = params.get("symbol", [""])[0].upper()
        name = params.get("name", [""])[0]
        category = params.get("category", ["Custom"])[0]
        
        if not symbol or not name:
            self._send_json({"success": False, "message": "缺少参数"}, 400)
            return
            
        # 保存到文件
        try:
            data_file = Path(BASE_DIR) / "etf_custom.txt"
            existing = []
            if data_file.exists():
                existing = data_file.read_text().strip().split("\n")
            
            # 检查是否已存在
            for line in existing:
                if line.startswith(symbol + "|"):
                    self._send_json({"success": False, "message": f"{symbol} 已存在"}, 400)
                    return
            
            with open(data_file, "a") as f:
                f.write(f"{symbol}|{name}|{category}\n")
            
            self._send_json({"success": True, "message": f"{symbol} 添加成功"})
        except Exception as e:
            self._send_json({"success": False, "message": str(e)}, 500)

    def handle_etf_list(self):
        try:
            data_file = Path(BASE_DIR) / "etf_custom.txt"
            if data_file.exists():
                data = data_file.read_text().strip()
                self._send_json(data.split("\n") if data else [])
            else:
                self._send_json([])
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def handle_indices(self):
        # 全球主要指数更多
        INDICES = ["SPY", "QQQ", "DIA", "IWM", "IWF", "IWD", "VTI", "IVV", "VOO", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "BTC-USD", "ETH-USD", "SOL-USD", "GOLD", "GC=F", "OIL", "CL=F", "EURUSD=X", "USDJPY=X", "TNX", "BITB", "BITO", "BITW", "DEFI"]
        quotes = fetch_quotes_by_tv(INDICES)
        out = []
        for s in INDICES:
            q = quotes.get(s)
            if q:
                out.append({"symbol": s, "price": q["price"], "chg": q["chg"]})
        self._send_json(out)

    def handle_chart(self):
        # 返回K线数据用于mini图
        query = urlparse(self.path).query
        params = parse_qs(query)
        symbol = params.get("symbol", [""])[0].upper()
        if not symbol:
            self._send_json({"error": "no symbol"}, 400)
            return
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=7d"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10, context=SSL_CONTEXT) as resp:
                data = json.loads(resp.read().decode())
                result = data.get("chart", {}).get("result", [{}])[0]
                timestamps = result.get("timestamp", [])
                quotes = result.get("indicators", {}).get("quote", [{}])[0]
                closes = quotes.get("close", [])
                out = {"symbol": symbol, "data": []}
                for i, ts in enumerate(timestamps):
                    if closes[i] is not None:
                        out["data"].append({"t": ts, "c": closes[i]})
                self._send_json(out)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def handle_market_data(self):
        quotes = fetch_quotes_by_tv(SYMBOLS)
        ts = datetime.now(timezone.utc).isoformat()
        out = []
        for s in SYMBOLS:
            q = quotes.get(s)
            if q:
                out.append({
                    "symbol": s,
                    "price": q["price"],
                    "changePercent24h": q["chg"],
                    "isRealtime": True,
                    "source": "tradingview",
                    "exchange": q["ex"],
                    "ts": ts
                })
        self._send_json(out)

    def handle_quote(self):
        query = urlparse(self.path).query
        params = parse_qs(query)
        symbols_raw = params.get("symbols", [""])[0]
        symbols = [s.strip().upper() for s in symbols_raw.split(",") if s.strip()]
        if not symbols:
            self._send_json({"error": "no symbols"}, 400)
            return
        quotes = fetch_quotes_by_tv(symbols)
        out = []
        for s in symbols:
            q = quotes.get(s)
            if q:
                out.append({"ticker": s, "price": q["price"], "chg": q["chg"], "source": "tradingview", "exchange": q["ex"]})
            else:
                out.append({"ticker": s, "error": "fetch failed"})
        self._send_json(out)

    def log_message(self, f, *args):
        print(f"[{self.log_date_time_string()}] {f % args}")


print(f"Starting ETF Terminal: http://localhost:{PORT}")
print(f"Loaded symbols: {len(SYMBOLS)}")
http.server.test(HandlerClass=ETFHandler, port=PORT)
