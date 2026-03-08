from rest_framework import serializers
from .models import City, AQIReading, EnvironmentalParameter, ForecastReading, DailyPrediction


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ['id', 'name', 'latitude', 'longitude']


class AQIReadingSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model = AQIReading
        fields = ['id', 'city_name', 'timestamp', 'pm25', 'aqi', 'status']


class EnvironmentalParameterSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnvironmentalParameter
        fields = ['id', 'timestamp', 'aod', 'no2', 'so2', 'ndvi', 'temperature', 'wind_speed']


class ForecastReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ForecastReading
        fields = ['day', 'pm25']


class DailyPredictionSerializer(serializers.ModelSerializer):
    """Serializer for daily PM2.5 predictions and 7-day forecast."""
    city_name = serializers.CharField(source='city.name', read_only=True)
    forecast = serializers.SerializerMethodField()

    class Meta:
        model = DailyPrediction
        fields = [
            'id', 'city_name', 'prediction_date', 'created_at',
            'pm25_today', 'forecast'
        ]

    def get_forecast(self, obj):
        """Return 7-day forecast as a list."""
        return obj.get_forecast_array()
