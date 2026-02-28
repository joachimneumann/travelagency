#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from http.client import HTTPConnection
from pathlib import Path
import argparse
import os
from urllib.parse import urlsplit


class FrontendHandler(SimpleHTTPRequestHandler):
    backend_base = "http://127.0.0.1:8787"
    proxy_prefixes = ("/api/", "/auth/", "/public/v1/")

    def __init__(self, *args, directory=None, **kwargs):
        self.root = Path(directory or os.getcwd())
        super().__init__(*args, directory=str(self.root), **kwargs)

    def maybe_proxy(self):
        path = urlsplit(self.path).path
        if not any(path.startswith(prefix) for prefix in self.proxy_prefixes):
            return False

        backend = urlsplit(self.backend_base)
        connection = HTTPConnection(backend.hostname, backend.port or 80, timeout=15)
        headers = {
            key: value
            for key, value in self.headers.items()
            if key.lower() not in {"host", "connection", "content-length"}
        }
        headers["Host"] = backend.netloc
        body = None
        if self.command in {"POST", "PATCH", "PUT"}:
            length = int(self.headers.get("Content-Length", "0") or "0")
            body = self.rfile.read(length) if length > 0 else None
        try:
            connection.request(self.command, self.path, body=body, headers=headers)
            upstream = connection.getresponse()
            payload = upstream.read()
            self.send_response(upstream.status, upstream.reason)
            excluded = {"connection", "content-length", "transfer-encoding", "server", "date"}
            for key, value in upstream.getheaders():
                if key.lower() in excluded:
                    continue
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(payload)
            return True
        except OSError:
            self.send_error(502, "Backend API unavailable")
            return True
        finally:
            connection.close()

    def send_custom_404(self):
        not_found = self.root / "404.html"
        if not_found.exists():
            body = not_found.read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404, "File not found")

    def do_GET(self):
        if self.maybe_proxy():
            return
        path = self.translate_path(self.path)
        if os.path.exists(path):
            return super().do_GET()
        self.send_custom_404()

    def do_HEAD(self):
        if self.maybe_proxy():
            return
        path = self.translate_path(self.path)
        if os.path.exists(path):
            return super().do_HEAD()
        not_found = self.root / "404.html"
        if not_found.exists():
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(not_found.stat().st_size))
            self.end_headers()
            return
        self.send_error(404, "File not found")

    def do_POST(self):
        if self.maybe_proxy():
            return
        self.send_error(405, "Method not allowed")

    def do_PATCH(self):
        if self.maybe_proxy():
            return
        self.send_error(405, "Method not allowed")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("port", type=int)
    parser.add_argument("--directory", default=os.getcwd())
    parser.add_argument("--backend-base", default=os.environ.get("BACKEND_BASE", "http://127.0.0.1:8787"))
    args = parser.parse_args()

    FrontendHandler.backend_base = args.backend_base.rstrip("/")
    handler = lambda *h_args, **h_kwargs: FrontendHandler(*h_args, directory=args.directory, **h_kwargs)
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    try:
      server.serve_forever()
    except KeyboardInterrupt:
      pass
    finally:
      server.server_close()


if __name__ == "__main__":
    main()
