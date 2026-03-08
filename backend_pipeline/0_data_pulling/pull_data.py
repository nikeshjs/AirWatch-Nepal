"""
GEE Data Puller — Parallel Orchestrator
========================================
Launches 16 worker processes (4 sites × 4 sources) in parallel.
Each worker pulls its source independently. Once all workers for a site
finish, this script merges their temp CSVs into the final per-site
approx and exact CSVs with smart lookback-based updating.

Usage:
    python pull_data.py            # all 4 sites
    python pull_data.py --site kathmandu   # single site
"""

import os
import sys
import subprocess
import shutil
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# ============================================================
# PATHS (portable — relative to this script)
# ============================================================

SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
PIPELINE_ROOT = os.path.dirname(SCRIPT_DIR)
WORKERS_DIR   = os.path.join(SCRIPT_DIR, "workers")
DB_RAW        = os.path.join(PIPELINE_ROOT, "database", "raw")
APPROX_DIR    = os.path.join(DB_RAW, "approx")
EXACT_DIR     = os.path.join(DB_RAW, "exact")
TEMP_DIR      = os.path.join(DB_RAW, "temp")

# ============================================================
# SITES & CONSTANTS
# ============================================================

SITES = {
    "kathmandu": (85.343189, 27.707763),
    "pokhara":   (83.973964, 28.205667),
    "birgunj":   (84.852162, 27.0264126),
    "chitwan":   (84.23604,  27.57961),
}

LOOKBACK_DAYS = 10
FALLBACK_DAYS = 30   # if no existing CSV

COLUMNS = [
    "date", "aod550",
    "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B8A", "B9", "B11", "B12",
    "AOT", "WVP",
    "no2", "so2", "co", "hcho", "o3", "ai",
    "temp", "dew", "humi", "preci", "press", "wspeed", "wdirn",
    "surf_water", "soil_water", "evapo", "so_rad", "t_rad",
    "lei_h", "lei_l", "blh",
    "sin", "cos",
    "site",
]
FEATURE_COLS = [c for c in COLUMNS if c not in ("date", "site")]

WORKERS = {
    "era5":  "pull_era5.py",
    "modis": "pull_modis.py",
    "s2":    "pull_sentinel2.py",
    "s5p":   "pull_sentinel5p.py",
}

# ============================================================
# HELPERS
# ============================================================

def load_existing(path):
    if not os.path.exists(path):
        return None
    try:
        df = pd.read_csv(path)
        if len(df) == 0:
            return None
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
        return df
    except Exception:
        return None


