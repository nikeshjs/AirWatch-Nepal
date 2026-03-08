"""
Shared configuration and utilities for satellite gap-filling workers.
"""

import numpy as np
import pandas as pd
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent          # 2_satellite_filling/
MODELS_DIR = BASE / "models"
DB_DIR = BASE.parent / "database"
RAW_APPROX = DB_DIR / "raw" / "approx"
ERA5_ONLY = DB_DIR / "era5_only"
EXACT_READY = DB_DIR / "exact_ready"

SITES = ["kathmandu", "pokhara", "birgunj", "chitwan"]

ERA5_COLS = [
    "temp", "dew", "humi", "preci", "press", "wspeed", "wdirn",
    "surf_water", "soil_water", "evapo", "so_rad", "t_rad",
    "lei_h", "lei_l", "blh",
]

# Columns that do NOT get the _filled suffix
NO_SUFFIX_COLS = {"date"} | set(ERA5_COLS) | {"sin", "cos", "site"}

WINDOW_DAYS = 50  # output last N days


def load_site_data(site):
    """Load raw approx + era5_only for a site, merge ERA5 in."""
    raw_path = RAW_APPROX / f"{site}.csv"
    era5_path = ERA5_ONLY / f"{site}.csv"

    df_raw = pd.read_csv(raw_path)
    df_raw["date"] = pd.to_datetime(df_raw["date"])

    df_era5 = pd.read_csv(era5_path)
    df_era5["date"] = pd.to_datetime(df_era5["date"])

    # Replace ERA5 columns in raw with the filled era5_only data
    df_raw = df_raw.drop(columns=ERA5_COLS + ["sin", "cos"], errors="ignore")
    df = df_raw.merge(df_era5, on="date", how="left")

    return df


def add_time_features(df):
    """Add common temporal features used by all satellite models."""
    dates = pd.to_datetime(df["date"])
    doy = dates.dt.dayofyear
    month = dates.dt.month
    week = dates.dt.isocalendar().week.astype(int)

    df["dayofyear"] = doy
    df["month_feat"] = month  # separate from 'month' col name if needed
    df["day"] = dates.dt.day
    df["weekofyear"] = week
    df["year"] = dates.dt.year
    df["doy_sin"] = np.sin(2 * np.pi * doy / 365.25)
    df["doy_cos"] = np.cos(2 * np.pi * doy / 365.25)
    df["month_sin"] = np.sin(2 * np.pi * month / 12)
    df["month_cos"] = np.cos(2 * np.pi * month / 12)
    df["is_monsoon"] = ((month >= 6) & (month <= 9)).astype(float)
    df["is_winter"] = ((month >= 11) | (month <= 2)).astype(float)
    df["is_premonsoon"] = ((month >= 3) & (month <= 5)).astype(float)
    df["is_postmonsoon"] = ((month == 10) | (month == 11)).astype(float)
    df["has_rain"] = (df["preci"] > 0).astype(float)

    # Interaction features
    df["temp_x_humi"] = df["temp"] * df["humi"]
    df["sorad_x_blh"] = df["so_rad"] * df["blh"]
    df["temp_x_sorad"] = df["temp"] * df["so_rad"]
    df["wspeed_sq"] = df["wspeed"] ** 2

    return df
