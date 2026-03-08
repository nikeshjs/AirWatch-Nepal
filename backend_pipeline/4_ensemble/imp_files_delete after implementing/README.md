# Ensemble Model Bundle

This folder is the backend handoff bundle for the final deployment ensemble.

## Included files

- `final_deployment_finetuned_models.joblib`: production model artifact
- `metadata.json`: artifact metadata and deployment context
- `feature_order.json`: exact 47-feature inference order
- `preprocessing_spec.json`: raw inputs and engineered-feature rules
- `inference.py`: reference loading, preprocessing, and prediction helper
- `requirements.txt`: Python packages needed to load and run the artifact

## Prediction contract

The artifact stores three regressors:

- `xgb`
- `lgb`
- `cat`

Prediction is:

```python
y_pred_log = (
    artifact["models"]["xgb"].predict(X)
    + artifact["models"]["lgb"].predict(X)
    + artifact["models"]["cat"].predict(X)
) / 3.0

y_pred_pm25 = np.expm1(y_pred_log)
```

## Two integration options

### Option 1: backend already builds the final 47 features

Pass a matrix or DataFrame whose columns are ordered exactly as listed in `feature_order.json`.

### Option 2: backend has the raw daily features only

Use `inference.py` to:

1. provide one row per `site` + `date`
2. include all raw source columns from `preprocessing_spec.json`
3. sort rows by `site`, then `date`
4. generate the rolling and interaction features
5. predict PM2.5

## Important preprocessing rules

- rolling features are causal: shift by one day before rolling
- rolling window is `5`
- rolling `min_periods` is `1`
- rolling is computed independently per `site`
- interaction epsilon is `1e-6`
- inference rows must be ordered chronologically within each site before rolling features are created
- the earliest rows per site can have `NaN` causal rolling features after the shift; the saved XGBoost, LightGBM, and CatBoost models can still score those rows
- missing required columns must be handled before prediction

## Minimal Python example

```python
from pathlib import Path

import pandas as pd

from inference import load_artifact, predict_pm25_from_raw_frame

artifact = load_artifact(Path("final_deployment_finetuned_models.joblib"))

raw_rows = pd.DataFrame([
    {
        "date": "2026-03-07",
        "site": "pokhara",
        "ai_filled": 0.1,
        "aod550_filled": 0.2,
        "AOT_filled": 0.3,
        "B1_filled": 0.4,
        "B11_filled": 0.5,
        "B12_filled": 0.6,
        "B2_filled": 0.7,
        "B3_filled": 0.8,
        "B4_filled": 0.9,
        "B5_filled": 1.0,
        "B6_filled": 1.1,
        "B7_filled": 1.2,
        "B8_filled": 1.3,
        "B8A_filled": 1.4,
        "co_filled": 1.5,
        "hcho_filled": 1.6,
        "no2_filled": 1.7,
        "o3_filled": 1.8,
        "so2_filled": 1.9,
        "WVP_filled": 2.0,
        "blh": 2.1,
        "cos": 2.2,
        "dew": 2.3,
        "evapo": 2.4,
        "humi": 2.5,
        "lei_h": 2.6,
        "lei_l": 2.7,
        "preci": 2.8,
        "press": 2.9,
        "sin": 3.0,
        "so_rad": 3.1,
        "soil_water": 3.2,
        "surf_water": 3.3,
        "t_rad": 3.4,
        "temp": 3.5,
        "wspeed": 3.6,
    }
])

pred = predict_pm25_from_raw_frame(raw_rows, artifact=artifact)
print(pred)
```

## Notes

- this is the final production artifact, not a held-out evaluation model
- deployment-site rows were weighted at `3.0x` during final training
- target transform during training was `log1p`
- inverse transform at inference is `expm1`