"""Generate realistic mock data for 3 demo clients."""

import random
import uuid
from datetime import datetime, timedelta

DEMO_CLIENTS = [
    {
        "name": "La Terraza",
        "industry": "Restauracion",
        "channels": {"instagram": True, "google_my_business": True},
    },
    {
        "name": "ModaEco",
        "industry": "E-commerce Moda",
        "channels": {"instagram": True, "google_ads": True, "analytics": True},
    },
    {
        "name": "Sonrisa Plus",
        "industry": "Clinica Dental",
        "channels": {"facebook": True, "google_ads": True},
    },
]

# Metric definitions per channel
CHANNEL_METRICS = {
    "instagram": [
        ("followers", 1200, 8000, 50),
        ("engagement_rate", 2.0, 6.0, 0.3),
        ("posts", 8, 20, 2),
        ("impressions", 5000, 40000, 2000),
    ],
    "google_ads": [
        ("clicks", 200, 1500, 100),
        ("impressions", 5000, 50000, 3000),
        ("conversions", 10, 80, 8),
        ("cost_per_conversion", 3.0, 15.0, 1.5),
        ("spend", 300, 2000, 150),
    ],
    "analytics": [
        ("sessions", 1000, 8000, 500),
        ("bounce_rate", 30.0, 65.0, 3.0),
        ("avg_session_duration", 60, 240, 20),
        ("page_views", 2000, 15000, 1000),
    ],
    "facebook": [
        ("followers", 800, 5000, 40),
        ("engagement_rate", 1.5, 5.0, 0.4),
        ("reach", 2000, 20000, 1500),
        ("impressions", 4000, 30000, 2000),
    ],
    "google_my_business": [
        ("searches", 100, 800, 50),
        ("views", 200, 1200, 80),
        ("calls", 5, 30, 3),
        ("direction_requests", 10, 50, 5),
    ],
}


def generate_metrics(client_channels: dict, days: int = 90) -> list[dict]:
    """Generate daily metrics for the given channels over N days."""
    metrics = []
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    for channel, enabled in client_channels.items():
        if not enabled or channel not in CHANNEL_METRICS:
            continue
        for metric_name, base_min, base_max, noise in CHANNEL_METRICS[channel]:
            base = random.uniform(base_min, base_max)
            # Add a slight upward trend (growth)
            trend = random.uniform(0.002, 0.008)
            for day_offset in range(days, 0, -1):
                date = today - timedelta(days=day_offset)
                # Trend + noise + weekly seasonality
                day_factor = 1.0 + (0.15 if date.weekday() in (4, 5) else 0)  # weekend bump
                value = base * (1 + trend * (days - day_offset)) * day_factor
                value += random.uniform(-noise, noise)
                value = max(0, round(value, 2))
                metrics.append({
                    "channel": channel,
                    "metric_name": metric_name,
                    "value": value,
                    "date": date,
                })
    return metrics
