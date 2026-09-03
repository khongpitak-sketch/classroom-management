"""
Classroom Management System - Local Web Server
Runs a lightweight HTTP server on port 8000 and automatically opens the web browser.
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import threading
import time

# Ensure UTF-8 output on Windows
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def open_browser():
    time.sleep(1.2)
    url = f"http://localhost:{PORT}/index.html"
    print(f"[+] Opening web browser: {url}")
    webbrowser.open(url)

def main():
    os.chdir(DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print("=" * 60)
            print("Classroom Management System (24 Rooms: 20 Classrooms + 4 Labs)")
            print(f"Server URL: http://localhost:{PORT}/index.html")
            print(f"Directory:  {DIRECTORY}")
            print("=" * 60)
            print("Press Ctrl+C to stop server.")
            print("=" * 60)
            
            threading.Thread(target=open_browser, daemon=True).start()
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Server stopped.")
    except Exception as e:
        print(f"[!] Server error: {e}")

if __name__ == "__main__":
    main()
