"""Unit tests for core scoring functions in process_data.py."""

import sys
import os
import unittest

# Add parent directory to path so we can import process_data
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import process_data as pd


class TestScoreToLevel(unittest.TestCase):
    def test_high(self):
        self.assertEqual(pd.score_to_level(85), 'high')
        self.assertEqual(pd.score_to_level(70), 'high')

    def test_medium_high(self):
        self.assertEqual(pd.score_to_level(65), 'medium-high')
        self.assertEqual(pd.score_to_level(55), 'medium-high')

    def test_medium(self):
        self.assertEqual(pd.score_to_level(45), 'medium')
        self.assertEqual(pd.score_to_level(40), 'medium')

    def test_low_medium(self):
        self.assertEqual(pd.score_to_level(30), 'low-medium')
        self.assertEqual(pd.score_to_level(25), 'low-medium')

    def test_low(self):
        self.assertEqual(pd.score_to_level(20), 'low')
        self.assertEqual(pd.score_to_level(0), 'low')


class TestParseDate(unittest.TestCase):
    def test_valid(self):
        dt = pd.parse_date('2026-04-11 08:30:00 +0800')
        self.assertIsNotNone(dt)
        self.assertEqual(dt.year, 2026)
        self.assertEqual(dt.month, 4)
        self.assertEqual(dt.day, 11)

    def test_empty(self):
        self.assertIsNone(pd.parse_date(''))
        self.assertIsNone(pd.parse_date(None))

    def test_invalid(self):
        self.assertIsNone(pd.parse_date('not-a-date'))


