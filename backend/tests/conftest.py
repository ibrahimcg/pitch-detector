"""
Pytest configuration and fixtures for Pitch Detector tests
"""
import pytest
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(scope="session")
def backend_path():
    """Return the backend directory path"""
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture
def sample_pitch_contour():
    """Create a sample pitch contour for testing"""
    import numpy as np
    
    contour = []
    for i in range(50):
        # Create a smooth wave with some noise
        base_freq = 440 + (np.sin(i * 0.2) * 50)
        noise = np.random.random() * 20 - 10
        contour.append({
            'time': i * 0.1,
            'frequency': base_freq + noise
        })
    return contour


@pytest.fixture
def noisy_pitch_contour():
    """Create a pitch contour with outliers for testing"""
    contour = []
    for i in range(20):
        if i % 5 == 0:
            # Add outlier
            contour.append({
                'time': i * 0.1,
                'frequency': 1000.0  # Outlier
            })
        else:
            contour.append({
                'time': i * 0.1,
                'frequency': 440.0 + (i * 5)
            })
    return contour
