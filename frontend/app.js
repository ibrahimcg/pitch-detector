// Pitch Matcher - Interactive Main Application Logic

/**
 * PianoSynthesizer - Generates piano-like sounds using Web Audio API
 * Uses OscillatorNode with ADSR envelope for realistic tone
 */
class PianoSynthesizer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.masterGain = audioContext.createGain();
        this.masterGain.connect(audioContext.destination);
        this.masterGain.gain.value = 0.3; // Default volume (30%)
        this.activeNotes = new Map(); // Track active oscillators for cleanup
    }
    
    /**
     * Convert note name (e.g., "C4") to frequency in Hz
     * Uses equal temperament: f = 440 * 2^((n-69)/12)
     */
    noteToFrequency(noteName) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
        if (!match) return 440; // Default to A4
        
        const [, note, octave] = match;
        const noteIndex = notes.indexOf(note);
        if (noteIndex === -1) return 440;
        
        // Calculate semitone position (A4 = 69)
        const semitone = noteIndex + (parseInt(octave) + 1) * 12;
        
        return 440 * Math.pow(2, (semitone - 69) / 12);
    }
    
    /**
     * Play a piano note with ADSR envelope
     * @param {string} noteName - Note to play (e.g., "C4")
     * @param {number} duration - Duration in seconds
     * @param {number} startTime - When to start (relative to audioContext.currentTime)
     * @returns {string} noteId - Unique identifier for this note
     */
    playNote(noteName, duration = 0.5, startTime = 0) {
        const frequency = this.noteToFrequency(noteName);
        const actualStartTime = this.audioContext.currentTime + startTime;
        
        // Create oscillator for fundamental frequency
        const osc = this.audioContext.createOscillator();
        osc.frequency.value = frequency;
        osc.type = 'triangle'; // Piano-like timbre
        
        // Add subtle harmonic for richness
        const osc2 = this.audioContext.createOscillator();
        osc2.frequency.value = frequency * 2; // Octave harmonic
        osc2.type = 'sine';
        
        // Create gain nodes for ADSR envelope
        const gainNode = this.audioContext.createGain();
        const harmGainNode = this.audioContext.createGain();
        
        gainNode.gain.value = 0;
        harmGainNode.gain.value = 0;
        
        // Connect audio graph
        osc.connect(gainNode);
        osc2.connect(harmGainNode);
        gainNode.connect(this.masterGain);
        harmGainNode.connect(this.masterGain);
        
        // ADSR envelope parameters
        const attack = 0.01;  // Quick onset
        const decay = 0.1;    // Natural decay
        const sustain = 0.7;  // 70% volume sustain
        const release = 0.3;  // Gradual fade
        
        // Apply ADSR to fundamental
        gainNode.gain.setValueAtTime(0, actualStartTime);
        gainNode.gain.linearRampToValueAtTime(0.8, actualStartTime + attack);
        gainNode.gain.linearRampToValueAtTime(sustain * 0.8, actualStartTime + attack + decay);
        gainNode.gain.setValueAtTime(sustain * 0.8, actualStartTime + Math.max(duration - release, attack + decay));
        gainNode.gain.linearRampToValueAtTime(0, actualStartTime + duration);
        
        // Apply ADSR to harmonic (quieter)
        harmGainNode.gain.setValueAtTime(0, actualStartTime);
        harmGainNode.gain.linearRampToValueAtTime(0.2, actualStartTime + attack);
        harmGainNode.gain.linearRampToValueAtTime(sustain * 0.2, actualStartTime + attack + decay);
        harmGainNode.gain.setValueAtTime(sustain * 0.2, actualStartTime + Math.max(duration - release, attack + decay));
        harmGainNode.gain.linearRampToValueAtTime(0, actualStartTime + duration);
        
        // Schedule oscillator start and stop
        osc.start(actualStartTime);
        osc.stop(actualStartTime + duration);
        osc2.start(actualStartTime);
        osc2.stop(actualStartTime + duration);
        
        // Cleanup when finished
        const noteId = `${noteName}-${Date.now()}-${Math.random()}`;
        this.activeNotes.set(noteId, { osc, osc2, gainNode, harmGainNode });
        
        osc.onended = () => {
            gainNode.disconnect();
            harmGainNode.disconnect();
            this.activeNotes.delete(noteId);
        };
        
        return noteId;
    }
    
    /**
     * Set master volume (0.0 to 1.0)
     */
    setVolume(volume) {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        this.masterGain.gain.setValueAtTime(clampedVolume, this.audioContext.currentTime);
    }
    
    /**
     * Stop all currently playing notes
     */
    stopAll() {
        const currentTime = this.audioContext.currentTime;
        
        for (const [noteId, { osc, osc2, gainNode, harmGainNode }] of this.activeNotes) {
            try {
                // Fade out quickly to avoid clicks
                gainNode.gain.cancelScheduledValues(currentTime);
                gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
                gainNode.gain.linearRampToValueAtTime(0, currentTime + 0.05);
                
                harmGainNode.gain.cancelScheduledValues(currentTime);
                harmGainNode.gain.setValueAtTime(harmGainNode.gain.value, currentTime);
                harmGainNode.gain.linearRampToValueAtTime(0, currentTime + 0.05);
                
                osc.stop(currentTime + 0.05);
                osc2.stop(currentTime + 0.05);
            } catch (e) {
                // Oscillator may already be stopped
                console.warn('Error stopping note:', e);
            }
        }
        
        this.activeNotes.clear();
    }
}

