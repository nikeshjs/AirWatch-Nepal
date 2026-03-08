# Air Quality Backend Pipeline

This system predicts daily PM2.5 air quality for **4 locations in Nepal** (Kathmandu, Pokhara, Birgunj, Chitwan) and forecasts the next 7 days.

It pulls satellite and weather data, fills any missing gaps using machine learning models, predicts today's PM2.5, and then forecasts PM2.5 for the next 7 days. The whole thing is designed to run **once a day** with a single command.

---

## Quick Start

### 1. Set up Python environment

You need Python 3.10 or higher.

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
```

For PyTorch, if you don't have a GPU, install the CPU version:
```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

### 2. Set up Google Earth Engine

Step 0 pulls data from Google Earth Engine (GEE). You need to authenticate first:

```bash
earthengine authenticate
```

This only needs to be done once. Follow the instructions in the terminal to log in with your Google account that has GEE access.

### 3. Run the pipeline

```bash
python main.py
```

That's it. This runs all 6 steps (0 through 5) one after another. Each step waits for the previous one to finish before starting.

---

## What does this system do?

Here is what happens when you run `main.py`:

### Step 0 — Pull satellite and weather data
Pulls the latest data from Google Earth Engine for all 4 locations. This includes:
- **MODIS** (aerosol/dust data)
- **Sentinel-2** (14 optical satellite bands)
- **Sentinel-5P** (6 trace gases: NO2, SO2, CO, O3, HCHO, AI)
- **ERA5** (15 weather variables: temperature, humidity, pressure, wind, etc.)

Data is saved into `database/raw/`.

### Step 1 — Fill missing ERA5 weather data
Satellite and weather data often has missing days. ERA5 weather data is needed by all other models, so it gets filled first. An LSTM neural network predicts the missing weather values. An XGBoost rain classifier improves precipitation predictions.

Filled ERA5 data is saved into `database/era5_only/`.

### Step 2 — Fill missing satellite data
Now that we have complete ERA5 weather data, we use it (along with other features) to fill missing satellite data. Each satellite source has its own set of models per location. 12 workers run in parallel (3 satellites x 4 sites).

Filled data is saved into `database/exact_ready/`.

### Step 3 — Convert approximate to exact satellite values
The satellite data we filled was in "approximate" resolution. This step uses per-location models to convert those approximate values into "exact" values that match the true satellite resolution.

Converted data is saved into `database/ensemble_ready/`.

### Step 4 — Predict today's PM2.5
Uses an ensemble of 3 models (XGBoost + LightGBM + CatBoost) to predict today's PM2.5 from the satellite and weather data. The model also creates some rolling and interaction features before predicting.

Results (with PM2.5 added) are saved into `database/lstm_ready/`.

