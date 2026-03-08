"""
Sentinel-2 band gap-filling worker.

14 bands per site, each with a StackingEnsemble (XGB + LGB + CatBoost → Ridge meta).
37 features per band model.
"""

import sys, warnings, argparse
import numpy as np
import pandas as pd
import joblib

warnings.filterwarnings("ignore")

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from config import MODELS_DIR, SITES, ERA5_COLS, load_site_data, add_time_features, WINDOW_DAYS


# Stub for unpickling StackingEnsemble
class StackingEnsemble:
    def predict(self, X):
        """Stacking: average XGB, LGB, CatBoost base predictions → Ridge meta."""
        base_preds = []
        for name in ["xgb_model", "lgb_model", "cb_model"]:
            m = getattr(self, name, None)
            if m is not None:
                try:
                    p = m.predict(X)
                    base_preds.append(p)
                except Exception:
                    pass
        if not base_preds:
            return np.zeros(X.shape[0])
        base_X = np.column_stack(base_preds)
        if hasattr(self, "meta_model") and self.meta_model is not None:
            return self.meta_model.predict(base_X)
        return np.mean(base_preds, axis=0)


# Register for pickle
import __main__
__main__.StackingEnsemble = StackingEnsemble

S2_BANDS = ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B8A", "B9", "B11", "B12", "AOT", "WVP"]


def build_features_for_band(df, band, climatology):
    """Build the 37 features expected by each S2 band model."""
    df = add_time_features(df)

    # ERA5 features with era5_ prefix
    feature_map = {}
    for col in ERA5_COLS:
        feature_map[f"era5_{col}"] = df[col]
    feature_map["era5_sin"] = df["sin"]
    feature_map["era5_cos"] = df["cos"]

    # Time features
    feature_map["dayofyear"] = df["dayofyear"]
    feature_map["month"] = df["month_feat"]
    feature_map["day"] = df["day"]
    feature_map["weekofyear"] = df["weekofyear"]
    feature_map["doy_sin"] = df["doy_sin"]
    feature_map["doy_cos"] = df["doy_cos"]
    feature_map["month_sin"] = df["month_sin"]
    feature_map["month_cos"] = df["month_cos"]
    feature_map["is_monsoon"] = df["is_monsoon"]
    feature_map["is_winter"] = df["is_winter"]
    feature_map["is_premonsoon"] = df["is_premonsoon"]
    feature_map["is_postmonsoon"] = df["is_postmonsoon"]

    # Climatology for this band
    monthly_clim = climatology.get("monthly", {})
    weekly_clim = climatology.get("weekly", {})
    daily_clim = climatology.get("daily", {})

    m = df["date"].dt.month
    wk = df["weekofyear"]
    doy = df["date"].dt.dayofyear

    fallback = df[band].median() if df[band].notna().any() else 0
    feature_map[f"{band}_clim_monthly"] = m.map(monthly_clim).fillna(fallback)
    feature_map[f"{band}_clim_weekly"] = wk.map(weekly_clim).fillna(fallback)
    feature_map[f"{band}_clim_daily"] = doy.map(daily_clim).fillna(fallback)

    # Interaction features
    feature_map["temp_x_humi"] = df["temp"] * df["humi"]
    feature_map["sorad_x_blh"] = df["so_rad"] * df["blh"]
    feature_map["temp_x_sorad"] = df["temp"] * df["so_rad"]
    feature_map["wspeed_sq"] = df["wspeed"] ** 2
    feature_map["has_rain"] = (df["preci"] > 0).astype(float)

    return pd.DataFrame(feature_map, index=df.index)


def fill_sentinel2(site):
    print(f"  [S2] {site}")
    models = joblib.load(MODELS_DIR / "sentinel2" / f"{site}_models.pkl")

    df = load_site_data(site)
    df = df.tail(WINDOW_DAYS).copy().reset_index(drop=True)

    results = df[["date"]].copy()
    total_filled = 0

    for band in S2_BANDS:
        if band not in models:
            results[f"{band}_filled"] = df.get(band, np.nan)
            continue

        band_info = models[band]
        band_model = band_info["model"]
        scaler = band_info.get("scaler")
        features = band_info["features"]
        climatology = band_info.get("train_climatology", {})
        train_medians = band_info.get("train_medians", {})

        # Build features for this band
        feat_df = build_features_for_band(df, band, climatology)

        # Ensure all required features exist, fill missing with train medians
        X = pd.DataFrame(index=df.index)
        for f in features:
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

        missing = df[band].isna() if band in df.columns else pd.Series(True, index=df.index)
        n_miss = missing.sum()

        filled = df[band].copy() if band in df.columns else pd.Series(np.nan, index=df.index)

        if n_miss > 0:
            X_missing = X.loc[missing].values
            if scaler is not None:
                X_missing = scaler.transform(X_missing)
            preds = band_model.predict(X_missing)
            filled.loc[missing] = preds
            total_filled += n_miss

        results[f"{band}_filled"] = filled.values

    print(f"    Filled {total_filled} band-day gaps across {len(S2_BANDS)} bands")
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True, choices=SITES)
    args = parser.parse_args()

    result = fill_sentinel2(args.site)
    out = MODELS_DIR.parent / "temp"
    out.mkdir(exist_ok=True)
    result.to_csv(out / f"s2_{args.site}.csv", index=False)
    print(f"    Saved -> temp/s2_{args.site}.csv")


if __name__ == "__main__":
    main()
