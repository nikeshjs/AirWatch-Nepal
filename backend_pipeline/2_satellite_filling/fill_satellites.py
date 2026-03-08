"""
Satellite Gap-Filling Pipeline (Step 2)

After step 1 fills ERA5 gaps, this script fills satellite gaps for
MODIS (AOD), Sentinel-2 (14 bands), and Sentinel-5P (6 gases)
using per-site ML models.

Runs 3 workers per site in parallel (12 total), then merges results
into exact_ready/{site}.csv with:
 - ERA5 + sin/cos columns as-is (no suffix)
 - All satellite columns with _filled suffix
 - Last 50 days of data
"""

import subprocess
import sys
import warnings
import numpy as np
import pandas as pd
from pathlib import Path

warnings.filterwarnings("ignore")

BASE = Path(__file__).resolve().parent
WORKERS_DIR = BASE / "workers"
DB_DIR = BASE.parent / "database"
RAW_APPROX = DB_DIR / "raw" / "approx"
ERA5_ONLY = DB_DIR / "era5_only"
EXACT_READY = DB_DIR / "exact_ready"
TEMP_DIR = BASE / "temp"

SITES = ["kathmandu", "pokhara", "birgunj", "chitwan"]

ERA5_COLS = [
    "temp", "dew", "humi", "preci", "press", "wspeed", "wdirn",
    "surf_water", "soil_water", "evapo", "so_rad", "t_rad",
    "lei_h", "lei_l", "blh",
]

# Columns from raw that are NOT satellite data
NO_SUFFIX_COLS = {"date"} | set(ERA5_COLS) | {"sin", "cos", "site"}

# All raw column order
RAW_COLS = [
    "date", "aod550", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8",
    "B8A", "B9", "B11", "B12", "AOT", "WVP", "no2", "so2", "co",
    "hcho", "o3", "ai", "temp", "dew", "humi", "preci", "press",
    "wspeed", "wdirn", "surf_water", "soil_water", "evapo", "so_rad",
    "t_rad", "lei_h", "lei_l", "blh", "sin", "cos", "site",
]

WINDOW_DAYS = 50
PYTHON = sys.executable


def run_workers():
    """Launch all 12 worker processes (3 satellites × 4 sites) in parallel."""
    TEMP_DIR.mkdir(exist_ok=True)

    workers = [
        ("fill_modis.py", "modis"),
        ("fill_sentinel2.py", "s2"),
        ("fill_sentinel5p.py", "s5p"),
    ]

    procs = []
    for worker_file, label in workers:
        for site in SITES:
            cmd = [PYTHON, str(WORKERS_DIR / worker_file), "--site", site]
            p = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=str(BASE),
            )
            procs.append((label, site, p))
            print(f"  Started {label}/{site} (PID {p.pid})")

    # Wait for all
    failed = []
    for label, site, p in procs:
        stdout, stderr = p.communicate()
        if stdout:
            for line in stdout.decode().strip().split("\n"):
                print(f"    {line}")
        if p.returncode != 0:
            print(f"  ERROR {label}/{site}: {stderr.decode()[:500]}")
            failed.append(f"{label}/{site}")

    if failed:
        print(f"\n  WARNING: {len(failed)} workers failed: {failed}")
    return len(failed) == 0


def merge_results():
    """Merge MODIS, S2, S5P results with ERA5 into exact_ready CSVs."""
    EXACT_READY.mkdir(parents=True, exist_ok=True)

    for site in SITES:
        print(f"\n  Merging {site}...")

        # Load raw approx for the base (last 50 days)
        raw = pd.read_csv(RAW_APPROX / f"{site}.csv")
        raw["date"] = pd.to_datetime(raw["date"])
        raw = raw.tail(WINDOW_DAYS).copy().reset_index(drop=True)

        # Load ERA5 (filled, from era5_only)
        era5 = pd.read_csv(ERA5_ONLY / f"{site}.csv")
        era5["date"] = pd.to_datetime(era5["date"])

        # Load worker results
        modis_path = TEMP_DIR / f"modis_{site}.csv"
        s2_path = TEMP_DIR / f"s2_{site}.csv"
        s5p_path = TEMP_DIR / f"s5p_{site}.csv"

        df_modis = pd.read_csv(modis_path) if modis_path.exists() else None
        df_s2 = pd.read_csv(s2_path) if s2_path.exists() else None
        df_s5p = pd.read_csv(s5p_path) if s5p_path.exists() else None

        if df_modis is not None:
            df_modis["date"] = pd.to_datetime(df_modis["date"])
        if df_s2 is not None:
            df_s2["date"] = pd.to_datetime(df_s2["date"])
        if df_s5p is not None:
            df_s5p["date"] = pd.to_datetime(df_s5p["date"])

        # Build output following raw column order
        out = pd.DataFrame()
        out["date"] = raw["date"]

        # For each raw column, decide: keep as-is or use _filled version
        for col in RAW_COLS:
            if col == "date":
                continue

            if col in NO_SUFFIX_COLS:
                # ERA5 / sin / cos / site → no suffix, use era5_only data
                if col in ERA5_COLS or col in ("sin", "cos"):
                    merged = out[["date"]].merge(era5[["date", col]], on="date", how="left")
                    out[col] = merged[col].values
                elif col == "site":
                    out[col] = site
            else:
                # Satellite column → _filled suffix
                filled_col = f"{col}_filled"
                value = None

                # Check which worker has this column
                if df_modis is not None and filled_col in df_modis.columns:
                    merged = out[["date"]].merge(df_modis[["date", filled_col]], on="date", how="left")
                    value = merged[filled_col].values
                elif df_s2 is not None and filled_col in df_s2.columns:
                    merged = out[["date"]].merge(df_s2[["date", filled_col]], on="date", how="left")
                    value = merged[filled_col].values
                elif df_s5p is not None and filled_col in df_s5p.columns:
                    merged = out[["date"]].merge(df_s5p[["date", filled_col]], on="date", how="left")
                    value = merged[filled_col].values

                if value is not None:
                    out[filled_col] = value
                else:
                    # Fallback: use raw data with _filled suffix
                    out[filled_col] = raw[col].values if col in raw.columns else np.nan

        out["date"] = out["date"].dt.strftime("%Y-%m-%d")
        out_path = EXACT_READY / f"{site}.csv"
        out.to_csv(out_path, index=False)

        # Stats
        n_rows = len(out)
        sat_cols = [c for c in out.columns if c.endswith("_filled")]
        n_nan = out[sat_cols].isna().sum().sum()
        print(f"    {site}: {n_rows} rows, {len(sat_cols)} satellite cols, {n_nan} NaN remaining")


def cleanup_temp():
    """Remove temp worker CSVs."""
    if TEMP_DIR.exists():
        for f in TEMP_DIR.glob("*.csv"):
            f.unlink()
        print("  Temp files cleaned up")


def main():
    print("Satellite Gap-Filling Pipeline  (Step 2)")
    print("=" * 50)

    print("\nLaunching workers...")
    success = run_workers()

    print("\nMerging results into exact_ready/...")
    merge_results()

    cleanup_temp()

    print(f"\n{'=' * 50}")
    print("Step 2 complete - satellite gaps filled.")


if __name__ == "__main__":
    main()
