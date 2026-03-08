"""
Sentinel-5P worker — pulls NO2, SO2, CO, HCHO, O3, AI for one site (exact + approx).
Usage: python pull_sentinel5p.py --site kathmandu --start 2025-11-18 --end 2026-03-07
Output: temp/{site}_s5p_exact.csv, temp/{site}_s5p_approx.csv
"""
import argparse
import os
import sys
import pandas as pd
import ee

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import init_ee, SITES, TEMP_DIR, RADIUS_EXACT, RADIUS_APPROX, T_RANGE

TAG = None

_COP = "COPERNICUS/S5P/OFFL/L3_"
_CND = "_column_number_density"
DATASETS = [
    (_COP + "NO2",    "tropospheric_NO2" + _CND, "no2"),
    (_COP + "SO2",    "SO2" + _CND,              "so2"),
    (_COP + "CO",     "CO" + _CND,               "co"),
    (_COP + "HCHO",   "tropospheric_HCHO" + _CND, "hcho"),
    (_COP + "O3",     "O3" + _CND,               "o3"),
    (_COP + "AER_AI", "absorbing_aerosol_index",  "ai"),
]
THRESHOLDS = {
    "no2":  (0, 0.001),
    "so2":  (0, 0.01),
    "co":   (0, 0.1),
    "o3":   (0, 0.5),
    "hcho": (0, 0.001),
    "ai":   (-5, 10),
}
GAS_NAMES = [d[2] for d in DATASETS]
COLS = ["date"] + GAS_NAMES


def log(msg):
    print(f"[{TAG}] {msg}", flush=True)


def fetch_gas(ds_id, band, name, geom, scale, s, e):
    coll = (ee.ImageCollection(ds_id)
            .filterBounds(geom).filterDate(s, e).select(band))
    if coll.size().getInfo() == 0:
        return None
    val_dict = coll.mean().reduceRegion(
        reducer=ee.Reducer.mean(), geometry=geom, scale=scale
    ).getInfo()
    v = list(val_dict.values())[0] if val_dict else None
    if v is not None:
        lo, hi = THRESHOLDS.get(name, (None, None))
        if lo is not None and not (lo <= v <= hi):
            v = None
    return v


def fetch_all(geom, scale, s, e):
    result = {}
    for ds_id, band, name in DATASETS:
        try:
            result[name] = fetch_gas(ds_id, band, name, geom, scale, s, e)
        except Exception:
            result[name] = None
    return result


def main():
    global TAG
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    args = parser.parse_args()

    TAG = f"s5p/{args.site}"
    lon, lat = SITES[args.site]

    log("Initializing EE...")
    init_ee()

    pt = ee.Geometry.Point([lon, lat])
    geom_exact  = pt.buffer(RADIUS_EXACT)
    geom_approx = pt.buffer(RADIUS_APPROX)

    dates = pd.date_range(args.start, args.end)
    log(f"{len(dates)} days to pull")

    rows_exact, rows_approx = [], []
    for i, d in enumerate(dates):
        ds = d.strftime("%Y-%m-%d")
        de = (d + pd.Timedelta(days=T_RANGE)).strftime("%Y-%m-%d")
        try:
            vals_e = fetch_all(geom_exact, RADIUS_EXACT, ds, de)
            vals_a = fetch_all(geom_approx, RADIUS_APPROX, ds, de)
        except Exception as ex:
            log(f"  {ds} ERROR: {ex}")
            vals_e = vals_a = {g: None for g in GAS_NAMES}
        rows_exact.append({"date": ds, **vals_e})
        rows_approx.append({"date": ds, **vals_a})
        if (i + 1) % 5 == 0 or i == len(dates) - 1:
            log(f"  {i + 1}/{len(dates)} done (last: {ds})")

    os.makedirs(TEMP_DIR, exist_ok=True)
    for label, rows in [("exact", rows_exact), ("approx", rows_approx)]:
        out = os.path.join(TEMP_DIR, f"{args.site}_s5p_{label}.csv")
        pd.DataFrame(rows)[COLS].to_csv(out, index=False)
        log(f"Saved {out} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
