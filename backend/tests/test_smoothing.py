import pytest
import sys
import os
import numpy as np
import time

# Add backend directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import smooth_pitch_contour, resample_pitch_contour


class TestSmoothPitchContour:
    """Test suite for pitch contour smoothing functionality"""
    
    def test_short_contour_returns_unchanged(self):
        """Test that contours shorter than kernel_size are returned unchanged"""
        short_contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': 0.1, 'frequency': 442.0},
            {'time': 0.2, 'frequency': 438.0}
        ]
        
        result = smooth_pitch_contour(short_contour, kernel_size=5)
        
        assert result == short_contour
    
    def test_median_filter_removes_outliers(self):
        """Test that median filter removes sudden pitch jumps"""
        contour_with_outliers = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': 0.1, 'frequency': 442.0},
            {'time': 0.2, 'frequency': 1000.0},  # Outlier
            {'time': 0.3, 'frequency': 444.0},
            {'time': 0.4, 'frequency': 446.0},
            {'time': 0.5, 'frequency': 448.0}
        ]
        
        result = smooth_pitch_contour(contour_with_outliers, kernel_size=3)
        
        # The outlier should be replaced with median of neighbors
        # At index 2: neighbors are 442 and 444, median is ~443
        assert result[2]['frequency'] != 1000.0
        assert 440.0 <= result[2]['frequency'] <= 450.0
    
    def test_preserves_smooth_regions(self):
        """Test that smooth regions are preserved"""
        smooth_contour = []
        for i in range(20):
            time = i * 0.1
            # Smooth linear increase in frequency
            frequency = 440.0 + (i * 10.0)
            smooth_contour.append({'time': time, 'frequency': frequency})
        
        result = smooth_pitch_contour(smooth_contour, kernel_size=3)
        
        # Check that the overall trend is preserved
        assert result[0]['frequency'] == 440.0
        assert result[-1]['frequency'] == pytest.approx(630.0, rel=0.1)
    
    def test_maintains_time_values(self):
        """Test that time values are not modified"""
        contour = [
            {'time': 0.5, 'frequency': 440.0},
            {'time': 1.0, 'frequency': 442.0},
            {'time': 1.5, 'frequency': 444.0},
            {'time': 2.0, 'frequency': 446.0},
            {'time': 2.5, 'frequency': 448.0},
            {'time': 3.0, 'frequency': 450.0},
            {'time': 3.5, 'frequency': 452.0}
        ]
        
        result = smooth_pitch_contour(contour, kernel_size=3)
        
        # Check all time values are preserved
        for i, point in enumerate(contour):
            assert result[i]['time'] == point['time']
    
    def test_empty_contour_returns_empty(self):
        """Test that empty contour returns empty list"""
        result = smooth_pitch_contour([], kernel_size=5)
        assert result == []
    
    def test_kernel_size_5_smoothing(self):
        """Test with kernel_size=5"""
        contour = []
        for i in range(10):
            frequency = 440.0 + (i * 10.0) + (np.random.random() * 50 - 25)
            contour.append({'time': i * 0.1, 'frequency': frequency})
        
        result = smooth_pitch_contour(contour, kernel_size=5)
        
        assert len(result) == len(contour)
        assert all('time' in point and 'frequency' in point for point in result)
    
    def test_frequency_type_conversion(self):
        """Test that frequencies are converted to float"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': 0.1, 'frequency': 442.0},
            {'time': 0.2, 'frequency': 444.0},
            {'time': 0.3, 'frequency': 446.0},
            {'time': 0.4, 'frequency': 448.0},
            {'time': 0.5, 'frequency': 450.0},
            {'time': 0.6, 'frequency': 452.0}
        ]
        
        result = smooth_pitch_contour(contour, kernel_size=3)
        
        # Check all frequencies are float type
        for point in result:
            assert isinstance(point['frequency'], (int, float))


class TestResamplePitchContour:
    """Test suite for pitch contour resampling functionality"""
    
    def test_empty_contour_returns_empty(self):
        """Test empty contour returns empty list"""
        result = resample_pitch_contour([])
        assert result == []
    
    def test_short_audio_returns_first_point(self):
        """Test that audio shorter than interval returns first point only"""
        short_contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': 0.1, 'frequency': 442.0},
            {'time': 0.2, 'frequency': 444.0}
        ]
        
        result = resample_pitch_contour(short_contour, interval=0.5)
        
        assert len(result) == 1
        assert result[0]['time'] == 0.0
        assert result[0]['frequency'] == 440.0
    
    def test_correct_number_of_output_points(self):
        """Test correct number of output points (duration / interval)"""
        # Create contour spanning 2.0 seconds with 0.1s intervals
        contour = [{'time': t * 0.1, 'frequency': 440.0 + t * 10} for t in range(21)]
        
        result = resample_pitch_contour(contour, interval=0.5)
        
        # Duration is 2.0s, interval is 0.5s
        # Points at: 0.5, 1.0, 1.5 (3 points) - excludes start and end
        expected_points = 3
        assert len(result) == expected_points
    
    def test_time_values_at_exact_intervals(self):
        """Test time values are at exact intervals"""
        contour = [{'time': t * 0.1, 'frequency': 440.0} for t in range(31)]
        
        result = resample_pitch_contour(contour, interval=0.5)
        
        for point in result:
            # Time should be a multiple of 0.5
            assert point['time'] % 0.5 == pytest.approx(0.0, abs=1e-9)
    
    def test_frequency_values_preserved_from_original(self):
        """Test frequency values are from original data points"""
        # Create contour with known frequencies
        contour = []
        for t in range(10):
            contour.append({'time': t * 0.2, 'frequency': float(400 + t * 20)})
        
        result = resample_pitch_contour(contour, interval=0.5)
        
        # Get all original frequencies
        original_freqs = [p['frequency'] for p in contour]
        
        # Each resampled frequency should be in original
        for point in result:
            assert point['frequency'] in original_freqs
    
    def test_first_point_at_first_interval(self):
        """Test first resampled point is at first interval, not at start"""
        contour = [{'time': 0.0, 'frequency': 440.0}, {'time': 1.0, 'frequency': 442.0}]
        
        result = resample_pitch_contour(contour, interval=0.5)
        
        # First point should be at t=0.5 (first interval), not t=0.0
        assert len(result) >= 1
        assert result[0]['time'] == 0.5
    
    def test_last_point_before_end(self):
        """Test last resampled point is before the end of audio"""
        contour = [{'time': t * 0.1, 'frequency': 440.0} for t in range(31)]
        
        result = resample_pitch_contour(contour, interval=0.5)
        
        end_time = contour[-1]['time']
        for point in result:
            assert point['time'] < end_time
    
    def test_boundary_condition_first_point(self):
        """Test boundary condition when target is very close to first time"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': 1.0, 'frequency': 442.0},
            {'time': 2.0, 'frequency': 444.0},
            {'time': 3.0, 'frequency': 446.0}
        ]
        
        result = resample_pitch_contour(contour, interval=1.0)
        
        # Should have points at 1.0 and 2.0
        assert len(result) == 2
        assert result[0]['time'] == 1.0
        assert result[0]['frequency'] == 442.0  # Closest to t=1.0
        assert result[1]['time'] == 2.0
        assert result[1]['frequency'] == 444.0  # Closest to t=2.0
    
    def test_boundary_condition_last_point(self):
        """Test boundary condition at the end"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': 0.4, 'frequency': 441.0},
            {'time': 0.9, 'frequency': 442.0},
            {'time': 1.0, 'frequency': 443.0}
        ]
        
        result = resample_pitch_contour(contour, interval=0.5)
        
        # Should have point at 0.5 (closest to 0.4 or 0.9)
        assert len(result) == 1
        # 0.5 is closer to 0.4 than 0.9
        assert result[0]['frequency'] == 441.0
    
    def test_various_interval_values(self):
        """Test with various interval values"""
        # Create contour spanning 3.0 seconds
        contour = [{'time': t * 0.1, 'frequency': 440.0} for t in range(31)]
        
        intervals = [0.1, 0.5, 1.0, 2.0]
        
        for interval in intervals:
            result = resample_pitch_contour(contour, interval=interval)
            # Verify time values are at specified intervals (within tolerance)
            for point in result:
                remainder = point['time'] % interval
                # Handle floating-point precision issues
                assert remainder == pytest.approx(0.0, abs=1e-6) or \
                       remainder == pytest.approx(interval, abs=1e-6)
    
    def test_unsorted_input_data(self):
        """Test that unsorted input is handled correctly"""
        unsorted_contour = [
            {'time': 2.0, 'frequency': 446.0},
            {'time': 0.0, 'frequency': 440.0},
            {'time': 1.0, 'frequency': 442.0},
            {'time': 0.5, 'frequency': 441.0},
            {'time': 1.5, 'frequency': 444.0}
        ]
        
        result = resample_pitch_contour(unsorted_contour, interval=1.0)
        
        # Result should be sorted by time
        for i in range(len(result) - 1):
            assert result[i]['time'] < result[i + 1]['time']
    
    def test_single_point_input(self):
        """Test with single point input"""
        single_point = [{'time': 1.0, 'frequency': 440.0}]
        
        result = resample_pitch_contour(single_point, interval=0.5)
        
        # Short audio case - should return first point
        assert len(result) == 1
        assert result[0]['time'] == 1.0
        assert result[0]['frequency'] == 440.0
    
    def test_exact_interval_match(self):
        """Test when original points match interval exactly"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': 0.5, 'frequency': 441.0},
            {'time': 1.0, 'frequency': 442.0},
            {'time': 1.5, 'frequency': 443.0},
            {'time': 2.0, 'frequency': 444.0}
        ]
        
        result = resample_pitch_contour(contour, interval=0.5)
        
        # Should get points at 0.5, 1.0, 1.5 (3 points, excluding start at 0.0)
        assert len(result) == 3
        assert result[0]['time'] == 0.5
        assert result[0]['frequency'] == 441.0
        assert result[1]['time'] == 1.0
        assert result[1]['frequency'] == 442.0
        assert result[2]['time'] == 1.5
        assert result[2]['frequency'] == 443.0
    
    def test_frequency_type_is_float(self):
        """Test that output frequencies are float type"""
        contour = [{'time': t * 0.5, 'frequency': 440} for t in range(6)]
        
        result = resample_pitch_contour(contour, interval=1.0)
        
        for point in result:
            assert isinstance(point['frequency'], float)
            assert isinstance(point['time'], float)
    
    def test_time_type_is_float(self):
        """Test that output times are float type"""
        contour = [{'time': t * 0.5, 'frequency': 440.0} for t in range(6)]
        
        result = resample_pitch_contour(contour, interval=1.0)
        
        for point in result:
            assert isinstance(point['time'], float)
            assert isinstance(point['frequency'], float)
    
    def test_large_dataset_performance(self):
        """Test performance with large dataset (10000 points)"""
        # Create large contour
        large_contour = [
            {'time': t * 0.001, 'frequency': 440.0 + t}
            for t in range(10000)
        ]
        
        start_time = time.time()
        result = resample_pitch_contour(large_contour, interval=0.5)
        elapsed = time.time() - start_time
        
        # Should complete in reasonable time (< 1 second)
        assert elapsed < 1.0
        
        # Verify results are valid
        assert len(result) > 0
        for point in result:
            assert 'time' in point
            assert 'frequency' in point
    
    def test_large_interval(self):
        """Test with interval larger than most gaps"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': 0.1, 'frequency': 441.0},
            {'time': 0.2, 'frequency': 442.0},
            {'time': 10.0, 'frequency': 500.0}  # Big gap
        ]
        
        result = resample_pitch_contour(contour, interval=5.0)
        
        # Should have points at 5.0 (closest to 10.0 or 0.2)
        # 5.0 is closer to 0.2 (diff 4.8) than 10.0 (diff 5.0)
        assert len(result) == 1
        assert result[0]['frequency'] == 442.0
    
    def test_constant_frequency_contour(self):
        """Test with constant frequency"""
        contour = [{'time': t * 0.1, 'frequency': 440.0} for t in range(21)]
        
        result = resample_pitch_contour(contour, interval=0.5)
        
        for point in result:
            assert point['frequency'] == 440.0
    
    def test_linear_frequency_increase(self):
        """Test with linear frequency increase"""
        contour = [{'time': t * 0.1, 'frequency': 440.0 + t * 10} for t in range(21)]

        result = resample_pitch_contour(contour, interval=0.5)

        # Verify linear relationship is preserved
        for i in range(len(result) - 1):
            time_diff = result[i + 1]['time'] - result[i]['time']
            freq_diff = result[i + 1]['frequency'] - result[i]['frequency']
            # Should be approximately 5.0 Hz per 0.5 seconds
            assert freq_diff == pytest.approx(50.0, rel=0.1)


class TestResamplePitchContourValidation:
    """Test suite for resample_pitch_contour input validation"""

    def test_none_input_returns_empty_list(self):
        """Test that None input returns empty list"""
        result = resample_pitch_contour(None)
        assert result == []

    def test_invalid_interval_zero(self):
        """Test that interval=0 raises ValueError"""
        contour = [{'time': 0.0, 'frequency': 440.0}, {'time': 1.0, 'frequency': 442.0}]

        with pytest.raises(ValueError, match="interval must be a positive number"):
            resample_pitch_contour(contour, interval=0)

    def test_invalid_interval_negative(self):
        """Test that negative interval raises ValueError"""
        contour = [{'time': 0.0, 'frequency': 440.0}, {'time': 1.0, 'frequency': 442.0}]

        with pytest.raises(ValueError, match="interval must be a positive number"):
            resample_pitch_contour(contour, interval=-0.5)

    def test_invalid_element_not_dict(self):
        """Test that non-dict elements raise ValueError"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            "not a dict",
            {'time': 1.0, 'frequency': 442.0}
        ]

        with pytest.raises(ValueError, match="expected dict"):
            resample_pitch_contour(contour)

    def test_missing_time_key(self):
        """Test that missing 'time' key raises ValueError"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'frequency': 442.0},  # Missing 'time'
            {'time': 1.0, 'frequency': 444.0}
        ]

        with pytest.raises(ValueError, match="missing required 'time' key"):
            resample_pitch_contour(contour)

    def test_missing_frequency_key(self):
        """Test that missing 'frequency' key raises ValueError"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': 0.5},  # Missing 'frequency'
            {'time': 1.0, 'frequency': 444.0}
        ]

        with pytest.raises(ValueError, match="missing required 'frequency' key"):
            resample_pitch_contour(contour)

    def test_non_numeric_time(self):
        """Test that non-numeric 'time' raises ValueError"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': "invalid", 'frequency': 442.0},
            {'time': 1.0, 'frequency': 444.0}
        ]

        with pytest.raises(ValueError, match="'time' must be numeric"):
            resample_pitch_contour(contour)

    def test_non_numeric_frequency(self):
        """Test that non-numeric 'frequency' raises ValueError"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': 0.5, 'frequency': "invalid"},
            {'time': 1.0, 'frequency': 444.0}
        ]

        with pytest.raises(ValueError, match="'frequency' must be numeric"):
            resample_pitch_contour(contour)

    def test_nan_in_time_values(self):
        """Test that NaN in time values raises ValueError"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': float('nan'), 'frequency': 442.0},
            {'time': 1.0, 'frequency': 444.0}
        ]

        with pytest.raises(ValueError, match="times must be finite"):
            resample_pitch_contour(contour)

    def test_nan_in_frequency_values(self):
        """Test that NaN in frequency values raises ValueError"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': 0.5, 'frequency': float('nan')},
            {'time': 1.0, 'frequency': 444.0}
        ]

        with pytest.raises(ValueError, match="frequencies must be finite"):
            resample_pitch_contour(contour)

    def test_inf_in_time_values(self):
        """Test that Inf in time values raises ValueError"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': float('inf'), 'frequency': 442.0},
            {'time': 1.0, 'frequency': 444.0}
        ]

        with pytest.raises(ValueError, match="times must be finite"):
            resample_pitch_contour(contour)

    def test_inf_in_frequency_values(self):
        """Test that Inf in frequency values raises ValueError"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': 0.5, 'frequency': float('inf')},
            {'time': 1.0, 'frequency': 444.0}
        ]

        with pytest.raises(ValueError, match="frequencies must be finite"):
            resample_pitch_contour(contour)

    def test_negative_inf_in_values(self):
        """Test that -Inf in values raises ValueError"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {'time': -float('inf'), 'frequency': 442.0},
            {'time': 1.0, 'frequency': 444.0}
        ]

        with pytest.raises(ValueError, match="times must be finite"):
            resample_pitch_contour(contour)

    def test_empty_dict_in_list(self):
        """Test that empty dict in list raises ValueError"""
        contour = [
            {'time': 0.0, 'frequency': 440.0},
            {},  # Empty dict
            {'time': 1.0, 'frequency': 444.0}
        ]

        with pytest.raises(ValueError, match="missing required 'time' key"):
            resample_pitch_contour(contour)

    def test_integer_time_and_frequency(self):
        """Test that integer time and frequency values work correctly"""
        contour = [
            {'time': 0, 'frequency': 440},
            {'time': 1, 'frequency': 442},
            {'time': 2, 'frequency': 444}
        ]

        result = resample_pitch_contour(contour, interval=0.5)

        # Should process without error and return floats
        assert len(result) >= 1
        for point in result:
            assert isinstance(point['time'], float)
            assert isinstance(point['frequency'], float)

    def test_single_point_none_interval(self):
        """Test single point with None interval uses default"""
        single_point = [{'time': 1.0, 'frequency': 440.0}]

        result = resample_pitch_contour(single_point)

        # Single point should return first point
        assert len(result) == 1
        assert result[0]['time'] == 1.0
        assert result[0]['frequency'] == 440.0

    def test_max_points_limit(self):
        """Test that exceeding max points raises ValueError"""
        from main import MAX_PITCH_POINTS

        # Create contour exceeding the limit
        large_contour = [
            {'time': t * 0.001, 'frequency': 440.0 + t}
            for t in range(MAX_PITCH_POINTS + 1)
        ]

        with pytest.raises(ValueError, match=f"exceeds maximum size of {MAX_PITCH_POINTS} points"):
            resample_pitch_contour(large_contour)
