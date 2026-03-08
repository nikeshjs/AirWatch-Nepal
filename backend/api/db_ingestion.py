"""
Database ingestion utility for saving PM2.5 predictions to Django database.

This module provides functions to save daily predictions (today's PM2.5 estimate
and 7-day forecast) to the DailyPrediction model. It can be used by the ML pipeline
to persist predictions after computing them.

Usage:
    from db_ingestion import save_predictions_from_csv
    save_predictions_from_csv('database/final.csv')
"""

import os
import sys
import django
from pathlib import Path

# Setup Django
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import City, DailyPrediction
from django.utils import timezone
from datetime import datetime


def ensure_cities_exist():
    """Ensure all 4 cities exist in the database."""
    CITIES = [
        {'name': 'Kathmandu', 'latitude': 27.7172, 'longitude': 85.3240},
        {'name': 'Pokhara', 'latitude': 28.2096, 'longitude': 83.9856},
        {'name': 'Birgunj', 'latitude': 27.0104, 'longitude': 84.8777},
        {'name': 'Chitwan', 'latitude': 27.5291, 'longitude': 84.3542},
    ]
    
    for city_data in CITIES:
        city, created = City.objects.get_or_create(
            name=city_data['name'],
            defaults={
                'latitude': city_data['latitude'],
                'longitude': city_data['longitude'],
            }
        )
        if created:
            print(f"Created city: {city.name}")


def save_predictions_from_csv(csv_path):
    """
    Save daily predictions from final.csv to the database.
    
    The CSV should have columns:
        date, site, pm2.5, pm2.5_1, pm2.5_2, ..., pm2.5_7
    
    Args:
        csv_path: Path to the final.csv file from the pipeline output
    
    Returns:
        dict: Summary with number of records created/updated
    """
    import pandas as pd
    
    ensure_cities_exist()
    
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    df = pd.read_csv(csv_path)
    
    # Validate columns
    required_cols = ['date', 'site', 'pm2.5', 'pm2.5_1', 'pm2.5_2', 'pm2.5_3',
                     'pm2.5_4', 'pm2.5_5', 'pm2.5_6', 'pm2.5_7']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}")
    
    summary = {'created': 0, 'updated': 0, 'errors': []}
    
    for idx, row in df.iterrows():
        try:
            # Parse date
            prediction_date = pd.to_datetime(row['date']).date()
            
            # Get city (normalize name to title case)
            city_name = row['site'].strip().title()
            try:
                city = City.objects.get(name=city_name)
            except City.DoesNotExist:
                summary['errors'].append(f"City not found: {city_name}")
                continue
            
            # Extract PM2.5 values
            pm25_today = float(row['pm2.5'])
            pm25_day1 = float(row['pm2.5_1'])
            pm25_day2 = float(row['pm2.5_2'])
            pm25_day3 = float(row['pm2.5_3'])
            pm25_day4 = float(row['pm2.5_4'])
            pm25_day5 = float(row['pm2.5_5'])
            pm25_day6 = float(row['pm2.5_6'])
            pm25_day7 = float(row['pm2.5_7'])
            
            # Create or update the prediction
            prediction, created = DailyPrediction.objects.update_or_create(
                city=city,
                prediction_date=prediction_date,
                defaults={
                    'pm25_today': pm25_today,
                    'pm25_day1': pm25_day1,
                    'pm25_day2': pm25_day2,
                    'pm25_day3': pm25_day3,
                    'pm25_day4': pm25_day4,
                    'pm25_day5': pm25_day5,
                    'pm25_day6': pm25_day6,
                    'pm25_day7': pm25_day7,
                }
            )
            
            if created:
                summary['created'] += 1
                print(f"✓ Created prediction: {city.name} on {prediction_date}")
            else:
                summary['updated'] += 1
                print(f"° Updated prediction: {city.name} on {prediction_date}")
        
        except Exception as e:
            summary['errors'].append(f"Row {idx}: {str(e)}")
            print(f"✗ Error processing row {idx}: {str(e)}")
    
    return summary


def save_predictions_dict(predictions_data):
    """
    Save daily predictions from a dictionary of data.
    
    Args:
        predictions_data: Dict with structure:
            {
                'prediction_date': '2026-03-07',
                'predictions': [
                    {
                        'site': 'kathmandu',
                        'pm2.5': 73.33,
                        'pm2.5_1': 78.91,
                        ...
                        'pm2.5_7': 78.44
                    },
                    ...
                ]
            }
    
    Returns:
        dict: Summary with number of records created/updated
    """
    ensure_cities_exist()
    
    summary = {'created': 0, 'updated': 0, 'errors': []}
    prediction_date = pd.to_datetime(predictions_data['prediction_date']).date() if isinstance(
        predictions_data['prediction_date'], str
    ) else predictions_data['prediction_date']
    
    for pred in predictions_data['predictions']:
        try:
            city_name = pred['site'].strip().title()
            try:
                city = City.objects.get(name=city_name)
            except City.DoesNotExist:
                summary['errors'].append(f"City not found: {city_name}")
                continue
            
            _, created = DailyPrediction.objects.update_or_create(
                city=city,
                prediction_date=prediction_date,
                defaults={
                    'pm25_today': float(pred['pm2.5']),
                    'pm25_day1': float(pred['pm2.5_1']),
                    'pm25_day2': float(pred['pm2.5_2']),
                    'pm25_day3': float(pred['pm2.5_3']),
                    'pm25_day4': float(pred['pm2.5_4']),
                    'pm25_day5': float(pred['pm2.5_5']),
                    'pm25_day6': float(pred['pm2.5_6']),
                    'pm25_day7': float(pred['pm2.5_7']),
                }
            )
            
            if created:
                summary['created'] += 1
            else:
                summary['updated'] += 1
        except Exception as e:
            summary['errors'].append(f"{pred.get('site', 'unknown')}: {str(e)}")
    
    return summary


if __name__ == '__main__':
    # Example: python db_ingestion.py
    csv_path = os.path.join(
        os.path.dirname(__file__), '..', '..', 'backend_pipeline', 'database', 'final.csv'
    )
    
    if len(sys.argv) > 1:
        csv_path = sys.argv[1]
    
    print(f"Ingesting predictions from: {csv_path}")
    summary = save_predictions_from_csv(csv_path)
    
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Created: {summary['created']}")
    print(f"  Updated: {summary['updated']}")
    if summary['errors']:
        print(f"  Errors: {len(summary['errors'])}")
        for err in summary['errors']:
            print(f"    - {err}")
    print(f"{'='*60}")
