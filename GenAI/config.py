import math
import random
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../Classes')))
from request import ServiceType

C = 3e8

RESERVE_RATIO = 0.10 # dành cho emergency 10%
DONE_ON_MAX_STEPS = True
INCLUDE_REMARK = False # True nếu đã remark neighbor nearest
MAX_STEP = 15
STEP_LIMIT_PENALTY = -100.0  # phạt khi vượt quá số bước tối đa
BASE_REWARD = 5
HOP_PENALTY = 5  # phạt mỗi bước
usage_pool = 10
QOS_pool = 55
timeout_pool = 8
finished_pool = 42
INVALID_ACTION_PENALTY = -80.0
DEAD_END_PENALTY = -120.0  # phạt khi không thể tiếp tục
GS_proximity_bonus = 16  # bonus when come near a gs
SPEACIAL_BONUS = 8 #For early finish
NORM_BASE = 70  # Normalization base for reward
INTER_STEP_NORM = 100.0 # Normalization base for inter-step reward

GAMMA_PROFILE = {
    ("groundstation", "user"):      1.2e-4,   # was 1.2e-4  -> reduce 3x (user-GS short ground links)
    ("groundstation", "uav"):       0.7e-4,   # was 0.7e-4  -> reduce ~2.8x (GS <-> UAV)
    ("groundstation", "LEO"):       2.5e-5,   # was 2.5e-5  -> reduce ~3.125x (GS <-> LEO)
    ("uav", "LEO"):                 2.5e-5,   # was 2.5e-5  -> reduce ~3.125x (UAV <-> LEO)
    ("LEO", "LEO"):                 1.0e-5,   # was 1.0e-5  -> reduce ~3.33x (inter-LEO ISL)
    ("LEO", "GEO"):                 1.5e-6,   # was 1.5e-6  -> reduce 3x (LEO <-> GEO)
    ("groundstation", "GEO"):       1.5e-6,   # was 1.5e-6  -> reduce 3x (GS <-> GEO)
    ("seastation", "LEO"):          3.0e-5,   # was 3.0e-5  -> reduce 3x (sea-station <-> LEO)
    ("default", "default"):         0.7e-4,   # was 0.7e-4  -> reduce ~2.8x (fallback)
}

GAMMA_BY_TYPE = {
    "LEO":          3.0e-5,   # was 3.0e-5
    "GEO":          1.0e-6,   # was 1.0e-6
    "seastation":   5.0e-5,   # was 5.0e-5
    "uav":          5.0e-5,   # was 5.0e-5
    "groundstation":1.5e-5,   # was 1.5e-5
}

PROC_DELAY_BASE_MS = {
    "LEO": 2.5,            # typical satellite forwarding fast-path ~2.5 ms
    "GEO": 7.0,              # GEO ground processing often ~7 ms
    "seastation": 4.5,     # ship/sea gateways ~4.5 ms
    "uav": 4.5,            # UAV processing ~4.5 ms
    "groundstation": 7,    # GS fast-path ~7 ms
    "user": 3.0
}


# (w_lat, w_rel, w_up, w_down)
BonusProfilesForService = {
    # Latency -> Reliability -> UP/DOWN Link
    ServiceType.EMERGENCY:      (0.5, 0.3, 0.1, 0.1),
    ServiceType.CONTROL:        (0.5, 0.3, 0.1, 0.1),
    ServiceType.VOICE:          (0.5, 0.3, 0.1, 0.1),

    # UP/DOWN Link -> Reliability -> Latency
    ServiceType.VIDEO:          (0.1, 0.2, 0.4, 0.3),
    ServiceType.STREAMING:      (0.1, 0.2, 0.4, 0.3),
    ServiceType.BULK_TRANSFER:  (0.1, 0.2, 0.4, 0.3),

    # DATA: UP/DOWN -> Latency -> Reliability
    ServiceType.DATA:           (0.2, 0.1, 0.35, 0.35),

    # IOT: Reliability -> Latency -> UP/DOWN
    ServiceType.IOT:            (0.3, 0.4, 0.15, 0.15),
}

DEFAULT_WEIGHTS = (0.25, 0.25, 0.25, 0.25)

