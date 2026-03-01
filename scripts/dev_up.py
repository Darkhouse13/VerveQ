import os
import sys
import subprocess
import signal
import time


def run():
    """Start backend (uvicorn) and frontend (Expo) concurrently.

    Usage: python scripts/dev_up.py
    """
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.abspath(os.path.join(here, os.pardir))

    # Ensure working directories
    backend_cwd = os.path.join(root, "backend")
    frontend_cwd = os.path.join(root, "frontend")

    # Commands (cross-platform)
    # Use `python -m uvicorn` to avoid python3 vs python on Windows
    backend_cmd = [sys.executable, "-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", os.getenv("PORT", "8000")]
    frontend_cmd = ["npm", "start"]

    env_backend = os.environ.copy()
    env_backend.setdefault("PYTHONPATH", backend_cwd)

    procs = []

    def spawn(cmd, cwd, name, env=None):
        print(f"[dev-up] starting {name}: {cmd} (cwd={cwd})")
        return subprocess.Popen(cmd, cwd=cwd, env=env or os.environ.copy())

    try:
        p_backend = spawn(backend_cmd, backend_cwd, "backend", env_backend)
        procs.append(("backend", p_backend))

        # Small delay so backend prints its URL before Expo starts
        time.sleep(1.0)

        p_frontend = spawn(frontend_cmd, frontend_cwd, "frontend")
        procs.append(("frontend", p_frontend))

        print("[dev-up] both processes launched. Press Ctrl+C to stop.")

        # Wait for either process to exit
        while True:
            for name, proc in list(procs):
                ret = proc.poll()
                if ret is not None:
                    print(f"[dev-up] {name} exited with code {ret}. Stopping the other process...")
                    raise SystemExit(ret)
            time.sleep(0.5)

    except KeyboardInterrupt:
        print("\n[dev-up] received Ctrl+C. Terminating...")
    finally:
        # Terminate all children gracefully
        for name, proc in procs:
            if proc.poll() is None:
                try:
                    if os.name == "nt":
                        # Best effort on Windows
                        proc.terminate()
                    else:
                        proc.terminate()
                except Exception:
                    pass
        # Give them a moment to exit, then kill if needed
        deadline = time.time() + 5
        for name, proc in procs:
            while proc.poll() is None and time.time() < deadline:
                time.sleep(0.1)
            if proc.poll() is None:
                try:
                    proc.kill()
                except Exception:
                    pass
        print("[dev-up] all processes stopped.")


if __name__ == "__main__":
    run()

