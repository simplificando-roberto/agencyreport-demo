"""Tiny HTTPS server for terminal login page. Serves index.html and proxies /ttyd/ to localhost:7681."""

import http.server
import http.client
import ssl
import os

os.chdir("/opt/terminal-web")

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/ttyd"):
            self._proxy()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/ttyd"):
            self._proxy()
        else:
            super().do_POST()

    def _proxy(self):
        path = self.path.replace("/ttyd", "", 1) or "/"
        try:
            conn = http.client.HTTPConnection("127.0.0.1", 7681, timeout=30)
            body = None
            cl = self.headers.get("Content-Length")
            if cl:
                body = self.rfile.read(int(cl))
            hdrs = {}
            for k in ("Upgrade", "Connection", "Sec-WebSocket-Key",
                       "Sec-WebSocket-Version", "Sec-WebSocket-Extensions",
                       "Content-Type", "Accept"):
                v = self.headers.get(k)
                if v:
                    hdrs[k] = v
            conn.request(self.command, path, body=body, headers=hdrs)
            resp = conn.getresponse()
            self.send_response(resp.status)
            for k, v in resp.getheaders():
                if k.lower() not in ("transfer-encoding",):
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(resp.read())
        except Exception as e:
            self.send_error(502, str(e))

    def log_message(self, fmt, *args):
        pass  # Silent

httpd = http.server.HTTPServer(("0.0.0.0", 7682), Handler)
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(
    "/home/dokku/agency-report/tls/server.crt",
    "/home/dokku/agency-report/tls/server.key",
)
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
print("Terminal web: https://0.0.0.0:7682")
httpd.serve_forever()
