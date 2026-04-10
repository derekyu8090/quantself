#!/usr/bin/env python3
"""
Apple Health Data Pipeline
Processes Apple Health export XML → JSON files for the Health Dashboard.

Usage:
    python3 process_data.py /path/to/apple_health_export

Output:
    public/data/cardiovascular.json
    public/data/sleep.json
    public/data/activity.json
    public/data/overview.json
"""

import xml.etree.ElementTree as ET
import json
import os
import sys
import statistics
from datetime import datetime, timedelta
from collections import defaultdict

def parse_date(s):
    """Parse Apple Health date string to date only."""
    if not s:
        return None
    try:
        return datetime.strptime(s[:19], '%Y-%m-%d %H:%M:%S')
    except:
        return None


def score_to_level(score):
    """Map 0-100 score to risk level string."""
    if score >= 70: return 'high'
    if score >= 55: return 'medium-high'
    if score >= 40: return 'medium'
    if score >= 25: return 'low-medium'
    return 'low'


def compute_risks(rhr_list, hrv_records, vo2_list, nightly_list, steps_daily,
                  body_mass, body_fat, spo2_records, sleep_breathing,
                  workouts, exercise_time_daily, all_beds, age):
    """Compute 6 risk dimensions from actual health data. Returns dict."""

    risks = {}

    # 1. Circadian Rhythm Risk
    # Based on: bedtime std deviation, % nights after midnight, bedtime consistency
    if all_beds:
        bed_std = statistics.stdev(all_beds) if len(all_beds) > 1 else 0
        after_midnight_pct = sum(1 for b in all_beds if b > 24) / len(all_beds) * 100
        after_2am_pct = sum(1 for b in all_beds if b > 26) / len(all_beds) * 100

        # Score: 0 (healthy) to 100 (severe disruption)
        # bed_std > 2h = very bad, after_2am > 50% = very bad
        score = min(100, int(
            (min(bed_std, 4) / 4 * 40) +       # std dev component (max 40)
            (min(after_midnight_pct, 100) / 100 * 30) +  # after midnight (max 30)
            (min(after_2am_pct, 100) / 100 * 30)         # after 2am (max 30)
        ))
        risks['circadianRhythm'] = {
            'level': score_to_level(score),
            'score': score,
            'label': '昼夜节律障碍',
        }
    else:
        risks['circadianRhythm'] = {'level': 'low', 'score': 0, 'label': '昼夜节律障碍'}

    # 2. Cardio Fitness Risk
    # Based on: VO2Max percentile for age, VO2Max trend direction
    if vo2_list:
        latest_vo2 = vo2_list[-1]['value']
        # Age-adjusted thresholds for males 25-30
        if latest_vo2 >= 49: vo2_score = 5
        elif latest_vo2 >= 44: vo2_score = 25
        elif latest_vo2 >= 39: vo2_score = 50
        elif latest_vo2 >= 35: vo2_score = 75
        else: vo2_score = 90

        # Trend: compare last 3 months vs previous 3 months
        if len(vo2_list) >= 4:
            recent = [v['value'] for v in vo2_list[-3:]]
            older = [v['value'] for v in vo2_list[:-3]]
            if older:
                trend_delta = sum(recent) / len(recent) - sum(older) / len(older)
                if trend_delta < -3: vo2_score = min(100, vo2_score + 15)   # declining fast
                elif trend_delta < -1: vo2_score = min(100, vo2_score + 5)  # declining slowly
                elif trend_delta > 1: vo2_score = max(0, vo2_score - 10)    # improving

        risks['cardioFitness'] = {
            'level': score_to_level(vo2_score),
            'score': vo2_score,
            'label': '心肺功能退化',
        }
    else:
        risks['cardioFitness'] = {'level': 'low', 'score': 0, 'label': '心肺功能退化'}

    # 3. Chronic Stress Risk
    # Based on: HRV mean vs age baseline, HRV night/day ratio, RHR elevation
    hrv_values = [r['value'] for r in hrv_records]
    rhr_values = [r['value'] for r in rhr_list]
    if hrv_values:
        hrv_mean = sum(hrv_values) / len(hrv_values)
        # For age 28 male, healthy HRV should be 50-80ms
        if hrv_mean < 30: hrv_score = 80
        elif hrv_mean < 40: hrv_score = 60
        elif hrv_mean < 50: hrv_score = 40
        elif hrv_mean < 60: hrv_score = 25
        else: hrv_score = 10

        # Night/day ratio check
        night_hrv = [r['value'] for r in hrv_records if r['hour'] >= 22 or r['hour'] <= 6]
        day_hrv = [r['value'] for r in hrv_records if 6 < r['hour'] < 22]
        if night_hrv and day_hrv:
            ratio = sum(night_hrv) / len(night_hrv) / (sum(day_hrv) / len(day_hrv))
            if ratio < 1.05: hrv_score = min(100, hrv_score + 15)  # No night advantage = bad

        risks['chronicStress'] = {
            'level': score_to_level(hrv_score),
            'score': hrv_score,
            'label': '过劳/慢性压力',
        }
    else:
        risks['chronicStress'] = {'level': 'low', 'score': 0, 'label': '过劳/慢性压力'}

    # 4. Metabolic Risk
    # Based on: body fat %, weight trend, exercise frequency, step count
    met_score = 0
    if body_fat:
        latest_bf = body_fat[-1]['value']
        if latest_bf > 25: met_score += 40
        elif latest_bf > 20: met_score += 20
        elif latest_bf > 15: met_score += 5

    step_vals = list(steps_daily.values()) if isinstance(steps_daily, dict) else [s['value'] for s in steps_daily]
    if step_vals:
        avg_steps = sum(step_vals) / len(step_vals)
        if avg_steps < 4000: met_score += 30
        elif avg_steps < 6000: met_score += 20
        elif avg_steps < 8000: met_score += 10

    # Weight trend (last 6 months)
    if len(body_mass) >= 2:
        recent_weight = body_mass[-1]['value']
        older_weights = [b['value'] for b in body_mass[:-1]]
        avg_older = sum(older_weights) / len(older_weights)
        if recent_weight > avg_older + 3: met_score += 15   # gaining
        elif recent_weight > avg_older + 1: met_score += 5

    # Exercise frequency
    if workouts:
        days_span = max(1, (datetime.strptime(workouts[-1].get('date', '2026-01-01'), '%Y-%m-%d') -
                            datetime.strptime(workouts[0].get('date', '2020-01-01'), '%Y-%m-%d')).days)
        weekly_freq = len(workouts) / (days_span / 7)
        if weekly_freq < 1: met_score += 15
        elif weekly_freq < 2: met_score += 5

    met_score = min(100, met_score)
    risks['metabolicRisk'] = {
        'level': score_to_level(met_score),
        'score': met_score,
        'label': '代谢综合征前兆',
    }

    # 5. Cardiovascular Event Risk
    # Based on: RHR anomaly frequency, SpO2 drops, HRV stability
    cv_score = 0
    rhr_values = [r['value'] for r in rhr_list]
    if rhr_values:
        rhr_mean = sum(rhr_values) / len(rhr_values)
        rhr_std = (sum((v - rhr_mean) ** 2 for v in rhr_values) / len(rhr_values)) ** 0.5
        anomaly_count = sum(1 for v in rhr_values if v > rhr_mean + 2 * rhr_std)
        anomaly_pct = anomaly_count / len(rhr_values) * 100
        if anomaly_pct > 5: cv_score += 20
        elif anomaly_pct > 2: cv_score += 10

    if spo2_records:
        spo2_vals = [r['value'] for r in spo2_records]
        below90 = sum(1 for v in spo2_vals if v < 90) / len(spo2_vals) * 100
        if below90 > 2: cv_score += 25
        elif below90 > 0.5: cv_score += 10

    # Low resting HR is protective
    if rhr_values:
        rhr_mean = sum(rhr_values) / len(rhr_values)
        if rhr_mean < 55: cv_score = max(0, cv_score - 10)  # athletic heart is protective
        elif rhr_mean > 75: cv_score += 20

    cv_score = min(100, max(0, cv_score))
    risks['cardiovascularEvent'] = {
        'level': score_to_level(cv_score),
        'score': cv_score,
        'label': '心血管急性事件',
    }

    # 6. Sleep Apnea Risk
    # Based on: breathing disturbance index, SpO2 night drops
    apnea_score = 0
    if sleep_breathing:
        avg_bd = sum(b['value'] for b in sleep_breathing) / len(sleep_breathing)
        high_bd_pct = sum(1 for b in sleep_breathing if b['value'] >= 5) / len(sleep_breathing) * 100
        if avg_bd > 5: apnea_score += 50
        elif avg_bd > 3: apnea_score += 30
        elif avg_bd > 1.5: apnea_score += 15
        apnea_score += min(30, int(high_bd_pct * 3))

    if spo2_records:
        night_spo2 = [r['value'] for r in spo2_records if r['hour'] >= 22 or r['hour'] <= 6]
        if night_spo2:
            night_below95 = sum(1 for v in night_spo2 if v < 95) / len(night_spo2) * 100
            if night_below95 > 10: apnea_score += 20
            elif night_below95 > 5: apnea_score += 10

    apnea_score = min(100, apnea_score)
    risks['sleepApnea'] = {
        'level': score_to_level(apnea_score),
        'score': apnea_score,
        'label': '睡眠呼吸障碍',
    }

    return risks


