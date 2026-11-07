"""A fake MCP server over stdio for the MCP host tests (run as a child process; no network).

Tools: ``env`` (its environment and argv), ``pid``, ``die`` (answers, then exits) and ``crash`` (exits without
answering). It refuses a second ``initialize``, as strict servers do, so the host must answer that from its cache.
"""

import json
import os
import sys

TOOLS = [
    {"name": "env", "description": "Env.", "inputSchema": {"type": "object"}, "annotations": {"readOnlyHint": True}},
    {"name": "pid", "description": "Pid.", "inputSchema": {"type": "object"}, "annotations": {"readOnlyHint": True}},
    {"name": "die", "description": "Die.", "inputSchema": {"type": "object"}},
    {"name": "crash", "description": "Crash.", "inputSchema": {"type": "object"}},
]


def send(msg: dict) -> None:
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def text(rid: object, value: object) -> None:
    send({"jsonrpc": "2.0", "id": rid, "result": {"content": [{"type": "text", "text": json.dumps(value)}]}})


def main() -> None:
    initialized = False
    print("a log line on stdout that is not JSON", flush=True)
    for line in sys.stdin:
        msg = json.loads(line)
        rid, method = msg.get("id"), msg.get("method")
        if rid is None:
            continue
        if method == "initialize":
            if initialized:
                send({"jsonrpc": "2.0", "id": rid, "error": {"code": -32600, "message": "already initialized"}})
                continue
            initialized = True
            send(
                {
                    "jsonrpc": "2.0",
                    "id": rid,
                    "result": {
                        "protocolVersion": "2025-06-18",
                        "capabilities": {"tools": {}},
                        "serverInfo": {"name": "fake"},
                    },
                }
            )
        elif method == "tools/list":
            send({"jsonrpc": "2.0", "id": rid, "result": {"tools": TOOLS}})
        elif method == "tools/call":
            name = msg["params"]["name"]
            if name == "env":
                text(rid, {"env": dict(os.environ), "argv": sys.argv[1:]})
            elif name == "pid":
                text(rid, os.getpid())
            elif name == "die":
                text(rid, "bye")
                os._exit(0)
            elif name == "crash":
                os._exit(3)
        else:
            send({"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": "no"}})


if __name__ == "__main__":
    main()
