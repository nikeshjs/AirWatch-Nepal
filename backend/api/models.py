from django.db import models


class City(models.Model):
    """Represents a monitored city in Nepal."""
    name = models.CharField(max_length=100, unique=True)
    latitude = models.FloatField()
    longitude = models.FloatField()

    class Meta:
        verbose_name_plural = 'Cities'
        ordering = ['name']

    def __str__(self):
        return self.name


class AQIReading(models.Model):
    """A single PM2.5 / AQI measurement for a city at a point in time."""
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='readings')
    timestamp = models.DateTimeField()
    pm25 = models.FloatField(help_text='PM2.5 concentration in µg/m³')
    aqi = models.IntegerField(default=0)

    # Status derived from pm25
    STATUS_CHOICES = [
        ('Good',      'Good'),
        ('Moderate',  'Moderate'),
        ('Unhealthy', 'Unhealthy'),
        ('Very Unhealthy', 'Very Unhealthy'),
        ('Hazardous', 'Hazardous'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Moderate')

    class Meta:
        ordering = ['-timestamp']
        indexes = [models.Index(fields=['city', 'timestamp'])]

    def __str__(self):
        return f'{self.city.name} – {self.pm25} µg/m³ @ {self.timestamp}'

    @staticmethod
    def pm25_to_status(pm25: float) -> str:
        if pm25 <= 15:   return 'Good'
        if pm25 <= 50:   return 'Moderate'
        if pm25 <= 100:  return 'Unhealthy'
        if pm25 <= 150:  return 'Very Unhealthy'
        return 'Hazardous'

    @staticmethod
    def pm25_to_aqi(pm25: float) -> int:
        """Simple linear AQI approximation from PM2.5."""
        if pm25 <= 12:    return int((pm25 / 12) * 50)
        if pm25 <= 35.4:  return int(50 + ((pm25 - 12) / 23.4) * 50)
        if pm25 <= 55.4:  return int(100 + ((pm25 - 35.4) / 20) * 50)
        if pm25 <= 150.4: return int(150 + ((pm25 - 55.4) / 95) * 100)
        return 300


class EnvironmentalParameter(models.Model):
    """Satellite-derived environmental parameters for a city."""
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='env_params')
    timestamp = models.DateTimeField()
    aod   = models.FloatField(help_text='Aerosol Optical Depth')
    no2   = models.FloatField(help_text='Nitrogen Dioxide (ppb)')
    so2   = models.FloatField(help_text='Sulfur Dioxide (ppb)')
    ndvi  = models.FloatField(help_text='Vegetation Index')
    temperature = models.FloatField(help_text='°C')
    wind_speed  = models.FloatField(help_text='km/h')

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f'{self.city.name} env @ {self.timestamp}'


class DailyPrediction(models.Model):
    """Daily PM2.5 prediction and 7-day forecast for a city.
    
    Stores both today's PM2.5 estimate (from ensemble model) and the 7-day forecast.
    Created once per day when the pipeline runs.
    """
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='daily_predictions')
    prediction_date = models.DateField(help_text='The date of today\'s prediction')
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Today's PM2.5 estimate from ensemble model
    pm25_today = models.FloatField(help_text='Today\'s PM2.5 estimate (µg/m³)')
    
    # 7-day forecast from LSTM model
    pm25_day1 = models.FloatField(help_text='Day +1 forecast (µg/m³)')
    pm25_day2 = models.FloatField(help_text='Day +2 forecast (µg/m³)')
    pm25_day3 = models.FloatField(help_text='Day +3 forecast (µg/m³)')
    pm25_day4 = models.FloatField(help_text='Day +4 forecast (µg/m³)')
    pm25_day5 = models.FloatField(help_text='Day +5 forecast (µg/m³)')
    pm25_day6 = models.FloatField(help_text='Day +6 forecast (µg/m³)')
    pm25_day7 = models.FloatField(help_text='Day +7 forecast (µg/m³)')

    class Meta:
        ordering = ['-prediction_date', 'city']
        indexes = [models.Index(fields=['city', '-prediction_date']),
                   models.Index(fields=['-prediction_date'])]
        unique_together = ['city', 'prediction_date']

    def __str__(self):
        return f'{self.city.name} prediction for {self.prediction_date}'
    
    def get_forecast_array(self):
        """Returns list of 7-day forecast values."""
        return [self.pm25_day1, self.pm25_day2, self.pm25_day3, self.pm25_day4,
                self.pm25_day5, self.pm25_day6, self.pm25_day7]


class ForecastReading(models.Model):
    """7-day LSTM forecast PM2.5 for a city (legacy, for individual days)."""
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='forecasts')
    created_at = models.DateTimeField(auto_now_add=True)
    day = models.PositiveSmallIntegerField(help_text='Forecast day offset (1–7)')
    pm25 = models.FloatField()

    class Meta:
        ordering = ['city', 'created_at', 'day']
        unique_together = ['city', 'created_at', 'day']

    def __str__(self):
        return f'{self.city.name} day+{self.day}: {self.pm25}'
