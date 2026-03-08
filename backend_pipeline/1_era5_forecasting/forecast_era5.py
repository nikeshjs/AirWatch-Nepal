"""
ERA5 Forecasting Pipeline (Step 1)

After step 0 pulls data, ERA5 has a 7-8 day lag. This script:
1. Refreshes era5_only/ from raw data (overwrites last REFRESH_DAYS)
2. Loads the LSTM model + rain enhancer
3. For each site, forecasts the missing ERA5 days
4. Fills the gap in era5_only/ CSVs (raw CSVs untouched)
"""

import torch
import torch.nn as nn
import numpy as np
import pandas as pd
import joblib
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

# ── Paths ────────────────────────────────────────────────────────────
BASE = Path(__file__).resolve().parent
MODELS_DIR = BASE / "models"
DB_DIR = BASE.parent / "database"
RAW_APPROX = DB_DIR / "raw" / "approx"
RAW_EXACT = DB_DIR / "raw" / "exact"
ERA5_ONLY = DB_DIR / "era5_only"

SITES = ["kathmandu", "pokhara", "birgunj", "chitwan"]

ERA5_COLS = [
    "temp", "dew", "humi", "preci", "press", "wspeed", "wdirn",
    "surf_water", "soil_water", "evapo", "so_rad", "t_rad",
    "lei_h", "lei_l", "blh",
]

LOOKBACK = 45       # days of history for LSTM input
FORECAST_DAYS = 8   # LSTM output horizon
REFRESH_DAYS = 10   # overwrite last N days of era5_only with fresh raw data


