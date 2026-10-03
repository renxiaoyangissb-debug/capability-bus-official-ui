#!/usr/bin/env python3
"""Real U4 integration fixture using only Core CLI and public transports."""

import http.cookiejar
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path


CORE_COMMIT = "4858520224a98b6528cb6cf47e7aa2e517bb62dc"
PLUGIN_ID = "ui.official.web"


def main():
    repository = Path(__file__).resolve().parents[1]
    arguments = list(sys.argv[1:])
    use_existing_package = "--use-existing-package" in arguments
    if use_existing_package:
        arguments.remove("--use-existing-package")
    core = Path(arguments[0] if arguments else repository.parent / "capability-bus-core").resolve()
    if run(["git", "-C", str(core), "rev-parse", "HEAD"]).strip() != CORE_COMMIT:
        raise RuntimeError("Real integration requires the accepted Core commit")
    if run(["git", "-C", str(core), "status", "--porcelain"]).strip():
        raise RuntimeError("Real integration requires a clean Core worktree")
    if not use_existing_package:
        subprocess.run(["npm", "run", "package:plugin"], cwd=repository, check=True)
    package = repository / "build" / "plugin" / PLUGIN_ID
    if not (package / "checksums.json").is_file():
        raise RuntimeError("Verified UI plugin package is missing")
    environment = dict(os.environ)
    environment.update({"PYTHONPATH": str(core / "src"), "PYTHONDONTWRITEBYTECODE": "1"})
    with tempfile.TemporaryDirectory(prefix="capbus-ui-u4-") as directory:
        root = Path(directory) / "core"
        daemon = start_daemon(core, root, environment)
        try:
            registered = cli(core, root, environment, "plugin", "register", str(package))["data"]
            system_id = registered["system_id"]
            identity_id = f"plugin:{system_id}"
            management_grant = cli(core, root, environment, "grant", "create", "--subject", identity_id, "--plugin", PLUGIN_ID, "--capability", "system.*")["data"]
            capability_grant = cli(core, root, environment, "grant", "create", "--plugin", PLUGIN_ID, "--capability", "ui.session.status")["data"]
            cli(core, root, environment, "plugin", "enable", PLUGIN_ID)
            cli(core, root, environment, "plugin", "start", PLUGIN_ID)

            echo_package = core / "examples" / "example-echo"
            cli(core, root, environment, "plugin", "register", str(echo_package))
            echo_grant = cli(core, root, environment, "grant", "create", "--plugin", "example.echo", "--capability", "example.echo")["data"]
            cli(core, root, environment, "plugin", "enable", "example.echo")
            cli(core, root, environment, "plugin", "start", "example.echo")
            echo_before = echo_call(core, root, environment, echo_grant["grant_id"], "before-ui-disable")
            echo_pid = echo_before["process_id"]

            status = session_status(core, root, environment, capability_grant["grant_id"], "initial")
            browser, csrf = pair(status["pairing_url"], status["url"])
            read = management(browser, csrf, status["url"], "system.version.get", {})
            require(read["ok"] and read["data"]["management_protocol_version"] == "0.1.0-alpha.3", "public read failed")

            write_key = "u4-secret-register"
            registered_secret = management(browser, csrf, status["url"], "system.secrets.register", {"secret_ref": "secretref://u4/integration", "plugin_id": None}, idempotency_key=write_key)
            require(registered_secret["ok"] and registered_secret["audit_id"], "public write/audit correlation failed")
            replay = management(browser, csrf, status["url"], "system.secrets.register", {"secret_ref": "secretref://u4/integration", "plugin_id": None}, idempotency_key=write_key)
            require(replay["ok"] and replay["authorization"]["reason_code"] == "IDEMPOTENCY_HIT", "idempotent replay failed")
            conflict = management(browser, csrf, status["url"], "system.secrets.register", {"secret_ref": "secretref://u4/other", "plugin_id": None}, idempotency_key=write_key)
            require(conflict["error"]["code"] == "IDEMPOTENCY_FINGERPRINT_CONFLICT", "idempotency conflict failed")

            document = {"bind_host": "127.0.0.1", "port": 0, "session_ttl_minutes": 30, "theme": "system", "language": "zh-CN", "audit_page_size": 50}
            configured = management(browser, csrf, status["url"], "system.config.set", {"plugin_id": PLUGIN_ID, "document": document}, idempotency_key="u4-config-one", expected_version=0)
            require(configured["ok"] and configured["data"]["version"] == 1, f"expected-version write failed: {configured}")
            version_conflict = management(browser, csrf, status["url"], "system.config.set", {"plugin_id": PLUGIN_ID, "document": document}, idempotency_key="u4-config-conflict", expected_version=0)
            require(version_conflict["error"]["code"] == "CONFIG_VERSION_CONFLICT", "version conflict failed")
            unconfirmed = management(browser, csrf, status["url"], "system.secrets.revoke", {"secret_ref": "secretref://u4/integration"}, idempotency_key="u4-revoke-unconfirmed")
            require(unconfirmed["error"]["code"] == "CONFIRMATION_REQUIRED", "confirmation denial failed")
            revoked_secret = management(browser, csrf, status["url"], "system.secrets.revoke", {"secret_ref": "secretref://u4/integration"}, idempotency_key="u4-revoke-confirmed", confirmed=True)
            require(revoked_secret["ok"], "confirmed write failed")
            audit = management(browser, csrf, status["url"], "system.audit.inspect", {"audit_id": registered_secret["audit_id"]})
            require(audit["ok"] and audit["data"]["trace_id"] == registered_secret["trace_id"], "audit lookup correlation failed")

            cli(core, root, environment, "grant", "revoke", management_grant["grant_id"])
            denied = management(browser, csrf, status["url"], "system.version.get", {})
            require(denied["error"]["code"] == "CREDENTIAL_INVALID", "Grant revocation did not invalidate the session credential")
            cli(core, root, environment, "plugin", "disable", PLUGIN_ID)
            wait_unreachable(status["url"])
            require(cli(core, root, environment, "version")["ok"], "Core CLI failed after UI disable")
            echo_disabled = echo_call(core, root, environment, echo_grant["grant_id"], "after-ui-disable")
            require(echo_disabled["process_id"] == echo_pid, "non-UI resident process changed across UI disable")

            management_grant = cli(core, root, environment, "grant", "create", "--subject", identity_id, "--plugin", PLUGIN_ID, "--capability", "system.*")["data"]
            cli(core, root, environment, "plugin", "enable", PLUGIN_ID)
            cli(core, root, environment, "plugin", "start", PLUGIN_ID)
            restarted_ui = session_status(core, root, environment, capability_grant["grant_id"], "ui-restart")
            browser2, csrf2 = pair(restarted_ui["pairing_url"], restarted_ui["url"])
            require(management(browser2, csrf2, restarted_ui["url"], "system.status.get", {})["ok"], "UI restart/reprovision failed")

            cli(core, root, environment, "daemon", "stop")
            daemon.wait(timeout=10)
            wait_unreachable(restarted_ui["url"])
            daemon = start_daemon(core, root, environment)
            recovered = session_status(core, root, environment, capability_grant["grant_id"], "core-restart")
            browser3, csrf3 = pair(recovered["pairing_url"], recovered["url"])
            require(management(browser3, csrf3, recovered["url"], "system.status.get", {})["ok"], "Core restart recovery failed")

            cli(core, root, environment, "plugin", "disable", PLUGIN_ID)
            wait_unreachable(recovered["url"])
            cli(core, root, environment, "plugin", "remove", PLUGIN_ID, "--confirm")
            require(cli(core, root, environment, "version")["ok"], "Core CLI failed after UI removal")
            wait_unreachable(recovered["url"])
            echo_removed = echo_call(core, root, environment, echo_grant["grant_id"], "after-ui-remove")
            echo_status = cli(core, root, environment, "plugin", "status", "example.echo")["data"]
            require(echo_status["plugin"]["lifecycle_state"] == "healthy" and echo_status["resident"]["resident"], "non-UI plugin was not healthy after UI removal")
            require(echo_removed["echo"] == {"checkpoint": "after-ui-remove"}, "non-UI invocation failed after UI removal")
            incompatible = subprocess.run([sys.executable, str(package / "server" / "plugin.py")], cwd=package, env={
                "CAPBUS_PROTOCOL_VERSION": "0.1.0-alpha.1", "CAPBUS_PLUGIN_ID": PLUGIN_ID,
                "CAPBUS_MANAGEMENT_SOCKET": str(root / "run" / "core.sock"), "CAPBUS_MANAGEMENT_PROTOCOL_VERSION": "0.1.0-alpha.999",
                "CAPBUS_MANAGEMENT_IDENTITY_ID": identity_id, "CAPBUS_MANAGEMENT_CREDENTIAL_ID": "cred_invalid",
                "CAPBUS_MANAGEMENT_CREDENTIAL_GENERATION": "1", "CAPBUS_MANAGEMENT_HMAC_KEY": os.urandom(32).hex(),
            }, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            require(incompatible.returncode == 1 and not incompatible.stdout, "incompatible bootstrap did not fail closed")
            print("real Core integration: UI lifecycle plus independent non-UI operation before/after disable/remove passed")
        finally:
            if daemon.poll() is None:
                try:
                    cli(core, root, environment, "daemon", "stop")
                except Exception:
                    daemon.terminate()
                daemon.wait(timeout=10)


def start_daemon(core, root, environment):
    process = subprocess.Popen([sys.executable, "-m", "capability_bus_core.cli", "--root", str(root), "serve"], cwd=core, env=environment, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    deadline = time.time() + 10
    path = root / "run" / "core.sock"
    while time.time() < deadline and not path.exists() and process.poll() is None:
        time.sleep(0.05)
    if not path.exists():
        raise RuntimeError(process.stderr.read() or "Core daemon did not start")
    return process


def cli(core, root, environment, *arguments):
    result = subprocess.run([sys.executable, "-m", "capability_bus_core.cli", "--root", str(root), *arguments], cwd=core, env=environment, capture_output=True, text=True, timeout=30)
    stream = result.stdout if result.returncode == 0 else result.stderr
    value = json.loads(stream)
    if result.returncode != 0:
        raise RuntimeError(f"CLI {' '.join(arguments)} failed: {value}")
    return value


def session_status(core, root, environment, grant_id, key):
    value = cli(core, root, environment, "capability", "call", "ui.session.status", "--grant", grant_id, "--idempotency-key", key)
    return value["data"]["data"]


def echo_call(core, root, environment, grant_id, checkpoint):
    value = cli(core, root, environment, "capability", "call", "example.echo", "--grant", grant_id,
                "--idempotency-key", "u4-" + checkpoint, "--input", json.dumps({"checkpoint": checkpoint}, separators=(",", ":")))
    data = value["data"]["data"]
    require(data["echo"] == {"checkpoint": checkpoint}, "non-UI plugin returned an invalid result")
    return data


def pair(pairing_url, origin):
    jar = http.cookiejar.CookieJar()
    browser = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    with browser.open(pairing_url, timeout=5) as response:
        require(response.status == 200, "pairing redirect failed")
    request = urllib.request.Request(origin + "/api/session", data=b"", method="POST", headers={"Origin": origin})
    with browser.open(request, timeout=5) as response:
        csrf = json.loads(response.read())["csrf_token"]
    return browser, csrf


def management(browser, csrf, origin, operation, arguments, idempotency_key=None, expected_version=None, confirmed=False):
    request_id = "mreq_" + uuid.uuid4().hex
    trace_id = "trace_" + uuid.uuid4().hex
    draft = {"protocol_version": "0.1.0-alpha.3", "request_id": request_id, "trace_id": trace_id,
             "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "nonce": "nonce_" + uuid.uuid4().hex,
             "operation": operation, "arguments": arguments, "idempotency_key": idempotency_key,
             "expected_version": expected_version, "confirmation": {"confirmed": True, "operation": operation} if confirmed else None}
    request = urllib.request.Request(origin + "/api/management", data=json.dumps(draft, separators=(",", ":")).encode(), method="POST",
                                     headers={"Origin": origin, "Content-Type": "application/json", "X-CSRF-Token": csrf})
    with browser.open(request, timeout=35) as response:
        value = json.loads(response.read())
    require(value.get("request_id") == request_id and value.get("trace_id") == trace_id, "management correlation failed")
    return value


def wait_unreachable(origin):
    deadline = time.time() + 5
    while time.time() < deadline:
        try:
            urllib.request.urlopen(origin, timeout=0.2)
        except (OSError, urllib.error.URLError):
            return
        time.sleep(0.05)
    raise RuntimeError("UI loopback listener did not close")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run(arguments):
    return subprocess.run(arguments, check=True, capture_output=True, text=True).stdout


if __name__ == "__main__":
    main()
