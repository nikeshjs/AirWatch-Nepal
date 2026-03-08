"""
API Views for AirWatch Nepal.

All views return JSON. If the DB is empty a seeded response is generated
on-the-fly so the frontend always has data to display.
"""
import random
import math
import os
import sys
import subprocess
import pandas as pd
from datetime import datetime, timedelta, timezone

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .models import City, AQIReading, EnvironmentalParameter, ForecastReading, DailyPrediction
from .serializers import (
    CitySerializer,
    AQIReadingSerializer,
    EnvironmentalParameterSerializer,
    ForecastReadingSerializer,
    DailyPredictionSerializer,
)

# ─── static seed data (used when DB is not yet populated) ───────────────
# Each city has realistic, geographically accurate environmental profiles.
SEED_CITIES = {
    'Kathmandu': {
        'lat': 27.7172, 'lng': 85.3240, 'pm25_base': 55,
        'env': {
            'aod': (0.48, 0.08),        # high — dense valley, trapped pollutants
            'no2': (38.0, 6.0),          # high — heavy traffic
            'so2': (16.5, 3.0),          # moderate-high — brick kilns
            'ndvi': (0.42, 0.05),        # low — urbanised
            'temperature': (18.5, 3.0),  # temperate valley (~1400m)
            'wind_speed': (5.5, 1.5),    # low — sheltered valley
        },
        'message_extra': 'Kathmandu Valley traps pollutants due to its bowl-shaped geography.',
    },
    'Pokhara': {
        'lat': 28.2096, 'lng': 83.9856, 'pm25_base': 18,
        'env': {
            'aod': (0.18, 0.04),         # low — clean lakeside air
            'no2': (12.0, 3.0),           # low — less traffic
            'so2': (5.2, 1.5),            # low — minimal industry
            'ndvi': (0.78, 0.04),         # high — lush green surroundings
            'temperature': (20.0, 2.5),   # mild (~800m)
            'wind_speed': (10.5, 2.0),    # moderate — lakeside breeze
        },
        'message_extra': 'Pokhara enjoys clean air thanks to lakeside breezes and abundant greenery.',
    },
    'Chitwan': {
        'lat': 27.5291, 'lng': 84.3542, 'pm25_base': 35,
        'env': {
            'aod': (0.32, 0.06),         # moderate — lowland haze
            'no2': (22.0, 4.0),           # moderate
            'so2': (9.8, 2.0),            # moderate
            'ndvi': (0.82, 0.03),         # very high — national park, jungle
            'temperature': (28.0, 3.0),   # warm lowland (~200m)
            'wind_speed': (7.0, 2.0),     # moderate
        },
        'message_extra': 'Chitwan\'s subtropical forests act as natural air filters.',
    },
    'Birgunj': {
        'lat': 27.0104, 'lng': 84.8777, 'pm25_base': 72,
        'env': {
            'aod': (0.58, 0.09),         # very high — industrial + cross-border pollution
            'no2': (45.0, 7.0),           # very high — industrial zone
            'so2': (22.0, 4.0),           # high — factories and vehicles
            'ndvi': (0.35, 0.06),         # low — urbanised, industrial
            'temperature': (30.5, 3.5),   # hot lowland (~100m)
            'wind_speed': (6.0, 1.5),     # low-moderate
        },
        'message_extra': 'Birgunj faces cross-border industrial pollution from the Indo-Gangetic plain.',
    },
}


# ─── CSV Reading Functions ────────────────────────────────────────────────

