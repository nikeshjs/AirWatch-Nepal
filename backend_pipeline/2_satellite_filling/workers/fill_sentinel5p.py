"""
Sentinel-5P trace gas gap-filling worker.

6 gas features per site, each with its own model (XGB/LGB/CatBoost).
34 features per gas model.
"""

import sys, warnings, argparse
import numpy as np
import pandas as pd
import joblib

warnings.filterwarnings("ignore")

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from config import MODELS_DIR, SITES, ERA5_COLS, load_site_data, add_time_features, WINDOW_DAYS


S5P_GASES = ["no2", "so2", "co", "hcho", "o3", "ai"]


def build_features_for_gas(df, gas, climatology, train_medians):
    """Build the 34 features expected by each S5P gas model."""
    df = add_time_features(df)

    feature_map = {}

    # ERA5 with era5_ prefix
    for col in ERA5_COLS:
        feature_map[f"era5_{col}"] = df[col]
    feature_map["era5_sin"] = df["sin"]
    feature_map["era5_cos"] = df["cos"]

    # Time features
    feature_map["dayofyear"] = df["dayofyear"]
    feature_map["month"] = df["month_feat"]
    feature_map["weekofyear"] = df["weekofyear"]
    feature_map["doy_sin"] = df["doy_sin"]
    feature_map["doy_cos"] = df["doy_cos"]
    feature_map["month_sin"] = df["month_sin"]
    feature_map["month_cos"] = df["month_cos"]
    feature_map["is_monsoon"] = df["is_monsoon"]
    feature_map["is_winter"] = df["is_winter"]
    feature_map["is_premonsoon"] = df["is_premonsoon"]
    feature_map["is_postmonsoon"] = df["is_postmonsoon"]

    # Climatology for this gas
    monthly_clim = climatology.get("monthly", {})
    weekly_clim = climatology.get("weekly", {})

    m = df["date"].dt.month
    wk = df["weekofyear"]

    fallback = df[gas].median() if gas in df.columns and df[gas].notna().any() else 0
    feature_map[f"{gas}_clim_monthly"] = m.map(monthly_clim).fillna(fallback)
    feature_map[f"{gas}_clim_weekly"] = wk.map(weekly_clim).fillna(fallback)

    # Interaction features
    feature_map["temp_x_humi"] = df["temp"] * df["humi"]
    feature_map["sorad_x_blh"] = df["so_rad"] * df["blh"]
    feature_map["wspeed_sq"] = df["wspeed"] ** 2
    feature_map["has_rain"] = (df["preci"] > 0).astype(float)

    return pd.DataFrame(feature_map, index=df.index)


def fill_sentinel5p(site):
    print(f"  [S5P] {site}")
    model_data = joblib.load(MODELS_DIR / "sentinel5p" / f"{site}_model.pkl")

    gas_models = model_data["features"]

    df = load_site_data(site)
    df = df.tail(WINDOW_DAYS).copy().reset_index(drop=True)

    results = df[["date"]].copy()
    total_filled = 0

    for gas in S5P_GASES:
        if gas not in gas_models:
            results[f"{gas}_filled"] = df.get(gas, np.nan)
            continue

        gas_info = gas_models[gas]
        model = gas_info["model"]
        scaler = gas_info.get("scaler")
        feature_cols = gas_info["feature_cols"]
        climatology = gas_info.get("climatology", {})
        train_medians = gas_info.get("train_medians", {})

        feat_df = build_features_for_gas(df, gas, climatology, train_medians)

        # Build feature matrix
        X = pd.DataFrame(index=df.index)
        for f in feature_cols:
            if f in feat_df.columns:
                X[f] = feat_df[f]
            elif f in df.columns:
                X[f] = df[f]
            else:
                X[f] = train_medians.get(f, 0)

        # Fill NaN in features
        for col in X.columns:
            if X[col].isna().any():
                fill_val = train_medians.get(col, X[col].median() if X[col].notna().any() else 0)
                X[col] = X[col].fillna(fill_val)

        missing = df[gas].isna() if gas in df.columns else pd.Series(True, index=df.index)
        n_miss = missing.sum()

        filled = df[gas].copy() if gas in df.columns else pd.Series(np.nan, index=df.index)

        if n_miss > 0:
            X_missing = X.loc[missing].values
            if scaler is not None:
                X_missing = scaler.transform(X_missing)
            preds = model.predict(X_missing)
            filled.loc[missing] = preds
            total_filled += n_miss

        results[f"{gas}_filled"] = filled.values

    print(f"    Filled {total_filled} gas-day gaps across {len(S5P_GASES)} gases")
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True, choices=SITES)
    args = parser.parse_args()

    result = fill_sentinel5p(args.site)
    out = MODELS_DIR.parent / "temp"
    out.mkdir(exist_ok=True)
    result.to_csv(out / f"s5p_{args.site}.csv", index=False)
    print(f"    Saved -> temp/s5p_{args.site}.csv")


if __name__ == "__main__":
    main()
