"""The MCP host: runs one npm or PyPI MCP server over stdio for one connector (``docs/CONNECTORS_SKILLS.md`` §1.10).

AgentCore Runtime ``vaic_prod_mcp_host`` gives each connector its own microVM session (``mcp-<id>-<version hash>``).
The connector bridge Lambda sends ``POST /invocations`` with
``{connector_id, package: {registry_type, name, version, args[]}, env: {NAME: value}, request: <JSON-RPC message>}``.
On the first call the exact version is installed into ``/tmp/pkg``. The process starts with an environment scrubbed to
PATH, HOME=/tmp/home and the connector's own variables (no AWS variables), and JSON-RPC is relayed over its stdio.
If it exits, it is restarted once; after that every call answers an error. Env values are kept in memory only and are
never logged. Standard library only: this image carries no city code beyond this file.
"""

from __future__ import annotations

import contextlib
import hashlib
import json
import os
import queue
import re
import subprocess
import sys
import threading
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

NPM_NAME = re.compile(r"^(@[a-z0-9][a-z0-9._-]{0,100}/)?[a-z0-9][a-z0-9._-]{0,100}$")
PYPI_NAME = re.compile(r"^[A-Za-z0-9]([A-Za-z0-9._-]{0,100}[A-Za-z0-9])?$")
NPM_VERSION = re.compile(r"^\d{1,9}\.\d{1,9}\.\d{1,9}(-[0-9A-Za-z.-]{1,60})?(\+[0-9A-Za-z.-]{1,60})?$")
PYPI_VERSION = re.compile(r"^\d{1,9}(\.\d{1,9}){0,5}((a|b|rc)\d{1,9})?(\.post\d{1,9})?(\.dev\d{1,9})?$")
ENV_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,100}$")
PLACEHOLDER = re.compile(r"^\{env:([A-Za-z_][A-Za-z0-9_]{0,100})\}$")
CALL_TIMEOUT = 60.0
INSTALL_TIMEOUT = 300.0
MAX_LINE = 20_000_000
HOME_DIR = "/tmp/home"  # noqa: S108 (the microVM's only writable place; one connector per microVM)
PKG_DIR = "/tmp/pkg"  # noqa: S108


class HostError(Exception):
    def __init__(self, code: int, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class Package:
    registry_type: str
    name: str
    version: str
    args: tuple[str, ...] = ()

    def key(self) -> str:
        raw = json.dumps([self.registry_type, self.name, self.version, list(self.args)])
        return hashlib.sha256(raw.encode()).hexdigest()[:32]


def parse_package(v: Any) -> Package:
    """The package from the call body, checked again here: exact versions only, no ranges, tags, URLs or paths."""
    if not isinstance(v, dict):
        raise HostError(400, "package is missing")
    rt, name, version = v.get("registry_type"), v.get("name"), v.get("version")
    args = v.get("args") or []
    if not isinstance(name, str) or not isinstance(version, str):
        raise HostError(400, "package name and version are required")
    if rt == "npm":
        ok = bool(NPM_NAME.match(name) and NPM_VERSION.match(version))
    elif rt == "pypi":
        ok = bool(PYPI_NAME.match(name) and PYPI_VERSION.match(version))
    else:
        raise HostError(400, "only npm and pypi packages run here")
    if not ok:
        raise HostError(400, "the package name or exact version is not valid")
    if not isinstance(args, list) or len(args) > 50 or not all(isinstance(a, str) and len(a) <= 2000 for a in args):
        raise HostError(400, "args must be a short list of strings")
    return Package(rt, name, version, tuple(args))


def parse_env(v: Any) -> dict[str, str]:
    if v is None:
        return {}
    if not isinstance(v, dict) or len(v) > 50:
        raise HostError(400, "env must be an object")
    out: dict[str, str] = {}
    for k, val in v.items():
        if not isinstance(k, str) or not ENV_NAME.match(k) or not isinstance(val, str) or len(val) > 16_384:
            raise HostError(400, "env names and values must be short strings")
        if k.upper().startswith("AWS_") or k in ("PATH", "HOME"):
            raise HostError(400, f"env may not set {k}")
        out[k] = val
    return out


def base_env() -> dict[str, str]:
    """The only variables a package (and its install scripts) ever sees, before the connector's own."""
    return {"PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"), "HOME": HOME_DIR}


