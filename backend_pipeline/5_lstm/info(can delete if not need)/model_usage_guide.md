# PM2.5 LSTM Model - Usage Documentation

## Overview
This model forecasts PM2.5 air quality values for 7 days into the future using the past 30 days of data.

## Model Architecture
- **Type:** Bidirectional LSTM with Attention mechanism
- **Input:** 30-day sequence of features (weather, temporal, rolling statistics)
- **Output:** 7-day PM2.5 forecast (µg/m³)

## Performance Summary
- **Overall Accuracy:** 81.63%
- **R² Score:** 0.8488
- **RMSE:** 18.28 µg/m³
- **MAE:** 9.37 µg/m³

## Files Included
1. `pm25_lstm_model.pth` - PyTorch model weights
2. `model_config.json` - Model configuration and hyperparameters
3. `feature_scaler.pkl` - Feature normalization scaler
4. `target_scaler.pkl` - Target normalization scaler
5. `model_metrics.md` - Detailed per-site performance metrics
6. `forecast_visualization.png` - Actual vs Predicted comparison

## Quick Start

### 1. Load the Model
```python
import torch
import json
import pickle
import numpy as np

# Load configuration
with open('model_config.json', 'r') as f:
    config = json.load(f)

# Load scalers
with open('feature_scaler.pkl', 'rb') as f:
    feature_scaler = pickle.load(f)
with open('target_scaler.pkl', 'rb') as f:
    target_scaler = pickle.load(f)

# Define model architecture (same as training)
class BiLSTMAttention(torch.nn.Module):
    def __init__(self, input_size, hidden_size, num_layers, output_size, dropout=0.2):
        super().__init__()
        self.lstm = torch.nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=True
        )
        self.attention = torch.nn.Sequential(
            torch.nn.Linear(hidden_size * 2, hidden_size),
            torch.nn.Tanh(),
            torch.nn.Linear(hidden_size, 1)
        )
        self.fc = torch.nn.Sequential(
            torch.nn.Linear(hidden_size * 2, hidden_size),
            torch.nn.ReLU(),
            torch.nn.Dropout(dropout),
            torch.nn.Linear(hidden_size, hidden_size // 2),
            torch.nn.ReLU(),
            torch.nn.Dropout(dropout / 2),
            torch.nn.Linear(hidden_size // 2, output_size)
        )
        
    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        attn_weights = torch.softmax(self.attention(lstm_out), dim=1)
        context = torch.sum(attn_weights * lstm_out, dim=1)
        return self.fc(context)

# Initialize and load weights
model = BiLSTMAttention(
    input_size=config['n_features'],
    hidden_size=config['hidden_size'],
    num_layers=config['num_layers'],
    output_size=config['output_window'],
    dropout=config['dropout']
)
model.load_state_dict(torch.load('pm25_lstm_model.pth'))
model.eval()
```

### 2. Make Predictions
```python
def predict(input_data, model, feature_scaler, target_scaler):
    """
    input_data: numpy array of shape (30, n_features) - 30 days of features
    Returns: numpy array of shape (7,) - 7-day PM2.5 forecast
    """
    # Scale features
    X_scaled = feature_scaler.transform(input_data)
    X_tensor = torch.FloatTensor(X_scaled).unsqueeze(0)  # Add batch dim
    
    # Predict
    with torch.no_grad():
        pred_scaled = model(X_tensor).numpy()
    
    # Inverse transform (log1p was used during training)
    pred_log = target_scaler.inverse_transform(pred_scaled.reshape(-1, 1))
    pred = np.expm1(pred_log).flatten()  # expm1 is inverse of log1p
    
    return np.clip(pred, 0, None)  # Ensure non-negative

# Example usage
# prediction = predict(last_30_days_features, model, feature_scaler, target_scaler)
# print(f"7-day forecast: {prediction}")
```

## Required Features
The model expects 69 features in this order:
```
ai_filled, aod550_filled, AOT_filled, B1_filled, B11_filled, B12_filled, B2_filled, B3_filled, B4_filled, B5_filled... (and more)
```

See `model_config.json` for the complete list of features.

## Key Feature Engineering Steps
1. **Temporal features:** day_of_year, month, day_of_week, week_of_year, is_weekend
2. **Cyclical encoding:** sin/cos transforms for month, day, week
3. **Rolling statistics:** mean, std, max, min over 3, 7, 14 day windows
4. **Lag features:** pm25 values at lags 1, 2, 3, 7, 14 days
5. **Diff features:** 1-day and 7-day differences
6. **EMA:** Exponential moving averages (7 and 14 day spans)

## Hyperparameters
- Hidden size: 256
- LSTM layers: 2
- Dropout: 0.173
- Learning rate: 0.00113
- Batch size: 32
- Weight decay: 0.0002

## Sites Supported
- Birgunj, Nepal
- Chitwan, Nepal
- Kathmandu, Nepal
- Pokhara, Nepal

## Limitations
- Accuracy varies by site (Kathmandu best, Birgunj most challenging)
- Predictions for days 6-7 are less accurate than days 1-2
- Data coefficient of variation is 88.2%, limiting maximum achievable accuracy

## Requirements
- Python 3.8+
- PyTorch >= 1.9
- scikit-learn >= 0.24
- numpy
- pandas

---
*Model trained on 2026-03-07*
