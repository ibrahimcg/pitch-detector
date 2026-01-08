import os
import tempfile
import numpy as np
import librosa
import bisect
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
import yt_dlp
from typing import Optional, List, Dict
from scipy.signal import medfilt

# Maximum allowed pitch points to prevent memory issues
MAX_PITCH_POINTS = 100000

app = FastAPI()

# Configure CORS with secure defaults
# Allow specific origins from environment variable or default to restrictive
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    # Development-friendly default: restrict in production by setting CORS_ORIGINS env var
    cors_origins = ["*"]  # TODO: Restrict to specific origins in production

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class YouTubeRequest(BaseModel):
    url: str
    
    @field_validator('url')
    @classmethod
    def url_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('URL cannot be empty')
        return v

class PitchPoint(BaseModel):
    time: float
    frequency: float

def smooth_pitch_contour(pitch_contour, kernel_size=5):
    """
    Apply median filtering to smooth pitch contour
    
    Args:
        pitch_contour: List of pitch points with 'time' and 'frequency' keys
        kernel_size: Size of the median filter window (odd number, default 5)
    
    Returns:
        Smoothed pitch contour
    """
    if len(pitch_contour) < kernel_size:
        return pitch_contour
    
    # Extract frequencies
    frequencies = np.array([p['frequency'] for p in pitch_contour])
    
    # Apply median filter
    smoothed_frequencies = medfilt(frequencies, kernel_size=kernel_size)
    
    # Reconstruct pitch contour with smoothed frequencies
    smoothed_contour = []
    for i, point in enumerate(pitch_contour):
        smoothed_contour.append({
            'time': point['time'],
            'frequency': float(smoothed_frequencies[i])
        })
    
    return smoothed_contour


def resample_pitch_contour(
    pitch_contour: List[Dict[str, float]],
    interval: float = 0.5
) -> List[Dict[str, float]]:
    """
    Resample pitch contour to fixed time intervals using binary search.

    Uses O(n log m) complexity where n is number of target points and m
    is number of original points. The binary search efficiently finds
    the closest time point for each target interval.

    Args:
        pitch_contour: List of {time, frequency} dicts, sorted by time
        interval: Time interval in seconds (default 0.5)

    Returns:
        Resampled pitch contour with points at regular intervals

    Raises:
        ValueError: If interval is not positive, input structure is invalid,
                    or input contains NaN/Inf values
    """
    # Handle None input
    if pitch_contour is None:
        return []

    # Handle empty input
    if not pitch_contour:
        return []

    # Validate interval parameter
    if interval <= 0:
        raise ValueError("interval must be a positive number")

    # Validate input structure: all elements must be dicts with required keys
    for i, point in enumerate(pitch_contour):
        if not isinstance(point, dict):
            raise ValueError(f"pitch_contour[{i}]: expected dict, got {type(point).__name__}")
        if 'time' not in point:
            raise ValueError(f"pitch_contour[{i}]: missing required 'time' key")
        if 'frequency' not in point:
            raise ValueError(f"pitch_contour[{i}]: missing required 'frequency' key")

    # Validate numeric types for required keys
    for i, point in enumerate(pitch_contour):
        if not isinstance(point['time'], (int, float)):
            raise ValueError(f"pitch_contour[{i}]: 'time' must be numeric, got {type(point['time']).__name__}")
        if not isinstance(point['frequency'], (int, float)):
            raise ValueError(f"pitch_contour[{i}]: 'frequency' must be numeric, got {type(point['frequency']).__name__}")

    # Check input size limit to prevent memory issues
    if len(pitch_contour) > MAX_PITCH_POINTS:
        raise ValueError(f"pitch_contour exceeds maximum size of {MAX_PITCH_POINTS} points")

    # Sort by time to ensure order (safety check)
    sorted_contour = sorted(pitch_contour, key=lambda p: p['time'])

    # Extract times and frequencies as numpy arrays for efficient operations
    times = np.array([p['time'] for p in sorted_contour])
    freqs = np.array([p['frequency'] for p in sorted_contour])

    # Validate that times and frequencies are finite (no NaN or Inf)
    if not np.isfinite(times).all():
        raise ValueError("times must be finite numeric values (no NaN or Inf)")
    if not np.isfinite(freqs).all():
        raise ValueError("frequencies must be finite numeric values (no NaN or Inf)")

    # Handle single point or short audio (less than interval duration)
    if len(times) == 1 or times[-1] - times[0] < interval:
        return [{'time': float(times[0]), 'frequency': float(freqs[0])}]

    # Generate target times starting from first interval point
    start_time = times[0]
    end_time = times[-1]
    target_times = np.arange(start_time + interval, end_time, interval)

    resampled = []
    for target in target_times:
        # Binary search to find closest time point
        idx = bisect.bisect_left(times, target)

        # Handle edge cases at boundaries
        if idx == 0:
            closest_freq = float(freqs[0])
        elif idx >= len(times):
            closest_freq = float(freqs[-1])
        else:
            # Compare neighbors to find closest
            if abs(times[idx] - target) <= abs(times[idx - 1] - target):
                closest_freq = float(freqs[idx])
            else:
                closest_freq = float(freqs[idx - 1])

        resampled.append({
            'time': float(target),
            'frequency': closest_freq
        })

    return resampled

