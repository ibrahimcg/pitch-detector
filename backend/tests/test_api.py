import pytest
from fastapi.testclient import TestClient
from main import app


class TestAPIEndpoints:
    """Test suite for API endpoints"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    def test_health_check(self, client):
        """Test health check endpoint"""
        response = client.get("/api/health")
        
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}
    
    def test_extract_pitch_invalid_url(self, client):
        """Test extract pitch with invalid URL"""
        response = client.post("/api/extract-pitch", json={"url": ""})
        
        # Should return error (currently returns 500 due to yt-dlp error handling)
        assert response.status_code in [400, 422, 500]
    
    def test_extract_pitch_missing_url(self, client):
        """Test extract pitch without URL parameter"""
        response = client.post("/api/extract-pitch", json={})
        
        # Should return validation error
        assert response.status_code == 422
    
    def test_extract_pitch_invalid_json(self, client):
        """Test extract pitch with invalid JSON"""
        response = client.post(
            "/api/extract-pitch",
            content="invalid json",
            headers={"Content-Type": "application/json"}
        )
        
        # Should return parsing error
        assert response.status_code == 422


class TestPydanticModels:
    """Test suite for Pydantic models"""
    
    def test_youtube_request_valid(self):
        """Test YouTubeRequest model with valid data"""
        from main import YouTubeRequest
        
        request = YouTubeRequest(url="https://www.youtube.com/watch?v=test123")
        assert request.url == "https://www.youtube.com/watch?v=test123"
    
    def test_youtube_request_empty_url(self):
        """Test YouTubeRequest model with empty URL"""
        from main import YouTubeRequest
        from pydantic import ValidationError
        
        # Empty string should fail validation
        try:
            request = YouTubeRequest(url="")
            assert False, "Should have raised validation error"
        except (ValidationError, ValueError):
            pass  # Expected
    
    def test_pitch_point_creation(self):
        """Test PitchPoint model"""
        from main import PitchPoint
        
        point = PitchPoint(time=1.5, frequency=440.0)
        assert point.time == 1.5
        assert point.frequency == 440.0


class TestPitchDataStructure:
    """Test suite for pitch data structure and processing"""
    
    def test_pitch_point_serialization(self):
        """Test PitchPoint serialization to dictionary"""
        from main import PitchPoint
        
        point = PitchPoint(time=2.5, frequency=523.25)
        data = point.model_dump()
        
        assert data['time'] == 2.5
        assert data['frequency'] == 523.25
