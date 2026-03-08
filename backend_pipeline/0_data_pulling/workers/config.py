"""
Shared configuration for all GEE worker scripts.
Paths are portable — computed relative to this file's location.
"""
import os
import ee

# ── Paths (portable) ──────────────────────────────────────────
WORKERS_DIR   = os.path.dirname(os.path.abspath(__file__))
PULLING_DIR   = os.path.dirname(WORKERS_DIR)
PIPELINE_ROOT = os.path.dirname(PULLING_DIR)
KEY_PATH      = os.path.join(PULLING_DIR, "key.txt")
DB_RAW        = os.path.join(PIPELINE_ROOT, "database", "raw")
TEMP_DIR      = os.path.join(DB_RAW, "temp")

# ── Sites ─────────────────────────────────────────────────────
SITES = {
    "kathmandu": (85.343189, 27.707763),
    "pokhara":   (83.973964, 28.205667),
    "birgunj":   (84.852162, 27.0264126),
    "chitwan":   (84.23604,  27.57961),
}

# ── Constants ─────────────────────────────────────────────────
RADIUS_EXACT  = 600    # meters
RADIUS_APPROX = 5000   # meters
KELVIN_TO_CELSIUS = -273.15
T_RANGE = 1            # 1-day GEE filter window


def init_ee():
    """Initialize Earth Engine with project ID from key.txt."""
    with open(KEY_PATH) as f:
        project_id = f.read().strip()
    ee.Initialize(project=project_id)
    return project_id
