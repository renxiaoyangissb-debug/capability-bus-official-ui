#!/usr/bin/env python3
"""F1-compatible process shell with no network listener and no Core imports."""

import json
import os
import sys


def emit(value):
    sys.stdout.write(json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def main():
    emit(
        {
            "type": "hello",
            "protocol_version": os.environ.get("CAPBUS_PROTOCOL_VERSION"),
            "plugin_id": os.environ.get("CAPBUS_PLUGIN_ID"),
            "capabilities": ["ui.session.status"],
        }
    )
    for line in sys.stdin:
        request = {}
        try:
            message = json.loads(line)
            request = message["request"]
            if message.get("type") != "request" or request.get("capability") != "ui.session.status":
                raise ValueError("unsupported request")
            emit(
                {
                    "type": "result",
                    "request_id": request["request_id"],
                    "ok": True,
                    "data": {
                        "phase": "U1-shell",
                        "http_listening": False,
                        "production_web_security": False,
                    },
                }
            )
        except Exception:
            emit(
                {
                    "type": "result",
                    "request_id": request.get("request_id", "unknown"),
                    "ok": False,
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": "Request was rejected",
                        "retryable": False,
                    },
                }
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