### Step 5 — Forecast PM2.5 for the next 7 days
A Bidirectional LSTM with Attention takes the past 30 days of data (including today's PM2.5) and forecasts PM2.5 for the next 7 days.

The final output is saved to `database/final.csv`.

---

## Output files

### `database/final.csv` — The main output

This is the file you care about most. It gets updated every day after the pipeline runs. It has **4 rows** (one per location) and **10 columns**:

| Column | What it is |
|--------|------------|
| `date` | Today's date |
| `site` | Location name (kathmandu, pokhara, birgunj, chitwan) |
| `pm2.5` | Today's PM2.5 value (µg/m³) |
| `pm2.5_1` | Tomorrow's forecast |
| `pm2.5_2` | Day after tomorrow's forecast |
| `pm2.5_3` to `pm2.5_7` | Forecast for days 3 to 7 |

Example:
```
date,site,pm2.5,pm2.5_1,pm2.5_2,pm2.5_3,pm2.5_4,pm2.5_5,pm2.5_6,pm2.5_7
2026-03-07,kathmandu,73.33,78.91,81.40,80.96,80.39,81.66,80.40,78.44
2026-03-07,pokhara,57.10,59.30,61.51,61.66,61.64,62.67,60.86,58.92
2026-03-07,birgunj,79.02,86.75,89.50,88.79,88.05,89.58,88.16,85.82
2026-03-07,chitwan,66.60,67.33,69.44,70.16,71.18,73.83,74.23,73.44
```

### `database/lstm_ready/{site}.csv` — Past 50 days of data with PM2.5

Each site has a CSV with 50 rows (most recent 50 days) and 41 columns. This includes all satellite data, weather data, and the `pm2.5` column.

---

## For the website

### Showing today's PM2.5

Read `database/final.csv`. The `pm2.5` column is today's value for each location. Show this in big numbers.

### Graph: Past 30 days of PM2.5

Read `database/lstm_ready/{site}.csv` for each location. Take the last 30 rows. Use the `date` and `pm2.5` columns to plot a line chart.

### Graph: Next 7 days forecast

Read `database/final.csv`. For each location, the columns `pm2.5_1` through `pm2.5_7` are the next 7 days. The dates for these are simply today+1, today+2, ..., today+7.

---

## Useful commands

```bash
# Run the full pipeline (steps 0-5)
python main.py

# Resume from a specific step (e.g., if step 2 failed, fix it and run)
python main.py --from 2

# Run only one specific step
python main.py --only 5
```

If any step fails, the pipeline stops and tells you which step failed. Fix the issue, then resume from that step using `--from`.

---

## Folder structure

```
backend_pipeline/
├── main.py                          # Run this. Orchestrates all steps.
├── requirements.txt                 # Python packages needed
├── README.md                        # You are here
│
├── 0_data_pulling/                  # Step 0: Pull data from GEE
│   ├── pull_data.py                 # Main script (runs 16 parallel workers)
│   └── workers/                     # Per-source worker scripts
│
├── 1_era5_forecasting/              # Step 1: Fill ERA5 weather gaps
│   ├── forecast_era5.py             # LSTM + rain enhancer
│   └── models/                      # LSTM and rain enhancer model files
│
├── 2_satellite_filling/             # Step 2: Fill satellite gaps
│   ├── fill_satellites.py           # Main script (runs 12 parallel workers)
│   ├── workers/                     # Per-satellite worker scripts
│   └── models/                      # Gap-filling models per site
│
├── 3_exact_filling/                 # Step 3: Approx to exact conversion
│   ├── build_ensemble_ready.py
│   └── models/                      # Conversion models per site
│
├── 4_ensemble/                      # Step 4: PM2.5 prediction
│   ├── predict_pm25.py
│   └── model/                       # XGBoost/LightGBM/CatBoost ensemble
│
├── 5_lstm/                          # Step 5: 7-day forecast
│   ├── forecast_lstm.py
│   ├── models/                      # LSTM model + scalers
│   └── docs(dont delete)/           # Model performance metrics
│
└── database/                        # All data lives here
    ├── final.csv                    # THE OUTPUT: today + 7-day forecast
    ├── raw/                         # Raw data from GEE
    │   ├── approx/                  # Approximate resolution
    │   └── exact/                   # Exact resolution
    ├── era5_only/                   # ERA5 with gaps filled
    ├── exact_ready/                 # Satellites filled (approx resolution)
    ├── ensemble_ready/              # Converted to exact resolution
    └── lstm_ready/                  # Final features + PM2.5 (50 days)
```

---

## 4 supported locations

| Location | Latitude | Longitude |
|----------|----------|-----------|
| Kathmandu | 27.7078 | 85.3432 |
| Pokhara | 28.2057 | 83.9740 |
| Birgunj | 27.0264 | 84.8522 |
| Chitwan | 27.5796 | 84.2360 |

---

## Important notes

- **Run once a day.** The system is designed for daily operation. Running it multiple times in the same day is fine but unnecessary.
- **Internet required.** Step 0 needs internet access to pull data from Google Earth Engine.
- **GEE authentication.** Must be set up before the first run (see Quick Start above).
- **No GPU needed.** All models run on CPU. PyTorch CPU version is enough.
- **The database folder keeps history.** Raw data accumulates over time. The pipeline smartly merges new data with existing data, so old data is not lost.
- **50-day window.** Steps 2 onwards only work with the most recent 50 days of data. This is by design — the models only need recent data to make predictions.
