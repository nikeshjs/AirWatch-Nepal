from __future__ import annotations

from pathlib import Path
from typing import Iterable

import joblib
import numpy as np
import pandas as pd


MODEL_FILENAME = "final_deployment_finetuned_models.joblib"
RAW_FEATURES_36 = [
    "ai_filled", "aod550_filled", "AOT_filled", "B1_filled", "B11_filled",
    "B12_filled", "B2_filled", "B3_filled", "B4_filled", "B5_filled",
    "B6_filled", "B7_filled", "B8_filled", "B8A_filled", "co_filled",
    "hcho_filled", "no2_filled", "o3_filled", "so2_filled", "WVP_filled",
    "blh", "cos", "dew", "evapo", "humi", "lei_h", "lei_l", "preci",
    "press", "sin", "so_rad", "soil_water", "surf_water", "t_rad", "temp", "wspeed",
]
ROLLING_INPUTS = ["hcho_filled", "o3_filled", "WVP_filled", "evapo", "humi", "press", "sin"]
EPSILON = 1e-6


def _default_artifact_path() -> Path:
    return Path(__file__).resolve().parent / MODEL_FILENAME


def load_artifact(path: str | Path | None = None) -> dict:
    artifact_path = Path(path) if path is not None else _default_artifact_path()
    return joblib.load(artifact_path)


def get_feature_order(artifact: dict | None = None) -> list[str]:
    loaded_artifact = artifact if artifact is not None else load_artifact()
    feature_order = loaded_artifact.get("feature_order")
    if not feature_order:
        raise ValueError("Artifact is missing 'feature_order'.")
    return list(feature_order)


def add_engineered_features(raw_frame: pd.DataFrame) -> pd.DataFrame:
    required_columns = {"date", "site", *RAW_FEATURES_36}
    missing_columns = sorted(required_columns.difference(raw_frame.columns))
    if missing_columns:
        raise ValueError(f"Raw frame is missing required columns: {missing_columns}")

    frame = raw_frame.copy()
    frame["date"] = pd.to_datetime(frame["date"])
    frame = frame.sort_values(["site", "date"]).reset_index(drop=True)

    for column in RAW_FEATURES_36:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    for column in ROLLING_INPUTS:
        engineered_column = f"{column}_roll5_causal"
        frame[engineered_column] = (
            frame.groupby("site")[column]
            .transform(lambda values: values.shift(1).rolling(window=5, min_periods=1).mean())
        )

    frame["aod550_filled_mul_cos"] = frame["aod550_filled"] * frame["cos"]
    frame["aod550_filled_div_cos"] = frame["aod550_filled"] / (frame["cos"] + EPSILON)
    frame["cos_div_aod550_filled"] = frame["cos"] / (frame["aod550_filled"] + EPSILON)
    frame["aod550_filled_mul_evapo"] = frame["aod550_filled"] * frame["evapo"]
    frame["aod550_filled_div_surf_water"] = frame["aod550_filled"] / (frame["surf_water"] + EPSILON)

    return frame


def _validate_feature_columns(frame: pd.DataFrame, feature_order: Iterable[str]) -> None:
    expected = list(feature_order)
    missing_columns = sorted(set(expected).difference(frame.columns))
    if missing_columns:
        raise ValueError(f"Feature frame is missing required columns: {missing_columns}")


def predict_pm25(feature_matrix: pd.DataFrame | np.ndarray, artifact: dict | None = None) -> np.ndarray:
    loaded_artifact = artifact if artifact is not None else load_artifact()
    models = loaded_artifact["models"]

    if isinstance(feature_matrix, pd.DataFrame):
        feature_order = get_feature_order(loaded_artifact)
        _validate_feature_columns(feature_matrix, feature_order)
        x = feature_matrix[feature_order].copy()
    else:
        x = np.asarray(feature_matrix)

    pred_log = (
        models["xgb"].predict(x)
        + models["lgb"].predict(x)
        + models["cat"].predict(x)
    ) / 3.0
    return np.expm1(pred_log)


def predict_pm25_from_raw_frame(raw_frame: pd.DataFrame, artifact: dict | None = None) -> np.ndarray:
    loaded_artifact = artifact if artifact is not None else load_artifact()
    engineered_frame = add_engineered_features(raw_frame)
    feature_order = get_feature_order(loaded_artifact)
    _validate_feature_columns(engineered_frame, feature_order)
    return predict_pm25(engineered_frame[feature_order], artifact=loaded_artifact)