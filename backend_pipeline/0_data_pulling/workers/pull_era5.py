"""
ERA5 worker — pulls ERA5-Land Daily + ERA5 Hourly for one site.
Usage: python pull_era5.py --site kathmandu --start 2025-11-18 --end 2026-03-07
Output: temp/{site}_era5.csv
"""
import argparse
import os
import sys
import numpy as np
import pandas as pd
import ee

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import init_ee, SITES, TEMP_DIR, KELVIN_TO_CELSIUS, RADIUS_EXACT, T_RANGE

TAG = None  # set in main

# ── ERA5 dataset config ──────────────────────────────────────
ERA5_LAND_DAILY = "ECMWF/ERA5_LAND/DAILY_AGGR"
ERA5_LAND_BANDS = [
    "dewpoint_temperature_2m", "temperature_2m",
    "skin_reservoir_content", "volumetric_soil_water_layer_1",
    "total_evaporation_sum",
    "surface_solar_radiation_downwards_sum",
    "surface_thermal_radiation_downwards_sum",
    "surface_pressure",
    "leaf_area_index_high_vegetation", "leaf_area_index_low_vegetation",
    "u_component_of_wind_10m", "v_component_of_wind_10m",
    "total_precipitation_sum",
]
ERA5_HOURLY = "ECMWF/ERA5/HOURLY"
ERA5_HOURLY_BANDS = ["boundary_layer_height"]
SCALE = 1000

COLS = [
    "date", "temp", "dew", "humi", "preci", "press", "wspeed", "wdirn",
    "surf_water", "soil_water", "evapo", "so_rad", "t_rad",
    "lei_h", "lei_l", "blh",
]


def log(msg):
    print(f"[{TAG}] {msg}", flush=True)


def weight_image(point, radius):
    coords = point.coordinates()
    lon = ee.Number(coords.get(0))
    lat = ee.Number(coords.get(1))
    pix = ee.Image.pixelLonLat()
    lat1 = pix.select("latitude").multiply(np.pi / 180)
    lat2 = ee.Image.constant(lat).multiply(np.pi / 180)
    dlon = ee.Image.constant(lon).multiply(np.pi / 180).subtract(
        pix.select("longitude").multiply(np.pi / 180)
    )
    dlat = lat2.subtract(lat1)
    a = dlat.divide(2).sin().pow(2).add(
        lat1.cos().multiply(lat2.cos()).multiply(dlon.divide(2).sin().pow(2))
    )
    dist = a.sqrt().asin().multiply(2 * 6_371_000)
    return dist.subtract(radius).divide(SCALE / 2).multiply(-1).clamp(0, 1)


def weighted_fetch(collection_id, bands, point, w_img, buf_geom, s, e):
    coll = (ee.ImageCollection(collection_id)
            .filterBounds(point).filterDate(s, e).select(bands))
    if coll.size().getInfo() == 0:
        return None
    mean_img = coll.mean()
    w_sum = mean_img.multiply(w_img).reduceRegion(
        reducer=ee.Reducer.sum(), geometry=buf_geom,
        scale=SCALE, maxPixels=1e9
    )
    w_total = w_img.reduceRegion(
        reducer=ee.Reducer.sum(), geometry=buf_geom,
        scale=SCALE, maxPixels=1e9
    ).getInfo().get("constant", 1)
    raw = w_sum.getInfo()
    return {b: (raw[b] / w_total if raw.get(b) is not None and w_total > 0 else None)
            for b in bands}


def r(v, n):
    return round(v, n) if v is not None else None


def derive(land, hourly):
    empty = {c: None for c in COLS if c != "date"}
    if not land:
        return empty

    td_k = land.get("dewpoint_temperature_2m")
    t_k  = land.get("temperature_2m")
    u    = land.get("u_component_of_wind_10m")
    v    = land.get("v_component_of_wind_10m")
    preci = land.get("total_precipitation_sum")

    dew  = (td_k + KELVIN_TO_CELSIUS) if td_k is not None else None
    temp = (t_k  + KELVIN_TO_CELSIUS) if t_k  is not None else None

    if u is not None and v is not None:
        wspeed = np.sqrt(u**2 + v**2)
        wdirn  = (np.arctan2(v, u) * 180 / np.pi + 360) % 360
    else:
        wspeed = wdirn = None

    humi = None
    if dew is not None and temp is not None:
        try:
            humi = 100 * (np.exp((17.625 * dew) / (243.04 + dew)) /
                          np.exp((17.625 * temp) / (243.04 + temp)))
        except Exception:
            pass

    blh = hourly.get("boundary_layer_height") if hourly else None

    return {
        "temp":       r(temp, 2),
        "dew":        r(dew, 2),
        "humi":       r(humi, 2),
        "preci":      r((preci * 1000) if preci is not None else None, 2),
        "press":      r(land.get("surface_pressure"), 2),
        "wspeed":     r(wspeed, 2),
        "wdirn":      r(wdirn, 2),
        "surf_water": r(land.get("skin_reservoir_content"), 4),
        "soil_water": r(land.get("volumetric_soil_water_layer_1"), 4),
        "evapo":      r(land.get("total_evaporation_sum"), 6),
        "so_rad":     r(land.get("surface_solar_radiation_downwards_sum"), 2),
        "t_rad":      r(land.get("surface_thermal_radiation_downwards_sum"), 2),
        "lei_h":      r(land.get("leaf_area_index_high_vegetation"), 4),
        "lei_l":      r(land.get("leaf_area_index_low_vegetation"), 4),
        "blh":        r(blh, 2),
    }


def main():
    global TAG
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    args = parser.parse_args()

    TAG = f"era5/{args.site}"
    lon, lat = SITES[args.site]

    log("Initializing EE...")
    init_ee()

    pt = ee.Geometry.Point([lon, lat])
    w_img = weight_image(pt, RADIUS_EXACT)
    buf = pt.buffer(RADIUS_EXACT + SCALE)

    dates = pd.date_range(args.start, args.end)
    log(f"{len(dates)} days to pull")

    rows = []
    for i, d in enumerate(dates):
        ds = d.strftime("%Y-%m-%d")
        de = (d + pd.Timedelta(days=T_RANGE)).strftime("%Y-%m-%d")
        try:
            land = weighted_fetch(ERA5_LAND_DAILY, ERA5_LAND_BANDS, pt, w_img, buf, ds, de)
            hrly = weighted_fetch(ERA5_HOURLY, ERA5_HOURLY_BANDS, pt, w_img, buf, ds, de)
            vals = derive(land, hrly)
        except Exception as ex:
            log(f"  {ds} ERROR: {ex}")
            vals = {c: None for c in COLS if c != "date"}
        vals["date"] = ds
        rows.append(vals)
        if (i + 1) % 5 == 0 or i == len(dates) - 1:
            log(f"  {i + 1}/{len(dates)} done (last: {ds})")

    os.makedirs(TEMP_DIR, exist_ok=True)
    out = os.path.join(TEMP_DIR, f"{args.site}_era5.csv")
    pd.DataFrame(rows)[COLS].to_csv(out, index=False)
    log(f"Saved {out} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
