from django.urls import path
from . import views

urlpatterns = [
    # Health-check
    path('health/',                              views.health_check,            name='health'),

    # City list & per-city summary
    path('cities/',                              views.city_list,               name='city-list'),
    path('cities/<str:city_name>/summary/',      views.city_summary,            name='city-summary'),

    # All cities snapshot (for landing page cards)
    path('summary/',                             views.all_cities_summary,      name='all-summary'),

    # PM2.5 predictions and forecasts
    path('predictions/generate/',                views.trigger_predictions,     name='trigger-predictions'),
    path('predictions/today/',                   views.get_today_predictions,   name='predictions-today'),
    path('predictions/<str:city_name>/',         views.get_city_prediction,     name='city-prediction'),
    path('predictions/<str:city_name>/forecast/', views.get_city_forecast,      name='city-forecast'),
]
