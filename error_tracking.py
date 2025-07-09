import traceback
import time
import json
from monitoring import monitor

class ErrorTracker:
    def __init__(self, alert_threshold=5, time_window_seconds=60):
        self.alert_threshold = alert_threshold
        self.time_window_seconds = time_window_seconds
        self.error_timestamps = []

    def capture_exception(self, exc, context=None, request=None):
        """
        Captures and logs an exception, including stack trace and context.
        """
        error_time = time.time()
        stack_trace = traceback.format_exc()
        
        error_details = {
            "timestamp": error_time,
            "type": type(exc).__name__,
            "message": str(exc),
            "stack_trace": stack_trace,
            "context": context or {},
        }

        if request:
            error_details["request"] = {
                "path": request.get("path", "N/A"),
                "method": request.get("method", "N/A"),
                "headers": dict(request.get("headers", {}))
            }

        # Use the monitor to record the error
        monitor.record_error(error_details)
        
        # Check if an alert should be triggered
        self.check_for_alert(error_details)

    def check_for_alert(self, error_details):
        """
        Checks if the number of recent errors exceeds the threshold and triggers an alert.
        """
        current_time = time.time()
        
        # Remove old timestamps
        self.error_timestamps = [t for t in self.error_timestamps if current_time - t < self.time_window_seconds]
        
        # Add current error timestamp
        self.error_timestamps.append(current_time)
        
        if len(self.error_timestamps) > self.alert_threshold:
            self.trigger_alert(len(self.error_timestamps), error_details)
            # Reset timestamps after alerting to avoid spam
            self.error_timestamps = []

    def trigger_alert(self, error_count, last_error):
        """
        Sends an alert. In a real system, this would integrate with email, Slack, etc.
        For now, it will print to console and log to a file.
        """
        alert_message = (
            f"CRITICAL ALERT: {error_count} errors detected in the last {self.time_window_seconds} seconds.\n"
            f"Last Error Type: {last_error['type']}\n"
            f"Message: {last_error['message']}\n"
            f"Timestamp: {time.ctime(last_error['timestamp'])}\n"
        )
        print(alert_message)
        
        # Log alert to a separate file for high-priority issues
        with open('alerts.log', 'a') as f:
            f.write(f"[{time.ctime()}] {alert_message}\n")

# Singleton instance
error_tracker = ErrorTracker()