# ── Model Definition ─────────────────────────────────────────────────
class ERA5LSTM(nn.Module):
    def __init__(self):
        super().__init__()
        self.lstm = nn.LSTM(22, 256, 2, batch_first=True)
        self.attention = nn.Sequential(
            nn.Linear(256, 256), nn.Tanh(), nn.Linear(256, 1)
        )
        self.fc_continuous = nn.Sequential(
            nn.Linear(256, 256), nn.GELU(), nn.Dropout(0.1),
            nn.Linear(256, 128), nn.GELU(), nn.Linear(128, 120),
        )
        self.fc_rain = nn.Sequential(
            nn.Linear(256, 128), nn.GELU(), nn.Dropout(0.1),
            nn.Linear(128, 8),
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        attn_w = torch.softmax(self.attention(out), dim=1)
        ctx = (attn_w * out).sum(dim=1)
        return self.fc_continuous(ctx), self.fc_rain(ctx)


# ── Helpers ──────────────────────────────────────────────────────────
def load_models():
    model = ERA5LSTM()
    state = torch.load(
        MODELS_DIR / "lstm_era5.pth", map_location="cpu", weights_only=False
    )
    model.load_state_dict(state)
    model.eval()
    enhancer = joblib.load(MODELS_DIR / "rain_enhancer.pkl")
    return model, enhancer


def build_temporal(dates):
    """7 temporal features from a DatetimeIndex."""
    doy = dates.dt.dayofyear
    month = dates.dt.month
    return np.column_stack([
        np.sin(2 * np.pi * doy / 365.25),
        np.cos(2 * np.pi * doy / 365.25),
        doy / 365.25,
        np.sin(2 * np.pi * month / 12),
        np.cos(2 * np.pi * month / 12),
        ((month >= 6) & (month <= 9)).astype(float),
        ((month >= 11) | (month <= 2)).astype(float),
    ]).astype(np.float32)


def lstm_forecast(model, era5_data, dates):
    """Run LSTM → (8, 15) continuous forecast + (8,) rain probabilities."""
    temporal = build_temporal(dates)
    X = np.concatenate([era5_data.astype(np.float32), temporal], axis=1)

    mean = X.mean(axis=0)
    std = X.std(axis=0)
    std[std == 0] = 1
    X_norm = (X - mean) / std

    with torch.no_grad():
        x_t = torch.FloatTensor(X_norm).unsqueeze(0)
        cont, rain = model(x_t)
        continuous = cont.view(FORECAST_DAYS, len(ERA5_COLS)).numpy()
        rain_probs = torch.sigmoid(rain).view(FORECAST_DAYS).numpy()

    # Denormalize with the ERA5 portion of the stats
    continuous = continuous * std[: len(ERA5_COLS)] + mean[: len(ERA5_COLS)]
    return continuous, rain_probs


def enhance_precipitation(enhancer, forecast, site, forecast_dates,
                          hist_preci, last_press, last_humi):
    """Refine LSTM precipitation with XGBoost rain enhancer (day by day)."""
    classifier = enhancer["classifier"]
    regressor = enhancer["regressor"]
    scaler = enhancer["scaler"]
    seasonal = enhancer["seasonal_stats"]

    enhanced = np.zeros(FORECAST_DAYS)
    prev_press, prev_humi = last_press, last_humi
    fcast_preci = []  # accumulates forecast precip for lag features

    for i in range(FORECAST_DAYS):
        row = {c: forecast[i, j] for j, c in enumerate(ERA5_COLS)}
        d = forecast_dates[i]
        doy = d.timetuple().tm_yday
        month = d.month

        # Combined precipitation series (history + forecast so far)
        all_preci = list(hist_preci) + fcast_preci

        features = [
            row["temp"], row["dew"], row["humi"], row["press"], row["wspeed"],
            row["temp"] - row["dew"],                         # temp_dew_spread
            100.0 / max(row["humi"], 1.0),                    # rh_inverse
            prev_press,                                       # press_lag1
            row["press"] - prev_press,                        # press_change
            prev_humi,                                        # humi_lag1
            row["humi"] - prev_humi,                          # humi_change
            all_preci[-1] if len(all_preci) >= 1 else 0,      # preci_lag1
            float(all_preci[-1] > 0) if len(all_preci) >= 1 else 0,
            all_preci[-2] if len(all_preci) >= 2 else 0,      # preci_lag2
            float(all_preci[-2] > 0) if len(all_preci) >= 2 else 0,
            all_preci[-3] if len(all_preci) >= 3 else 0,      # preci_lag3
            float(all_preci[-3] > 0) if len(all_preci) >= 3 else 0,
            all_preci[-7] if len(all_preci) >= 7 else 0,      # preci_lag7
            float(all_preci[-7] > 0) if len(all_preci) >= 7 else 0,
            sum(all_preci[-7:]),                               # rain_7d_sum
            sum(1 for x in all_preci[-7:] if x > 0),          # rain_7d_count
            np.sin(2 * np.pi * doy / 365.25),                 # sin_doy
            np.cos(2 * np.pi * doy / 365.25),                 # cos_doy
            float(6 <= month <= 9),                            # is_monsoon
            row["blh"], row["evapo"], row["soil_water"],
            float(site == "birgunj"),                          # site one-hots
            float(site == "kathmandu"),
            float(site == "chitwan"),
            float(site == "pokhara"),
        ]

        X = scaler.transform(np.array(features).reshape(1, -1))
        is_rain = classifier.predict(X)[0]

        if is_rain:
            amount = max(0.0, regressor.predict(X)[0])
            # Clip to seasonal range
            if site in seasonal and month in seasonal[site]:
                p75 = seasonal[site][month].get("p75", amount * 2)
                amount = min(amount, p75 * 2)
            enhanced[i] = amount
        else:
            enhanced[i] = 0.0

        fcast_preci.append(enhanced[i])
        prev_press = row["press"]
        prev_humi = row["humi"]

    return enhanced


def find_era5_gap(df):
    """Return start index of trailing ERA5-NaN block, or None."""
    all_nan = df[ERA5_COLS].isna().all(axis=1)
    gap_start = None
    for idx in range(len(df) - 1, -1, -1):
        if all_nan.iloc[idx]:
            gap_start = idx
        else:
            break
    return gap_start


def fill_sin_cos(df):
    """Ensure sin/cos columns are always populated from the date."""
    dates = pd.to_datetime(df["date"])
    doy = dates.dt.dayofyear
    df["sin"] = np.sin(2 * np.pi * doy / 365.25)
    df["cos"] = np.cos(2 * np.pi * doy / 365.25)
    return df


# ── Per-site processing ──────────────────────────────────────────────
def refresh_era5_only(site):
    """
    Rebuild era5_only from raw/approx, overwriting the last REFRESH_DAYS
    with freshly-pulled raw data so any new step-0 data replaces old
    forecasted values.
    """
    approx_path = RAW_APPROX / f"{site}.csv"
    if not approx_path.exists():
        return None

    df_raw = pd.read_csv(approx_path)
    df_raw["date"] = pd.to_datetime(df_raw["date"])

    keep = ["date"] + ERA5_COLS + ["sin", "cos"]
    df_era5 = df_raw[[c for c in keep if c in df_raw.columns]].copy()
    df_era5 = fill_sin_cos(df_era5)

    era5_path = ERA5_ONLY / f"{site}.csv"
    if era5_path.exists():
        df_old = pd.read_csv(era5_path)
        df_old["date"] = pd.to_datetime(df_old["date"])

        # For the last REFRESH_DAYS, overwrite with raw data
        cutoff = df_raw["date"].max() - pd.Timedelta(days=REFRESH_DAYS - 1)

        # Keep old data before cutoff (may contain earlier forecasts)
        df_keep = df_old[df_old["date"] < cutoff].copy()

        # Take raw data from cutoff onwards
        df_new = df_era5[df_era5["date"] >= cutoff].copy()

        # Also include any old dates not in raw (shouldn't happen but safe)
        df_merged = pd.concat([df_keep, df_new], ignore_index=True)
        df_merged = df_merged.drop_duplicates(subset="date", keep="last")
        df_merged = df_merged.sort_values("date").reset_index(drop=True)
    else:
        df_merged = df_era5.copy()

    df_merged["date"] = df_merged["date"].dt.strftime("%Y-%m-%d")
    df_merged.to_csv(era5_path, index=False)
    return era5_path


def process_site(site, model, enhancer):
    print(f"\n{'=' * 50}")
    print(f"  {site.upper()}")
    print(f"{'=' * 50}")

    # Step A: Refresh era5_only from raw data
    era5_path = refresh_era5_only(site)
    if era5_path is None:
        print(f"  Raw approx CSV not found — skipping")
        return
    print(f"  era5_only refreshed (last {REFRESH_DAYS} days from raw)")

    # Step B: Load the refreshed era5_only
    df = pd.read_csv(era5_path)
    df["date"] = pd.to_datetime(df["date"])

    gap_start = find_era5_gap(df)
    if gap_start is None:
        print("  No ERA5 gap found — nothing to forecast")
        return

    gap_size = len(df) - gap_start
    gap_dates = df["date"].iloc[gap_start:].tolist()
    while len(gap_dates) < FORECAST_DAYS:
        gap_dates.append(gap_dates[-1] + pd.Timedelta(days=1))
    print(f"  ERA5 gap: {gap_size} days  "
          f"({gap_dates[0].date()} → {gap_dates[gap_size - 1].date()})")

    # Gather LOOKBACK non-NaN rows
    good = df[ERA5_COLS].notna().all(axis=1)
    history = df[good].tail(LOOKBACK)
    if len(history) < LOOKBACK:
        print(f"  Insufficient history ({len(history)} < {LOOKBACK}) — skipping")
        return

    # ── LSTM forecast ────────────────────────────────────────────────
    era5_in = history[ERA5_COLS].values
    in_dates = history["date"]
    continuous, rain_probs = lstm_forecast(model, era5_in, in_dates)
    print(f"  LSTM forecast done  (rain probs: {rain_probs[:gap_size].round(3)})")

    # ── Rain enhancer ────────────────────────────────────────────────
    hist_preci = history["preci"].values[-7:].tolist()
    last_press = history["press"].iloc[-1]
    last_humi = history["humi"].iloc[-1]

    enhanced_preci = enhance_precipitation(
        enhancer, continuous, site, gap_dates,
        hist_preci, last_press, last_humi,
    )
    preci_idx = ERA5_COLS.index("preci")
    continuous[:gap_size, preci_idx] = enhanced_preci[:gap_size]
    print(f"  Rain enhanced  (mm: {enhanced_preci[:gap_size].round(3)})")

    # ── Fill gap in era5_only CSV ────────────────────────────────────
    n = min(gap_size, FORECAST_DAYS)
    for i in range(n):
        for j, col in enumerate(ERA5_COLS):
            df.at[gap_start + i, col] = round(continuous[i, j], 6)

    df = fill_sin_cos(df)
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
    df.to_csv(era5_path, index=False)
    print(f"  era5_only saved → {era5_path.name}")


# ── Main ─────────────────────────────────────────────────────────────
def main():
    print("ERA5 Forecasting Pipeline  (Step 1)")
    print("=" * 50)

    ERA5_ONLY.mkdir(parents=True, exist_ok=True)

    print("Loading models …")
    model, enhancer = load_models()
    print("Models loaded.\n")

    for site in SITES:
        process_site(site, model, enhancer)

    print(f"\n{'=' * 50}")
    print("Step 1 complete — ERA5 gaps filled.")


if __name__ == "__main__":
    main()
