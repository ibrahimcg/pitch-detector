// Pitch Matcher - Interactive Main Application Logic

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
        
        // View state (pan and zoom)
        this.viewState = {
            offsetX: 0,
            offsetY: 0,
            zoom: 1,
            minZoom: 0.5,
            maxZoom: 10,
            isDragging: false,
            lastMouseX: 0,
            lastMouseY: 0
        };
        
        // Tooltip state
        this.tooltipData = {
            visible: false,
            x: 0,
            y: 0,
            time: 0,
            frequency: 0,
            note: ''
        };
        
        // Canvas setup - Frequency plot
        this.canvas = document.getElementById('pitchCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        
        // Canvas setup - Notes plot
        this.notesCanvas = document.getElementById('notesCanvas');
        this.notesCtx = this.notesCanvas.getContext('2d');
        this.setupNotesCanvas();
        
        // Tooltip state for notes plot
        this.notesTooltipData = {
            visible: false,
            x: 0,
            y: 0,
            time: 0,
            frequency: 0,
            note: ''
        };
        
        // UI elements
        this.youtubeUrlInput = document.getElementById('youtubeUrl');
        this.processBtn = document.getElementById('processBtn');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.zoomInBtn = document.getElementById('zoomInBtn');
        this.zoomOutBtn = document.getElementById('zoomOutBtn');
        this.resetViewBtn = document.getElementById('resetViewBtn');
        this.statusDiv = document.getElementById('status');
        this.micStatusSpan = document.getElementById('micStatus');
        this.currentNoteSpan = document.getElementById('currentNote');
        this.currentTimeSpan = document.getElementById('currentTime');
        this.zoomLevelSpan = document.getElementById('zoomLevel');
        this.tooltip = document.getElementById('tooltip');
        this.notesTooltip = document.getElementById('notesTooltip');
        
        this.bindEvents();
    }
    
    setupCanvas() {
        // Set canvas size
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * 2;
        this.canvas.height = rect.height * 2;
        this.ctx.scale(2, 2);
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }
    
    setupNotesCanvas() {
        // Set canvas size to match frequency plot
        const rect = this.notesCanvas.getBoundingClientRect();
        this.notesCanvas.width = rect.width * 2;
        this.notesCanvas.height = rect.height * 2;
        this.notesCtx.scale(2, 2);
        this.notesCanvas.width = rect.width;
        this.notesCanvas.height = rect.height;
    }
    
    bindEvents() {
        this.processBtn.addEventListener('click', () => this.processYouTubeUrl());
        this.startBtn.addEventListener('click', () => this.startMicrophone());
        this.stopBtn.addEventListener('click', () => this.stopMicrophone());
        
        // Zoom controls
        this.zoomInBtn.addEventListener('click', () => this.zoomIn());
        this.zoomOutBtn.addEventListener('click', () => this.zoomOut());
        this.resetViewBtn.addEventListener('click', () => this.resetView());
        
        // Canvas interactions - Frequency plot
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        
        // Canvas interactions - Notes plot
        this.notesCanvas.addEventListener('wheel', (e) => this.handleWheelNotes(e));
        this.notesCanvas.addEventListener('mousedown', (e) => this.handleMouseDownNotes(e));
        this.notesCanvas.addEventListener('mousemove', (e) => this.handleMouseMoveNotes(e));
        this.notesCanvas.addEventListener('mouseup', (e) => this.handleMouseUpNotes(e));
        this.notesCanvas.addEventListener('mouseleave', (e) => this.handleMouseLeaveNotes(e));
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.setupNotesCanvas();
            this.draw();
        });
    }
    
    // Pan and zoom methods
    handleWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Zoom factor
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(Math.max(this.viewState.zoom * zoomFactor, this.viewState.minZoom), this.viewState.maxZoom);
        
        if (newZoom !== this.viewState.zoom) {
            // Adjust offset to zoom towards mouse position
            const zoomRatio = newZoom / this.viewState.zoom;
            this.viewState.offsetX = mouseX - (mouseX - this.viewState.offsetX) * zoomRatio;
            this.viewState.offsetY = mouseY - (mouseY - this.viewState.offsetY) * zoomRatio;
            this.viewState.zoom = newZoom;
            
            this.updateZoomDisplay();
            this.draw();
        }
    }
    
    handleMouseDown(e) {
        this.viewState.isDragging = true;
        this.viewState.lastMouseX = e.clientX;
        this.viewState.lastMouseY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (this.viewState.isDragging) {
            const deltaX = e.clientX - this.viewState.lastMouseX;
            const deltaY = e.clientY - this.viewState.lastMouseY;
            
            this.viewState.offsetX += deltaX;
            this.viewState.offsetY += deltaY;
            
            this.viewState.lastMouseX = e.clientX;
            this.viewState.lastMouseY = e.clientY;
            
            this.draw();
        } else {
            // Update tooltip
            this.updateTooltip(mouseX, mouseY);
        }
    }
    
    handleMouseUp(e) {
        this.viewState.isDragging = false;
        this.canvas.style.cursor = 'grab';
    }
    
    handleMouseLeave(e) {
        this.viewState.isDragging = false;
        this.tooltip.style.display = 'none';
        this.tooltipData.visible = false;
        this.canvas.style.cursor = 'grab';
    }
    
    // Notes canvas event handlers (synchronized with frequency plot)
    handleWheelNotes(e) {
        this.handleWheel(e);
    }
    
    handleMouseDownNotes(e) {
        this.viewState.isDragging = true;
        this.viewState.lastMouseX = e.clientX;
        this.viewState.lastMouseY = e.clientY;
        this.notesCanvas.style.cursor = 'grabbing';
    }
    
    handleMouseMoveNotes(e) {
        const rect = this.notesCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (this.viewState.isDragging) {
            const deltaX = e.clientX - this.viewState.lastMouseX;
            const deltaY = e.clientY - this.viewState.lastMouseY;
            
            this.viewState.offsetX += deltaX;
            this.viewState.offsetY += deltaY;
            
            this.viewState.lastMouseX = e.clientX;
            this.viewState.lastMouseY = e.clientY;
            
            this.draw();
        } else {
            // Update notes tooltip
            this.updateNotesTooltip(mouseX, mouseY);
        }
    }
    
    handleMouseUpNotes(e) {
        this.viewState.isDragging = false;
        this.notesCanvas.style.cursor = 'grab';
    }
    
    handleMouseLeaveNotes(e) {
        this.viewState.isDragging = false;
        this.notesTooltip.style.display = 'none';
        this.notesTooltipData.visible = false;
        this.notesCanvas.style.cursor = 'grab';
    }
    
    zoomIn() {
        const newZoom = Math.min(this.viewState.zoom * 1.2, this.viewState.maxZoom);
        this.viewState.zoom = newZoom;
        this.updateZoomDisplay();
        this.draw();
    }
    
    zoomOut() {
        const newZoom = Math.max(this.viewState.zoom / 1.2, this.viewState.minZoom);
        this.viewState.zoom = newZoom;
        this.updateZoomDisplay();
        this.draw();
    }
    
    resetView() {
        this.viewState.offsetX = 0;
        this.viewState.offsetY = 0;
        this.viewState.zoom = 1;
        this.updateZoomDisplay();
        this.draw();
    }
    
    updateZoomDisplay() {
        this.zoomLevelSpan.textContent = `${Math.round(this.viewState.zoom * 100)}%`;
    }
    
    updateTooltip(mouseX, mouseY) {
        if (this.targetPitchData.length === 0) {
            this.tooltip.style.display = 'none';
            this.tooltipData.visible = false;
            return;
        }
        
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;
        
        // Get visible time range
        const minFreq = 50;
        const maxFreq = 1000;
        const maxTime = Math.max(...this.targetPitchData.map(p => p.time));
        const minTime = Math.min(...this.targetPitchData.map(p => p.time));
        const timeRange = maxTime - minTime || 1;
        
        // Calculate time at mouse position
        const visibleWidth = width * this.viewState.zoom;
        const visibleHeight = height * this.viewState.zoom;
        
        const time = ((mouseX - this.viewState.offsetX) / visibleWidth) * timeRange + minTime;
        
        // Find closest pitch point
        let closestPoint = null;
        let minDist = Infinity;
        
        for (const point of this.targetPitchData) {
            const dist = Math.abs(point.time - time);
            if (dist < minDist) {
                minDist = dist;
                closestPoint = point;
            }
        }
        
        if (closestPoint && minDist < 0.5) { // Only show if close enough
            const note = this.frequencyToNote(closestPoint.frequency);
            
            this.tooltipData = {
                visible: true,
                x: mouseX + 15,
                y: mouseY + 15,
                time: closestPoint.time,
                frequency: closestPoint.frequency,
                note: note
            };
            
            // Update tooltip position and content
            this.tooltip.style.display = 'block';
            this.tooltip.style.left = `${mouseX + 15}px`;
            this.tooltip.style.top = `${mouseY + 15}px`;
            this.tooltip.innerHTML = `
                <div class="time">Time: ${closestPoint.time.toFixed(2)}s</div>
                <div class="frequency">${closestPoint.frequency.toFixed(1)} Hz</div>
                <div class="note">Note: ${note}</div>
            `;
        } else {
            this.tooltip.style.display = 'none';
            this.tooltipData.visible = false;
        }
    }
    
    updateNotesTooltip(mouseX, mouseY) {
        if (this.targetPitchData.length === 0) {
            this.notesTooltip.style.display = 'none';
            this.notesTooltipData.visible = false;
            return;
        }
        
        const width = this.notesCanvas.offsetWidth;
        const height = this.notesCanvas.offsetHeight;
        
        // Get visible time range
        const maxTime = Math.max(...this.targetPitchData.map(p => p.time));
        const minTime = Math.min(...this.targetPitchData.map(p => p.time));
        const timeRange = maxTime - minTime || 1;
        
        // Calculate time at mouse position
        const visibleWidth = width * this.viewState.zoom;
        const time = ((mouseX - this.viewState.offsetX) / visibleWidth) * timeRange + minTime;
        
        // Find closest pitch point
        let closestPoint = null;
        let minDist = Infinity;
        
        for (const point of this.targetPitchData) {
            const dist = Math.abs(point.time - time);
            if (dist < minDist) {
                minDist = dist;
                closestPoint = point;
            }
        }
        
        if (closestPoint && minDist < 0.5) { // Only show if close enough
            const note = this.frequencyToNote(closestPoint.frequency);
            
            this.notesTooltipData = {
                visible: true,
                x: mouseX + 15,
                y: mouseY + 15,
                time: closestPoint.time,
                frequency: closestPoint.frequency,
                note: note
            };
            
            // Update tooltip position and content
            this.notesTooltip.style.display = 'block';
            this.notesTooltip.style.left = `${mouseX + 15}px`;
            this.notesTooltip.style.top = `${mouseY + 15}px`;
            this.notesTooltip.innerHTML = `
                <div class="time">Time: ${closestPoint.time.toFixed(2)}s</div>
                <div class="note">Note: ${note}</div>
                <div class="frequency">${closestPoint.frequency.toFixed(1)} Hz</div>
            `;
        } else {
            this.notesTooltip.style.display = 'none';
            this.notesTooltipData.visible = false;
        }
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
                this.resetView();
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
        // Add small epsilon to avoid floating-point precision issues
        const octave = Math.floor((noteNum + 0.0001) / 12) - 1;
        const note = notes[Math.round(noteNum + 0.0001) % 12];
        
        return `${note}${octave}`;
    }
    
    getCurrentTime() {
        return performance.now() / 1000;
    }
    
    draw() {
        // Draw frequency plot
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;
        
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, width, height);
        
        // Save context for transformations
        this.ctx.save();
        
        // Apply pan and zoom transformations
        this.ctx.translate(this.viewState.offsetX, this.viewState.offsetY);
        this.ctx.scale(this.viewState.zoom, this.viewState.zoom);
        
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
        
        // Restore context (undo transformations for fixed elements)
        this.ctx.restore();
        
        // Draw notes plot
        this.drawNotesCanvas();
    }
    
    drawNotesCanvas() {
        const width = this.notesCanvas.offsetWidth;
        const height = this.notesCanvas.offsetHeight;
        
        // Clear canvas
        this.notesCtx.fillStyle = '#1a1a2e';
        this.notesCtx.fillRect(0, 0, width, height);
        
        // Save context for transformations
        this.notesCtx.save();
        
        // Apply pan and zoom transformations (X-axis synchronized with frequency plot)
        this.notesCtx.translate(this.viewState.offsetX, 0);
        this.notesCtx.scale(this.viewState.zoom, 1);
        
        // Draw notes grid
        this.drawNotesGrid(width, height);
        
        // Draw target notes (from YouTube)
        if (this.targetPitchData.length > 0) {
            this.drawNotesPlot(this.targetPitchData, 'rgba(0, 255, 136, 0.8)', width, height);
        }
        
        // Draw user notes (from microphone)
        if (this.userPitchData.length > 0) {
            this.drawNotesPlot(this.userPitchData, 'rgba(255, 107, 107, 0.8)', width, height);
        }
        
        // Restore context
        this.notesCtx.restore();
    }
    
    drawGrid(width, height) {
        const visibleWidth = width * this.viewState.zoom;
        const visibleHeight = height * this.viewState.zoom;
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1 / this.viewState.zoom; // Keep lines thin regardless of zoom
        
        // Calculate visible frequency range
        const minFreq = 50;
        const maxFreq = 1000;
        
        // Draw horizontal lines (frequency)
        const freqStep = this.viewState.zoom > 2 ? 100 : (this.viewState.zoom > 1.5 ? 50 : 100);
        
        for (let freq = minFreq; freq <= maxFreq; freq += freqStep) {
            const y = this.frequencyToY(freq, height, minFreq, maxFreq);
            
            // Check if visible
            const transformedY = y * this.viewState.zoom + this.viewState.offsetY;
            if (transformedY > -50 && transformedY < height + 50) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(width, y);
                this.ctx.stroke();
                
                // Draw note labels
                if (freq % 200 === 0 || (freq % 100 === 0 && this.viewState.zoom > 1.5)) {
                    const note = this.frequencyToNote(freq);
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                    this.ctx.font = `${12 / this.viewState.zoom}px Arial`;
                    this.ctx.fillText(`${note} (${freq}Hz)`, 5, y - 5 / this.viewState.zoom);
                }
            }
        }
        
        // Draw vertical lines (time)
        if (this.targetPitchData.length > 0) {
            const maxTime = Math.max(...this.targetPitchData.map(p => p.time));
            const minTime = Math.min(...this.targetPitchData.map(p => p.time));
            const timeRange = maxTime - minTime || 1;
            
            const timeStep = this.viewState.zoom > 3 ? 1 : (this.viewState.zoom > 1.5 ? 2 : 5);
            
            for (let time = minTime; time <= maxTime; time += timeStep) {
                const x = ((time - minTime) / timeRange) * width;
                
                // Check if visible
                const transformedX = x * this.viewState.zoom + this.viewState.offsetX;
                if (transformedX > -50 && transformedX < visibleWidth + 50) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, 0);
                    this.ctx.lineTo(x, height);
                    this.ctx.stroke();
                    
                    // Draw time labels
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                    this.ctx.font = `${12 / this.viewState.zoom}px Arial`;
                    this.ctx.fillText(`${time.toFixed(1)}s`, x + 5, height - 5 / this.viewState.zoom);
                }
            }
        }
    }
    
    drawPitchCurve(pitchData, color, width, height) {
        if (pitchData.length < 2) return;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3 / this.viewState.zoom;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
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
            
            // Check if point is visible
            const transformedX = x * this.viewState.zoom + this.viewState.offsetX;
            const transformedY = y * this.viewState.zoom + this.viewState.offsetY;
            
            if (transformedX > -50 && transformedX < width * this.viewState.zoom + 50 &&
                transformedY > -50 && transformedY < height * this.viewState.zoom + 50) {
                
                if (firstPoint) {
                    this.ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    this.ctx.lineTo(x, y);
                }
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
    
    /**
     * Convert note string (e.g., "C4", "D#5") to Y position on notes canvas
     * Note range: C1 to C8 (88 semitones)
     */
    noteToY(noteString, height) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Parse note string
        const octave = parseInt(noteString.slice(-1));
        const noteName = noteString.slice(0, -1);
        const noteIndex = noteNames.indexOf(noteName);
        
        if (noteIndex === -1) return height / 2; // Default to middle if invalid
        
        // Calculate semitone position (C1 = 0, C8 = 84)
        const minOctave = 1;
        const maxOctave = 8;
        const totalSemitones = (maxOctave - minOctave) * 12;
        const semitone = (octave - minOctave) * 12 + noteIndex;
        
        // Map to Y position (inverted: lower notes at bottom)
        return height - (semitone / totalSemitones) * height;
    }
    
    /**
     * Draw piano-style grid for notes plot
     */
    drawNotesGrid(width, height) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const blackKeys = ['C#', 'D#', 'F#', 'G#', 'A#'];
        
        this.notesCtx.lineWidth = 1 / this.viewState.zoom;
        
        // Draw horizontal grid lines for each semitone
        for (let octave = 1; octave <= 8; octave++) {
            for (let i = 0; i < noteNames.length; i++) {
                const noteName = noteNames[i];
                const noteString = `${noteName}${octave}`;
                const y = this.noteToY(noteString, height);
                
                // Different style for white keys vs black keys
                const isBlackKey = blackKeys.includes(noteName);
                this.notesCtx.strokeStyle = isBlackKey ? 
                    'rgba(255, 255, 255, 0.08)' : 
                    'rgba(255, 255, 255, 0.15)';
                
                if (isBlackKey) {
                    this.notesCtx.setLineDash([3 / this.viewState.zoom, 3 / this.viewState.zoom]);
                } else {
                    this.notesCtx.setLineDash([]);
                }
                
                this.notesCtx.beginPath();
                this.notesCtx.moveTo(0, y);
                this.notesCtx.lineTo(width, y);
                this.notesCtx.stroke();
                
                // Draw octave labels (only on C notes)
                if (noteName === 'C') {
                    this.notesCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                    this.notesCtx.font = `${14 / this.viewState.zoom}px Arial`;
                    this.notesCtx.fillText(noteString, 5 / this.viewState.zoom, y - 5);
                }
            }
        }
        
        // Reset line dash
        this.notesCtx.setLineDash([]);
        
        // Draw vertical time grid (synchronized with frequency plot)
        if (this.targetPitchData.length > 0) {
            const maxTime = Math.max(...this.targetPitchData.map(p => p.time));
            const minTime = Math.min(...this.targetPitchData.map(p => p.time));
            const timeRange = maxTime - minTime || 1;
            
            const timeStep = this.viewState.zoom > 3 ? 1 : (this.viewState.zoom > 1.5 ? 2 : 5);
            
            this.notesCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            
            for (let time = minTime; time <= maxTime; time += timeStep) {
                const x = ((time - minTime) / timeRange) * width;
                
                this.notesCtx.beginPath();
                this.notesCtx.moveTo(x, 0);
                this.notesCtx.lineTo(x, height);
                this.notesCtx.stroke();
                
                // Draw time labels
                this.notesCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                this.notesCtx.font = `${12 / this.viewState.zoom}px Arial`;
                this.notesCtx.fillText(`${time.toFixed(1)}s`, x + 5 / this.viewState.zoom, height - 5);
            }
        }
    }
    
    /**
     * Draw note blocks on the notes plot
     */
    drawNotesPlot(pitchData, color, width, height) {
        if (pitchData.length === 0) return;
        
        // Normalize time to canvas width
        const maxTime = Math.max(...pitchData.map(p => p.time));
        const minTime = Math.min(...pitchData.map(p => p.time));
        const timeRange = maxTime - minTime || 1;
        
        // Group consecutive same-note points into blocks
        const noteBlocks = [];
        let currentBlock = null;
        
        for (const point of pitchData) {
            const note = this.frequencyToNote(point.frequency);
            const x = ((point.time - minTime) / timeRange) * width;
            const y = this.noteToY(note, height);
            
            if (!currentBlock || currentBlock.note !== note) {
                // Start new block
                if (currentBlock) {
                    noteBlocks.push(currentBlock);
                }
                currentBlock = {
                    note: note,
                    startX: x,
                    endX: x,
                    y: y,
                    frequency: point.frequency
                };
            } else {
                // Extend current block
                currentBlock.endX = x;
            }
        }
        
        // Push the last block
        if (currentBlock) {
            noteBlocks.push(currentBlock);
        }
        
        // Draw note blocks
        this.notesCtx.fillStyle = color;
        const blockHeight = 8; // Height of note block in pixels
        
        for (const block of noteBlocks) {
            const blockWidth = Math.max(block.endX - block.startX, 3 / this.viewState.zoom);
            
            // Check if block is visible
            const transformedX = block.startX * this.viewState.zoom + this.viewState.offsetX;
            if (transformedX > -50 && transformedX < width * this.viewState.zoom + 50) {
                // Draw rectangle for note block (with rounded caps via lineJoin)
                this.notesCtx.fillRect(
                    block.startX, 
                    block.y - blockHeight / 2, 
                    blockWidth, 
                    blockHeight
                );
            }
        }
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
