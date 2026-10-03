#!/usr/bin/env python3
"""Loopback UI bridge for the public Capability Bus management protocol."""

from __future__ import annotations

import hashlib
import hmac
import json
import mimetypes
import os
import secrets
import socket
import sys
import threading
import time
from datetime import datetime, timezone
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlsplit


MANAGEMENT_PROTOCOL = "0.1.0-alpha.3"
CONTROL_PROTOCOL = "capbus-local-control-v1"
MAX_MESSAGE_BYTES = 1024 * 1024
PAIRING_TTL_SECONDS = 300
SESSION_TTL_SECONDS = 1800
COOKIE_NAME = "capbus_ui_session"
REQUIRED_ENVIRONMENT = (
    "CAPBUS_MANAGEMENT_SOCKET", "CAPBUS_MANAGEMENT_PROTOCOL_VERSION",
    "CAPBUS_MANAGEMENT_IDENTITY_ID", "CAPBUS_MANAGEMENT_CREDENTIAL_ID",
    "CAPBUS_MANAGEMENT_CREDENTIAL_GENERATION", "CAPBUS_MANAGEMENT_HMAC_KEY",
)
REQUEST_FIELDS = {
    "protocol_version", "request_id", "trace_id", "timestamp", "nonce", "operation",
    "arguments", "idempotency_key", "expected_version", "confirmation",
}


def compact_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def emit(value):
    sys.stdout.write(compact_json(value) + "\n")
    sys.stdout.flush()


class ManagementBridge:
    def __init__(self, environment):
        if any(not environment.get(name) for name in REQUIRED_ENVIRONMENT):
            raise RuntimeError("Core management bootstrap is unavailable")
        if environment["CAPBUS_MANAGEMENT_PROTOCOL_VERSION"] != MANAGEMENT_PROTOCOL:
            raise RuntimeError("Core management protocol is incompatible")
        self.socket_path = environment["CAPBUS_MANAGEMENT_SOCKET"]
        self.identity_id = environment["CAPBUS_MANAGEMENT_IDENTITY_ID"]
        self.credential_id = environment["CAPBUS_MANAGEMENT_CREDENTIAL_ID"]
        try:
            self.credential_generation = int(environment["CAPBUS_MANAGEMENT_CREDENTIAL_GENERATION"])
            self.key = bytes.fromhex(environment["CAPBUS_MANAGEMENT_HMAC_KEY"])
        except (TypeError, ValueError) as exc:
            raise RuntimeError("Core management bootstrap is invalid") from exc
        if self.credential_generation < 1 or len(self.key) != 32:
            raise RuntimeError("Core management bootstrap is invalid")

    def invoke(self, draft):
        if not isinstance(draft, dict) or set(draft) != REQUEST_FIELDS:
            raise ValueError("Management request fields are invalid")
        if draft.get("protocol_version") != MANAGEMENT_PROTOCOL:
            raise ValueError("Management protocol is incompatible")
        if not isinstance(draft.get("arguments"), dict):
            raise ValueError("Management arguments must be an object")
        request = dict(draft)
        request.update({"identity_id": self.identity_id, "credential_id": self.credential_id, "credential_generation": self.credential_generation})
        request["signature"] = hmac.new(self.key, compact_json(request).encode("utf-8"), hashlib.sha256).hexdigest()
        raw = (compact_json({"protocol": CONTROL_PROTOCOL, "operation": "management", "request": request}) + "\n").encode("utf-8")
        if len(raw) > MAX_MESSAGE_BYTES:
            raise ValueError("Management request is too large")
        client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        client.settimeout(30)
        try:
            client.connect(self.socket_path)
            client.sendall(raw)
            chunks = bytearray()
            while b"\n" not in chunks:
                chunk = client.recv(65536)
                if not chunk:
                    raise RuntimeError("Core closed the management connection")
                chunks.extend(chunk)
                if len(chunks) > MAX_MESSAGE_BYTES:
                    raise RuntimeError("Core management response is too large")
            response = json.loads(bytes(chunks).split(b"\n", 1)[0].decode("utf-8"))
            if not isinstance(response, dict):
                raise RuntimeError("Core management response is invalid")
            return response
        finally:
            client.close()


class SessionStore:
    def __init__(self):
        self.pairing_code = secrets.token_urlsafe(24)
        self.pairing_expires = time.time() + PAIRING_TTL_SECONDS
        self.pairing_consumed = False
        self.sessions = {}
        self.lock = threading.Lock()

    def pair(self, candidate):
        with self.lock:
            if self.pairing_consumed or time.time() >= self.pairing_expires or not hmac.compare_digest(candidate, self.pairing_code):
                return None
            self.pairing_consumed = True
            session_id = secrets.token_urlsafe(32)
            self.sessions[session_id] = (time.time() + SESSION_TTL_SECONDS, secrets.token_urlsafe(32))
            return session_id

    def authorize(self, session_id, csrf_token=None):
        with self.lock:
            value = self.sessions.get(session_id)
            if value is None:
                return None
            expires_at, expected_csrf = value
            if time.time() >= expires_at:
                self.sessions.pop(session_id, None)
                return None
            if csrf_token is not None and not hmac.compare_digest(csrf_token, expected_csrf):
                return None
            return expected_csrf


class LoopbackServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False