/**
 * PlaybackController - Manages timing and playback of note sequences
 */
class PlaybackController {
    constructor(synthesizer, onUpdate) {
        this.synthesizer = synthesizer;
        this.onUpdate = onUpdate; // Callback for playhead updates
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.speed = 1.0;
        this.noteSequence = [];
        this.scheduledNotes = [];
        this.playbackStartTime = 0;
        this.pauseTime = 0;
        this.animationFrameId = null;
    }
    
    /**
     * Convert pitch data to note sequence with durations
     * Groups consecutive same notes into blocks
     */
    loadNotes(pitchData, frequencyToNoteFunc) {
        if (!pitchData || pitchData.length === 0) {
            this.noteSequence = [];
            return;
        }
        
        const noteBlocks = [];
        let currentNote = null;
        let startTime = 0;
        
        for (const point of pitchData) {
            const note = frequencyToNoteFunc(point.frequency);
            
            if (note !== currentNote) {
                if (currentNote) {
                    noteBlocks.push({
                        note: currentNote,
                        startTime: startTime,
                        duration: Math.max(0.05, point.time - startTime) // Min 50ms duration
                    });
                }
                currentNote = note;
                startTime = point.time;
            }
        }
        
        // Add final note
        if (currentNote) {
            const lastPoint = pitchData[pitchData.length - 1];
            noteBlocks.push({
                note: currentNote,
                startTime: startTime,
                duration: Math.max(0.1, lastPoint.time - startTime)
            });
        }
        
        this.noteSequence = noteBlocks;
    }
    
    /**
     * Start or resume playback
     */
    play() {
        if (this.isPlaying) return;
        if (this.noteSequence.length === 0) return;
        
        this.isPlaying = true;
        this.isPaused = false;
        
        const audioContext = this.synthesizer.audioContext;
        
        // Resume AudioContext if suspended (browser autoplay policy)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        // Calculate playback start time
        if (this.currentTime === 0) {
            // Starting fresh
            this.playbackStartTime = audioContext.currentTime;
        } else {
            // Resuming from pause
            this.playbackStartTime = audioContext.currentTime - (this.currentTime / this.speed);
        }
        
        // Schedule all notes
        this.scheduleNotes();
        
        // Start playhead animation
        this.updatePlayhead();
    }
    
    /**
     * Pause playback
     */
    pause() {
        if (!this.isPlaying || this.isPaused) return;
        
        this.isPlaying = false;
        this.isPaused = true;
        this.pauseTime = this.currentTime;
        
        // Stop all scheduled notes
        this.synthesizer.stopAll();
        this.scheduledNotes = [];
        
        // Stop animation
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    /**
     * Stop playback and reset to beginning
     */
    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.pauseTime = 0;
        
        // Stop all notes
        this.synthesizer.stopAll();
        this.scheduledNotes = [];
        
        // Stop animation
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Update UI to show reset
        if (this.onUpdate) {
            this.onUpdate(0);
        }
    }
    
    /**
     * Set playback speed (0.5x to 2x)
     */
    setSpeed(speed) {
        const wasPlaying = this.isPlaying;
        
        if (wasPlaying) {
            this.pause();
        }
        
        this.speed = Math.max(0.5, Math.min(2.0, speed));
        
        if (wasPlaying) {
            this.play();
        }
    }
    