def _get_final_csv_path():
    """Get the path to final.csv from the backend_pipeline."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    project_root = os.path.dirname(backend_dir)
    csv_path = os.path.join(project_root, 'backend_pipeline', 'database', 'final.csv')
    print(f"[API] CSV path: {csv_path}")
    print(f"[API] CSV exists: {os.path.exists(csv_path)}")
    return csv_path


def _read_predictions_from_csv():
    """
    Read predictions from final.csv (if it exists) and return as a dict.
    Returns None if file doesn't exist or can't be parsed.
    """
    csv_path = _get_final_csv_path()
    if not os.path.exists(csv_path):
        print(f"[API] CSV not found at: {csv_path}")
        return None
    
    try:
        print(f"[API] Reading CSV from: {csv_path}")
        df = pd.read_csv(csv_path)
        print(f"[API] CSV loaded successfully. Shape: {df.shape}")
        print(f"[API] Columns: {list(df.columns)}")
        
        predictions = {}
        
        for idx, row in df.iterrows():
            city_name = row['site'].strip().title()
            predictions[city_name] = {
                'date': str(row['date']),
                'pm25_today': float(row['pm2.5']),
                'forecast': [
                    float(row[f'pm2.5_{i}']) for i in range(1, 8)
                ]
            }
            print(f"[API] Loaded {city_name}: PM2.5={predictions[city_name]['pm25_today']}")
        
        print(f"[API] Successfully loaded {len(predictions)} cities from CSV")
        return predictions
    except Exception as e:
        print(f"[API] ERROR reading final.csv: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None


# ─── Helper functions ─────────────────────────────────────────────────────

def _set_seed_for_city(city_name):
    """Set random seed based on date and city for reproducible seeded data."""
    from django.utils import timezone
    today = timezone.now().date()
    # Create a seed from date and city name so values are same all day, change each day
    seed_value = int(today.strftime('%Y%m%d')) + sum(ord(c) for c in city_name)
    random.seed(seed_value)


def _pm25_to_status(pm25):
    if pm25 <= 15:  return 'Good'
    if pm25 <= 50:  return 'Moderate'
    if pm25 <= 100: return 'Unhealthy'
    return 'Very Unhealthy'


def _pm25_to_aqi(pm25):
    if pm25 <= 12:   return int((pm25 / 12) * 50)
    if pm25 <= 35.4: return int(50 + ((pm25 - 12) / 23.4) * 50)
    if pm25 <= 55.4: return int(100 + ((pm25 - 35.4) / 20) * 50)
    return int(150 + ((pm25 - 55.4) / 95) * 100)


def _seed_data(city_name):
    """Return generated data for a city without touching the DB."""
    city_info = SEED_CITIES.get(city_name, SEED_CITIES['Kathmandu'])
    base = city_info['pm25_base']
    env_profile = city_info['env']
    pm25 = round(base + random.uniform(-5, 5), 1)

    now = datetime.now(timezone.utc)

    # 30-day historical — city-specific amplitude
    amplitude = base * 0.28  # pollution swing proportional to base
    historical = []
    for i in range(30, 0, -1):
        v = round(base + amplitude * math.sin(i * 0.4) + random.uniform(-6, 6), 1)
        historical.append({'day': 31 - i, 'pm25': max(5, v)})

    # 7-day forecast — realistic trend for each city
    forecast = []
    trend_per_day = random.uniform(-1.2, 0.4)  # slight downward bias
    for d in range(1, 8):
        v = round(pm25 + d * trend_per_day + random.uniform(-3, 3), 1)
        forecast.append({'day': d, 'pm25': max(5, v)})

    # Environmental params (12 time-steps for sparkline) — city-specific ranges
    env_series = {}
    for param, (center, spread) in env_profile.items():
        env_series[param] = [round(center + random.uniform(-spread, spread), 3 if spread < 0.1 else 1)
                             for _ in range(12)]
    env_current = {k: v[-1] for k, v in env_series.items()}

    status_label = _pm25_to_status(pm25)
    messages = {
        'Good': 'Air quality is satisfactory and poses little or no risk.',
        'Moderate': 'Air quality is acceptable for most people.',
        'Unhealthy': 'Members of sensitive groups may experience health effects.',
        'Very Unhealthy': 'Everyone may begin to experience serious health effects.',
    }
    msg = messages.get(status_label, '')
    # Append city-specific context
    if city_info.get('message_extra'):
        msg += ' ' + city_info['message_extra']

    return {
        'city': city_name,
        'timestamp': now.isoformat(),
        'pm25': pm25,
        'aqi': _pm25_to_aqi(pm25),
        'status': status_label,
        'message': msg,
        'historical': historical,
        'forecast': forecast,
        'env_current': env_current,
        'env_series': env_series,
    }


# ─── views ───────────────────────────────────────────────────────────────

@api_view(['GET'])
def city_list(request):
    """GET /api/cities/ — list all available cities (only 4 required cities)."""
    ALLOWED_CITIES = ['Kathmandu', 'Pokhara', 'Birgunj', 'Chitwan']
    cities_qs = City.objects.filter(name__in=ALLOWED_CITIES)
    if cities_qs.exists():
        return Response(CitySerializer(cities_qs, many=True).data)
    # fallback: seed list
    return Response([{'id': i, 'name': n, 'latitude': SEED_CITIES[n]['lat'], 'longitude': SEED_CITIES[n]['lng']}
                     for i, n in enumerate(ALLOWED_CITIES, 1)])


@api_view(['GET'])
def city_summary(request, city_name):
    """
    GET /api/cities/<city_name>/summary/
    Returns current AQI, 30-day historical and 7-day forecast in one call.
    Tries: final.csv → Database → Seeded data
    """
    city_title = city_name.title()
    
    print(f"[API] ===== city_summary called for: {city_title} =====")
    
    # First try: Read from final.csv (most accurate)
    print("[API] Attempting to read from CSV...")
    csv_predictions = _read_predictions_from_csv()
    if csv_predictions and city_title in csv_predictions:
        pred = csv_predictions[city_title]
        pm25 = pred['pm25_today']
        forecast = pred['forecast']
        
        print(f"[API] Using CSV data for {city_title}. PM2.5={pm25}")
        
        return Response({
            'city': city_title,
            'timestamp': f"{pred['date']}T00:00:00Z",
            'pm25': round(pm25, 1),
            'aqi': _pm25_to_aqi(pm25),
            'status': _pm25_to_status(pm25),
            'message': _msg(_pm25_to_status(pm25)),
            'historical': [],  # No historical data from CSV
            'forecast': [{'day': i+1, 'pm25': round(v, 1)} for i, v in enumerate(forecast)],
            'env_current': {},
            'env_series': {},
        })
    
    # Second try: Database
    print(f"[API] CSV not available, trying database for {city_title}...")
    try:
        city_obj = City.objects.get(name__iexact=city_name)
        latest = AQIReading.objects.filter(city=city_obj).first()
        if latest:
            print(f"[API] Using database data for {city_title}")
            historical_qs = AQIReading.objects.filter(city=city_obj).order_by('timestamp')[:30]
            forecast_qs   = ForecastReading.objects.filter(city=city_obj).order_by('day')[:7]
            env_qs        = EnvironmentalParameter.objects.filter(city=city_obj).first()

            historical = [{'day': i + 1, 'pm25': r.pm25} for i, r in enumerate(historical_qs)]
            forecast   = ForecastReadingSerializer(forecast_qs, many=True).data
            env_data   = EnvironmentalParameterSerializer(env_qs).data if env_qs else {}

            return Response({
                'city': city_obj.name,
                'timestamp': latest.timestamp.isoformat(),
                'pm25': latest.pm25,
                'aqi': latest.aqi,
                'status': latest.status,
                'message': _msg(latest.status),
                'historical': historical,
                'forecast': forecast,
                'env_current': env_data,
                'env_series': {},   # extend when storing time-series env data
            })
    except City.DoesNotExist:
        pass

    # Fallback to seeded data
    print(f"[API] No CSV or database data, using SEEDED data for {city_title} (fallback)")
    name = city_title
    if name not in SEED_CITIES:
        name = 'Kathmandu'
    return Response(_seed_data(name))


def _msg(s):
    return {
        'Good': 'Air quality is satisfactory and poses little or no risk.',
        'Moderate': 'Air quality is acceptable for most people.',
        'Unhealthy': 'Members of sensitive groups may experience effects.',
        'Very Unhealthy': 'Everyone may begin to experience health effects.',
    }.get(s, '')


@api_view(['GET'])
def all_cities_summary(request):
    """
    GET /api/summary/
    Returns current PM2.5 + status for every city (for the landing page cards) — only 4 required cities.
    Tries: final.csv → Database → Seeded data
    """
    result = []
    ALLOWED_CITIES = ['Kathmandu', 'Pokhara', 'Birgunj', 'Chitwan']
    
    # First try: Read from final.csv (most accurate)
    csv_predictions = _read_predictions_from_csv()
    if csv_predictions:
        for name in ALLOWED_CITIES:
            if name in csv_predictions:
                pred = csv_predictions[name]
                pm25 = pred['pm25_today']
                result.append({
                    'city': name,
                    'pm25': round(pm25, 1),
                    'aqi': _pm25_to_aqi(pm25),
                    'status': _pm25_to_status(pm25),
                    'latitude': SEED_CITIES[name]['lat'],
                    'longitude': SEED_CITIES[name]['lng'],
                })
        if result:
            return Response(result)
    
    # Fallback: Seeded data
    for name in ALLOWED_CITIES:
        if name in SEED_CITIES:
            _set_seed_for_city(name)  # Set reproducible seed
            
            data = SEED_CITIES[name]
            pm25 = round(data['pm25_base'] + random.uniform(-5, 5), 1)
            result.append({
                'city': name,
                'pm25': pm25,
                'aqi': _pm25_to_aqi(pm25),
                'status': _pm25_to_status(pm25),
                'latitude': data['lat'],
                'longitude': data['lng'],
            })
    return Response(result)


@api_view(['GET'])
def health_check(request):
    """GET /api/health/ — simple liveness probe."""
    return Response({'status': 'ok', 'service': 'AirWatch Nepal API'})


# ─── Prediction endpoints ────────────────────────────────────────────────────

@api_view(['POST'])
def trigger_predictions(request):
    """
    POST /api/predictions/generate/
    Triggers the ML pipeline (steps 0-5) to generate fresh PM2.5 predictions.
    Blocks until pipeline completes, then returns fresh predictions for all cities.
    
    Expected request body: {} (empty JSON object)
    Response: Array of predictions with PM2.5 values and 7-day forecasts
    """
    try:
        # Find main.py in the backend_pipeline directory
        # Path: from views.py at backend/api/views.py to backend_pipeline/main.py
        current_file = os.path.abspath(__file__)  # Full path to views.py
        backend_dir = os.path.dirname(os.path.dirname(current_file))  # backend/
        project_root = os.path.dirname(backend_dir)  # project root
        backend_pipeline_dir = os.path.join(project_root, 'backend_pipeline')
        main_py_path = os.path.join(backend_pipeline_dir, 'main.py')
        
        if not os.path.exists(main_py_path):
            return Response(
                {'error': 'Pipeline script not found', 'details': f'Expected at {main_py_path}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Run the pipeline as a subprocess
        print(f"[API] Triggering pipeline: {main_py_path}")
        try:
            # Set UTF-8 encoding for subprocess to handle Unicode characters
            env = os.environ.copy()
            env['PYTHONIOENCODING'] = 'utf-8'
            
            result = subprocess.run(
                [sys.executable, main_py_path],
                cwd=backend_pipeline_dir,
                capture_output=True,
                text=True,
                encoding='utf-8',
                env=env,
                timeout=3600  # 1 hour timeout
            )
        except subprocess.TimeoutExpired:
            return Response(
                {'error': 'Pipeline timeout', 'details': 'Pipeline took longer than 1 hour'},
                status=status.HTTP_408_REQUEST_TIMEOUT
            )
        except Exception as e:
            print(f"[API] Subprocess error: {str(e)}")
            return Response(
                {'error': 'Subprocess error', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        if result.returncode != 0:
            error_msg = result.stderr if result.stderr else 'Unknown error'
            print(f"[API] Pipeline failed with exit code {result.returncode}")
            print(f"[API] Error: {error_msg[-500:]}")
            return Response(
                {
                    'error': 'Pipeline execution failed',
                    'details': error_msg[-500:],
                    'exit_code': result.returncode
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Pipeline succeeded, now return fresh predictions
        print(f"[API] Pipeline completed successfully")
        from django.utils import timezone
        today = timezone.now().date()
        
        predictions_qs = DailyPrediction.objects.filter(
            prediction_date=today
        ).select_related('city').filter(city__name__in=['Kathmandu', 'Pokhara', 'Birgunj', 'Chitwan'])
        
        if predictions_qs.exists():
            predictions = DailyPredictionSerializer(predictions_qs, many=True).data
            return Response({
                'success': True,
                'message': 'Pipeline executed and predictions updated',
                'predictions': predictions
            })
        else:
            # If no predictions found, return seeded data as fallback
            result = []
            for city_name in ['Kathmandu', 'Pokhara', 'Birgunj', 'Chitwan']:
                if city_name in SEED_CITIES:
                    data = SEED_CITIES[city_name]
                    base = data['pm25_base']
                    pm25_today = round(base + random.uniform(-5, 5), 1)
                    
                    forecast = []
                    trend_per_day = random.uniform(-1.2, 0.4)
                    for d in range(1, 8):
                        v = round(pm25_today + d * trend_per_day + random.uniform(-3, 3), 1)
                        forecast.append(max(5, v))
                    
                    result.append({
                        'city_name': city_name,
                        'prediction_date': str(today),
                        'pm25_today': pm25_today,
                        'forecast': forecast,
                    })
            
            return Response({
                'success': True,
                'message': 'Pipeline executed (DB empty, showing seeded data)',
                'predictions': result
            })
    
    except Exception as e:
        print(f"[API] Unexpected error in trigger_predictions: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': 'Internal server error', 'details': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_today_predictions(request):
    """
    GET /api/predictions/today/
    Returns today's PM2.5 predictions and 7-day forecast for all cities.
    Tries: final.csv → Database → Seeded data
    """
    from django.utils import timezone
    today = timezone.now().date()
    
    print("[API] ===== get_today_predictions called =====")
    
    # First try: Read from final.csv (most accurate)
    csv_predictions = _read_predictions_from_csv()
    if csv_predictions:
        print(f"[API] Using CSV data. Found {len(csv_predictions)} cities")
        result = []
        ALLOWED_CITIES = ['Kathmandu', 'Pokhara', 'Birgunj', 'Chitwan']
        for city_name in ALLOWED_CITIES:
            if city_name in csv_predictions:
                pred = csv_predictions[city_name]
                result.append({
                    'city_name': city_name,
                    'prediction_date': pred['date'],
                    'pm25_today': round(pred['pm25_today'], 1),
                    'forecast': [round(v, 1) for v in pred['forecast']],
                })
        if result:
            print(f"[API] Returning {len(result)} cities from CSV")
            return Response(result)
    
    # Second try: Database
    print("[API] CSV not available, trying database...")
    predictions = DailyPrediction.objects.filter(
        prediction_date=today,
        city__name__in=['Kathmandu', 'Pokhara', 'Birgunj', 'Chitwan']
    ).select_related('city')
    
    if predictions.exists():
        print(f"[API] Using database data. Found {predictions.count()} predictions")
        return Response(DailyPredictionSerializer(predictions, many=True).data)
    
    # Fallback: Seeded data structure — only return the 4 required cities
    print("[API] No CSV or database data, using SEEDED data (fallback)")
    result = []
    for city_name in ['Kathmandu', 'Pokhara', 'Birgunj', 'Chitwan']:
        if city_name in SEED_CITIES:
            _set_seed_for_city(city_name)  # Set reproducible seed
            
            data = SEED_CITIES[city_name]
            base = data['pm25_base']
            pm25_today = round(base + random.uniform(-5, 5), 1)
            
            forecast = []
            trend_per_day = random.uniform(-1.2, 0.4)
            for d in range(1, 8):
                v = round(pm25_today + d * trend_per_day + random.uniform(-3, 3), 1)
                forecast.append(max(5, v))
            
            result.append({
                'city_name': city_name,
                'prediction_date': str(today),
                'pm25_today': pm25_today,
                'forecast': forecast,
            })
    
    return Response(result)


@api_view(['GET'])
def get_city_prediction(request, city_name):
    """
    GET /api/predictions/<city_name>/
    Returns the latest PM2.5 prediction for a specific city.
    Tries: final.csv → Database → Seeded data
    """
    ALLOWED_CITIES = ['Kathmandu', 'Pokhara', 'Birgunj', 'Chitwan']
    city_title = city_name.title()
    
    # First try: Read from final.csv (most accurate)
    csv_predictions = _read_predictions_from_csv()
    if csv_predictions and city_title in csv_predictions:
        pred = csv_predictions[city_title]
        return Response({
            'city_name': city_title,
            'prediction_date': pred['date'],
            'pm25_today': round(pred['pm25_today'], 1),
            'forecast': [round(v, 1) for v in pred['forecast']],
        })
    
    # Second try: Database
    try:
        city_obj = City.objects.get(name__iexact=city_name)
        prediction = DailyPrediction.objects.filter(city=city_obj).latest('prediction_date')
        return Response(DailyPredictionSerializer(prediction).data)
    except City.DoesNotExist:
        pass
    except DailyPrediction.DoesNotExist:
        pass
    
    # Fallback: Seeded data
    if city_title not in ALLOWED_CITIES or city_title not in SEED_CITIES:
        city_title = 'Kathmandu'  # Default fallback
    
    if city_title in SEED_CITIES:
        _set_seed_for_city(city_title)  # Set reproducible seed
        
        city_data = SEED_CITIES[city_title]
        from django.utils import timezone
        today = timezone.now().date()
        
        pm25_today = round(city_data['pm25_base'] + random.uniform(-5, 5), 1)
        forecast = []
        trend_per_day = random.uniform(-1.2, 0.4)
        for d in range(1, 8):
            v = round(pm25_today + d * trend_per_day + random.uniform(-3, 3), 1)
            forecast.append(max(5, v))
        
        return Response({
            'city_name': city_title,
            'prediction_date': str(today),
            'pm25_today': pm25_today,
            'forecast': forecast,
        })
    else:
        return Response(
            {'error': f'City "{city_name}" not found in allowed cities'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
def get_city_forecast(request, city_name):
    """
    GET /api/predictions/<city_name>/forecast/
    Returns the latest 7-day forecast for a specific city.
    Tries: final.csv → Database → Seeded data
    """
    ALLOWED_CITIES = ['Kathmandu', 'Pokhara', 'Birgunj', 'Chitwan']
    city_title = city_name.title()
    
    print(f"[API] ===== get_city_forecast called for: {city_title} =====")
    
    # First try: Read from final.csv (most accurate)
    csv_predictions = _read_predictions_from_csv()
    if csv_predictions and city_title in csv_predictions:
        pred = csv_predictions[city_title]
        forecast_data = [
            {'day': i + 1, 'pm25': round(v, 1)}
            for i, v in enumerate(pred['forecast'])
        ]
        print(f"[API] Using CSV data for {city_title}")
        return Response({
            'city': city_title,
            'prediction_date': pred['date'],
            'forecast': forecast_data,
        })
    
    # Second try: Database
    print(f"[API] CSV not available, trying database for {city_title}...")
    try:
        city_obj = City.objects.get(name__iexact=city_name)
        prediction = DailyPrediction.objects.filter(city=city_obj).latest('prediction_date')
        
        forecast_data = [
            {'day': i + 1, 'pm25': pm25_val}
            for i, pm25_val in enumerate(prediction.get_forecast_array())
        ]
        
        print(f"[API] Using database data for {city_title}")
        return Response({
            'city': city_obj.name,
            'prediction_date': str(prediction.prediction_date),
            'forecast': forecast_data,
        })
    except City.DoesNotExist:
        pass
    except DailyPrediction.DoesNotExist:
        pass
    
    # Fallback: Seeded data
    print(f"[API] No CSV or database data, using SEEDED data for {city_title} (fallback)")
    if city_title not in ALLOWED_CITIES or city_title not in SEED_CITIES:
        city_title = 'Kathmandu'  # Default fallback
    
    if city_title in SEED_CITIES:
        _set_seed_for_city(city_title)  # Set reproducible seed
        
        city_data = SEED_CITIES[city_title]
        pm25_today = round(city_data['pm25_base'] + random.uniform(-5, 5), 1)
        
        forecast = []
        trend_per_day = random.uniform(-1.2, 0.4)
        for d in range(1, 8):
            v = round(pm25_today + d * trend_per_day + random.uniform(-3, 3), 1)
            forecast.append({'day': d, 'pm25': max(5, v)})
        
        from django.utils import timezone
        return Response({
            'city': city_title,
            'prediction_date': str(timezone.now().date()),
            'forecast': forecast,
        })
    else:
        return Response(
            {'error': f'City "{city_name}" not found in allowed cities'},
            status=status.HTTP_404_NOT_FOUND
        )
