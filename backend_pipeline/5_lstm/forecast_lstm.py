"""
Step 5 -- 7-day PM2.5 forecast using Bidirectional LSTM with Attention.

Reads lstm_ready/{site}.csv (41 cols, 50 rows), engineers 69 features
(36 raw + temporal + cyclical + site_encoded + pm2.5 rolling/lag/diff/ema),
scales with RobustScaler, feeds last 30-day window to BiLSTM-Attention,
inverse-transforms with MinMaxScaler + expm1, and writes final.csv.

Model:   5_lstm/models/pm25_lstm_model.pth
Scalers: 5_lstm/models/feature_scaler.pkl, target_scaler.pkl

Output:  database/final.csv
  Columns: date, site, pm2.5, pm2.5_1, pm2.5_2, ..., pm2.5_7
  Rows: 4 (one per site), updated daily
"""

import os
import sys
import json
import pickle
import warnings
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import torch
import torch.nn as nn

warnings.filterwarnings("ignore")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LSTM_READY_DIR = os.path.join(BASE_DIR, "..", "database", "lstm_ready")
MODEL_PATH = os.path.join(BASE_DIR, "models", "pm25_lstm_model.pth")
FEATURE_SCALER_PATH = os.path.join(BASE_DIR, "models", "feature_scaler.pkl")
TARGET_SCALER_PATH = os.path.join(BASE_DIR, "models", "target_scaler.pkl")
CONFIG_PATH = os.path.join(BASE_DIR, "info(can delete if not need)", "model_config.json")
FINAL_CSV_PATH = os.path.join(BASE_DIR, "..", "database", "final.csv")

SITES = ["kathmandu", "pokhara", "birgunj", "chitwan"]
SITE_ENCODING = {"birgunj": 0, "chitwan": 1, "kathmandu": 2, "pokhara": 3}

INPUT_WINDOW = 30
OUTPUT_WINDOW = 7

# 36 raw feature columns (order must match model_config.json)
RAW_FEATURES = [
    "ai_filled", "aod550_filled", "AOT_filled", "B1_filled", "B11_filled",
    "B12_filled", "B2_filled", "B3_filled", "B4_filled", "B5_filled",
    "B6_filled", "B7_filled", "B8_filled", "B8A_filled", "co_filled",
    "hcho_filled", "no2_filled", "o3_filled", "so2_filled", "WVP_filled",
    "blh", "cos", "dew", "evapo", "humi", "lei_h", "lei_l", "preci",
    "press", "sin", "so_rad", "soil_water", "surf_water", "t_rad", "temp", "wspeed",
]


# --------------- Model Architecture ---------------

class BiLSTMAttention(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers, output_size, dropout=0.2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=True,
        )
        self.attention = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 1),
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout / 2),
            nn.Linear(hidden_size // 2, output_size),
        )

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        attn_weights = torch.softmax(self.attention(lstm_out), dim=1)
        context = torch.sum(attn_weights * lstm_out, dim=1)
        return self.fc(context)


# --------------- Feature Engineering ---------------

def engineer_features(df, site):
    """Build 69 features from a single-site lstm_ready DataFrame."""
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    # --- 36 raw features (already in df) ---
    for col in RAW_FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    pm = df["pm2.5"].copy()

    # --- 5 temporal features ---
    df["day_of_year"] = df["date"].dt.dayofyear
    df["month"] = df["date"].dt.month
    df["day_of_week"] = df["date"].dt.dayofweek
    df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

    # --- 6 cyclical features ---
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
    df["day_sin"] = np.sin(2 * np.pi * df["day_of_year"] / 365)
    df["day_cos"] = np.cos(2 * np.pi * df["day_of_year"] / 365)
    df["week_sin"] = np.sin(2 * np.pi * df["week_of_year"] / 52)
    df["week_cos"] = np.cos(2 * np.pi * df["week_of_year"] / 52)

    # --- 1 site encoding ---
    df["site_encoded"] = SITE_ENCODING[site]

    # --- 12 PM2.5 rolling statistics ---
    for w in [3, 7, 14]:
        df[f"pm25_roll_mean_{w}"] = pm.rolling(w, min_periods=1).mean()
        df[f"pm25_roll_std_{w}"] = pm.rolling(w, min_periods=1).std().fillna(0)
        df[f"pm25_roll_max_{w}"] = pm.rolling(w, min_periods=1).max()
        df[f"pm25_roll_min_{w}"] = pm.rolling(w, min_periods=1).min()

    # --- 5 PM2.5 lag features ---
    for lag in [1, 2, 3, 7, 14]:
        df[f"pm25_lag_{lag}"] = pm.shift(lag)

    # --- 2 PM2.5 diff features ---
    df["pm25_diff_1"] = pm.diff(1)
    df["pm25_diff_7"] = pm.diff(7)

    # --- 2 PM2.5 EMA features ---
    df["pm25_ema_7"] = pm.ewm(span=7, min_periods=1).mean()
    df["pm25_ema_14"] = pm.ewm(span=14, min_periods=1).mean()

    return df


# --------------- Full 69-feature column order ---------------