    /**
     * Schedule notes for playback
     */
    scheduleNotes() {
        const audioContext = this.synthesizer.audioContext;
        const currentAudioTime = audioContext.currentTime;
        
        // Clear old scheduled notes
        this.scheduledNotes = [];
        
        // Schedule each note in the sequence
        for (const noteBlock of this.noteSequence) {
            const scheduleTime = (noteBlock.startTime / this.speed) - (this.currentTime / this.speed);
            const duration = noteBlock.duration / this.speed;
            
            // Only schedule notes that haven't played yet and are in the near future
            if (scheduleTime + duration > 0) {
                const noteId = this.synthesizer.playNote(
                    noteBlock.note,
                    duration,
                    scheduleTime
                );
                
                this.scheduledNotes.push(noteId);
            }
        }
    }
    
    /**
     * Update playhead position and call update callback
     */
    updatePlayhead() {
        if (!this.isPlaying) return;
        
        const audioContext = this.synthesizer.audioContext;
        const elapsed = (audioContext.currentTime - this.playbackStartTime) * this.speed;
        this.currentTime = elapsed;
        
        // Check if playback finished
        if (this.noteSequence.length > 0) {
            const lastNote = this.noteSequence[this.noteSequence.length - 1];
            const totalDuration = lastNote.startTime + lastNote.duration;
            
            if (this.currentTime >= totalDuration) {
                this.stop();
                return;
            }
        }
        
        // Call update callback
        if (this.onUpdate) {
            this.onUpdate(this.currentTime);
        }
        
        // Continue animation at 60 FPS
        this.animationFrameId = requestAnimationFrame(() => this.updatePlayhead());
    }
    
