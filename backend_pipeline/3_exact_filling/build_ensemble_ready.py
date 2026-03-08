"""
Step 3 -- Approx-to-Exact conversion for ensemble-ready output.

Reads the filled-approx data from exact_ready/, applies 21 per-site
models (1 MODIS + 14 Sentinel-2 + 6 Sentinel-5P) that map
approx -> exact, and writes ensemble_ready/ CSVs.

Models live in backend_pipeline/3_exact_filling/models/{site}_models.pkl.
Each sub-model expects a single feature (the filled approx value).

Input:  backend_pipeline/database/exact_ready/{site}.csv   (50 rows, 40 cols)
Output: backend_pipeline/database/ensemble_ready/{site}.csv (50 rows, 40 cols)
"""

import os
import sys
import pickle
import warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

EXACT_READY_DIR = os.path.join(BASE_DIR, "..", "database", "exact_ready")
ENSEMBLE_READY_DIR = os.path.join(BASE_DIR, "..", "database", "ensemble_ready")
MODEL_DIR = os.path.join(BASE_DIR, "models")

SITES = ["kathmandu", "pokhara", "birgunj", "chitwan"]

# 21 satellite columns that get converted (key in model dict -> column name)
MODEL_KEY_TO_COL = {
    "modis_aod550":   "aod550",
    "sentinel2_B1":   "B1",
    "sentinel2_B2":   "B2",
    "sentinel2_B3":   "B3",
    "sentinel2_B4":   "B4",
    "sentinel2_B5":   "B5",
    "sentinel2_B6":   "B6",
    "sentinel2_B7":   "B7",
    "sentinel2_B8":   "B8",
    "sentinel2_B8A":  "B8A",
    "sentinel2_B9":   "B9",
    "sentinel2_B11":  "B11",
    "sentinel2_B12":  "B12",
    "sentinel2_AOT":  "AOT",
    "sentinel2_WVP":  "WVP",
    "sentinel5p_no2": "no2",
    "sentinel5p_so2": "so2",
    "sentinel5p_co":  "co",
    "sentinel5p_o3":  "o3",
    "sentinel5p_hcho":"hcho",
    "sentinel5p_ai":  "ai",
}

# Satellite columns get _filled suffix (matches exact_ready schema)
SATELLITE_COLS = list(MODEL_KEY_TO_COL.values())

FINAL_COLS = [
    "date", "aod550_filled",
    "B1_filled", "B2_filled", "B3_filled", "B4_filled", "B5_filled",
    "B6_filled", "B7_filled", "B8_filled", "B8A_filled",
    "B9_filled", "B11_filled", "B12_filled", "AOT_filled", "WVP_filled",
    "no2_filled", "so2_filled", "co_filled", "hcho_filled", "o3_filled", "ai_filled",
    "temp", "dew", "humi", "preci", "press", "wspeed", "wdirn",
    "surf_water", "soil_water", "evapo", "so_rad", "t_rad",
    "lei_h", "lei_l", "blh", "sin", "cos", "site",
]


def load_models(site):
    path = os.path.join(MODEL_DIR, f"{site}_models.pkl")
    with open(path, "rb") as f:
        return pickle.load(f)


def process_site(site):
    print(f"[{site}] Loading exact_ready data ...")
    input_path = os.path.join(EXACT_READY_DIR, f"{site}.csv")
    df = pd.read_csv(input_path)
    nrows = len(df)

    models = load_models(site)
    out = pd.DataFrame()
    out["date"] = df["date"]

    converted = 0
    for model_key, col_name in MODEL_KEY_TO_COL.items():
        filled_col = f"{col_name}_filled"
        if filled_col not in df.columns:
            print(f"  WARNING: {filled_col} not in exact_ready, skipping")
            continue

        model = models[model_key]["model"]
        approx_vals = df[filled_col].values.reshape(-1, 1)
        exact_vals = model.predict(approx_vals)
        out[f"{col_name}_filled"] = exact_vals
        converted += 1

    # Copy non-satellite columns as-is (ERA5, sin, cos, site)
    non_sat_cols = [c for c in FINAL_COLS if c != "date" and c not in [f"{s}_filled" for s in SATELLITE_COLS]]
    for c in non_sat_cols:
        if c in df.columns:
            out[c] = df[c].values

    # Reorder to final schema
    out = out[FINAL_COLS]

    os.makedirs(ENSEMBLE_READY_DIR, exist_ok=True)
    out_path = os.path.join(ENSEMBLE_READY_DIR, f"{site}.csv")
    out.to_csv(out_path, index=False)

    nan_count = out.isna().sum().sum()
    print(f"  [{site}] {converted}/21 columns converted, {nrows} rows, {nan_count} NaN -> {out_path}")
    return True


def main():
    print("=" * 60)
    print("Step 3: Approx -> Exact conversion (ensemble_ready)")
    print("=" * 60)

    sites = SITES
    if len(sys.argv) > 1 and sys.argv[1] == "--site":
        sites = [sys.argv[2]]

    ok = 0
    for site in sites:
        try:
            process_site(site)
            ok += 1
        except Exception as e:
            print(f"  [{site}] FAILED: {e}")

    print(f"\nDone: {ok}/{len(sites)} sites converted.")
    return 0 if ok == len(sites) else 1


if __name__ == "__main__":
    sys.exit(main())
