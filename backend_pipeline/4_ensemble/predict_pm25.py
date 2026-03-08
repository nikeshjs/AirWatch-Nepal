"""
Step 4 -- PM2.5 prediction using the ensemble model.

Reads ensemble_ready/{site}.csv (40 cols, 50 rows), engineers
rolling + interaction features, runs XGB/LGB/CatBoost ensemble,
appends pm2.5 column, and writes lstm_ready/{site}.csv (41 cols, 50 rows).

Model: backend_pipeline/4_ensemble/model/final_deployment_finetuned_models.joblib
  - 3 regressors (xgb, lgb, cat), averaged in log1p space, expm1 back
  - 47 input features (35 raw + 7 rolling causal + 5 interactions)
"""

import os
import sys
import joblib
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENSEMBLE_READY_DIR = os.path.join(BASE_DIR, "..", "database", "ensemble_ready")
LSTM_READY_DIR = os.path.join(BASE_DIR, "..", "database", "lstm_ready")
MODEL_PATH = os.path.join(BASE_DIR, "model", "final_deployment_finetuned_models.joblib")

SITES = ["kathmandu", "pokhara", "birgunj", "chitwan"]

# 7 columns that get causal rolling features: shift(1).rolling(5, min_periods=1).mean()
ROLLING_INPUTS = ["hcho_filled", "o3_filled", "WVP_filled", "evapo", "humi", "press", "sin"]
EPSILON = 1e-6


def load_artifact():
    return joblib.load(MODEL_PATH)


def add_engineered_features(df):
    """Add 7 rolling-causal + 5 interaction features. Expects chronological order."""
    for col in ROLLING_INPUTS:
        df[f"{col}_roll5_causal"] = (
            df[col].shift(1).rolling(window=5, min_periods=1).mean()
        )
    df["aod550_filled_mul_cos"] = df["aod550_filled"] * df["cos"]
    df["aod550_filled_div_cos"] = df["aod550_filled"] / (df["cos"] + EPSILON)
    df["cos_div_aod550_filled"] = df["cos"] / (df["aod550_filled"] + EPSILON)
    df["aod550_filled_mul_evapo"] = df["aod550_filled"] * df["evapo"]
    df["aod550_filled_div_surf_water"] = df["aod550_filled"] / (df["surf_water"] + EPSILON)
    return df


def predict_pm25(df, artifact):
    """Run XGB+LGB+CatBoost ensemble, return pm2.5 array."""
    feature_order = artifact["feature_order"]
    X = df[feature_order]
    models = artifact["models"]
    pred_log = (
        models["xgb"].predict(X)
        + models["lgb"].predict(X)
        + models["cat"].predict(X)
    ) / 3.0
    return np.expm1(pred_log)


def process_site(site, artifact):
    print(f"[{site}] Loading ensemble_ready data ...")
    input_path = os.path.join(ENSEMBLE_READY_DIR, f"{site}.csv")
    df = pd.read_csv(input_path)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    # Engineer features (per-site, already single site)
    df = add_engineered_features(df)

    # Predict
    pm25 = predict_pm25(df, artifact)
    df["pm2.5"] = pm25

    # Build output: original 40 columns + pm2.5 = 41
    # Keep the exact same columns as ensemble_ready + pm2.5
    out_cols = [
        "date", "aod550_filled",
        "B1_filled", "B2_filled", "B3_filled", "B4_filled", "B5_filled",
        "B6_filled", "B7_filled", "B8_filled", "B8A_filled",
        "B9_filled", "B11_filled", "B12_filled", "AOT_filled", "WVP_filled",
        "no2_filled", "so2_filled", "co_filled", "hcho_filled", "o3_filled", "ai_filled",
        "temp", "dew", "humi", "preci", "press", "wspeed", "wdirn",
        "surf_water", "soil_water", "evapo", "so_rad", "t_rad",
        "lei_h", "lei_l", "blh", "sin", "cos", "site", "pm2.5",
    ]
    out = df[out_cols].copy()
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")

    os.makedirs(LSTM_READY_DIR, exist_ok=True)
    out_path = os.path.join(LSTM_READY_DIR, f"{site}.csv")
    out.to_csv(out_path, index=False)

    nan_count = out.isna().sum().sum()
    print(f"  [{site}] {len(out)} rows, {len(out.columns)} cols, {nan_count} NaN, pm2.5 range: {pm25.min():.2f} - {pm25.max():.2f}")
    return True


def main():
    print("=" * 60)
    print("Step 4: PM2.5 prediction (ensemble -> lstm_ready)")
    print("=" * 60)

    artifact = load_artifact()
    print(f"Model loaded: {len(artifact['feature_order'])} features, 3 models (xgb/lgb/cat)")

    sites = SITES
    if len(sys.argv) > 1 and sys.argv[1] == "--site":
        sites = [sys.argv[2]]

    ok = 0
    for site in sites:
        try:
            process_site(site, artifact)
            ok += 1
        except Exception as e:
            print(f"  [{site}] FAILED: {e}")
            import traceback
            traceback.print_exc()

    print(f"\nDone: {ok}/{len(sites)} sites predicted.")
    return 0 if ok == len(sites) else 1


if __name__ == "__main__":
    sys.exit(main())
