"""
Sentinel-2 worker — pulls B1-B12, AOT, WVP for one site (exact + approx).
Optimized: batches bands by native resolution (3 reduceRegion calls per
geometry instead of 14).
Usage: python pull_sentinel2.py --site kathmandu --start 2025-11-18 --end 2026-03-07
Output: temp/{site}_s2_exact.csv, temp/{site}_s2_approx.csv
"""
import argparse
import os
import sys
import pandas as pd
import ee

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import init_ee, SITES, TEMP_DIR, RADIUS_EXACT, RADIUS_APPROX, T_RANGE

TAG = None

S2_DATASET = "COPERNICUS/S2_SR_HARMONIZED"
ALL_BANDS = [
    "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8",
    "B8A", "B9", "B11", "B12", "AOT", "WVP", "SCL",
]
OUTPUT_BANDS = [
    "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8",
    "B8A", "B9", "B11", "B12", "AOT", "WVP",
]
# Group output bands by native scale for batched reduceRegion
SCALE_GROUPS = {
    10: ["B2", "B3", "B4", "B8", "AOT", "WVP"],
    20: ["B5", "B6", "B7", "B8A", "B11", "B12"],
    60: ["B1", "B9"],
}
CLEAR_PIXELS = [4, 5, 6, 11]

COLS = ["date"] + OUTPUT_BANDS


def log(msg):
    print(f"[{TAG}] {msg}", flush=True)


def cloud_mask(img):
    scl = img.select("SCL")
    return img.updateMask(scl.remap(CLEAR_PIXELS, [1] * len(CLEAR_PIXELS)))


def fetch_s2(geom, s, e):
    """Returns dict {band: value} for OUTPUT_BANDS."""
    coll = (ee.ImageCollection(S2_DATASET)
            .filterBounds(geom).filterDate(s, e))
    masked = coll.map(cloud_mask)
    if masked.size().getInfo() == 0:
        return {b: None for b in OUTPUT_BANDS}

    result = {}
    for scale, bands in SCALE_GROUPS.items():
        vals = (masked.select(bands).mean()
                .reduceRegion(reducer=ee.Reducer.mean(),
                              geometry=geom, scale=scale)
                .getInfo())
        for b in bands:
            result[b] = vals.get(b) if vals else None
    return result


def main():
    global TAG
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    args = parser.parse_args()

    TAG = f"s2/{args.site}"
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
            vals_e = fetch_s2(geom_exact, ds, de)
            vals_a = fetch_s2(geom_approx, ds, de)
        except Exception as ex:
            log(f"  {ds} ERROR: {ex}")
            vals_e = vals_a = {b: None for b in OUTPUT_BANDS}
        rows_exact.append({"date": ds, **vals_e})
        rows_approx.append({"date": ds, **vals_a})
        if (i + 1) % 5 == 0 or i == len(dates) - 1:
            log(f"  {i + 1}/{len(dates)} done (last: {ds})")

    os.makedirs(TEMP_DIR, exist_ok=True)
    for label, rows in [("exact", rows_exact), ("approx", rows_approx)]:
        out = os.path.join(TEMP_DIR, f"{args.site}_s2_{label}.csv")
        pd.DataFrame(rows)[COLS].to_csv(out, index=False)
        log(f"Saved {out} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