def compute_goals(rhr_stats, hrv_stats, steps_stats, body_mass, nightly_list, workouts, all_beds):
    """Compute personalized goal targets based on current data."""
    goals = {}

    # Bedtime goal: move 1h earlier in 2 weeks, 2h in 4 weeks
    if all_beds:
        current_bed = (round(sum(all_beds[-30:]) / len(all_beds[-30:]), 1)
                       if len(all_beds) >= 30
                       else round(sum(all_beds) / len(all_beds), 1))
        goals['bedtime'] = {
            'current': current_bed,
            'target2w': round(max(22, current_bed - 1), 1),
            'target4w': round(max(22, current_bed - 2), 1),
            'unit': 'h', 'label': '入睡时间',
        }

    # HRV goal: +5ms in 2w, +10ms in 4w
    if hrv_stats.get('mean'):
        goals['hrv'] = {
            'current': hrv_stats['mean'],
            'target2w': round(hrv_stats['mean'] + 5, 1),
            'target4w': round(hrv_stats['mean'] + 10, 1),
            'unit': 'ms', 'label': 'HRV SDNN',
        }

    # RHR goal: maintain or lower
    if rhr_stats.get('latest'):
        goals['rhr'] = {
            'current': rhr_stats['latest'],
            'target2w': min(rhr_stats['latest'], 55),
            'target4w': min(rhr_stats['latest'], 55),
            'unit': 'bpm', 'label': '静息心率',
        }

    # Steps goal: increase toward 8000
    step_vals = [s['value'] for s in steps_stats] if isinstance(steps_stats, list) else []
    current_steps = (round(sum(step_vals[-30:]) / len(step_vals[-30:]))
                     if len(step_vals) >= 30
                     else (steps_stats.get('mean', 5000) if isinstance(steps_stats, dict) else 5000))
    goals['steps'] = {
        'current': current_steps,
        'target2w': min(max(current_steps + 1000, 7000), 10000),
        'target4w': min(max(current_steps + 2000, 8000), 12000),
        'unit': '步', 'label': '日均步数',
    }

    # Exercise frequency
    if workouts and len(workouts) >= 2:
        days_span = max(7, (datetime.strptime(workouts[-1].get('date', '2026-01-01'), '%Y-%m-%d') -
                            datetime.strptime(workouts[max(0, len(workouts) - 30)].get('date', '2020-01-01'), '%Y-%m-%d')).days)
        recent_workouts = workouts[-30:]
        current_freq = round(len(recent_workouts) / (days_span / 7), 1)
    else:
        current_freq = 1.0
    goals['exerciseFreq'] = {
        'current': current_freq,
        'target2w': max(current_freq + 1, 3),
        'target4w': max(current_freq + 2, 4),
        'unit': '次/周', 'label': '周运动次数',
    }

    # Weight
    if body_mass:
        goals['weight'] = {
            'current': body_mass[-1]['value'],
            'target2w': body_mass[-1]['value'],
            'target4w': round(max(body_mass[-1]['value'] - 1, 70), 1),
            'unit': 'kg', 'label': '体重',
        }

    return goals