class TestComputeHealthScore(unittest.TestCase):
    """Test the daily health score computation."""

    def _make_data(self, days=30):
        """Create synthetic health data for testing."""
        from datetime import datetime, timedelta
        base = datetime(2026, 3, 1)
        dates = [(base + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(days)]

        rhr_daily = [{'date': d, 'value': 55 + (i % 5)} for i, d in enumerate(dates)]
        hrv_daily_map = {d: [45 + (i % 10)] for i, d in enumerate(dates)}
        nightly = [{'date': d, 'total': 7.0 + (i % 3) * 0.5, 'deep': 1.2, 'rem': 1.5, 'bedtime': 24.5} for i, d in enumerate(dates)]
        steps_daily = {d: 7000 + i * 100 for i, d in enumerate(dates)}
        workouts = [{'date': dates[i], 'type': 'Swimming', 'duration': 45} for i in range(0, days, 3)]
        body_mass = [{'date': dates[0], 'value': 75}]

        return rhr_daily, hrv_daily_map, nightly, steps_daily, workouts, body_mass

    def test_returns_valid_structure(self):
        rhr, hrv, nightly, steps, workouts, body = self._make_data()
        result = pd.compute_health_score(rhr, hrv, nightly, steps, workouts, body, age=28)
        self.assertIn('daily', result)
        self.assertIn('latest', result)
        self.assertIn('mean', result)
        self.assertIn('trend', result)
        self.assertIn('breakdown', result)

    def test_score_in_range(self):
        rhr, hrv, nightly, steps, workouts, body = self._make_data()
        result = pd.compute_health_score(rhr, hrv, nightly, steps, workouts, body, age=28)
        self.assertGreaterEqual(result['latest'], 0)
        self.assertLessEqual(result['latest'], 100)
        self.assertGreaterEqual(result['mean'], 0)
        self.assertLessEqual(result['mean'], 100)

    def test_trend_values(self):
        rhr, hrv, nightly, steps, workouts, body = self._make_data(days=60)
        result = pd.compute_health_score(rhr, hrv, nightly, steps, workouts, body, age=28)
        self.assertIn(result['trend'], ['improving', 'declining', 'stable'])

    def test_empty_data(self):
        result = pd.compute_health_score([], {}, [], {}, [], [], age=28)
        self.assertEqual(result['daily'], [])
        self.assertEqual(result['latest'], 0)


class TestComputeRisks(unittest.TestCase):
    """Test the 8-dimension risk computation."""

    def test_empty_data(self):
        risks = pd.compute_risks(
            rhr_list=[], hrv_records=[], vo2_list=[], nightly_list=[],
            steps_daily={}, body_mass=[], body_fat=[], spo2_records=[],
            sleep_breathing=[], workouts=[], exercise_time_daily={},
            all_beds=[], age=28,
        )
        self.assertIn('circadianRhythm', risks)
        self.assertIn('cardioFitness', risks)
        self.assertIn('chronicStress', risks)
        self.assertIn('metabolicRisk', risks)
        self.assertIn('cardiovascularEvent', risks)
        self.assertIn('sleepApnea', risks)

    def test_scores_in_range(self):
        rhr = [{'date': '2026-01-01', 'value': 55}] * 30
        hrv = [{'date': '2026-01-01', 'hour': 2, 'value': 50}] * 30
        vo2 = [{'date': '2026-01-01', 'value': 45}]
        nightly = [{'date': '2026-01-01', 'total': 7, 'deep': 1.2, 'bedtime': 24.5}] * 30
        beds = [24.5] * 30

        risks = pd.compute_risks(
            rhr_list=rhr, hrv_records=hrv, vo2_list=vo2, nightly_list=nightly,
            steps_daily={'2026-01-01': 8000}, body_mass=[{'date': '2026-01-01', 'value': 75}],
            body_fat=[], spo2_records=[], sleep_breathing=[], workouts=[],
            exercise_time_daily={}, all_beds=beds, age=28,
        )
        for key, val in risks.items():
            self.assertGreaterEqual(val['score'], 0, f"{key} score < 0")
            self.assertLessEqual(val['score'], 100, f"{key} score > 100")
            self.assertIn(val['level'], ['high', 'medium-high', 'medium', 'low-medium', 'low'])


class TestComputeTrends(unittest.TestCase):
    """Test trend detection."""

    def test_no_data(self):
        result = pd.compute_trends([], {}, [], {})
        self.assertEqual(result, [])

    def test_stable_data(self):
        rhr = [{'date': f'2026-01-{i+1:02d}', 'value': 55} for i in range(60)]
        result = pd.compute_trends(rhr, {}, [], {})
        # Constant data should produce no trends
        self.assertEqual(len(result), 0)

    def test_declining_rhr(self):
        # RHR going up = concerning (lower is better)
        rhr = [{'date': f'2026-01-{i+1:02d}', 'value': 50 + i * 0.5} for i in range(30)]
        result = pd.compute_trends(rhr, {}, [], {})
        rhr_trends = [t for t in result if t['metric'] == 'rhr']
        if rhr_trends:
            self.assertTrue(rhr_trends[0]['concerning'])


class TestComputeBaselines(unittest.TestCase):
    def test_basic(self):
        rhr = [{'date': f'2026-01-{i+1:02d}', 'value': 55 + (i % 3)} for i in range(30)]
        hrv_map = {f'2026-01-{i+1:02d}': [45 + (i % 5)] for i in range(30)}
        nightly = [{'date': f'2026-01-{i+1:02d}', 'total': 7.0 + (i % 2) * 0.5} for i in range(30)]
        steps = {f'2026-01-{i+1:02d}': 7000 + i * 50 for i in range(30)}

        result = pd.compute_baselines(rhr, hrv_map, nightly, steps)
        self.assertIn('rhr', result)
        self.assertIn('hrv', result)
        self.assertIn('sleep', result)
        self.assertIn('steps', result)


class TestConfigLoading(unittest.TestCase):
    def test_config_loaded(self):
        self.assertIsInstance(pd.CONFIG, dict)

    def test_config_has_scoring(self):
        if pd.CONFIG:  # only if config file exists
            self.assertIn('scoring', pd.CONFIG)
            self.assertIn('risk', pd.CONFIG)


if __name__ == '__main__':
    unittest.main()
