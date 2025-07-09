import time
import threading
from collections import deque, defaultdict
import json
import os

class SystemMonitor:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            with cls._lock:
                if not cls._instance:
                    cls._instance = super(SystemMonitor, cls).__new__(cls)
        return cls._instance

    def __init__(self, log_file='monitoring_logs.jsonl'):
        if not hasattr(self, 'initialized'):
            self.initialized = True
            self.log_file = log_file
            self.metrics = {
                "requests": deque(maxlen=1000),
                "errors": deque(maxlen=500),
                "system": deque(maxlen=60), # 1 minute of data
                "usage_analytics": defaultdict(lambda: defaultdict(int))
            }
            self.log_lock = threading.Lock()
            
            # Start a background thread for system metrics
            self.stop_event = threading.Event()
            self.system_thread = threading.Thread(target=self._collect_system_metrics, daemon=True)
            self.system_thread.start()

    def _collect_system_metrics(self):
        """Periodically collect system-level metrics."""
        while not self.stop_event.is_set():
            try:
                # NOTE: psutil is not a standard library. This will require installation.
                # If not available, these metrics will be skipped.
                import psutil
                cpu_usage = psutil.cpu_percent(interval=1)
                memory_info = psutil.virtual_memory()
                
                system_metric = {
                    "timestamp": time.time(),
                    "cpu_usage": cpu_usage,
                    "memory_usage_percent": memory_info.percent,
                    "memory_used_mb": memory_info.used / (1024 * 1024)
                }
                self.metrics["system"].append(system_metric)
                self._log_to_file("system", system_metric)

            except ImportError:
                # psutil not installed, stop trying to collect these metrics.
                print("Monitoring: `psutil` library not found. Skipping system metrics collection.")
                break
            except Exception as e:
                print(f"Error collecting system metrics: {e}")
            
            time.sleep(1) # Collect every second

    def record_request(self, path, method, status_code, duration_ms):
        """Record details of an HTTP request."""
        request_data = {
            "timestamp": time.time(),
            "path": path,
            "method": method,
            "status_code": status_code,
            "duration_ms": duration_ms
        }
        self.metrics["requests"].append(request_data)
        self._log_to_file("request", request_data)

    def record_error(self, error_details):
        """Record an error with its context."""
        self.metrics["errors"].append(error_details)
        self._log_to_file("error", error_details)

    def track_usage(self, event_type, event_key):
        """Track a specific usage event (e.g., quiz_mode_selected, 'Classic')."""
        self.metrics["usage_analytics"][event_type][event_key] += 1
        usage_data = {
            "timestamp": time.time(),
            "type": event_type,
            "key": event_key
        }
        self._log_to_file("usage", usage_data)

    def get_metrics(self):
        """Return a snapshot of the current metrics."""
        # Convert deques to lists for JSON serialization
        return {
            "requests": list(self.metrics["requests"]),
            "errors": list(self.metrics["errors"]),
            "system": list(self.metrics["system"]),
            "usage_analytics": self.metrics["usage_analytics"]
        }

    def _log_to_file(self, log_type, data):
        """Append a log entry to the persistent log file."""
        log_entry = {
            "log_type": log_type,
            "data": data
        }
        with self.log_lock:
            with open(self.log_file, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')

    def stop(self):
        """Stop background threads."""
        self.stop_event.set()
        self.system_thread.join()

# Singleton instance
monitor = SystemMonitor()
