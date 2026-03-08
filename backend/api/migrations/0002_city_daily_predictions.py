# Generated migration for DailyPrediction model

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='DailyPrediction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('prediction_date', models.DateField(help_text='The date of today\'s prediction')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('pm25_today', models.FloatField(help_text='Today\'s PM2.5 estimate (µg/m³)')),
                ('pm25_day1', models.FloatField(help_text='Day +1 forecast (µg/m³)')),
                ('pm25_day2', models.FloatField(help_text='Day +2 forecast (µg/m³)')),
                ('pm25_day3', models.FloatField(help_text='Day +3 forecast (µg/m³)')),
                ('pm25_day4', models.FloatField(help_text='Day +4 forecast (µg/m³)')),
                ('pm25_day5', models.FloatField(help_text='Day +5 forecast (µg/m³)')),
                ('pm25_day6', models.FloatField(help_text='Day +6 forecast (µg/m³)')),
                ('pm25_day7', models.FloatField(help_text='Day +7 forecast (µg/m³)')),
                ('city', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='daily_predictions', to='api.city')),
            ],
            options={
                'ordering': ['-prediction_date', 'city'],
            },
        ),
        migrations.AddIndex(
            model_name='dailyprediction',
            index=models.Index(fields=['city', '-prediction_date'], name='api_dailypr_city_id_7f3c2e_idx'),
        ),
        migrations.AddIndex(
            model_name='dailyprediction',
            index=models.Index(fields=['-prediction_date'], name='api_dailypr__predict_3f2a1c_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='dailyprediction',
            unique_together={('city', 'prediction_date')},
        ),
    ]
