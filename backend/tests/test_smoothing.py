import pytest
import sys
import os
import numpy as np

# Add backend directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import smooth_pitch_contour


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