def install_argv(pkg: Package, target: Path) -> list[str]:
    """The exact-version install. Install scripts run (many servers need them), with the scrubbed environment."""
    if pkg.registry_type == "npm":
        return [
            "npm",
            "install",
            "--prefix",
            str(target),
            "--ignore-scripts=false",
            "--no-audit",
            "--no-fund",
            "--no-save",
            "--no-package-lock",
            f"{pkg.name}@{pkg.version}",
        ]
    return ["uv", "pip", "install", "--python", sys.executable, "--target", str(target), f"{pkg.name}=={pkg.version}"]


def _npm_bin(target: Path, name: str) -> Path:
    meta = json.loads((target / "node_modules" / name / "package.json").read_text())
    b = meta.get("bin")
    if isinstance(b, str):
        return target / "node_modules" / name / b
    if isinstance(b, dict) and b:
        short = name.rsplit("/", 1)[-1]
        rel = b.get(short) or (next(iter(b.values())) if len(b) == 1 else None)
        if rel is None:
            rel = next(iter(b.values()))
        return target / "node_modules" / name / str(rel)
    raise HostError(502, "the npm package has no command to run")


# ``python -c`` puts "-c" in sys.argv[0]: drop it and the target, so the package's script sees itself as argv[0].
PYPI_BOOT = (
    "import runpy,sys; sys.path.insert(0, sys.argv[1]); del sys.argv[:2]; "
    "runpy.run_path(sys.argv[0], run_name='__main__')"
)


def pypi_argv(target: Path, script: Path) -> list[str]:
    """Runs an installed PyPI command with ``target`` (where uv put the package) on the import path."""
    return [sys.executable, "-c", PYPI_BOOT, str(target), str(script)]


def _pypi_script(target: Path, name: str) -> Path:
    bins = sorted(p for p in (target / "bin").glob("*") if p.is_file()) if (target / "bin").is_dir() else []
    norm = re.sub(r"[-_.]+", "-", name).lower()
    pick = next((p for p in bins if re.sub(r"[-_.]+", "-", p.name).lower() == norm), None)
    if pick is None and len(bins) == 1:
        pick = bins[0]
    if pick is None:
        pick = next((p for p in bins if "mcp" in p.name.lower()), None)
    if pick is None:
        raise HostError(502, "the PyPI package has no command to run")
    return pick


def default_install(pkg: Package, target: Path) -> list[str]:
    """Installs the package into ``target`` and answers the argv that starts it (before ``args``)."""
    target.mkdir(parents=True, exist_ok=True)
    env = {**base_env(), "npm_config_cache": f"{HOME_DIR}/.npm", "UV_CACHE_DIR": f"{HOME_DIR}/.cache/uv"}
    Path(HOME_DIR).mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        install_argv(pkg, target), env=env, capture_output=True, timeout=INSTALL_TIMEOUT, check=False, cwd=target
    )
    if r.returncode != 0:
        raise HostError(502, f"installing {pkg.name} {pkg.version} failed")
    if pkg.registry_type == "npm":
        return ["node", str(_npm_bin(target, pkg.name))]
    return pypi_argv(target, _pypi_script(target, pkg.name))


Installer = Callable[[Package, Path], list[str]]