def get_fetch_range(site_name):
    """Determine start/end dates for a site from its existing CSVs."""
    last_dates = []
    for variant_dir in [APPROX_DIR, EXACT_DIR]:
        csv_path = os.path.join(variant_dir, f"{site_name}.csv")
        df = load_existing(csv_path)
        if df is not None:
            last_dates.append(pd.to_datetime(df["date"].iloc[-1]))

    today = datetime.now().strftime("%Y-%m-%d")
    if last_dates:
        earliest_last = min(last_dates)
        start = (earliest_last - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%d")
        return start, today, True
    else:
        fallback = (datetime.now() - timedelta(days=FALLBACK_DAYS)).strftime("%Y-%m-%d")
        return fallback, today, False


def day_sin_cos(date_str):
    d = pd.to_datetime(date_str)
    doy = d.timetuple().tm_yday
    angle = 2 * np.pi * doy / 365.25
    return round(np.sin(angle), 4), round(np.cos(angle), 4)


def smart_merge(existing_df, new_df):
    """
    Merge freshly-pulled data into existing CSV:
      - Lookback rows (date already exists): only fill NaN→non-NaN
      - New rows (date not in existing): append
    """
    if existing_df is None:
        return new_df[COLUMNS].copy()

    existing = existing_df.copy()
    new_data = new_df.copy()
    existing["date"] = existing["date"].astype(str)
    new_data["date"] = new_data["date"].astype(str)

    existing_dates = set(existing["date"])
    existing = existing.set_index("date")

    appends = []
    updated = 0

    for _, row in new_data.iterrows():
        d = row["date"]
        if d in existing_dates:
            for col in FEATURE_COLS:
                if pd.isna(existing.at[d, col]) and pd.notna(row[col]):
                    existing.at[d, col] = row[col]
                    updated += 1
        else:
            appends.append(row)

    existing = existing.reset_index()
    if appends:
        existing = pd.concat([existing, pd.DataFrame(appends)], ignore_index=True)

    existing["date"] = pd.to_datetime(existing["date"])
    existing = existing.sort_values("date").reset_index(drop=True)
    existing["date"] = existing["date"].dt.strftime("%Y-%m-%d")

    if updated:
        print(f"      Lookback: filled {updated} previously-NaN cells")
    if appends:
        print(f"      Appended {len(appends)} new rows")

    return existing[COLUMNS]


# ============================================================
# MERGE TEMP FILES → FINAL CSV
# ============================================================

def merge_site(site_name):
    """Load temp CSVs for one site, join on date, smart-merge into final CSVs."""
    print(f"\n  [{site_name}] Merging temp files...")

    # Load ERA5 (shared for approx and exact)
    era5_path = os.path.join(TEMP_DIR, f"{site_name}_era5.csv")
    df_era5 = pd.read_csv(era5_path) if os.path.exists(era5_path) else None

    for variant in ["approx", "exact"]:
        print(f"    {variant}:")
        # Load source temp files
        modis_path = os.path.join(TEMP_DIR, f"{site_name}_modis_{variant}.csv")
        s2_path    = os.path.join(TEMP_DIR, f"{site_name}_s2_{variant}.csv")
        s5p_path   = os.path.join(TEMP_DIR, f"{site_name}_s5p_{variant}.csv")

        dfs = []
        for label, path in [("era5", era5_path), ("modis", modis_path),
                             ("s2", s2_path), ("s5p", s5p_path)]:
            if os.path.exists(path):
                dfs.append(pd.read_csv(path))
                print(f"      Loaded {label}: {path}")
            else:
                print(f"      MISSING {label}: {path}")

        if not dfs:
            print(f"      No temp files found — skipping")
            continue

        # Outer-join all sources on date
        merged = dfs[0]
        for df in dfs[1:]:
            merged = pd.merge(merged, df, on="date", how="outer")

        # Add sin, cos from date
        merged["sin"] = merged["date"].apply(lambda d: day_sin_cos(d)[0])
        merged["cos"] = merged["date"].apply(lambda d: day_sin_cos(d)[1])
        merged["site"] = site_name

        # Ensure all expected columns exist
        for col in COLUMNS:
            if col not in merged.columns:
                merged[col] = float("nan")
        merged = merged[COLUMNS]

        merged["date"] = pd.to_datetime(merged["date"])
        merged = merged.sort_values("date").reset_index(drop=True)
        merged["date"] = merged["date"].dt.strftime("%Y-%m-%d")

        # Smart-merge with existing data
        variant_dir = APPROX_DIR if variant == "approx" else EXACT_DIR
        csv_path = os.path.join(variant_dir, f"{site_name}.csv")
        existing = load_existing(csv_path)

        final = smart_merge(existing, merged)

        os.makedirs(variant_dir, exist_ok=True)
        final.to_csv(csv_path, index=False)
        print(f"      Saved {csv_path} ({len(final)} rows)")


# ============================================================
# ORCHESTRATOR
# ============================================================

def launch_workers(sites_to_run):
    """Launch all worker processes in parallel and wait for them."""
    python = sys.executable
    processes = []

    for site_name in sites_to_run:
        start, end, has_data = get_fetch_range(site_name)
        status = f"lookback from {start}" if has_data else f"fresh from {start}"
        print(f"  {site_name}: {status} → {end}")

        for source, script in WORKERS.items():
            worker_path = os.path.join(WORKERS_DIR, script)
            cmd = [python, worker_path,
                   "--site", site_name,
                   "--start", start,
                   "--end", end]
            tag = f"{source}/{site_name}"
            proc = subprocess.Popen(
                cmd,
                stdout=sys.stdout,
                stderr=sys.stderr,
            )
            processes.append((tag, proc))

    print(f"\n  Launched {len(processes)} workers. Waiting...\n")

    # Wait for all workers
    failed = []
    for tag, proc in processes:
        proc.wait()
        if proc.returncode != 0:
            failed.append(tag)

    if failed:
        print(f"\n  WARNING: {len(failed)} workers failed: {failed}")
    else:
        print(f"\n  All {len(processes)} workers completed successfully!")

    return len(failed) == 0


def main():
    import argparse
    parser = argparse.ArgumentParser(description="GEE Data Puller — Parallel")
    parser.add_argument("--site", type=str, default=None,
                        help="Run for a single site (default: all 4)")
    args = parser.parse_args()

    sites_to_run = [args.site] if args.site else list(SITES.keys())

    print("=" * 60)
    print("  GEE Data Puller — Parallel (16 workers)")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)

    # Clean temp dir
    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR)
    os.makedirs(TEMP_DIR, exist_ok=True)
    print(f"  Temp dir: {TEMP_DIR}\n")

    # Phase 1: Launch all workers
    print("─── PHASE 1: Parallel data pull ───")
    success = launch_workers(sites_to_run)

    # Phase 2: Merge
    print("\n─── PHASE 2: Merge ───")
    for site_name in sites_to_run:
        merge_site(site_name)

    # Clean temp
    shutil.rmtree(TEMP_DIR, ignore_errors=True)
    print(f"\n  Temp files cleaned up.")

    print("\n" + "=" * 60)
    print("  All done!")
    print("=" * 60)


if __name__ == "__main__":
    main()
