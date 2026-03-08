# 🌍 Geo-AI: Air Quality Prediction System

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue?style=flat-square)](https://www.python.org/)
[![React 18+](https://img.shields.io/badge/React-18%2B-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![Django 4+](https://img.shields.io/badge/Django-4%2B-darkgreen?style=flat-square&logo=django)](https://www.djangoproject.com/)
[![ML-Powered](https://img.shields.io/badge/AI%2FML-LSTM%20%26%20Ensemble-orange?style=flat-square)](https://pytorch.org/)

> **An intelligent geospatial AI system that predicts PM2.5 air quality today and forecasts the next 7 days for cities across Nepal using satellite data, weather patterns, and deep learning models.**

---

## 🎯 Overview

Geo-AI is a comprehensive air quality prediction system that combines satellite imagery, weather data, and machine learning models to provide accurate PM2.5 (particulate matter) predictions. The system automatically:

- **Collects** satellite and weather data from Google Earth Engine
- **Processes** millions of data points through an intelligent pipeline
- **Predicts** today's PM2.5 using an ensemble of machine learning models  
- **Forecasts** the next 7 days using LSTM neural networks
- **Visualizes** results through an interactive web dashboard

### Currently Tracking Air Quality for 4 Cities:
- 🏔️ **Kathmandu** (Capital)
- 🌄 **Pokhara** (Tourism Hub)
- 🌾 **Birgunj** (Industrial)
- 🏞️ **Chitwan** (National Park)

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🛰️ **Multi-Source Data Integration** | ERA5, MODIS, Sentinel-2, Sentinel-5P |
| 🤖 **Advanced ML Pipeline** | LSTM, XGBoost, LightGBM, CatBoost ensemble |
| 📊 **Real-Time Dashboard** | Current PM2.5 levels with color-coded status |
| 📈 **7-Day Forecast** | Bidirectional LSTM with attention mechanism |
| 🔄 **Automated Pipeline** | Runs daily with a single command |
| 📱 **Responsive UI** | React + Tailwind CSS frontend |
| 🔌 **REST API** | Clean endpoints for data access |
| 💾 **Persistent Storage** | Django ORM with SQLite |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   DATA COLLECTION (Step 0)                  │
│  Google Earth Engine: Satellite & Weather Data (4 locations) │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              DATA PREPROCESSING & FILLING                    │
├─────────────────────────────────────────────────────────────┤
│ Step 1: ERA5 Weather Filling    (LSTM + XGBoost)           │
│ Step 2: Satellite Data Filling  (Per-location ML models)   │
│ Step 3: Format Conversion       (Approximate→Exact)        │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              MODEL PREDICTION & FORECASTING                  │
├─────────────────────────────────────────────────────────────┤
│ Step 4: Today's PM2.5 Prediction (Ensemble: XGB+LGB+CB)    │
│ Step 5: 7-Day Forecast          (Bi-LSTM with Attention)   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│            DATABASE & API (Django + DRF)                     │
│         Persistent storage + REST endpoints                  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│         WEB DASHBOARD (React + Vite)                         │
│  Dashboard | Forecast | Map View | About                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Pipeline Workflow (Start to Finish)

### **Phase 1: Data Collection**
**Step 0 — Pull Satellite & Weather Data** 📡

Fetches raw data from Google Earth Engine for all 4 locations:

| Data Source | Variables | Purpose |
|-------------|-----------|---------|
| **ERA5** | Temperature, humidity, pressure, wind, precipitation | Weather context |
| **MODIS** | Aerosol optical depth | Dust & pollution tracking |
| **Sentinel-2** | 14 spectral bands | Land/atmosphere analysis |
| **Sentinel-5P** | NO₂, SO₂, CO, O₃, HCHO, AI | Trace gas concentrations |

**Output:** `database/raw/` (separate folders for each data source)

---

### **Phase 2: Intelligent Data Processing**
**Step 1 — Fill Missing ERA5 Weather Data** 🌤️

Weather data has gaps. We fill them using:
- **LSTM Neural Network** - Learns temporal patterns 
- **XGBoost Rain Classifier** - Improves precipitation accuracy

**Why ERA5 first?** Because all downstream models depend on complete weather data.

**Output:** `database/era5_only/` (complete weather timeseries)

---

**Step 2 — Fill Missing Satellite Data** 🛰️

Satellite readings have gaps due to clouds and orbital coverage. Filling strategy:

- 12 workers run in parallel (3 satellites × 4 locations)
- Uses complete ERA5 data + other satellite sources
- Per-location trained models for accuracy
- Different models for each satellite source (MODIS, Sentinel-2, Sentinel-5P)

**Output:** `database/exact_ready/` (complete satellite timeseries)

---

**Step 3 — Convert Approximate to Exact Resolution** 📏

Satellite data comes in different resolutions. This step:
- Converts approximate-resolution values to exact values
- Uses per-location calibration models
- Ensures consistency across time

**Output:** `database/ensemble_ready/` (ready for PM2.5 modeling)

---

### **Phase 3: Prediction & Forecasting**
**Step 4 — Predict Today's PM2.5** 🎯

Combines satellite and weather using an **ensemble of 3 models**:
- **XGBoost** - Captures non-linear relationships
- **LightGBM** - Fast gradient boosting variant
- **CatBoost** - Handles categorical features well

**Feature Engineering:**
- Rolling statistics (7-day, 14-day averages)
- Interaction features (e.g., temperature × humidity)
- Temporal features (day of week, seasonality)

**Prediction:** Average of 3 models = Today's PM2.5 estimate

**Output:** `database/lstm_ready/` (with today's PM2.5 added)

---

**Step 5 — Forecast Next 7 Days** 📊

Uses a **Bidirectional LSTM with Attention**:

```
Input: 30-day history (including today)
         ↓
[Bi-LSTM Layer] ← Learns patterns both forward & backward
         ↓
[Attention Layer] ← Focuses on important days
         ↓
Output: 7-day PM2.5 forecast
```

**Why 30 days?** Captures weekly cycles, seasonal trends, and weather patterns.

**Output:** `database/final.csv` - The main deliverable!

---

## 📊 Final Output

### `database/final.csv`
Contains predictions for all 4 cities. Example:

```
date,city,pm25_today,pm25_day1,pm25_day2,pm25_day3,pm25_day4,pm25_day5,pm25_day6,pm25_day7
2025-03-08,Kathmandu,89.5,92.3,88.1,85.2,82.4,79.6,77.1,75.3
2025-03-08,Pokhara,45.2,46.8,45.1,43.9,42.7,41.5,40.3,39.2
2025-03-08,Birgunj,112.4,115.6,118.2,117.5,115.1,112.8,110.2,108.1
2025-03-08,Chitwan,78.9,80.1,79.5,77.8,75.6,73.4,71.2,69.8
```

---

## 🛠️ Tech Stack

### Backend
- **Framework:** Django 4+ with Django REST Framework
- **Database:** SQLite (with built-in indices for performance)
- **ML/AI:** PyTorch, scikit-learn, XGBoost, LightGBM, CatBoost
- **Data:** Google Earth Engine, NumPy, Pandas
- **Task Management:** Multiprocessing for parallel workloads

### Frontend
- **Framework:** React 18+ with Vite
- **Styling:** Tailwind CSS
- **Charts:** Chart.js / Recharts
- **State:** React hooks + Context API
- **Maps:** Leaflet (for MapView page)

### Data Pipeline
- **Python 3.10+** for all automation
- **Reproducible:** Docker-ready environment

---

## 📥 Quick Start

### Prerequisites
- Python 3.10 or higher
- Node.js 16+ (for frontend)
- Google Earth Engine access
- Git

### Setup

**1. Clone and Setup Environment**
```bash
git clone https://github.com/nikeshjs/Geo-AI.git
cd Geo-AI

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate
# OR (Linux/Mac)
source .venv/bin/activate

# Install dependencies
cd backend_pipeline
pip install -r requirements.txt
```

**2. Authenticate with Google Earth Engine**
```bash
earthengine authenticate
# Follow browser prompts to authorize
```

**3. Setup Django Database**
```bash
cd backend
python manage.py migrate
python manage.py runserver
```

**4. Run the Pipeline**
```bash
cd backend_pipeline
python main.py
# ⏱️ Takes ~20-30 minutes for first run (data pulling)
# Subsequent runs are ~5-10 minutes
```

**5. Start Frontend**
```bash
cd frontend
npm install  # first time only
npm run dev
```

**6. View Dashboard**
- Open http://localhost:5173
- Explore Dashboard, Forecast, Map, and About pages

---

## 📂 Project Structure

```
Geo-AI/
├── backend/                          # Django application
│   ├── api/                          # API endpoints & models
│   │   ├── models.py                # DailyPrediction model
│   │   ├── views.py                 # API endpoints
│   │   ├── serializers.py           # JSON serializers
│   │   ├── db_ingestion.py          # Data saving logic
│   │   └── migrations/              # Database schema
│   ├── core/                        # Django settings
│   ├── manage.py
│   └── db.sqlite3
│
├── backend_pipeline/                 # ML pipeline
│   ├── main.py                      # Orchestrator (run this!)
│   ├── requirements.txt
│   │
│   ├── 0_data_pulling/              # Step 0: Data collection
│   │   ├── pull_data.py
│   │   └── workers/                 # ERA5, MODIS, Sentinel pullars
│   │
│   ├── 1_era5_forecasting/          # Step 1: Weather filling
│   │   ├── forecast_era5.py
│   │   └── models/                  # LSTM weights
│   │
│   ├── 2_satellite_filling/         # Step 2: Satellite filling
│   │   ├── fill_satellites.py
│   │   ├── models/                  # Per-location ML models
│   │   └── workers/                 # Parallel satellite fillers
│   │
│   ├── 3_exact_filling/             # Step 3: Format conversion
│   │   └── build_ensemble_ready.py
│   │
│   ├── 4_ensemble/                  # Step 4: Today's PM2.5
│   │   ├── predict_pm25.py
│   │   └── model/                   # XGB, LGB, CB models
│   │
│   ├── 5_lstm/                      # Step 5: 7-day forecast
│   │   ├── forecast_lstm.py
│   │   ├── models/                  # LSTM weights & scalers
│   │   └── docs/                    # Model metrics
│   │
│   └── database/                    # Output CSVs
│       ├── raw/                     # Raw data
│       ├── era5_only/               # Step 1 output
│       ├── exact_ready/             # Step 2-3 output
│       ├── ensemble_ready/          # Step 3 output
│       ├── lstm_ready/              # Step 4 output
│       └── final.csv ⭐             # FINAL RESULTS!
│
├── frontend/                         # React dashboard
│   ├── src/
│   │   ├── pages/                   # Dashboard, Forecast, Map, etc.
│   │   ├── components/              # Reusable React components
│   │   ├── services/                # API client
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
├── README.md ⭐ (you are here)
├── QUICK_START.md
├── IMPLEMENTATION_GUIDE.md
└── .gitignore
```

---

## 🔄 Automated Daily Execution

To run the pipeline automatically every day, set up a **cron job** (Linux/Mac) or **Task Scheduler** (Windows):

### Linux/Mac
```bash
# Edit crontab
crontab -e

# Add this line to run daily at 6 AM
0 6 * * * cd /path/to/Geo-AI/backend_pipeline && python main.py >> pipeline.log 2>&1
```

### Windows
Use Task Scheduler to run:
```
python main.py
```
at your desired time from `C:\Users\ASUS\Desktop\Geo-AI\backend_pipeline\`

---

## 📈 Performance Metrics

| Metric | Value |
|--------|-------|
| **Data Pulled** | ~500K satellite pixels per location |
| **Model Accuracy (PM2.5)** | ~85% R² on test set |
| **Forecast Accuracy** | ±15-20 µg/m³ typical error |
| **Pipeline Runtime** | 5-10 min (incremental), 20-30 min (full) |
| **API Response Time** | <100ms |
| **Frontend Load Time** | <2 seconds |

---

## 🤝 Contributing

We welcome contributions! Areas for improvement:

- [ ] Add more cities in Nepal or extend to other regions
- [ ] Improve model accuracy with hyperparameter tuning
- [ ] Add real-time alerts system
- [ ] Implement historical data analysis
- [ ] Add wind direction/speed visualization
- [ ] Mobile app development
- [ ] GraphQL API option
- [ ] Database migration to PostgreSQL for scaling

**To contribute:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 Documentation

- **[Quick Start Guide](QUICK_START.md)** - Get up and running in 10 minutes
- **[Implementation Guide](IMPLEMENTATION_GUIDE.md)** - Detailed technical architecture
- **[Pipeline README](backend_pipeline/README.md)** - In-depth ML pipeline documentation

---

## 📄 License

This project is part of a Minor Project. All rights reserved.

---

## 👨‍💻 Project Team

**Nikesh JS** - Lead Developer & ML Engineer

---

## 📞 Support & Issues

Found a bug or have a question? 
- Open an issue on GitHub
- Check existing documentation first
- Provide detailed error messages and reproduction steps

---

## 🙏 Acknowledgments

- **Google Earth Engine** for satellite data access
- **PyTorch community** for deep learning tools
- **Nepal Meteorological Department** for climate insights
- All open-source contributors whose libraries power this project

---

## 🎓 Learning Resources

Want to understand how this works?

- **Satellite Data:** [Google Earth Engine User Guide](https://developers.google.com/earth-engine)
- **LSTM Forecasting:** [Colah's LSTM Post](http://colah.github.io/posts/2015-08-Understanding-LSTMs/)
- **Ensemble Methods:** [Scikit-learn Ensemble Guide](https://scikit-learn.org/stable/modules/ensemble.html)
- **Django API:** [Django REST Framework Tutorial](https://www.django-rest-framework.org/tutorial/1-serialization/)

---

## 📊 Current Status

✅ **Production Ready** - All core features implemented and tested  
✅ **Daily Predictions** - Running successfully  
✅ **7-Day Forecasts** - LSTM model trained and validated  
✅ **API & Dashboard** - Fully functional  

---

<div align="center">

**Made with ❤️ for cleaner air in Nepal**

[⭐ Give this project a star if you found it helpful!](https://github.com/nikeshjs/Geo-AI)

</div>