QoSProfiles = {
    ServiceType.VOICE: {
        "uplink": (0.1, 0.3),
        "downlink": (0.2, 0.5),
        "latency": (20, 100),
        "reliability": (0.95, 0.99),
        "priority": (2, 4),
        "cpu": (1, 4),
        "power": (2, 6),
    },
    ServiceType.VIDEO: {
        "uplink": (1, 3),
        "downlink": (5, 10),
        "latency": (50, 150),
        "reliability": (0.90, 0.98),
        "priority": (3, 6),
        "cpu": (10, 30),
        "power": (20, 50),
    },
    ServiceType.DATA: {
        "uplink": (1, 5),
        "downlink": (5, 20),
        "latency": (50, 200),
        "reliability": (0.90, 0.97),
        "priority": (4, 7),
        "cpu": (5, 20),
        "power": (10, 40),
    },
    ServiceType.IOT: {
        "uplink": (0.05, 0.3),
        "downlink": (0.05, 0.2),
        "latency": (10, 100),
        "reliability": (0.97, 0.999),
        "priority": (2, 5),
        "cpu": (1, 3),
        "power": (1, 5),
    },
    ServiceType.STREAMING: {
        "uplink": (1, 3),
        "downlink": (8, 15),
        "latency": (50, 150),
        "reliability": (0.90, 0.97),
        "priority": (3, 6),
        "cpu": (15, 40),
        "power": (20, 60),
    },
    ServiceType.BULK_TRANSFER: {
        "uplink": (5, 20),
        "downlink": (20, 100),
        "latency": (100, 500),
        "reliability": (0.85, 0.95),
        "priority": (7, 10),
        "cpu": (20, 50),
        "power": (40, 80),
    },
    ServiceType.CONTROL: {
        "uplink": (0.1, 0.5),
        "downlink": (0.1, 0.5),
        "latency": (5, 50),
        "reliability": (0.99, 0.999),
        "priority": (1, 3),
        "cpu": (2, 6),
        "power": (5, 10),
    },
    ServiceType.EMERGENCY: {
        "uplink": (0.5, 2),
        "downlink": (0.5, 2),
        "latency": (1, 20),
        "reliability": (0.999, 1.0),
        "priority": (1, 1),
        "cpu": (5, 15),
        "power": (10, 20),
    },
}

def service_proc_delay_ms(node_type, service: ServiceType) -> float:
    #get the delay of the node type base on service type
    base = PROC_DELAY_BASE_MS[node_type]

    if service == ServiceType.EMERGENCY:
        return base * 0.5   # e.g. fast-path for emergency
    if service == ServiceType.CONTROL:
        return base * 0.7   # lower, but not as aggressive
    return base

def calc_link_delay_ms(distance_m: float,
                    node_a,
                    node_b,
                    service: ServiceType) -> float:
    """
    Delay (ms) for a single hop = propagation + avg proc delay.
    """
    # propagation delay (ms)
    prop_ms = (distance_m / C) * 1000.0

    # avg processing delay of both endpoints
    proc_ms = 0.5 * (service_proc_delay_ms(node_a, service) +
                    service_proc_delay_ms(node_b, service))

    return prop_ms + proc_ms
    #total path delay = sum of all link delays

def pick_gamma(a: str, b: str):
    key = (a,b)
    if key in GAMMA_PROFILE:
        return GAMMA_PROFILE[key]
    key_rev = (b,a)
    if key_rev in GAMMA_PROFILE:
        return GAMMA_PROFILE[key_rev]
    return GAMMA_PROFILE[("default","default")]

def link_reliability(type_a: str, type_b: str, distance_m: float) -> float:
    d_km = distance_m / 1000.0
    gamma = pick_gamma(type_a, type_b)
    return math.exp(-gamma * d_km)
    #total path reliability = product of all link reliabilities

def random_user():
    regions = [
        {"name": "China",          "latRange": (18, 54),   "lonRange": (73, 135),  "weight": 14},
        {"name": "India",          "latRange": (8, 37),    "lonRange": (68, 97),   "weight": 14},
        {"name": "Europe",         "latRange": (35, 60),   "lonRange": (-10, 40),  "weight": 14},
        {"name": "USA",            "latRange": (25, 50),   "lonRange": (-125, -66),"weight": 10},
        {"name": "Brazil",         "latRange": (-35, 5),   "lonRange": (-74, -34), "weight": 4},
        {"name": "Nigeria",        "latRange": (4, 14),    "lonRange": (3, 15),    "weight": 4},
        {"name": "Japan",          "latRange": (30, 45),   "lonRange": (129, 146), "weight": 4},
        {"name": "SoutheastAsia",  "latRange": (-10, 20),  "lonRange": (95, 120),  "weight": 4},
        {"name": "Other",          "latRange": (-90, 90),  "lonRange": (-180, 180),"weight": 32},
    ]

    total_weight = sum(r["weight"] for r in regions)
    rand = random.random() * total_weight

    # Weighted region selection
    selected_region = None
    for r in regions:
        if rand < r["weight"]:
            selected_region = r
            break
        rand -= r["weight"]

    # Generate latitude and longitude within range
    lat = round(random.uniform(*selected_region["latRange"]), 4)
    lon = round(random.uniform(*selected_region["lonRange"]), 4)
    alt = random.uniform(0, 2000)  # Altitude in meters

    # 60% chance of supporting 5G
    # support_5g = random.random() < 0.6
    support_5g = True

    return {"lat": lat, "lon": lon, "alt" : alt}