# Pitch Matcher Web App

A minimal web application that extracts pitch contours from YouTube videos and allows users to match the pitch with their voice in real-time.

## Features

- YouTube URL input for audio extraction
- Pitch contour visualization using Canvas
- Real-time microphone input analysis
- Visual comparison between target pitch and user's pitch
- Note detection and display

## Tech Stack

- **Backend**: Python (FastAPI)
- **Frontend**: Vanilla JavaScript, HTML5 Canvas
- **Audio Processing**: Librosa for pitch detection, Web Audio API for real-time analysis

## Setup Instructions

### Prerequisites

1. Python 3.8+
2. FFmpeg (required for audio processing)
3. Node.js (optional, for serving frontend)

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

### Frontend Setup

You can serve the frontend using any static file server. For example:

```bash
# Using Python's built-in server
cd frontend
python -m http.server 3000

# OR using Node.js (if installed)
npx serve frontend
```

### Running the Application

1. Start the backend server:
```bash
cd backend
python main.py
```

The backend will run at `http://localhost:8000`

2. In a separate terminal, serve the frontend:
```bash
cd frontend
python -m http.server 3000
```

The frontend will be available at `http://localhost:3000`

## Usage

1. Open `http://localhost:3000` in your web browser
2. Enter a YouTube URL and click "Extract Pitch"
3. Wait for the pitch data to be processed
4. Click "Start Microphone" to enable real-time pitch detection
5. Sing along with the music and try to match the green pitch curve with your voice (red curve)

## API Endpoints

- `POST /api/extract-pitch` - Extract pitch data from YouTube video
- `GET /api/health` - Health check endpoint

## Dependencies

### Backend
- fastapi
- uvicorn
- yt-dlp
- librosa
- numpy
- python-multipart

### System Requirements
- FFmpeg (must be installed and in PATH)

## Notes

- The backend uses yt-dlp to extract audio from YouTube videos
- Librosa is used for pitch detection using the piptrack algorithm
- The frontend uses the Web Audio API for real-time microphone analysis
- Pitch detection is performed using auto-correlation algorithm
- For best results, use videos with clear melodic content (singing, instruments)

## Troubleshooting

1. **FFmpeg not found**: Make sure FFmpeg is installed and accessible in your system PATH
2. **Microphone access denied**: Grant microphone permissions in your browser
3. **CORS errors**: Ensure the backend is running on port 8000
4. **YouTube extraction failed**: Check if the video is available and not region-restricted

## License

MIT License
