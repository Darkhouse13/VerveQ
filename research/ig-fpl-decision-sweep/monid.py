#!/usr/bin/env python3
"""MONID-SWEEP-2 helper: POST /v1/run, poll to completion, save JSON, track spend.

Usage: python3 monid.py <outfile.json> '<json-run-body>'
Prints: STATUS cost=<usd> <outfile>
Exits 1 on provider error (caller decides retry/stop per budget rules).
"""
import json, sys, time, urllib.request, os

KEY = os.environ["MONID_KEY"]
BASE = "https://api.monid.ai/v1"

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")

def main():
    outfile, runbody = sys.argv[1], json.loads(sys.argv[2])
    code, j = req("POST", "/run", runbody)
    if code not in (200, 202):
        print(f"SUBMIT-ERROR http={code} {json.dumps(j)[:300]}"); sys.exit(1)
    run_id = j.get("runId")
    for _ in range(60):
        if j.get("status") in ("COMPLETED", "FAILED", "ERROR"):
            break
        time.sleep(3)
        code, j = req("GET", f"/runs/{run_id}")
    cost = (j.get("cost") or {}).get("value", 0)
    with open(outfile, "w") as f:
        json.dump(j, f)
    print(f"{j.get('status')} cost={cost} {outfile}")
    if j.get("status") != "COMPLETED":
        print(json.dumps(j.get("providerResponse") or j)[:400]); sys.exit(1)

main()
