"""
MODIS worker — pulls AOD (aod550) for one site, both exact and approx.
Usage: python pull_modis.py --site kathmandu --start 2025-11-18 --end 2026-03-07
Output: temp/{site}_modis_exact.csv, temp/{site}_modis_approx.csv
"""
import argparse
import os
import sys
import pandas as pd
import ee

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import init_ee, SITES, TEMP_DIR, RADIUS_EXACT, RADIUS_APPROX, T_RANGE

TAG = None

DATASET = "MODIS/061/MCD19A2_GRANULES"
AOD_BAND = "Optical_Depth_055"
AOD_SCALE_FACTOR = 0.001
QA_BAND = "AOD_QA"
QA_BIT_POS = 8
QA_BIT_WIDTH = 4
QA_CLEAR = [0, 1, 3, 4]
AOD_MIN, AOD_MAX = 0.001, 5.0

COLS = ["date", "aod550"]


def log(msg):
    print(f"[{TAG}] {msg}", flush=True)


def mask_qa(img):
    qa = img.select(QA_BAND)
    bits = qa.rightShift(QA_BIT_POS).bitwiseAnd((1 << QA_BIT_WIDTH) - 1)
    return img.updateMask(bits.remap(QA_CLEAR, [1] * len(QA_CLEAR)))


def fetch_aod(geom, s, e):
    coll = (ee.ImageCollection(DATASET)
            .filterBounds(geom).filterDate(s, e))
    masked = coll.map(mask_qa).select(AOD_BAND)
    if masked.size().getInfo() == 0:
        return None
    val = masked.mean().reduceRegion(
        reducer=ee.Reducer.mean(), geometry=geom, scale=1000
    ).getInfo().get(AOD_BAND)
    if val is not None:
        val *= AOD_SCALE_FACTOR
        if not (AOD_MIN <= val <= AOD_MAX):
            return None
    return val


def main():
    global TAG
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    args = parser.parse_args()

    TAG = f"modis/{args.site}"
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
            aod_e = fetch_aod(geom_exact, ds, de)
            aod_a = fetch_aod(geom_approx, ds, de)
        except Exception as ex:
            log(f"  {ds} ERROR: {ex}")
            aod_e = aod_a = None
        rows_exact.append({"date": ds, "aod550": aod_e})
        rows_approx.append({"date": ds, "aod550": aod_a})
        if (i + 1) % 5 == 0 or i == len(dates) - 1:
            log(f"  {i + 1}/{len(dates)} done (last: {ds})")

    os.makedirs(TEMP_DIR, exist_ok=True)
    for label, rows in [("exact", rows_exact), ("approx", rows_approx)]:
        out = os.path.join(TEMP_DIR, f"{args.site}_modis_{label}.csv")
        pd.DataFrame(rows)[COLS].to_csv(out, index=False)
        log(f"Saved {out} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
