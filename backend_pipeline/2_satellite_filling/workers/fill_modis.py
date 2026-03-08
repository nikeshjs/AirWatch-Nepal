"""
MODIS AOD gap-filling worker.

Two model types:
 - Transfer (kathmandu, birgunj, chitwan): LGB, 64 features, RobustScaler
 - Site-specific (pokhara): XGB, 124 features, no scaler, has climatology
"""

import sys, warnings, argparse
import numpy as np
import pandas as pd
import joblib

warnings.filterwarnings("ignore")

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from config import MODELS_DIR, SITES, ERA5_COLS, load_site_data, add_time_features, WINDOW_DAYS


TARGET = "aod550"


def build_transfer_features(df):
    """64 features for transfer models (kathmandu, birgunj, chitwan)."""
    df = add_time_features(df)

    # Rename for model's expected names
    df["month"] = df["month_feat"]
    df["day_of_year"] = df["dayofyear"]
    df["week_of_year"] = df["weekofyear"]

    # AOD lag features
    df["temp_dew_diff"] = df["temp"] - df["dew"]
    df["net_radiation"] = df["so_rad"] - df["t_rad"]

    for lag in [1, 2, 3, 7, 14]:
        df[f"aod_lag_{lag}"] = df[TARGET].shift(lag)

    for win in [7, 14, 30]:
        roll = df[TARGET].rolling(win, min_periods=1)
        df[f"aod_roll_mean_{win}"] = roll.mean()
        df[f"aod_roll_std_{win}"] = roll.std().fillna(0)
        df[f"aod_roll_max_{win}"] = roll.max()
        df[f"aod_roll_min_{win}"] = roll.min()

    # ERA5 rolling
    for col in ["temp", "humi", "wspeed", "blh"]:
        for win in [7, 14]:
            roll = df[col].rolling(win, min_periods=1)
            df[f"{col}_roll_mean_{win}"] = roll.mean()
            df[f"{col}_roll_std_{win}"] = roll.std().fillna(0)

    # Climatology from the raw data itself
    monthly_clim = df.groupby(df["date"].dt.month)[TARGET].agg(["mean", "std", "median"])
    m = df["date"].dt.month
    df["clim_mean"] = m.map(monthly_clim["mean"])
    df["clim_std"] = m.map(monthly_clim["std"]).fillna(0)
    df["clim_median"] = m.map(monthly_clim["median"])

    df["is_pre_monsoon"] = df["is_premonsoon"]
    return df


def build_site_specific_features(df, climatology):
    """124 features for Pokhara site-specific model."""
    df = add_time_features(df)
    df["month"] = df["month_feat"]
    df["day_of_year"] = df["dayofyear"]
    df["week"] = df["weekofyear"]

    base_cols = ["temp", "dew", "humi", "preci", "press", "wspeed",
                 "wdirn", "blh", "so_rad", "t_rad", "sin", "cos"]

    # Lag features
    for lag in [1, 2, 3, 7, 14]:
        for col in base_cols:
            df[f"{col}_lag{lag}"] = df[col].shift(lag)

    # Rolling features
    roll_cols = ["temp", "humi", "blh", "preci", "so_rad", "dew"]
    for col in roll_cols:
        df[f"{col}_roll7_mean"] = df[col].rolling(7, min_periods=1).mean()
    for col in roll_cols:
        for win in [14, 30]:
            roll = df[col].rolling(win, min_periods=1)
            df[f"{col}_roll{win}_mean"] = roll.mean()
            df[f"{col}_roll{win}_std"] = roll.std().fillna(0)

    # Interaction features
    df["blh_temp"] = df["blh"] * df["temp"]
    df["humi_temp"] = df["humi"] * df["temp"]
    df["preci_humi"] = df["preci"] * df["humi"]
    df["so_rad_temp"] = df["so_rad"] * df["temp"]
    df["wspeed_blh"] = df["wspeed"] * df["blh"]

    # Diff features
    for col in ["temp", "blh", "humi"]:
        df[f"{col}_diff1"] = df[col].diff(1)
        df[f"{col}_diff7"] = df[col].diff(7)

    # Climatology from stored stats
    doy_stats = climatology["doy_stats"]
    month_stats = climatology["month_stats"]
    doy = df["date"].dt.dayofyear
    m = df["date"].dt.month
    wk = df["weekofyear"]

    df["clim_doy_mean"] = doy.map(doy_stats.get("mean", {})).fillna(df[TARGET].median())
    df["clim_doy_std"] = doy.map(doy_stats.get("std", {})).fillna(0)
    df["clim_doy_median"] = doy.map(doy_stats.get("median", doy_stats.get("mean", {}))).fillna(df[TARGET].median())
    df["clim_month_mean"] = m.map(month_stats.get("mean", {})).fillna(df[TARGET].median())
    df["clim_month_std"] = m.map(month_stats.get("std", {})).fillna(0)
    df["clim_month_q25"] = m.map(month_stats.get("q25", {})).fillna(df[TARGET].median())
    df["clim_month_q75"] = m.map(month_stats.get("q75", {})).fillna(df[TARGET].median())

    return df


def fill_modis(site):
    print(f"  [MODIS] {site}", flush=True)
    model_data = joblib.load(MODELS_DIR / "modis" / f"{site}_model.pkl")

    # Determine model type
    feat_key = "features" if "features" in model_data else "feature_names"
    features = model_data[feat_key]
    best = model_data["best_model"]
    model = model_data[f"{best}_model"]
    scaler = model_data.get("scaler")
    climatology = model_data.get("climatology")

    df = load_site_data(site)

    if climatology is not None:
        df = build_site_specific_features(df, climatology)
    else:
        df = build_transfer_features(df)

    # Slice to window
    df = df.tail(WINDOW_DAYS).copy().reset_index(drop=True)

    # Fill NaN targets
    missing = df[TARGET].isna()
    if missing.sum() == 0:
        print(f"    No missing AOD - skipping")
        return df[["date", TARGET]].rename(columns={TARGET: f"{TARGET}_filled"})

    # Build feature matrix for missing rows, fill NaN features with median
    X = df[features].copy()
    for col in X.columns:
        if X[col].isna().any():
            X[col] = X[col].fillna(X[col].median() if X[col].notna().any() else 0)

    X_missing = X.loc[missing].values
    if scaler is not None:
        X_missing = scaler.transform(X_missing)

    predictions = model.predict(X_missing)
    predictions = np.clip(predictions, 0.001, 5.0)  # physics bounds for AOD

    filled = df[TARGET].copy()
    filled.loc[missing] = predictions
    result = df[["date"]].copy()
    result[f"{TARGET}_filled"] = filled.values
    n_filled = missing.sum()
    print(f"    Filled {n_filled}/{len(df)} days")
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True, choices=SITES)
    args = parser.parse_args()

    result = fill_modis(args.site)
    # Save temp result
    out = MODELS_DIR.parent / "temp"
    out.mkdir(exist_ok=True)
    result.to_csv(out / f"modis_{args.site}.csv", index=False)
    print(f"    Saved -> temp/modis_{args.site}.csv")


if __name__ == "__main__":
    main()