@app.post("/api/extract-pitch")
async def extract_pitch(
    request: YouTubeRequest,
    resample_interval: float = Query(
        default=0.5, 
        ge=0.1, 
        le=2.0, 
        description="Resampling interval in seconds (0.1 to 2.0)"
    )
):
    """
    Extract pitch contour from YouTube video audio.
    
    Pipeline:
    1. Download audio from YouTube
    2. Extract raw pitch using librosa piptrack
    3. Apply median filtering for smoothing
    4. Resample to fixed time intervals
    
    Args:
        request: YouTube URL to process
        resample_interval: Time interval for resampling in seconds (default 0.5)
    """
    try:
        # Create temp directory for audio processing
        with tempfile.TemporaryDirectory() as temp_dir:
            audio_path = os.path.join(temp_dir, "audio.wav")
            
            # Download audio from YouTube
            ydl_opts = {
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'wav',
                    'preferredquality': '192',
                }],
                'outtmpl': os.path.join(temp_dir, 'audio'),
                'quiet': True,
                'no_warnings': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([request.url])
            
            # Load audio and extract pitch
            if not os.path.exists(audio_path):
                raise HTTPException(status_code=500, detail="Failed to extract audio from YouTube")
            
            # Load audio with librosa
            y, sr = librosa.load(audio_path, sr=22050)
            
            # Extract pitch using pyin (pitch tracking)
            # fmin and fmax cover typical vocal range
            fmin = librosa.note_to_hz('C2')
            fmax = librosa.note_to_hz('C7')
            
            # Get pitch frequencies
            pitches, magnitudes = librosa.piptrack(y=y, sr=sr, fmin=fmin, fmax=fmax)
            
            # Extract the dominant pitch at each time frame
            pitch_contour = []
            for t in range(pitches.shape[1]):
                # Get the frequency with the highest magnitude at this time frame
                index = magnitudes[:, t].argmax()
                pitch = pitches[index, t]
                
                # Only include confident pitch detections
                if magnitudes[index, t] > 0.1:
                    # Convert frame number to time
                    time = t * len(y) / sr / pitches.shape[1]
                    pitch_contour.append({
                        'time': float(time),
                        'frequency': float(pitch)
                    })
            
            # Apply median filtering to smooth the pitch contour
            pitch_contour = smooth_pitch_contour(pitch_contour, kernel_size=5)
            
            # Resample to fixed time intervals
            pitch_contour = resample_pitch_contour(pitch_contour, interval=resample_interval)
            
            return {
                'status': 'success',
                'pitch_data': pitch_contour,
                'duration': float(len(y) / sr),
                'sample_rate': sr,
                'resample_interval': resample_interval
            }
            
    except Exception as e:
        print(f"Error processing YouTube URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
