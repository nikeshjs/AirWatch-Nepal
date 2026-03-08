from django.contrib import admin
from .models import City, AQIReading, EnvironmentalParameter, ForecastReading


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ['name', 'latitude', 'longitude']
    search_fields = ['name']


@admin.register(AQIReading)
class AQIReadingAdmin(admin.ModelAdmin):
    list_display = ['city', 'pm25', 'aqi', 'status', 'timestamp']
    list_filter = ['city', 'status']
    search_fields = ['city__name']
    ordering = ['-timestamp']


@admin.register(EnvironmentalParameter)
class EnvironmentalParameterAdmin(admin.ModelAdmin):
    list_display = ['city', 'aod', 'no2', 'so2', 'ndvi', 'temperature', 'wind_speed', 'timestamp']
    list_filter = ['city']


@admin.register(ForecastReading)
class ForecastReadingAdmin(admin.ModelAdmin):
    list_display = ['city', 'day', 'pm25', 'created_at']
    list_filter = ['city']
