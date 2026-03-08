# PM2.5 LSTM Model - Per-Site Performance Metrics

## Model Configuration
- **Input Window:** 30 days
- **Output Window:** 7 days (PM2.5 forecast)
- **Architecture:** Bidirectional LSTM with Attention
- **Sites:** Birgunj, Chitwan, Kathmandu, Pokhara (Nepal)
- **Train/Test Split:** 75%/25% (chronological per-site)

## Performance Metrics

| Site | R² Score | RMSE | MAE | MAPE (%) | Accuracy (%) |
|------|----------|------|-----|----------|--------------|
| Birgunj | 0.8111 | 32.63 | 17.65 | 23.68 | 76.32 |
| Chitwan | 0.8819 | 11.22 | 7.86 | 19.22 | 80.78 |
| Kathmandu | 0.9159 | 8.78 | 6.37 | 12.97 | 87.03 |
| Pokhara | 0.8708 | 8.26 | 5.58 | 17.58 | 82.42 |
| **OVERALL** | 0.8488 | 18.28 | 9.37 | 18.37 | 81.63 |

## Metric Definitions
- **R² Score:** Coefficient of determination (1.0 = perfect fit)
- **RMSE:** Root Mean Square Error (µg/m³)
- **MAE:** Mean Absolute Error (µg/m³)
- **MAPE:** Mean Absolute Percentage Error (%)
- **Accuracy:** 100 - MAPE (%)

## Notes
- Lower RMSE/MAE/MAPE = better performance
- Higher R²/Accuracy = better performance
- Birgunj shows higher error due to extreme PM2.5 variability at that site
