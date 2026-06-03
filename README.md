# Air Quality Index Data Analysis and Visualisation

This project analyzes Bengaluru AQI bulletin data using `pandas`, `matplotlib`, and `seaborn`.

## Dataset

Source file used in this project:

`data/Bengaluru_AQIBulletins.csv`

The dataset contains daily AQI bulletin records with:

- Date
- City
- Number of monitoring stations
- Air quality category
- AQI index value
- Prominent pollutant label

## Project Structure

```text
.
├── data/
│   └── Bengaluru_AQIBulletins.csv
├── outputs/
│   ├── figures/
│   ├── air_quality_category_counts.csv
│   ├── monthly_aqi_summary.csv
│   ├── prominent_pollutant_counts.csv
│   ├── summary_metrics.csv
│   └── yearly_aqi_summary.csv
├── src/
│   └── aqi_analysis.py
├── requirements.txt
└── README.md
```

## How to Run

Create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

Run the analysis:

```powershell
python src\aqi_analysis.py
```

Run the interactive dashboard:

```powershell
.\run_app.ps1
```

Then open:

```text
http://127.0.0.1:8765/index.html
```

## Generated Outputs

The script creates summary CSV files in `outputs/` and visualizations in `outputs/figures/`:

- `monthly_aqi_trend.png`
- `aqi_category_distribution.png`
- `yearly_aqi_boxplot.png`
- `year_month_aqi_heatmap.png`
- `top_prominent_pollutants.png`

## Key Findings

- Records analyzed: 3,120 daily AQI bulletins
- Date range: 2015-05-02 to 2023-12-31
- Average AQI: 75.42
- Highest AQI: 266
- Most common AQI category: Satisfactory
