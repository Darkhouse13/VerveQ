import time
from collections import defaultdict

class RateLimiter:
    def __init__(self, default_limit=100, default_period=60, ip_limits=None, blocked_ips=None):
        self.default_limit = default_limit
        self.default_period = default_period
        self.ip_limits = ip_limits if ip_limits else {}
        self.blocked_ips = blocked_ips if blocked_ips else set()
        self.requests = defaultdict(list)

    def is_allowed(self, ip, endpoint):
        if ip in self.blocked_ips:
            return False, "IP address is blocked."

        limit, period = self.ip_limits.get(endpoint, (self.default_limit, self.default_period))
        
        current_time = time.time()
        
        # Filter out requests that are outside the time window
        self.requests[ip] = [req_time for req_time in self.requests[ip] if current_time - req_time < period]
        
        if len(self.requests[ip]) >= limit:
            return False, f"Rate limit exceeded. Try again in {int(period - (current_time - self.requests[ip][0]))} seconds."
            
        return True, ""

    def add_request(self, ip):
        self.requests[ip].append(time.time())

    def block_ip(self, ip):
        self.blocked_ips.add(ip)

    def unblock_ip(self, ip):
        if ip in self.blocked_ips:
            self.blocked_ips.remove(ip)

    def get_stats(self):
        return {
            "blocked_ips": list(self.blocked_ips),
            "request_counts": {ip: len(reqs) for ip, reqs in self.requests.items()}
        }

# Example configuration
rate_limiter_config = {
    "default_limit": 100,
    "default_period": 60, # 1 minute
    "ip_limits": {
        "/quiz": (20, 60),
        "/answer": (20, 60),
        "/leaderboard": (5, 60),
        "/admin/stats": (10, 300)
    },
    "blocked_ips": {"192.168.1.100"}
}

limiter = RateLimiter(
    default_limit=rate_limiter_config["default_limit"],
    default_period=rate_limiter_config["default_period"],
    ip_limits=rate_limiter_config["ip_limits"],
    blocked_ips=rate_limiter_config["blocked_ips"]
)