def main(export_dir):
    xml_path = os.path.join(export_dir, 'export.xml')
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'data')
    os.makedirs(out_dir, exist_ok=True)

    print(f"Parsing {xml_path} ...")

    # Collectors
    rhr_daily = {}
    hrv_records = []
    vo2max_records = []
    walking_hr_records = []
    sleep_records = []
    steps_daily = defaultdict(float)
    active_energy_daily = defaultdict(float)
    exercise_time_daily = defaultdict(float)
    body_mass = []
    body_fat = []
    spo2_records = []
    resp_records = []
    sleep_breathing = []
    sleep_temp = []
    workouts = []
    activity_summaries = []
    user_info = {}
    hr_by_hour = defaultdict(list)

    record_count = 0

    for event, elem in ET.iterparse(xml_path, events=('end',)):
        if elem.tag == 'Me':
            user_info = {
                'dob': elem.get('HKCharacteristicTypeIdentifierDateOfBirth', ''),
                'sex': elem.get('HKCharacteristicTypeIdentifierBiologicalSex', ''),
            }

        elif elem.tag == 'Record':
            rtype = elem.get('type', '')
            val_str = elem.get('value', '')
            start = elem.get('startDate', '')
            dt = parse_date(start)
            if dt is None:
                elem.clear()
                continue

            date_str = dt.strftime('%Y-%m-%d')
            hour = dt.hour

            if rtype == 'HKQuantityTypeIdentifierRestingHeartRate':
                try:
                    v = float(val_str)
                    rhr_daily[date_str] = v
                except: pass

            elif rtype == 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN':
                try:
                    v = float(val_str)
                    hrv_records.append({'date': date_str, 'hour': hour, 'value': v})
                except: pass

            elif rtype == 'HKQuantityTypeIdentifierVO2Max':
                try:
                    v = float(val_str)
                    vo2max_records.append({'date': date_str, 'value': v})
                except: pass

            elif rtype == 'HKQuantityTypeIdentifierWalkingHeartRateAverage':
                try:
                    v = float(val_str)
                    walking_hr_records.append({'date': date_str, 'value': v})
                except: pass

            elif rtype == 'HKCategoryTypeIdentifierSleepAnalysis':
                source = elem.get('sourceName', '')
                if 'Watch' in source or 'Apple' in source:
                    end = elem.get('endDate', '')
                    end_dt = parse_date(end)
                    if end_dt:
                        dur_hrs = (end_dt - dt).total_seconds() / 3600
                        sleep_records.append({
                            'start': start[:19],
                            'end': end[:19],
                            'value': val_str,
                            'duration_hrs': dur_hrs,
                            'end_date': end_dt.strftime('%Y-%m-%d'),
                            'start_hour': hour,
                        })

            elif rtype == 'HKQuantityTypeIdentifierStepCount':
                try:
                    steps_daily[date_str] += float(val_str)
                except: pass

            elif rtype == 'HKQuantityTypeIdentifierActiveEnergyBurned':
                try:
                    active_energy_daily[date_str] += float(val_str)
                except: pass

            elif rtype == 'HKQuantityTypeIdentifierAppleExerciseTime':
                try:
                    exercise_time_daily[date_str] += float(val_str)
                except: pass

            elif rtype == 'HKQuantityTypeIdentifierBodyMass':
                try:
                    body_mass.append({'date': date_str, 'value': float(val_str)})
                except: pass

            elif rtype == 'HKQuantityTypeIdentifierBodyFatPercentage':
                try:
                    body_fat.append({'date': date_str, 'value': round(float(val_str) * 100, 1)})
                except: pass

            elif rtype == 'HKQuantityTypeIdentifierOxygenSaturation':
                try:
                    v = float(val_str) * 100
                    spo2_records.append({'date': date_str, 'hour': hour, 'value': v})
                except: pass

            elif rtype == 'HKQuantityTypeIdentifierHeartRate':
                try:
                    hr_by_hour[hour].append(float(val_str))
                except: pass

            elif rtype == 'HKQuantityTypeIdentifierRespiratoryRate':
                try:
                    resp_records.append({'date': date_str, 'hour': hour, 'value': float(val_str)})
                except: pass

            elif rtype == 'HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances':
                try:
                    sleep_breathing.append({'date': date_str, 'value': float(val_str)})
                except: pass

            elif rtype == 'HKQuantityTypeIdentifierAppleSleepingWristTemperature':
                try:
                    sleep_temp.append({'date': date_str, 'value': float(val_str)})
                except: pass

            record_count += 1
            if record_count % 1000000 == 0:
                print(f"  Processed {record_count // 1000000}M records...")
            elem.clear()

        elif elem.tag == 'Workout':
            wo = {
                'type': elem.get('workoutActivityType', '').replace('HKWorkoutActivityType', ''),
                'startDate': elem.get('startDate', '')[:19],
                'endDate': elem.get('endDate', '')[:19],
                'duration': 0,
                'distance': 0,
                'calories': 0,
                'avgHR': 0,
                'maxHR': 0,
                'minHR': 0,
                'swimDistance': 0,
                'strokeCount': 0,
            }
            try:
                wo['duration'] = round(float(elem.get('duration', 0)))
            except: pass
            try:
                wo['calories'] = round(float(elem.get('totalEnergyBurned', 0)))
            except: pass

            for stat in elem.findall('WorkoutStatistics'):
                st = stat.get('type', '')
                if 'HeartRate' in st and 'Recovery' not in st and 'Variability' not in st and 'Walking' not in st:
                    try: wo['avgHR'] = round(float(stat.get('average', 0)))
                    except: pass
                    try: wo['maxHR'] = round(float(stat.get('maximum', 0)))
                    except: pass
                    try: wo['minHR'] = round(float(stat.get('minimum', 0)))
                    except: pass
                elif 'ActiveEnergyBurned' in st:
                    try: wo['calories'] = round(float(stat.get('sum', 0)))
                    except: pass
                elif 'DistanceSwimming' in st:
                    try: wo['swimDistance'] = round(float(stat.get('sum', 0)))
                    except: pass
                elif 'SwimmingStrokeCount' in st:
                    try: wo['strokeCount'] = round(float(stat.get('sum', 0)))
                    except: pass
                elif 'Distance' in st and 'Swimming' not in st:
                    try: wo['distance'] = round(float(stat.get('sum', 0)))
                    except: pass

            dt = parse_date(wo['startDate'])
            if dt:
                wo['date'] = dt.strftime('%Y-%m-%d')
                wo['hour'] = dt.hour
                workouts.append(wo)
            elem.clear()

        elif elem.tag == 'ActivitySummary':
            try:
                activity_summaries.append({
                    'date': elem.get('dateComponents', ''),
                    'activeEnergy': round(float(elem.get('activeEnergyBurned', 0))),
                    'exerciseTime': round(float(elem.get('appleExerciseTime', 0))),
                    'standHours': round(float(elem.get('appleStandHours', 0))),
                })
            except: pass
            elem.clear()

    print(f"  Total records: {record_count}")

    # ================================================================
    # BUILD CARDIOVASCULAR JSON
    # ================================================================
    print("Building cardiovascular.json ...")

    # RHR
    rhr_list = sorted([{'date': d, 'value': v} for d, v in rhr_daily.items()], key=lambda x: x['date'])
    rhr_values = [r['value'] for r in rhr_list]
    rhr_stats = {
        'mean': round(sum(rhr_values) / len(rhr_values), 1) if rhr_values else 0,
        'min': min(rhr_values) if rhr_values else 0,
        'max': max(rhr_values) if rhr_values else 0,
        'latest': rhr_list[-1]['value'] if rhr_list else 0,
        'latestDate': rhr_list[-1]['date'] if rhr_list else '',
    }

    # RHR monthly
    rhr_monthly = defaultdict(list)
    for r in rhr_list:
        m = r['date'][:7]
        rhr_monthly[m].append(r['value'])
    rhr_monthly_list = sorted([{
        'month': m,
        'mean': round(sum(vs)/len(vs), 1),
        'min': min(vs),
        'max': max(vs),
    } for m, vs in rhr_monthly.items()], key=lambda x: x['month'])

    # HRV
    hrv_daily_map = defaultdict(list)
    hrv_night_map = defaultdict(list)
    hrv_day_map = defaultdict(list)
    for r in hrv_records:
        hrv_daily_map[r['date']].append(r['value'])
        if r['hour'] >= 22 or r['hour'] <= 6:
            hrv_night_map[r['date']].append(r['value'])
        else:
            hrv_day_map[r['date']].append(r['value'])

    hrv_daily_list = sorted([{
        'date': d,
        'value': round(sum(vs)/len(vs), 1),
    } for d, vs in hrv_daily_map.items()], key=lambda x: x['date'])

    all_hrv = [r['value'] for r in hrv_records]
    night_hrv = [r['value'] for r in hrv_records if r['hour'] >= 22 or r['hour'] <= 6]
    day_hrv = [r['value'] for r in hrv_records if 6 < r['hour'] < 22]
    hrv_stats = {
        'mean': round(sum(all_hrv)/len(all_hrv), 1) if all_hrv else 0,
        'nightMean': round(sum(night_hrv)/len(night_hrv), 1) if night_hrv else 0,
        'dayMean': round(sum(day_hrv)/len(day_hrv), 1) if day_hrv else 0,
        'latest': hrv_daily_list[-1]['value'] if hrv_daily_list else 0,
        'latestDate': hrv_daily_list[-1]['date'] if hrv_daily_list else '',
    }

    # HRV monthly
    hrv_monthly = defaultdict(list)
    for r in hrv_records:
        m = r['date'][:7]
        hrv_monthly[m].append(r['value'])
    hrv_monthly_list = sorted([{
        'month': m,
        'mean': round(sum(vs)/len(vs), 1),
    } for m, vs in hrv_monthly.items()], key=lambda x: x['month'])

    # VO2Max
    vo2_list = sorted(vo2max_records, key=lambda x: x['date'])
    for v in vo2_list:
        v['value'] = round(v['value'], 1)
    vo2_stats = {
        'latest': vo2_list[-1]['value'] if vo2_list else 0,
        'latestDate': vo2_list[-1]['date'] if vo2_list else '',
        'peak': max(v['value'] for v in vo2_list) if vo2_list else 0,
        'mean': round(sum(v['value'] for v in vo2_list)/len(vo2_list), 1) if vo2_list else 0,
    }

    # Walking HR monthly
    whr_monthly = defaultdict(list)
    for r in walking_hr_records:
        m = r['date'][:7]
        whr_monthly[m].append(r['value'])
    whr_monthly_list = sorted([{
        'month': m,
        'mean': round(sum(vs)/len(vs), 1),
    } for m, vs in whr_monthly.items()], key=lambda x: x['month'])

    # Heart rate by hour
    hr_hourly = []
    for h in range(24):
        vals = hr_by_hour.get(h, [])
        if vals:
            hr_hourly.append({
                'hour': h,
                'mean': round(sum(vals)/len(vals)),
                'median': round(sorted(vals)[len(vals)//2]),
            })

    # SpO2 stats
    spo2_values = [r['value'] for r in spo2_records]
    spo2_stats = {
        'mean': round(sum(spo2_values)/len(spo2_values), 1) if spo2_values else 0,
        'below95pct': round(sum(1 for v in spo2_values if v < 95) / len(spo2_values) * 100, 1) if spo2_values else 0,
    }

    # SpO2 hourly profile
    spo2_by_hour = defaultdict(list)
    for r in spo2_records:
        spo2_by_hour[r['hour']].append(r['value'])
    spo2_hourly = sorted([{
        'hour': h,
        'mean': round(sum(vs)/len(vs), 1),
        'min': round(min(vs), 1),
    } for h, vs in spo2_by_hour.items()], key=lambda x: x['hour'])

    # Respiratory monthly
    resp_monthly = defaultdict(list)
    for r in resp_records:
        m = r['date'][:7]
        resp_monthly[m].append(r['value'])
    resp_monthly_list = sorted([{
        'month': m,
        'mean': round(sum(vs)/len(vs), 1),
    } for m, vs in resp_monthly.items()], key=lambda x: x['month'])

    # Respiratory nightly average
    night_resp = [r['value'] for r in resp_records if r['hour'] >= 22 or r['hour'] <= 6]
    resp_stats = {
        'mean': round(sum(r['value'] for r in resp_records) / len(resp_records), 1) if resp_records else 0,
        'nightMean': round(sum(night_resp)/len(night_resp), 1) if night_resp else 0,
    }

    cardio = {
        'rhr': {'daily': rhr_list, 'monthly': rhr_monthly_list, 'stats': rhr_stats},
        'hrv': {'daily': hrv_daily_list, 'monthly': hrv_monthly_list, 'stats': hrv_stats},
        'vo2max': {'records': vo2_list, 'stats': vo2_stats},
        'walkingHR': {'monthly': whr_monthly_list},
        'hrHourly': hr_hourly,
        'spo2': {'stats': spo2_stats, 'hourly': spo2_hourly},
        'respiratory': {'monthly': resp_monthly_list, 'stats': resp_stats},
    }

    with open(os.path.join(out_dir, 'cardiovascular.json'), 'w') as f:
        json.dump(cardio, f)
    print("  cardiovascular.json done")

    # ================================================================
    # BUILD SLEEP JSON
    # ================================================================
    print("Building sleep.json ...")

    asleep_types = [
        'HKCategoryValueSleepAnalysisAsleepCore',
        'HKCategoryValueSleepAnalysisAsleepDeep',
        'HKCategoryValueSleepAnalysisAsleepREM',
        'HKCategoryValueSleepAnalysisAsleepUnspecified',
    ]

    # Group by night (using end_date)
    nightly = defaultdict(lambda: {'core': 0, 'deep': 0, 'rem': 0, 'total': 0, 'bedtime': None, 'wakeTime': None})
    for r in sleep_records:
        if r['value'] not in asleep_types:
            continue
        night = r['end_date']
        dur = r['duration_hrs']
        if dur <= 0 or dur > 12:
            continue
        nightly[night]['total'] += dur
        if 'Core' in r['value']:
            nightly[night]['core'] += dur
        elif 'Deep' in r['value']:
            nightly[night]['deep'] += dur
        elif 'REM' in r['value']:
            nightly[night]['rem'] += dur

        # Track bedtime (earliest start after 20:00) and wake time (latest end)
        start_dt = parse_date(r['start'])
        end_dt = parse_date(r['end'])
        if start_dt:
            bt_hour = start_dt.hour + start_dt.minute / 60
            # Skip records starting between 12:00-20:00 (likely naps)
            if bt_hour < 12:
                bt_hour += 24  # e.g., 3am → 27
            if bt_hour >= 20:  # only count sleep starting after 8pm
                if nightly[night]['bedtime'] is None or bt_hour < nightly[night]['bedtime']:
                    nightly[night]['bedtime'] = bt_hour
        if end_dt:
            wt_hour = end_dt.hour + end_dt.minute / 60
            if nightly[night]['wakeTime'] is None or wt_hour > nightly[night]['wakeTime']:
                nightly[night]['wakeTime'] = wt_hour

    # Filter valid nights
    nightly_list = []
    for date, data in sorted(nightly.items()):
        if 2 < data['total'] < 16:
            nightly_list.append({
                'date': date,
                'total': round(data['total'], 2),
                'core': round(data['core'], 2),
                'deep': round(data['deep'], 2),
                'rem': round(data['rem'], 2),
                'bedtime': round(data['bedtime'], 2) if data['bedtime'] else None,
                'wakeTime': round(data['wakeTime'], 2) if data['wakeTime'] else None,
            })

    # Sleep monthly
    sleep_monthly = defaultdict(list)
    for n in nightly_list:
        m = n['date'][:7]
        sleep_monthly[m].append(n)

    sleep_monthly_list = []
    for m, nights in sorted(sleep_monthly.items()):
        totals = [n['total'] for n in nights]
        deeps = [n['deep'] for n in nights if n['deep'] > 0]
        rems = [n['rem'] for n in nights if n['rem'] > 0]
        beds = [n['bedtime'] for n in nights if n['bedtime']]
        sleep_monthly_list.append({
            'month': m,
            'avgTotal': round(sum(totals)/len(totals), 2),
            'avgDeep': round(sum(deeps)/len(deeps), 2) if deeps else 0,
            'avgREM': round(sum(rems)/len(rems), 2) if rems else 0,
            'avgBedtime': round(sum(beds)/len(beds), 2) if beds else 0,
            'count': len(nights),
        })

    # Bedtime heatmap: [dayOfWeek][hourBucket] → count
    bedtime_heatmap = []
    for n in nightly_list:
        if n['bedtime'] is None:
            continue
        dt = datetime.strptime(n['date'], '%Y-%m-%d')
        dow = dt.weekday()
        hour_bucket = int(n['bedtime']) % 24
        bedtime_heatmap.append({'dow': dow, 'hour': hour_bucket, 'date': n['date']})

    # Aggregate heatmap
    heatmap_counts = defaultdict(int)
    for h in bedtime_heatmap:
        heatmap_counts[(h['dow'], h['hour'])] += 1
    heatmap_data = [{'dow': k[0], 'hour': k[1], 'count': v} for k, v in heatmap_counts.items()]

    # Sleep stats
    all_totals = [n['total'] for n in nightly_list]
    all_deeps = [n['deep'] for n in nightly_list if n['deep'] > 0]
    all_rems = [n['rem'] for n in nightly_list if n['rem'] > 0]
    all_beds = [n['bedtime'] for n in nightly_list if n['bedtime']]

    sleep_stats = {
        'avgTotal': round(sum(all_totals)/len(all_totals), 2) if all_totals else 0,
        'avgDeep': round(sum(all_deeps)/len(all_deeps), 2) if all_deeps else 0,
        'avgREM': round(sum(all_rems)/len(all_rems), 2) if all_rems else 0,
        'avgBedtime': round(sum(all_beds)/len(all_beds), 2) if all_beds else 0,
        'below6hPct': round(sum(1 for t in all_totals if t < 6)/len(all_totals)*100, 1) if all_totals else 0,
        'below7hPct': round(sum(1 for t in all_totals if t < 7)/len(all_totals)*100, 1) if all_totals else 0,
        'above8hPct': round(sum(1 for t in all_totals if t >= 8)/len(all_totals)*100, 1) if all_totals else 0,
        'totalNights': len(nightly_list),
        'deepPct': round(sum(all_deeps)/len(all_deeps) / (sum(all_totals)/len(all_totals)) * 100, 1) if all_deeps and all_totals else 0,
        'remPct': round(sum(all_rems)/len(all_rems) / (sum(all_totals)/len(all_totals)) * 100, 1) if all_rems and all_totals else 0,
    }

    # Breathing disturbances and wrist temperature
    sleep_breathing_sorted = sorted(sleep_breathing, key=lambda x: x['date'])
    sleep_temp_sorted = sorted(sleep_temp, key=lambda x: x['date'])

    sleep_data = {
        'nightly': nightly_list,
        'monthly': sleep_monthly_list,
        'heatmap': heatmap_data,
        'stats': sleep_stats,
        'breathingDisturbances': sleep_breathing_sorted,
        'wristTemperature': sleep_temp_sorted,
    }

    with open(os.path.join(out_dir, 'sleep.json'), 'w') as f:
        json.dump(sleep_data, f)
    print("  sleep.json done")

    # ================================================================
    # BUILD ACTIVITY JSON
    # ================================================================
    print("Building activity.json ...")

    # Daily steps
    steps_list = sorted([{'date': d, 'value': round(v)} for d, v in steps_daily.items() if v > 100], key=lambda x: x['date'])

    # Daily active energy
    energy_list = sorted([{'date': d, 'value': round(v)} for d, v in active_energy_daily.items() if v > 50], key=lambda x: x['date'])

    # Steps monthly
    steps_monthly = defaultdict(list)
    for s in steps_list:
        m = s['date'][:7]
        steps_monthly[m].append(s['value'])
    steps_monthly_list = sorted([{
        'month': m,
        'mean': round(sum(vs)/len(vs)),
        'median': round(sorted(vs)[len(vs)//2]),
    } for m, vs in steps_monthly.items()], key=lambda x: x['month'])

    # Steps stats
    step_values = [s['value'] for s in steps_list]
    steps_stats = {
        'mean': round(sum(step_values)/len(step_values)) if step_values else 0,
        'median': round(sorted(step_values)[len(step_values)//2]) if step_values else 0,
        'below5000pct': round(sum(1 for v in step_values if v < 5000)/len(step_values)*100, 1) if step_values else 0,
        'above10000pct': round(sum(1 for v in step_values if v >= 10000)/len(step_values)*100, 1) if step_values else 0,
    }

    # Workouts - already collected
    workouts_sorted = sorted(workouts, key=lambda x: x.get('date', ''))

    # Workout monthly frequency
    wo_monthly = defaultdict(int)
    for w in workouts_sorted:
        m = w.get('date', '')[:7]
        if m:
            wo_monthly[m] += 1
    wo_monthly_list = sorted([{'month': m, 'count': c} for m, c in wo_monthly.items()], key=lambda x: x['month'])

    # Swimming specific
    swim_workouts = [w for w in workouts_sorted if w['type'] == 'Swimming']

    # Activity summaries
    act_list = sorted(activity_summaries, key=lambda x: x['date'])

    # Body composition
    body_mass_sorted = sorted(body_mass, key=lambda x: x['date'])
    body_fat_sorted = sorted(body_fat, key=lambda x: x['date'])

    # Exercise time daily
    exercise_list = sorted([{'date': d, 'value': round(v)} for d, v in exercise_time_daily.items() if v > 0], key=lambda x: x['date'])

    activity_data = {
        'steps': {'daily': steps_list, 'monthly': steps_monthly_list, 'stats': steps_stats},
        'energy': {'daily': energy_list},
        'workouts': workouts_sorted,
        'swimWorkouts': swim_workouts,
        'workoutMonthly': wo_monthly_list,
        'activitySummary': act_list,
        'bodyMass': body_mass_sorted,
        'bodyFat': body_fat_sorted,
        'exerciseTime': {'daily': exercise_list},
    }

    with open(os.path.join(out_dir, 'activity.json'), 'w') as f:
        json.dump(activity_data, f)
    print("  activity.json done")

    # ================================================================
    # BUILD OVERVIEW JSON
    # ================================================================
    print("Building overview.json ...")

    # Determine age
    dob = user_info.get('dob', '1990-01-01')
    try:
        dob_dt = datetime.strptime(dob, '%Y-%m-%d')
        age = (datetime.now() - dob_dt).days // 365
    except:
        age = 28

    # Anomaly detection
    anomalies = []
    rhr_mean = sum(rhr_values) / len(rhr_values) if rhr_values else 54
    rhr_std = (sum((v - rhr_mean)**2 for v in rhr_values) / len(rhr_values))**0.5 if rhr_values else 4
    for r in rhr_list:
        if r['value'] > rhr_mean + 2 * rhr_std:
            anomalies.append({'date': r['date'], 'type': 'rhr_high', 'value': r['value'], 'label': f"RHR {r['value']:.0f} bpm"})

    # HRV anomalies
    if hrv_daily_list:
        hrv_vals = [r['value'] for r in hrv_daily_list]
        hrv_m = sum(hrv_vals) / len(hrv_vals)
        hrv_s = (sum((v - hrv_m) ** 2 for v in hrv_vals) / len(hrv_vals)) ** 0.5
        for r in hrv_daily_list:
            if r['value'] < hrv_m - 2 * hrv_s:
                anomalies.append({'date': r['date'], 'type': 'hrv_low', 'value': r['value'], 'label': f"HRV {r['value']:.0f} ms"})

    # Sleep anomalies
    for n in nightly_list:
        if n['total'] < 4:
            anomalies.append({'date': n['date'], 'type': 'sleep_short', 'value': n['total'], 'label': f"Sleep {n['total']:.1f}h"})
        if n.get('bedtime') and n['bedtime'] > 28:
            anomalies.append({'date': n['date'], 'type': 'bedtime_late', 'value': n['bedtime'], 'label': "Bed after 4AM"})

    # Step anomalies
    if step_values:
        step_mean = sum(step_values) / len(step_values)
        if step_mean > 6000:
            for s in steps_list:
                if s['value'] < 2000:
                    anomalies.append({'date': s['date'], 'type': 'steps_low', 'value': s['value'], 'label': f"Steps {s['value']}"})

    # SpO2 anomalies
    for r in spo2_records:
        if r['value'] < 92:
            anomalies.append({'date': r['date'], 'type': 'spo2_low', 'value': round(r['value'], 1), 'label': f"SpO2 {r['value']:.0f}%"})

    overview = {
        'user': {
            'dob': dob,
            'age': age,
            'sex': 'male' if 'Male' in user_info.get('sex', '') else 'female',
            'currentWeight': body_mass_sorted[-1]['value'] if body_mass_sorted else 0,
            'currentBodyFat': body_fat_sorted[-1]['value'] if body_fat_sorted else 0,
            'latestWeightDate': body_mass_sorted[-1]['date'] if body_mass_sorted else '',
        },
        'risks': compute_risks(
            rhr_list=rhr_list,
            hrv_records=hrv_records,
            vo2_list=vo2_list,
            nightly_list=nightly_list,
            steps_daily=steps_daily,
            body_mass=body_mass_sorted,
            body_fat=body_fat_sorted,
            spo2_records=spo2_records,
            sleep_breathing=sleep_breathing,
            workouts=workouts_sorted,
            exercise_time_daily=exercise_time_daily,
            all_beds=all_beds,
            age=age,
        ),
        'goals': compute_goals(
            rhr_stats=rhr_stats,
            hrv_stats=hrv_stats,
            steps_stats=steps_list,
            body_mass=body_mass_sorted,
            nightly_list=nightly_list,
            workouts=workouts_sorted,
            all_beds=all_beds,
        ),
        'anomalies': anomalies,
        'dataRange': {
            'start': rhr_list[0]['date'] if rhr_list else '',
            'end': rhr_list[-1]['date'] if rhr_list else '',
        },
    }

    with open(os.path.join(out_dir, 'overview.json'), 'w') as f:
        json.dump(overview, f)
    print("  overview.json done")

    print("\nAll data files generated successfully!")
    print(f"Output: {out_dir}/")
    print("\nNew fields summary:")
    print(f"  respiratory: {len(resp_monthly_list)} months")
    print(f"  spo2 hourly: {len(spo2_hourly)} hours")
    print(f"  breathing disturbances: {len(sleep_breathing_sorted)} records")
    print(f"  wrist temperature: {len(sleep_temp_sorted)} records")
    print(f"  exercise time: {len(exercise_list)} days")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 process_data.py /path/to/apple_health_export")
        sys.exit(1)
    main(sys.argv[1])