    /**
     * Get current playback time
     */
    getCurrentTime() {
        return this.currentTime;
    }
}

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
        
        // Playback components
        this.playbackAudioContext = null; // Separate context for playback
        this.pianoSynthesizer = null;
        this.playbackController = null;
        this.playheadPosition = 0;
        this.isPlaybackActive = false;
        
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
        
        // Playback UI elements
        this.playBtn = document.getElementById('playBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopPlaybackBtn = document.getElementById('stopPlaybackBtn');
        this.speedSelect = document.getElementById('speedSelect');
        this.modeSelect = document.getElementById('modeSelect');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        
        this.bindEvents();
        this.bindPlaybackEvents();
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
    
    /**
     * Bind playback control event listeners
     */
    bindPlaybackEvents() {
        if (!this.playBtn || !this.pauseBtn || !this.stopPlaybackBtn) return;
        
        this.playBtn.addEventListener('click', () => this.handlePlay());
        this.pauseBtn.addEventListener('click', () => this.handlePause());
        this.stopPlaybackBtn.addEventListener('click', () => this.handleStopPlayback());
        this.speedSelect.addEventListener('change', (e) => this.handleSpeedChange(e));
        this.volumeSlider.addEventListener('input', (e) => this.handleVolumeChange(e));
        this.modeSelect.addEventListener('change', (e) => this.handleModeChange(e));
    }
    
    /**
     * Handle play button click
     */
    handlePlay() {
        // Initialize audio context if needed (requires user gesture)
        if (!this.playbackAudioContext) {
            try {
                this.playbackAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.pianoSynthesizer = new PianoSynthesizer(this.playbackAudioContext);
                this.playbackController = new PlaybackController(
                    this.pianoSynthesizer,
                    (time) => this.updatePlayheadCallback(time)
                );
            } catch (error) {
                console.error('Failed to create AudioContext:', error);
                this.showStatus('Audio playback not supported in this browser', 'error');
                return;
            }
        }
        
        // Load notes based on selected mode
        const mode = this.modeSelect.value;
        let notesToPlay = [];
        
        if (mode === 'target' && this.targetPitchData.length > 0) {
            notesToPlay = this.targetPitchData;
        } else if (mode === 'user' && this.userPitchData.length > 0) {
            notesToPlay = this.userPitchData;
        } else if (mode === 'both') {
            // Combine both datasets
            if (this.targetPitchData.length > 0 && this.userPitchData.length > 0) {
                // Play both simultaneously by loading them separately
                // For MVP, we'll just play target (enhancement: overlay both)
                notesToPlay = this.targetPitchData;
                // TODO: Implement dual playback in future enhancement
            } else if (this.targetPitchData.length > 0) {
                notesToPlay = this.targetPitchData;
            } else if (this.userPitchData.length > 0) {
                notesToPlay = this.userPitchData;
            }
        }
        
        if (notesToPlay.length === 0) {
            this.showStatus('No pitch data available for playback', 'error');
            return;
        }
        
        // Load notes into playback controller
        this.playbackController.loadNotes(notesToPlay, (freq) => this.frequencyToNote(freq));
        
        // Set speed and volume
        this.playbackController.setSpeed(parseFloat(this.speedSelect.value));
        this.pianoSynthesizer.setVolume(parseFloat(this.volumeSlider.value) / 100);
        
        // Start playback
        this.playbackController.play();
        
        // Update UI state
        this.isPlaybackActive = true;
        this.playBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.stopPlaybackBtn.disabled = false;
    }
    
    /**
     * Handle pause button click
     */
    handlePause() {
        if (!this.playbackController) return;
        
        if (this.playbackController.isPlaying) {
            this.playbackController.pause();
            this.playBtn.disabled = false;
            this.pauseBtn.disabled = true;
            this.playBtn.textContent = '▶ Resume';
        }
    }
    
    /**
     * Handle stop button click
     */
    handleStopPlayback() {
        if (!this.playbackController) return;
        
        this.playbackController.stop();
        this.isPlaybackActive = false;
        this.playheadPosition = 0;
        
        // Update UI state
        this.playBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.stopPlaybackBtn.disabled = true;
        this.playBtn.textContent = '▶ Play';
        
        // Redraw to remove playhead
        this.draw();
    }
    
    /**
     * Handle speed selection change
     */
    handleSpeedChange(e) {
        const speed = parseFloat(e.target.value);
        if (this.playbackController) {
            this.playbackController.setSpeed(speed);
        }
    }
    
    /**
     * Handle volume slider change
     */
    handleVolumeChange(e) {
        const volume = parseFloat(e.target.value);
        this.volumeValue.textContent = `${volume}%`;
        
        if (this.pianoSynthesizer) {
            this.pianoSynthesizer.setVolume(volume / 100);
        }
    }
    
    /**
     * Handle mode selection change
     */
    handleModeChange(e) {
        // Mode change takes effect on next playback
        // If currently playing, restart with new mode
        if (this.playbackController && this.playbackController.isPlaying) {
            this.handleStopPlayback();
            // Auto-restart would be jarring, so just stop
        }
    }
    
    /**
     * Playhead update callback from PlaybackController
     */
    updatePlayheadCallback(time) {
        this.playheadPosition = time;
        this.draw(); // Redraw to show updated playhead
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
                
                // Enable playback controls
                if (this.playBtn) {
                    this.playBtn.disabled = false;
                }
                
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
        
        // Draw playhead if playback is active
        if (this.isPlaybackActive && this.playheadPosition > 0) {
            this.drawPlayhead(width, height);
        }
        
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
        
        // Draw playhead on notes canvas if playback is active
        if (this.isPlaybackActive && this.playheadPosition > 0) {
            this.drawPlayheadNotes(width, height);
        }
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
    
    /**
     * Draw playhead indicator on frequency canvas
     */
    drawPlayhead(width, height) {
        if (this.targetPitchData.length === 0) return;
        
        const maxTime = Math.max(...this.targetPitchData.map(p => p.time));
        const minTime = Math.min(...this.targetPitchData.map(p => p.time));
        const timeRange = maxTime - minTime || 1;
        
        // Calculate X position from playhead time
        const x = ((this.playheadPosition - minTime) / timeRange) * width;
        
        // Only draw if within visible bounds
        if (x >= 0 && x <= width) {
            this.ctx.save();
            this.ctx.strokeStyle = '#FFD700'; // Gold color
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.globalAlpha = 0.8;
            
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
            
            this.ctx.restore();
        }
    }
    
    /**
     * Draw playhead indicator on notes canvas
     */
    drawPlayheadNotes(width, height) {
        if (this.targetPitchData.length === 0) return;
        
        const maxTime = Math.max(...this.targetPitchData.map(p => p.time));
        const minTime = Math.min(...this.targetPitchData.map(p => p.time));
        const timeRange = maxTime - minTime || 1;
        
        // Calculate X position from playhead time
        const x = ((this.playheadPosition - minTime) / timeRange) * width;
        
        // Only draw if within visible bounds
        if (x >= 0 && x <= width) {
            this.notesCtx.save();
            this.notesCtx.strokeStyle = '#FFD700'; // Gold color
            this.notesCtx.lineWidth = 2;
            this.notesCtx.setLineDash([5, 5]);
            this.notesCtx.globalAlpha = 0.8;
            
            this.notesCtx.beginPath();
            this.notesCtx.moveTo(x, 0);
            this.notesCtx.lineTo(x, height);
            this.notesCtx.stroke();
            
            this.notesCtx.restore();
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PitchMatcher();
});
