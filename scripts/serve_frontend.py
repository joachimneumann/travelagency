#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from http.client import HTTPConnection
from pathlib import Path
import argparse
import os
import socket
import time
from urllib.parse import urlsplit


PAGE_MAP = {
    "/": "frontend/pages/index.html",
    "/index.html": "frontend/pages/index.html",
    "/404.html": "frontend/pages/404.html",
    "/backend.html": "frontend/pages/backend.html",
    "/backend-booking.html": "frontend/pages/backend-booking.html",
    "/backend-tour.html": "frontend/pages/backend-tour.html",
    "/customer.html": "frontend/pages/customer.html",
}


class FrontendHandler(SimpleHTTPRequestHandler):
    backend_base = "http://127.0.0.1:8787"
    proxy_prefixes = ("/api/", "/auth/", "/public/v1/")
    reload_prefix = "/__dev_reload"
    live_reload_enabled = True
    watched_roots = ("frontend", "assets")
    watched_suffixes = (".html", ".css", ".js")

    def __init__(self, *args, directory=None, **kwargs):
        self.root = Path(directory or os.getcwd())
        super().__init__(*args, directory=str(self.root), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

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

    def resolved_page_path(self, request_path):
        mapped = PAGE_MAP.get(request_path)
        return (self.root / mapped) if mapped else None

    def send_custom_404(self):
        not_found = self.root / "frontend/pages/404.html"
        if not_found.exists():
            body = self.inject_live_reload(not_found.read_text(encoding="utf-8")).encode("utf-8")
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404, "File not found")

    def serve_html_file(self, html_path, status=200):
        body = self.inject_live_reload(html_path.read_text(encoding="utf-8")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def inject_live_reload(self, html_text):
        if not self.live_reload_enabled:
            return html_text

        script = """
<script>
(() => {
  if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") return;
  const source = new EventSource("/__dev_reload");
  source.onmessage = (event) => {
    if (event.data === "reload") {
      source.close();
      window.location.reload();
    }
  };
})();
</script>
""".strip()

        marker = "</body>"
        if marker in html_text:
          return html_text.replace(marker, f"{script}\n{marker}", 1)
        return f"{html_text}\n{script}"

    def current_tree_version(self):
        latest = 0
        for relative_root in self.watched_roots:
            base = self.root / relative_root
            if not base.exists():
                continue
            for dirpath, dirnames, filenames in os.walk(base):
                dirnames[:] = [name for name in dirnames if name not in {".git", "__pycache__", "node_modules"}]
                for filename in filenames:
                    if not filename.endswith(self.watched_suffixes):
                        continue
                    file_path = Path(dirpath) / filename
                    try:
                        mtime = file_path.stat().st_mtime_ns
                    except OSError:
                        continue
                    if mtime > latest:
                        latest = mtime
        return latest

    def handle_dev_reload(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        baseline = self.current_tree_version()
        try:
            while True:
                current = self.current_tree_version()
                if current > baseline:
                    self.wfile.write(b"data: reload\n\n")
                    self.wfile.flush()
                    return
                self.wfile.write(b": keepalive\n\n")
                self.wfile.flush()
                time.sleep(1.0)
        except (BrokenPipeError, ConnectionResetError):
            return

    def do_GET(self):
        if self.maybe_proxy():
            return
        request_path = urlsplit(self.path).path
        if request_path == self.reload_prefix and self.live_reload_enabled:
            self.handle_dev_reload()
            return
        resolved_page = self.resolved_page_path(request_path)
        if resolved_page and resolved_page.exists():
            self.serve_html_file(resolved_page)
            return
        path = self.translate_path(self.path)
        if os.path.exists(path):
            if path.endswith(".html"):
                self.serve_html_file(Path(path))
                return
            return super().do_GET()
        self.send_custom_404()

    def do_HEAD(self):
        if self.maybe_proxy():
            return
        request_path = urlsplit(self.path).path
        resolved_page = self.resolved_page_path(request_path)
        if resolved_page and resolved_page.exists():
            self.serve_html_file(resolved_page)
            return
        path = self.translate_path(self.path)
        if os.path.exists(path):
            if path.endswith(".html"):
                self.serve_html_file(Path(path))
                return
            return super().do_HEAD()
        not_found = self.root / "frontend/pages/404.html"
        if not_found.exists():
            self.serve_html_file(not_found, status=404)
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


class DualStackThreadingHTTPServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6

    def server_bind(self):
        if hasattr(socket, "IPPROTO_IPV6") and hasattr(socket, "IPV6_V6ONLY"):
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("port", type=int)
    parser.add_argument("--directory", default=os.getcwd())
    parser.add_argument("--backend-base", default=os.environ.get("BACKEND_BASE", "http://127.0.0.1:8787"))
    args = parser.parse_args()

    FrontendHandler.backend_base = args.backend_base.rstrip("/")
    handler = lambda *h_args, **h_kwargs: FrontendHandler(*h_args, directory=args.directory, **h_kwargs)
    if args.bind in {"localhost", "127.0.0.1"}:
        server = DualStackThreadingHTTPServer(("::", args.port), handler)
    else:
        server = ThreadingHTTPServer((args.bind, args.port), handler)
    try:
      server.serve_forever()
    except KeyboardInterrupt:
      pass
    finally:
      server.server_close()


if __name__ == "__main__":
    main()