@dataclass
class Proc:
    """One running package: a child process plus a reader thread that hands answers back by request id."""

    argv: list[str]
    env: dict[str, str]
    popen: subprocess.Popen[bytes] | None = None
    waiting: dict[int, queue.Queue[dict[str, Any] | None]] = field(default_factory=dict)
    lock: threading.Lock = field(default_factory=threading.Lock)
    next_id: int = 0
    initialized: bool = False
    closed: bool = False

    def start(self) -> None:
        Path(self.env.get("HOME", HOME_DIR)).mkdir(parents=True, exist_ok=True)
        self.popen = subprocess.Popen(
            self.argv,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,  # the package's own logs could echo its key: never kept
            env=self.env,
            cwd=self.env.get("HOME", HOME_DIR),
        )
        threading.Thread(target=self._read, args=(self.popen,), daemon=True).start()

    def alive(self) -> bool:
        # Its stdout closing counts as dead too: a process that has answered and is still exiting must not be
        # reused, or the retry after a failed call lands on it again (seen under load, decision 263).
        return self.popen is not None and not self.closed and self.popen.poll() is None

    def stop(self) -> None:
        if self.popen and self.popen.poll() is None:
            self.popen.kill()
            self.popen.wait(5)

    def _read(self, p: subprocess.Popen[bytes]) -> None:
        assert p.stdout is not None
        for line in iter(lambda: p.stdout.readline(MAX_LINE), b""):  # type: ignore[union-attr]
            try:
                msg = json.loads(line)
            except ValueError:
                continue  # a stray log line on stdout
            if not isinstance(msg, dict):
                continue
            if "method" in msg and "id" in msg:  # the server asks us something (ping, roots, sampling)
                self._answer_server(msg)
            elif "id" in msg and isinstance(msg["id"], int):
                q = self.waiting.get(msg["id"])
                if q:
                    q.put(msg)
        self.closed = True  # set before waking, so a request registered after this sees it
        for q in list(self.waiting.values()):  # the process ended: wake everyone waiting
            q.put(None)

    def _answer_server(self, msg: dict[str, Any]) -> None:
        if msg.get("method") == "ping":
            reply: dict[str, Any] = {"jsonrpc": "2.0", "id": msg["id"], "result": {}}
        else:
            reply = {"jsonrpc": "2.0", "id": msg["id"], "error": {"code": -32601, "message": "not supported"}}
        with contextlib.suppress(OSError):
            self._write(reply)

    def _write(self, msg: Mapping[str, Any]) -> None:
        assert self.popen is not None and self.popen.stdin is not None
        with self.lock:
            self.popen.stdin.write(json.dumps(msg).encode() + b"\n")
            self.popen.stdin.flush()

    def notify(self, msg: Mapping[str, Any]) -> None:
        self._write({k: v for k, v in msg.items() if k != "id"})

    def request(self, msg: Mapping[str, Any], timeout: float = CALL_TIMEOUT) -> dict[str, Any] | None:
        """The answer, with the caller's id put back; None when the process died first."""
        with self.lock:
            self.next_id += 1
            rid = self.next_id
        q: queue.Queue[dict[str, Any] | None] = queue.Queue()
        self.waiting[rid] = q
        try:
            if self.closed:
                return None
            try:
                self._write({**msg, "id": rid})
            except OSError:
                return None
            try:
                out = q.get(timeout=timeout)
            except queue.Empty as e:
                raise HostError(504, "the server did not answer in time") from e
        finally:
            self.waiting.pop(rid, None)
        if out is None:
            return None
        return {**out, "id": msg.get("id")}


@dataclass
class Connector:
    """One connector's package in this session: its install, its process, one restart, and the cached initialize."""

    pkg: Package
    env_key: str
    argv: list[str]
    env: dict[str, str]
    proc: Proc | None = None
    restarts: int = 0
    init: tuple[dict[str, Any], dict[str, Any]] | None = None
    """(the initialize params the first caller sent, the server's result)."""
    lock: threading.Lock = field(default_factory=threading.Lock)

    def ensure(self) -> Proc:
        with self.lock:
            if self.proc and self.proc.alive():
                return self.proc
            if self.proc is not None:  # it was running and exited
                if self.restarts >= 1:
                    raise HostError(502, "the server stopped again after a restart")
                self.restarts += 1
                self.proc.stop()
            self.proc = Proc(self.argv, self.env)
            self.proc.start()
            if self.init is not None:  # replay the handshake to the new process
                r = self.proc.request({"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": self.init[0]})
                if r is None or "error" in r:
                    raise HostError(502, "the server did not start")
                self.proc.notify({"jsonrpc": "2.0", "method": "notifications/initialized"})
                self.proc.initialized = True
            return self.proc

    def handle(self, msg: dict[str, Any]) -> dict[str, Any] | None:
        method = msg.get("method")
        is_request = "id" in msg
        for _attempt in range(2):
            proc = self.ensure()
            if method == "initialize" and self.init is not None:
                return {"jsonrpc": "2.0", "id": msg.get("id"), "result": self.init[1]}
            if not is_request:
                if method == "notifications/initialized" and proc.initialized:
                    return None  # every bridge call opens a new MCP session; the process keeps its first one
                try:
                    proc.notify(msg)
                except OSError:
                    continue
                proc.initialized = proc.initialized or method == "notifications/initialized"
                return None
            out = proc.request(msg)
            if out is None:
                continue  # it died during the call: restart once and try again
            if method == "initialize" and "result" in out:
                self.init = (dict(msg.get("params") or {}), out["result"])
            return out
        raise HostError(502, "the server stopped")

    def stop(self) -> None:
        if self.proc:
            self.proc.stop()