FEATURE_COLUMNS = [
    "ai_filled", "aod550_filled", "AOT_filled", "B1_filled", "B11_filled",
    "B12_filled", "B2_filled", "B3_filled", "B4_filled", "B5_filled",
    "B6_filled", "B7_filled", "B8_filled", "B8A_filled", "co_filled",
    "hcho_filled", "no2_filled", "o3_filled", "so2_filled", "WVP_filled",
    "blh", "cos", "dew", "evapo", "humi", "lei_h", "lei_l", "preci",
    "press", "sin", "so_rad", "soil_water", "surf_water", "t_rad", "temp", "wspeed",
    "day_of_year", "month", "day_of_week", "week_of_year", "is_weekend",
    "month_sin", "month_cos", "day_sin", "day_cos", "week_sin", "week_cos",
    "site_encoded",
    "pm25_roll_mean_3", "pm25_roll_std_3", "pm25_roll_max_3", "pm25_roll_min_3",
    "pm25_roll_mean_7", "pm25_roll_std_7", "pm25_roll_max_7", "pm25_roll_min_7",
    "pm25_roll_mean_14", "pm25_roll_std_14", "pm25_roll_max_14", "pm25_roll_min_14",
    "pm25_lag_1", "pm25_lag_2", "pm25_lag_3", "pm25_lag_7", "pm25_lag_14",
    "pm25_diff_1", "pm25_diff_7",
    "pm25_ema_7", "pm25_ema_14",
]


# --------------- Main Logic ---------------

def load_model():
    model = BiLSTMAttention(
        input_size=69,
        hidden_size=256,
        num_layers=2,
        output_size=7,
        dropout=0.173,
    )
    state_dict = torch.load(MODEL_PATH, map_location="cpu", weights_only=False)
    model.load_state_dict(state_dict)
    model.eval()
    return model


def load_scalers():
    with open(FEATURE_SCALER_PATH, "rb") as f:
        feature_scaler = pickle.load(f)
    with open(TARGET_SCALER_PATH, "rb") as f:
        target_scaler = pickle.load(f)
    return feature_scaler, target_scaler


def process_site(site, model, feature_scaler, target_scaler):
    print(f"[{site}] Loading lstm_ready data ...")
    input_path = os.path.join(LSTM_READY_DIR, f"{site}.csv")
    df = pd.read_csv(input_path)

    # Engineer all 69 features
    df = engineer_features(df, site)

    # Extract the 69-feature matrix
    feat_df = df[FEATURE_COLUMNS].copy()

    # Fill any remaining NaN from lag/diff with 0 (earliest rows)
    feat_df = feat_df.fillna(0)

    # We need the last 30 rows as the input window
    if len(feat_df) < INPUT_WINDOW:
        raise ValueError(f"Not enough rows: {len(feat_df)} < {INPUT_WINDOW}")

    window = feat_df.iloc[-INPUT_WINDOW:].values  # (30, 69)

    # Scale features
    window_scaled = feature_scaler.transform(window)
    X = torch.FloatTensor(window_scaled).unsqueeze(0)  # (1, 30, 69)

    # Predict
    with torch.no_grad():
        pred_scaled = model(X).numpy()  # (1, 7)

    # Inverse transform: MinMaxScaler then expm1
    pred_log = target_scaler.inverse_transform(pred_scaled.reshape(-1, 1))
    pred = np.expm1(pred_log).flatten()
    pred = np.clip(pred, 0, None)

    # Today's pm2.5 is the last value in the data
    today_pm25 = df["pm2.5"].iloc[-1]
    today_date = pd.to_datetime(df["date"].iloc[-1]).strftime("%Y-%m-%d")

    print(f"  [{site}] today={today_date}, pm2.5={today_pm25:.2f}, "
          f"forecast: {', '.join(f'{v:.2f}' for v in pred)}")

    return {
        "date": today_date,
        "site": site,
        "pm2.5": round(today_pm25, 2),
        "pm2.5_1": round(float(pred[0]), 2),
        "pm2.5_2": round(float(pred[1]), 2),
        "pm2.5_3": round(float(pred[2]), 2),
        "pm2.5_4": round(float(pred[3]), 2),
        "pm2.5_5": round(float(pred[4]), 2),
        "pm2.5_6": round(float(pred[5]), 2),
        "pm2.5_7": round(float(pred[6]), 2),
    }


def main():
    print("=" * 60)
    print("Step 5: 7-day PM2.5 forecast (BiLSTM-Attention)")
    print("=" * 60)

    model = load_model()
    feature_scaler, target_scaler = load_scalers()
    print("Model + scalers loaded (69 features -> 7-day forecast)")

    sites = SITES
    if len(sys.argv) > 1 and sys.argv[1] == "--site":
        sites = [sys.argv[2]]

    rows = []
    ok = 0
    for site in sites:
        try:
            row = process_site(site, model, feature_scaler, target_scaler)
            rows.append(row)
            ok += 1
        except Exception as e:
            print(f"  [{site}] FAILED: {e}")
            import traceback
            traceback.print_exc()

    if rows:
        final_df = pd.DataFrame(rows)
        final_df = final_df[["date", "site", "pm2.5",
                             "pm2.5_1", "pm2.5_2", "pm2.5_3", "pm2.5_4",
                             "pm2.5_5", "pm2.5_6", "pm2.5_7"]]
        os.makedirs(os.path.dirname(FINAL_CSV_PATH), exist_ok=True)
        final_df.to_csv(FINAL_CSV_PATH, index=False)
        print(f"\nFinal CSV written: {FINAL_CSV_PATH}")
        print(final_df.to_string(index=False))

    print(f"\nDone: {ok}/{len(sites)} sites forecasted.")
    return 0 if ok == len(sites) else 1


if __name__ == "__main__":
    sys.exit(main())
