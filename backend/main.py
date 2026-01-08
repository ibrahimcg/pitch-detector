import os
import tempfile
import numpy as np
import librosa
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
from typing import Optional
import json

app = FastAPI()

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class YouTubeRequest(BaseModel):
    url: str

class PitchPoint(BaseModel):
    time: float
    frequency: float

@app.post("/api/extract-pitch")
async def extract_pitch(request: YouTubeRequest):
    """
    Extract pitch contour from YouTube video audio
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
            
            return {
                'status': 'success',
                'pitch_data': pitch_contour,
                'duration': float(len(y) / sr),
                'sample_rate': sr
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
