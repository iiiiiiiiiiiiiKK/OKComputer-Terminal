#!/usr/bin/env python3
"""ETF Price Fetcher using yfinance"""
import json
import sys
from yfinance import Ticker

# ETF 列表
ETFS = [
    "VT", "ACWI", "ACWX", "VTI", "SPY", "QQQ",
    "EFA", "EZU", "EWU", "EWG", "EWQ", "EWI", "EWP", "EWC", "EWJ", "EWA",
    "EEM", "EMXC", "EWY", "EWS", "EIDO", "EZA", "EWM", "INDA", "ARGT", "TUR", "VNM", "EWW", "EWZ", "EWT",
    "MCHI", "FXI", "KWEB", "ASHR",
    "VNQ", "VNQI", "REET", "REM", "MBB",
    "SCHD", "PFF", "DVY", "IDV", "AMLP",
    "JEPI", "JEPQ", "QQQI", "DIVO", "QDVO", "QYLD", "XYLD",
    "BND", "AGG", "BNDX", "TIP", "VTIP",
    "TLT", "TLH", "IEF", "IEI", "SHY", "BIL", "SGOV",
    "LQD", "HYG", "BINC", "JAAA", "JBBB",
    "EMB", "EMHY",
    "GLD", "SLV", "PDBC", "DBC", "DBB", "DBA", "USO", "UNG", "CPER",
    "IBIT"
]

def fetch_prices():
    """Fetch all ETF prices"""
    results = []
    
    # 分批获取（yfinance 批量处理）
    symbols = " ".join(ETFS)
    
    try:
        tickers = Ticker(symbols)
        # 获取快速信息
        info = tickers.info
        
        for symbol in ETFS:
            try:
                t = Ticker(symbol)
                data = t.info
                
                price = data.get('regularMarketPrice', 0)
                change = data.get('regularMarketChangePercent', 0)
                
                if price:
                    results.append({
                        'ticker': symbol,
                        'price': round(price, 2),
                        'chg': round(change, 2) if change else 0
                    })
            except Exception as e:
                print(f"Error {symbol}: {e}", file=sys.stderr)
                continue
                
    except Exception as e:
        print(f"Batch error: {e}", file=sys.stderr)
    
    print(json.dumps(results))

if __name__ == "__main__":
    fetch_prices()
