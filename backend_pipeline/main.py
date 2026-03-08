"""
Main pipeline orchestrator -- runs steps 0 through 5 sequentially.

Usage:
    python main.py              # run full pipeline
    python main.py --from 3     # resume from step 3
    python main.py --only 5     # run only step 5

Each step runs as a subprocess so failures are caught cleanly.
Designed to be run once per day.
"""

import os
import sys
import subprocess
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Python executable inside the venv
PYTHON = sys.executable

# Step definitions: (step_number, description, script_path)
STEPS = [
    (0, "Data Pulling (GEE)",           os.path.join(BASE_DIR, "0_data_pulling", "pull_data.py")),
    (1, "ERA5 Forecasting (LSTM)",      os.path.join(BASE_DIR, "1_era5_forecasting", "forecast_era5.py")),
    (2, "Satellite Gap Filling",        os.path.join(BASE_DIR, "2_satellite_filling", "fill_satellites.py")),
    (3, "Approx-to-Exact Conversion",   os.path.join(BASE_DIR, "3_exact_filling", "build_ensemble_ready.py")),
    (4, "PM2.5 Ensemble Prediction",    os.path.join(BASE_DIR, "4_ensemble", "predict_pm25.py")),
    (5, "7-Day LSTM Forecast",          os.path.join(BASE_DIR, "5_lstm", "forecast_lstm.py")),
]


def run_step(step_num, description, script_path):
    """Run a single pipeline step as a subprocess. Returns True on success."""
    print(f"\n{'='*60}")
    print(f"  STEP {step_num}: {description}")
    print(f"  Script: {os.path.relpath(script_path, BASE_DIR)}")
    print(f"  Started: {datetime.now().strftime('%H:%M:%S')}")
    print(f"{'='*60}\n")

    if not os.path.isfile(script_path):
        print(f"  ERROR: Script not found: {script_path}")
        return False

    result = subprocess.run(
        [PYTHON, script_path],
        cwd=os.path.dirname(script_path),
    )

    if result.returncode != 0:
        print(f"\n  STEP {step_num} FAILED (exit code {result.returncode})")
        return False

    print(f"\n  STEP {step_num} COMPLETED at {datetime.now().strftime('%H:%M:%S')}")
    return True


def main():
    today = datetime.now().strftime("%Y-%m-%d")
    print("#" * 60)
    print(f"#  AIR QUALITY BACKEND PIPELINE")
    print(f"#  Date: {today}")
    print(f"#  Time: {datetime.now().strftime('%H:%M:%S')}")
    print("#" * 60)

    # Parse arguments
    start_step = 0
    only_step = None

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--from" and i + 1 < len(args):
            start_step = int(args[i + 1])
            i += 2
        elif args[i] == "--only" and i + 1 < len(args):
            only_step = int(args[i + 1])
            i += 2
        else:
            print(f"Unknown argument: {args[i]}")
            print("Usage: python main.py [--from N] [--only N]")
            return 1
            i += 1

    # Determine which steps to run
    if only_step is not None:
        steps_to_run = [(n, d, p) for n, d, p in STEPS if n == only_step]
        if not steps_to_run:
            print(f"ERROR: Step {only_step} not found")
            return 1
        print(f"\nRunning only step {only_step}")
    else:
        steps_to_run = [(n, d, p) for n, d, p in STEPS if n >= start_step]
        if start_step > 0:
            print(f"\nResuming from step {start_step}")
        else:
            print(f"\nRunning full pipeline (steps 0-5)")

    # Execute steps sequentially
    completed = 0
    failed_step = None

    for step_num, description, script_path in steps_to_run:
        success = run_step(step_num, description, script_path)
        if not success:
            failed_step = step_num
            print(f"\n{'!'*60}")
            print(f"  PIPELINE HALTED at step {step_num}: {description}")
            print(f"  Fix the issue and resume with: python main.py --from {step_num}")
            print(f"{'!'*60}")
            break
        completed += 1

    # Summary
    print(f"\n{'#'*60}")
    print(f"#  PIPELINE {'COMPLETED' if failed_step is None else 'FAILED'}")
    print(f"#  Steps completed: {completed}/{len(steps_to_run)}")
    print(f"#  Finished: {datetime.now().strftime('%H:%M:%S')}")
    
    # Save predictions to database if pipeline succeeded
    if failed_step is None:
        final_csv = os.path.join(BASE_DIR, "database", "final.csv")
        if os.path.exists(final_csv):
            print(f"#  Output: database/final.csv")
            print(f"#  Saving to database...")
            _save_to_database(final_csv)
    print(f"{'#'*60}")

    return 0 if failed_step is None else 1


def _save_to_database(csv_path):
    """Save predictions from final.csv to Django database."""
    try:
        # Add backend to path so we can import Django modules
        backend_path = os.path.join(os.path.dirname(BASE_DIR), 'backend')
        if backend_path not in sys.path:
            sys.path.insert(0, backend_path)
            sys.path.insert(0, os.path.dirname(BASE_DIR))
        
        # Try to import db_ingestion module
        try:
            from api.db_ingestion import save_predictions_from_csv
        except ImportError:
            print(f"#  ⚠  Could not import db_ingestion from Django")
            print(f"#  To manually save predictions, run:")
            print(f"#    cd ../backend")
            print(f"#    python api/db_ingestion.py ../{os.path.relpath(csv_path, os.path.dirname(BASE_DIR))}")
            return
        
        # Save predictions to database
        print(f"#  Loading predictions from: {os.path.relpath(csv_path, BASE_DIR)}")
        summary = save_predictions_from_csv(csv_path)
        
        print(f"#  ✓ Database saved: {summary['created']} created, {summary['updated']} updated")
        if summary['errors']:
            print(f"#  ⚠  Errors: {len(summary['errors'])}")
            for err in summary['errors'][:3]:  # Show first 3 errors
                print(f"#    - {err}")
            if len(summary['errors']) > 3:
                print(f"#    ... and {len(summary['errors']) - 3} more")
    except Exception as e:
        print(f"#  ⚠  Database save failed: {e}")
        print(f"#  Predictions saved to CSV, but not to database.")
        print(f"#  To save manually:")
        print(f"#    cd ../backend")
        print(f"#    python api/db_ingestion.py ../{os.path.relpath(csv_path, os.path.dirname(BASE_DIR))}")


if __name__ == "__main__":
    sys.exit(main())