class Handler(BaseHTTPRequestHandler):
    server_version = "CapabilityBusOfficialUI"
    sys_version = ""

    def do_GET(self):
        parsed = urlsplit(self.path)
        pairing = parse_qs(parsed.query).get("pair", [])
        if parsed.path == "/" and pairing:
            session_id = self.server.sessions.pair(pairing[0])
            if session_id is None:
                return self.error_response(403, "PAIRING_DENIED")
            self.send_response(303)
            self.security_headers()
            self.send_header("Set-Cookie", f"{COOKIE_NAME}={session_id}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_TTL_SECONDS}")
            self.send_header("Location", "/")
            self.end_headers()
            return
        self.serve_static(parsed.path)

    def do_POST(self):
        if self.headers.get("Origin") != self.server.origin:
            return self.error_response(403, "ORIGIN_DENIED")
        session_id = self.session_cookie()
        csrf = self.server.sessions.authorize(session_id) if session_id else None
        if csrf is None:
            return self.error_response(401, "SESSION_REQUIRED")
        if self.path == "/api/session":
            return self.json_response(200, {"csrf_token": csrf, "expires_in_seconds": SESSION_TTL_SECONDS})
        if self.path != "/api/management":
            return self.error_response(404, "NOT_FOUND")
        if self.server.sessions.authorize(session_id, self.headers.get("X-CSRF-Token", "")) is None:
            return self.error_response(403, "CSRF_DENIED")
        try:
            self.json_response(200, self.server.bridge.invoke(self.read_json()))
        except ValueError:
            self.error_response(400, "VALIDATION_FAILED")
        except (OSError, RuntimeError, json.JSONDecodeError):
            self.error_response(503, "CORE_UNAVAILABLE")

    def read_json(self):
        if self.headers.get_content_type() != "application/json":
            raise ValueError("JSON content type is required")
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ValueError("Content length is invalid") from exc
        if length < 1 or length > MAX_MESSAGE_BYTES:
            raise ValueError("Request body size is invalid")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def session_cookie(self):
        jar = cookies.SimpleCookie()
        try:
            jar.load(self.headers.get("Cookie", ""))
        except cookies.CookieError:
            return None
        morsel = jar.get(COOKIE_NAME)
        return morsel.value if morsel else None

    def serve_static(self, request_path):
        relative = "index.html" if request_path in ("", "/") else request_path.lstrip("/")
        candidate = (self.server.web_root / relative).resolve()
        if self.server.web_root not in candidate.parents or not candidate.is_file():
            return self.error_response(404, "NOT_FOUND")
        content = candidate.read_bytes()
        self.send_response(200)
        self.security_headers()
        self.send_header("Content-Type", mimetypes.guess_type(candidate.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store" if candidate.name == "index.html" else "public, max-age=31536000, immutable")
        self.end_headers()
        self.wfile.write(content)

    def json_response(self, status, value):
        body = compact_json(value).encode("utf-8")
        self.send_response(status)
        self.security_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def error_response(self, status, code):
        self.json_response(status, {"ok": False, "error": {"code": code, "message": "Request was rejected", "retryable": False}})

    def security_headers(self):
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")

    def log_message(self, _format, *_arguments):
        return


def create_server(bridge):
    server = LoopbackServer(("127.0.0.1", 0), Handler)
    host, port = server.server_address
    if host != "127.0.0.1":
        server.server_close()
        raise RuntimeError("UI listener is not loopback-only")
    server.bridge = bridge
    server.sessions = SessionStore()
    server.origin = f"http://127.0.0.1:{port}"
    server.web_root = (Path(__file__).resolve().parents[1] / "web").resolve()
    return server


def status_data(server):
    active_pairing = not server.sessions.pairing_consumed and time.time() < server.sessions.pairing_expires
    expires_at = datetime.fromtimestamp(server.sessions.pairing_expires, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    return {"phase": "U4-real-core", "http_listening": True, "production_web_security": True,
            "url": server.origin, "pairing_url": f"{server.origin}/?pair={quote(server.sessions.pairing_code)}" if active_pairing else None,
            "pairing_expires_at": expires_at if active_pairing else None, "management_protocol_version": MANAGEMENT_PROTOCOL}


def main():
    if os.environ.get("CAPBUS_PROTOCOL_VERSION") != "0.1.0-alpha.1" or os.environ.get("CAPBUS_PLUGIN_ID") != "ui.official.web":
        raise RuntimeError("Plugin bootstrap is incompatible")
    server = create_server(ManagementBridge(os.environ))
    thread = threading.Thread(target=server.serve_forever, name="capbus-ui-http", daemon=True)
    thread.start()
    emit({"type": "hello", "protocol_version": os.environ.get("CAPBUS_PROTOCOL_VERSION"), "plugin_id": os.environ.get("CAPBUS_PLUGIN_ID"), "capabilities": ["ui.session.status"]})
    try:
        for line in sys.stdin:
            request = {}
            try:
                message = json.loads(line)
                request = message["request"]
                if message.get("type") != "request" or request.get("capability") != "ui.session.status":
                    raise ValueError("unsupported request")
                emit({"type": "result", "request_id": request["request_id"], "ok": True, "data": status_data(server)})
            except Exception:
                emit({"type": "result", "request_id": request.get("request_id", "unknown"), "ok": False,
                      "error": {"code": "INVALID_REQUEST", "message": "Request was rejected", "retryable": False}})
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        raise SystemExit(1)
