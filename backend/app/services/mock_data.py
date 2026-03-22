"""Generate realistic mock data for 3 demo clients with anomalies and trends."""

import random
from datetime import datetime, timedelta, timezone

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

CHANNEL_METRICS = {
    "instagram": [
        ("followers", 1200, 8000, 50),
        ("engagement_rate", 2.0, 6.0, 0.3),
        ("posts", 8, 20, 2),
        ("impressions", 5000, 40000, 2000),
        ("reach", 3000, 25000, 1500),
    ],
    "google_ads": [
        ("clicks", 200, 1500, 100),
        ("impressions", 5000, 50000, 3000),
        ("conversions", 10, 80, 8),
        ("cost_per_conversion", 3.0, 15.0, 1.5),
        ("spend", 300, 2000, 150),
        ("roas", 2.0, 8.0, 0.5),
    ],
    "analytics": [
        ("sessions", 1000, 8000, 500),
        ("bounce_rate", 30.0, 65.0, 3.0),
        ("avg_session_duration", 60, 240, 20),
        ("page_views", 2000, 15000, 1000),
        ("conversion_rate", 1.0, 5.0, 0.3),
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

# Client-specific trends: 0=La Terraza (growing), 1=ModaEco (stable), 2=Sonrisa Plus (declining)
CLIENT_TRENDS = [0.006, 0.002, -0.003]


def generate_metrics(client_channels: dict, days: int = 90, client_index: int = 0) -> list[dict]:
    metrics = []
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    trend_factor = CLIENT_TRENDS[client_index % len(CLIENT_TRENDS)]

    for channel, enabled in client_channels.items():
        if not enabled or channel not in CHANNEL_METRICS:
            continue
        for metric_name, base_min, base_max, noise in CHANNEL_METRICS[channel]:
            base = random.uniform(base_min, base_max)

            for day_offset in range(days, 0, -1):
                date = today - timedelta(days=day_offset)
                day_num = days - day_offset

                # Trend
                value = base * (1 + trend_factor * day_num)

                # Weekly seasonality (weekends higher)
                if date.weekday() in (4, 5):
                    value *= 1.15

                # Monthly seasonality (end of month slightly higher)
                if date.day >= 25:
                    value *= 1.08

                # Anomalies: random spikes/drops (2% chance)
                if random.random() < 0.02:
                    value *= random.choice([0.5, 0.6, 1.5, 1.8])

                # Noise
                value += random.uniform(-noise, noise)
                value = max(0, round(value, 2))

                metrics.append({
                    "channel": channel,
                    "metric_name": metric_name,
                    "value": value,
                    "date": date,
                })
    return metrics
