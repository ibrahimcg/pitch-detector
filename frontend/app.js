// Pitch Matcher - Main Application Logic

class PitchMatcher {
    constructor() {
        // API configuration
        this.apiUrl = 'http://localhost:8000/api';
        
        // App state
        this.targetPitchData = [];
        this.userPitchData = [];
        this.isRecording = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.animationFrame = null;
        
        // Canvas setup
        this.canvas = document.getElementById('pitchCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        
        // UI elements
        this.youtubeUrlInput = document.getElementById('youtubeUrl');
        this.processBtn = document.getElementById('processBtn');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.statusDiv = document.getElementById('status');
        this.micStatusSpan = document.getElementById('micStatus');
        this.currentNoteSpan = document.getElementById('currentNote');
        
        this.bindEvents();
    }
    
    setupCanvas() {
        // Set canvas size
        this.canvas.width = this.canvas.offsetWidth * 2;
        this.canvas.height = this.canvas.offsetHeight * 2;
        this.ctx.scale(2, 2);
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }
    
    bindEvents() {
        this.processBtn.addEventListener('click', () => this.processYouTubeUrl());
        this.startBtn.addEventListener('click', () => this.startMicrophone());
        this.stopBtn.addEventListener('click', () => this.stopMicrophone());
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.draw();
        });
    }
    
    async processYouTubeUrl() {
        const url = this.youtubeUrlInput.value.trim();
        if (!url) {
            this.showStatus('Please enter a YouTube URL', 'error');
            return;
        }
        
        this.showStatus('Processing YouTube video... This may take a moment.', 'loading');
        this.processBtn.disabled = true;
        
        try {
            const response = await fetch(`${this.apiUrl}/extract-pitch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to process YouTube URL');
            }
            
            const data = await response.json();
            
            if (data.status === 'success') {
                this.targetPitchData = data.pitch_data;
                this.showStatus(`Successfully extracted pitch data! Duration: ${data.duration.toFixed(1)}s`, 'success');
                this.startBtn.disabled = false;
                this.draw();
            } else {
                throw new Error(data.detail || 'Unknown error occurred');
            }
            
        } catch (error) {
            console.error('Error processing YouTube URL:', error);
            this.showStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.processBtn.disabled = false;
        }
    }
    
    async startMicrophone() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Set up audio analysis
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            this.isRecording = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.micStatusSpan.textContent = 'Microphone active - Sing along!';
            
            // Start real-time pitch detection
            this.detectPitch();
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.showStatus(`Microphone access denied: ${error.message}`, 'error');
        }
    }
    
    stopMicrophone() {
        this.isRecording = false;
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.micStatusSpan.textContent = 'Microphone inactive';
        this.currentNoteSpan.textContent = '-';
    }
    
    detectPitch() {
        if (!this.isRecording) return;
        
        const bufferLength = this.analyser.fftSize;
        const buffer = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(buffer);
        
        // Auto-correlation for pitch detection
        const pitch = this.autoCorrelate(buffer, this.audioContext.sampleRate);
        
        if (pitch !== -1) {
            const note = this.frequencyToNote(pitch);
            this.currentNoteSpan.textContent = `${note} (${pitch.toFixed(1)} Hz)`;
            
            // Add user pitch to data
            const currentTime = this.getCurrentTime();
            this.userPitchData.push({
                time: currentTime,
                frequency: pitch
            });
            
            // Keep only recent data
            if (this.userPitchData.length > 1000) {
                this.userPitchData.shift();
            }
        }
        
        this.draw();
        this.animationFrame = requestAnimationFrame(() => this.detectPitch());
    }
    
    autoCorrelate(buffer, sampleRate) {
        // Auto-correlation algorithm for pitch detection
        const SIZE = buffer.length;
        let bestOffset = -1;
        let bestCorrelation = 0;
        let foundGoodCorrelation = false;
        const correlations = new Array(SIZE).fill(0);
        
        for (let offset = 0; offset < SIZE; offset++) {
            let correlation = 0;
            for (let i = 0; i < SIZE / 2; i++) {
                correlation += Math.abs(buffer[i] - buffer[i + offset]);
            }
            correlation = 1 - (correlation / (SIZE / 2));
            correlations[offset] = correlation;
        }
        
        // Find the first peak
        for (let i = 0; i < SIZE / 2; i++) {
            if (correlations[i] > 0.9 && correlations[i] > correlations[i - 1]) {
                foundGoodCorrelation = true;
                if (correlations[i] > correlations[i + 1]) {
                    bestOffset = i;
                    break;
                }
            }
        }
        
        if (foundGoodCorrelation && bestOffset !== -1) {
            let maxval = -1;
            let maxpos = -1;
            
            // Search around the first peak
            for (let i = bestOffset; i < SIZE / 2; i++) {
                if (correlations[i] > maxval) {
                    maxval = correlations[i];
                    maxpos = i;
                }
            }
            
            // Calculate frequency from the period
            let T0 = maxpos;
            
            // Interpolate for better accuracy
            const x1 = correlations[T0 - 1];
            const x2 = correlations[T0];
            const x3 = correlations[T0 + 1];
            
            const a = (x1 + x3 - 2 * x2) / 2;
            const b = (x3 - x1) / 2;
            
            if (a) {
                T0 -= b / (2 * a);
            }
            
            return sampleRate / T0;
        }
        
        return -1;
    }
    
    frequencyToNote(frequency) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // A4 = 440 Hz
        const noteNum = 12 * (Math.log2(frequency / 440)) + 69;
        const octave = Math.floor((noteNum - 12 * Math.floor(noteNum / 12) + 12) / 12);
        const note = notes[Math.round(noteNum) % 12];
        
        return `${note}${Math.floor(octave)}`;
    }
    
    getCurrentTime() {
        return performance.now() / 1000;
    }
    
    draw() {
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;
        
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw grid
        this.drawGrid(width, height);
        
        // Draw target pitch (from YouTube)
        if (this.targetPitchData.length > 0) {
            this.drawPitchCurve(this.targetPitchData, '#00ff88', width, height);
        }
        
        // Draw user pitch (from microphone)
        if (this.userPitchData.length > 0) {
            this.drawPitchCurve(this.userPitchData, '#ff6b6b', width, height);
        }
    }
    
    drawGrid(width, height) {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        
        // Draw horizontal lines (frequency)
        const minFreq = 50;  // Hz
        const maxFreq = 1000; // Hz
        
        for (let freq = minFreq; freq <= maxFreq; freq += 100) {
            const y = this.frequencyToY(freq, height, minFreq, maxFreq);
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
        
        // Draw note labels
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '10px Arial';
        
        for (let freq = minFreq; freq <= maxFreq; freq += 200) {
            const y = this.frequencyToY(freq, height, minFreq, maxFreq);
            this.ctx.fillText(`${freq}Hz`, 5, y - 5);
        }
    }
    
    drawPitchCurve(pitchData, color, width, height) {
        if (pitchData.length < 2) return;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        const minFreq = 50;
        const maxFreq = 1000;
        
        // Normalize time to canvas width
        const maxTime = Math.max(...pitchData.map(p => p.time));
        const minTime = Math.min(...pitchData.map(p => p.time));
        const timeRange = maxTime - minTime || 1;
        
        let firstPoint = true;
        
        for (const point of pitchData) {
            const x = ((point.time - minTime) / timeRange) * width;
            const y = this.frequencyToY(point.frequency, height, minFreq, maxFreq);
            
            if (firstPoint) {
                this.ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        
        this.ctx.stroke();
    }
    
    frequencyToY(frequency, height, minFreq, maxFreq) {
        // Logarithmic frequency to y position mapping
        const logMin = Math.log(minFreq);
        const logMax = Math.log(maxFreq);
        const logFreq = Math.log(frequency);
        
        return height - ((logFreq - logMin) / (logMax - logMin)) * height;
    }
    
    showStatus(message, type) {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status ${type}`;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PitchMatcher();
});