class Host:
    def __init__(self, pkg_root: Path, installer: Installer = default_install) -> None:
        self.pkg_root = pkg_root
        self.installer = installer
        self.connectors: dict[str, Connector] = {}
        self.installed: dict[str, list[str]] = {}
        self.lock = threading.Lock()

    def invoke(self, body: Mapping[str, Any]) -> dict[str, Any] | None:
        cid = body.get("connector_id")
        if not isinstance(cid, str) or not re.fullmatch(r"[a-z][a-z0-9-]{1,30}", cid):
            raise HostError(400, "connector_id is not valid")
        pkg = parse_package(body.get("package"))
        env = parse_env(body.get("env"))
        req = body.get("request")
        if not isinstance(req, dict) or req.get("jsonrpc") != "2.0" or not isinstance(req.get("method"), str):
            raise HostError(400, "request must be one JSON-RPC message")
        key = f"{cid}:{pkg.key()}"
        env_key = hashlib.sha256(json.dumps(env, sort_keys=True).encode()).hexdigest()
        with self.lock:
            if pkg.key() not in self.installed:
                self.installed[pkg.key()] = self.installer(pkg, self.pkg_root / pkg.key())
            c = self.connectors.get(key)
            if c is None or c.env_key != env_key:  # first call, or a new key: start fresh with the new values
                if c is not None:
                    c.stop()
                c = Connector(pkg, env_key, self.installed[pkg.key()] + _args(pkg.args, env), {**env, **base_env()})
                self.connectors[key] = c
        return c.handle(req)


def _args(args: tuple[str, ...], env: Mapping[str, str]) -> list[str]:
    """Secret arguments arrive as ``{env:NAME}`` and are filled in only here."""
    out = []
    for a in args:
        m = PLACEHOLDER.match(a)
        out.append(env.get(m.group(1), "") if m else a)
    return out


def make_handler(host: Host) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def _send(self, status: int, body: Any) -> None:
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:
            if self.path == "/ping":
                self._send(200, {"status": "Healthy"})
            else:
                self._send(404, {"error": {"code": 404, "message": "not found"}})

        def do_POST(self) -> None:
            if self.path != "/invocations":
                self._send(404, {"error": {"code": 404, "message": "not found"}})
                return
            try:
                n = int(self.headers.get("content-length") or 0)
                if n > 10_000_000:
                    raise HostError(413, "the request is too large")
                try:
                    body = json.loads(self.rfile.read(n) or b"{}")
                except ValueError as e:
                    raise HostError(400, "the body is not JSON") from e
                if not isinstance(body, dict):
                    raise HostError(400, "the body must be an object")
                out = host.invoke(body)
                self._send(200, out if out is not None else {})
            except HostError as e:
                self._send(e.code, {"error": {"code": e.code, "message": e.message}})
            except Exception as e:
                self._send(500, {"error": {"code": 500, "message": type(e).__name__}})

        def log_message(self, format: str, *args: Any) -> None:
            sys.stderr.write(f"mcp-host {self.command} {self.path}\n")  # never the body: it carries env values

    return Handler


def main() -> None:
    host = Host(Path(os.environ.get("MCP_HOST_PKG_DIR", PKG_DIR)))
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), make_handler(host)).serve_forever()  # noqa: S104


if __name__ == "__main__":
    main()
