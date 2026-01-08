# Context: Piano Audio Playback Feature

**Status**: Planning Phase  
**Created**: 2026-01-08  
**Last Updated**: 2026-01-08  
**Feature Owner**: User Request  
**Priority**: High

---

## Executive Summary

Add piano sound playback capability to the pitch-detector application, allowing users to hear both the target melody (from YouTube) and their recorded performance as piano sounds with visual playback indicators.

---

## Project Context

### Current State
- **Project**: Pitch Detector Web Application
- **Location**: `/Users/ibrahim/Documents/CS/pitch-detector`
- **Latest Commit**: `f02ecf6` - Notes plot (piano roll) visualization completed
- **Git Status**: Working tree clean, 1 commit ahead of origin/master
- **Recent Completion**: Notes visualization feature with dual piano roll display

### Technology Stack
- **Frontend**: Vanilla JavaScript (ES6+)
- **Backend**: Python FastAPI
- **Audio Processing**: Currently pitch detection only
- **Visualization**: HTML5 Canvas

---

## Feature Requirements

### Functional Requirements

#### 1. Audio Playback
- **FR-1.1**: Play target notes from YouTube audio extraction as piano sounds
- **FR-1.2**: Play user's recorded microphone notes as piano sounds
- **FR-1.3**: Support playing target only, user only, or both simultaneously

#### 2. Playback Controls
- **FR-2.1**: Play button to start playback from current position or beginning
- **FR-2.2**: Stop button to stop playback and return to beginning
- **FR-2.3**: Pause/Resume functionality to pause and continue from same position
- **FR-2.4**: Speed control with presets: 0.5x, 1x, 1.5x, 2x

#### 3. Visual Feedback
- **FR-3.1**: Animated playhead indicator moving across both plots during playback
- **FR-3.2**: Highlight current note being played
- **FR-3.3**: Display current playback time and note name
- **FR-3.4**: Sync visual indicators with audio playback

#### 4. Audio Options
- **FR-4.1**: Volume control slider (0-100%)
- **FR-4.2**: Mute toggle option
- **FR-4.3**: Mode selector: Target only / User only / Both

---

## Technical Requirements

### Audio Synthesis Architecture

#### Selected Approach: Web Audio API (Option 1 - Recommended)
**Rationale**: 
- Lightweight with no external dependencies
- Works offline
- Good enough quality for MVP
- No asset management overhead

**Implementation Details**:
- Use `OscillatorNode` for tone generation
- Implement ADSR envelope for realistic piano sound
- Support polyphony (multiple simultaneous notes)

#### Alternative Options (Future Enhancement)
- **Option 2**: Pre-recorded piano samples (5-10MB, higher quality)
- **Option 3**: Tone.js library (~100KB, easier API)

### Core Components

#### 1. PianoSynthesizer Class
**Responsibility**: Audio generation and note synthesis

**Methods**:
```javascript
class PianoSynthesizer {
    constructor(audioContext)
    noteToFrequency(noteName)     // Convert "C4" → 261.63 Hz
    playNote(frequency, duration)  // Generate piano tone
    stopNote(noteId)               // Stop specific note
    setVolume(level)               // 0.0 to 1.0
    mute(enabled)                  // Toggle mute
}
```

**Audio Envelope (ADSR)**:
- Attack: 0.01s (quick onset)
- Decay: 0.1s (natural decay)
- Sustain: 0.7 (70% volume)
- Release: 0.3s (gradual fade)

#### 2. PlaybackController Class
**Responsibility**: Playback timing and control

**Methods**:
```javascript
class PlaybackController {
    constructor(synthesizer, noteSequence)
    play()                         // Start playback
    pause()                        // Pause playback
    stop()                         // Stop and reset
    setSpeed(multiplier)           // 0.5x to 2x
    setMode(mode)                  // 'target', 'user', 'both'
    getCurrentTime()               // Get playback position
    seek(time)                     // Jump to time position
}
```

**Timing Strategy**:
- Use `AudioContext.currentTime` for precise scheduling
- Schedule notes 100ms ahead of playhead
- Update playhead every 16ms (60 FPS)
- Cancel scheduled notes on stop/pause

#### 3. UI Integration
**Location**: Extend `PitchMatcher` class in `app.js`

**New Methods**:
```javascript
// In PitchMatcher class
initializePlayback()               // Setup audio components
drawPlayhead(time)                 // Render playhead indicator
updatePlaybackUI()                 // Update time/note display
preprocessNotes()                  // Convert pitch data to note sequence
```

---

## Implementation Details

### Note Frequency Calculation

```javascript
function noteToFrequency(noteName) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = noteName.match(/^([A-G]#?)(\d+)$/);
    if (!match) return 440; // Default to A4
    
    const [_, note, octave] = match;
    const noteIndex = notes.indexOf(note);
    const semitone = noteIndex + (parseInt(octave) + 1) * 12;
    
    return 440 * Math.pow(2, (semitone - 69) / 12);
}
```

**Note**: Reverse of existing `frequencyToNote()` function

### Data Processing Pipeline

1. **Extract Note Sequences**:
   ```javascript
   // Input: pitchData = [{time: 0.5, frequency: 261.63, note: "C4"}, ...]
   // Output: noteSequence = [{note: "C4", startTime: 0.5, duration: 0.3}, ...]
   ```

2. **Group Consecutive Same Notes**:
   - Merge adjacent points with same note into single note event
   - Calculate duration from time differences
   - Minimum note duration: 50ms

3. **Handle Silence**:
   - Skip time periods with no detected pitch
   - Maintain timing accuracy for gaps

### Playback Timing

```javascript
// Precise scheduling algorithm
function scheduleNote(note, playbackTime, speed) {
    const scheduleTime = audioContext.currentTime + (note.startTime - playbackTime) / speed;
    const duration = note.duration / speed;
    
    if (scheduleTime > audioContext.currentTime) {
        synthesizer.playNote(note.frequency, duration, scheduleTime);
    }
}
```

---

## File Modifications

### 1. `frontend/app.js`
**Changes**:
- Add `PianoSynthesizer` class (250 lines)
- Add `PlaybackController` class (300 lines)
- Extend `PitchMatcher` with playback methods (150 lines)
- Update `draw()` to render playhead (50 lines)
- Add event listeners for playback controls (100 lines)

**Estimated Addition**: ~850 lines

### 2. `frontend/index.html`
**Changes**:
- Add playback control panel section
- Add play/pause/stop buttons with icons
- Add speed selector dropdown
- Add volume slider
- Add mode toggle radio buttons
- Add playback time display

**Estimated Addition**: ~80 lines

### 3. `frontend/style.css`
**Changes**:
- Style playback control panel
- Style playback buttons (hover, active states)
- Style playhead indicator
- Add responsive layout rules
- Add animation keyframes for playhead

**Estimated Addition**: ~150 lines

### 4. `frontend/piano.js` (Optional - Future)
**Purpose**: Modular separation of piano synthesis logic
**Status**: Deferred to future refactoring
**Rationale**: Keep changes in single file for simpler initial implementation

---

## UI Design Specification

### Playback Control Panel Layout

```
┌─────────────────────────────────────────────────────────────┐
│  PLAYBACK CONTROLS                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [▶ Play] [⏸ Pause] [⏹ Stop]  Speed: [1x ▼]        │   │
│  │                                                      │   │
│  │ Mode:  ( ) Target  ( ) User  (●) Both              │   │
│  │                                                      │   │
│  │ Volume: ▰▰▰▰▰▰▰▰▰▱ 90%  [🔊]                       │   │
│  │                                                      │   │
│  │ Time: 00:12.5 / 01:45.0  Note: C4                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Placement**: Below canvas elements, above any footer

### Playhead Indicator Specification

**Visual Properties**:
- Shape: Vertical line spanning canvas height
- Color: `#FFD700` (gold/yellow)
- Width: 2px
- Style: Dashed (`setLineDash([5, 5])`)
- Z-index: Above notes, below UI overlays

**Animation**:
- Update rate: 60 FPS (every 16ms)
- Movement: Smooth linear interpolation
- Sync: Locked to `AudioContext.currentTime`

**Behavior**:
- Appears only during playback
- Disappears when stopped
- Frozen when paused
- Visible on both canvases simultaneously

### Button States

**Normal**: Light gray background, dark text  
**Hover**: Darker gray background, scale 1.05  
**Active/Playing**: Blue background, white text  
**Disabled**: 50% opacity, no hover effect  

---

## Performance Requirements

### Benchmarks
- **Playback Start Latency**: < 100ms from button click
- **Frame Rate**: Maintain 60 FPS during playback + visualization
- **Memory Usage**: No memory leaks during repeated play/stop cycles
- **Concurrent Notes**: Support up to 10 simultaneous notes without distortion
- **Audio Quality**: No clicks, pops, or glitches between notes

### Optimization Strategies

1. **Pre-processing**:
   - Convert pitch data to note sequence once before playback
   - Cache frequency calculations
   - Build note lookup tables

2. **Audio Node Management**:
   - Reuse gain nodes where possible
   - Properly disconnect and garbage collect finished nodes
   - Pool oscillator nodes for frequently played notes

3. **Scheduling Efficiency**:
   - Schedule notes in batches (100ms windows)
   - Cancel only necessary notes on stop/pause
   - Use single timer for playhead updates

4. **Rendering Optimization**:
   - Only redraw playhead region (not full canvas)
   - Use `requestAnimationFrame` for smooth animation
   - Skip rendering if canvas not visible

---

## Edge Cases & Error Handling

### Edge Cases

| Case | Behavior |
|------|----------|
| No pitch data loaded | Disable play button, show "No data" tooltip |
| Very short notes (< 50ms) | Enforce minimum 50ms duration |
| Rapid chromatic runs | Limit to 20 notes/second, merge if needed |
| Long audio (> 10 min) | Stream processing, don't load all at once |
| User microphone silence | Skip silent periods, maintain timing |
| Speed change during play | Recalculate scheduled notes from current position |
| Audio context suspended | Resume context before playing, show error if fails |
| Multiple rapid play clicks | Debounce button, prevent overlapping playback |

### Error Handling

```javascript
try {
    await audioContext.resume();
    playbackController.play();
} catch (error) {
    console.error('Playback failed:', error);
    alert('Unable to play audio. Please check browser permissions.');
    // Reset UI to stopped state
}
```

**Error Scenarios**:
1. Web Audio API not supported → Show browser upgrade message
2. Audio context creation fails → Fallback to silent mode (visual only)
3. Invalid note data → Skip malformed notes, log warning
4. Out of memory → Stop playback, clear buffers, retry with lower quality

---

## Browser Compatibility

### Supported Browsers
- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ⚠️ (requires user gesture to start AudioContext)
- Edge 90+ ✅

### Known Browser Quirks

**Safari**:
- AudioContext must be created after user interaction
- Requires `audioContext.resume()` in click handler
- May have stricter autoplay policies

**Firefox**:
- Slightly different ADSR behavior
- Test envelope timing carefully

**Chrome**:
- Reference implementation
- Most predictable Web Audio behavior

### Polyfills/Fallbacks
- None required for target browsers
- Graceful degradation: Show "Unsupported browser" message for IE11 and below

---

## Testing Requirements

### Unit Tests
- ✅ Note to frequency conversion accuracy
- ✅ Frequency to note conversion (existing)
- ✅ ADSR envelope generation
- ✅ Note sequence preprocessing
- ✅ Playback speed calculations
- ✅ Volume level conversions

### Integration Tests
- ✅ Play/pause/stop state transitions
- ✅ Speed change during playback
- ✅ Mode switching (target/user/both)
- ✅ Volume and mute controls
- ✅ Playhead synchronization with audio
- ✅ Multiple playback cycles

### Manual Testing Checklist
- [ ] Play target notes - sounds like piano
- [ ] Play user notes - sounds like piano
- [ ] Play both simultaneously - no distortion
- [ ] Pause and resume - continues from correct position
- [ ] Stop - returns to beginning
- [ ] Speed 0.5x - tempo slowed, pitch unchanged
- [ ] Speed 2x - tempo increased, pitch unchanged
- [ ] Volume control - smooth level changes
- [ ] Mute toggle - instant silence/restore
- [ ] Playhead moves smoothly at 60 FPS
- [ ] No audio clicks or pops
- [ ] No memory leaks after 10+ play cycles
- [ ] Works on mobile Chrome/Safari
- [ ] Works with 10+ minute audio

### Performance Testing
- Measure frame rate during playback (target: 60 FPS)
- Measure playback latency (target: < 100ms)
- Profile memory usage over 30 minutes
- Test with varying audio lengths (1s to 30min)
- Test with dense note sequences (20 notes/sec)

---

## Exit Criteria

### Feature Completeness
- ✅ Target notes playback implemented
- ✅ User notes playback implemented
- ✅ Both simultaneous playback implemented
- ✅ Play/pause/stop controls functional
- ✅ Speed control functional (0.5x, 1x, 1.5x, 2x)
- ✅ Volume control functional
- ✅ Mute toggle functional
- ✅ Mode selector functional (target/user/both)
- ✅ Playhead indicator animated
- ✅ Current time and note display updated

### Quality Gates
- ✅ No audio distortion or glitches
- ✅ Performance maintains 60 FPS
- ✅ Code passes linting (existing standards)
- ✅ No console errors or warnings
- ✅ Cross-browser testing completed
- ✅ Manual testing checklist 100% passed
- ✅ No memory leaks detected
- ✅ Accessibility: Keyboard controls work
- ✅ Documentation updated (README)
- ✅ Code review completed and approved

### User Acceptance
- ✅ Piano sound quality acceptable
- ✅ Controls intuitive and responsive
- ✅ Visual feedback clear and helpful
- ✅ Performance smooth on target hardware
- ✅ Feature meets all user stories

---

## User Stories

### US-1: Learn Target Melody
**As a musician**  
**I want to** hear the target melody as piano sounds  
**So that** I can learn it by ear before attempting to sing/play it

**Acceptance Criteria**:
- Play button starts target melody playback
- Piano tone quality is clear and recognizable
- Speed control allows slowing down for learning
- Playhead shows current position in melody

### US-2: Review Performance
**As a singer**  
**I want to** hear my recorded performance as piano sounds  
**So that** I can evaluate my pitch accuracy objectively

**Acceptance Criteria**:
- Can play back only user recording
- Pitch errors are audible in playback
- Can compare side-by-side with target melody
- Volume control allows focusing on user notes

### US-3: Practice Difficult Passages
**As a student**  
**I want to** slow down playback to 0.5x speed  
**So that** I can practice difficult passages at my own pace

**Acceptance Criteria**:
- Speed selector offers 0.5x option
- Pitch remains unchanged when speed is reduced
- Can change speed during playback
- Visual playhead moves at correct reduced speed

### US-4: Compare Performances
**As a teacher**  
**I want to** play target and user recordings simultaneously  
**So that** I can identify specific pitch discrepancies

**Acceptance Criteria**:
- "Both" mode plays target and user together
- Can distinguish between the two audio sources
- No audio distortion when playing both
- Visual indicators show both note sequences

---

## Dependencies

### External Dependencies
- **Web Audio API**: Built into modern browsers (no npm package needed)
- **Browser Support**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

### Internal Dependencies
- **Existing Functions**:
  - `frequencyToNote(frequency)` - Already implemented
  - `pitchData` array structure - Already defined
  - Canvas rendering pipeline - Already established
  
- **Existing Code Integration**:
  - Must not break existing pitch detection
  - Must not interfere with recording functionality
  - Must coordinate with existing visualization

### Data Dependencies
- **Target Notes**: `this.targetPitchData` array
- **User Notes**: `this.userPitchData` array
- **Time Synchronization**: Both arrays must have aligned timestamps

---

## Constraints

### Technical Constraints
- **File Size**: Total JavaScript increase must be < 50KB
- **Browser Support**: Must work in last 2 versions of major browsers
- **Latency**: Playback start must be < 100ms after button click
- **Memory**: No memory leaks, max 100MB heap increase during playback
- **Offline**: Must work without internet connection (no CDN dependencies)

### Design Constraints
- **Consistency**: UI must match existing application style
- **Accessibility**: Controls must be keyboard accessible
- **Responsiveness**: Must work on desktop and tablet (mobile playback optional)
- **Performance**: Cannot degrade pitch detection or visualization performance

### Business Constraints
- **Timeline**: Feature should be completed within reasonable timeframe
- **Quality**: Must meet same code quality standards as existing features
- **Maintainability**: Code must be well-documented and testable

---

## Risk Assessment

### Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Safari Web Audio compatibility issues | Medium | High | Test early on Safari, implement user gesture handling |
| Timing drift over long playback | Medium | Medium | Use AudioContext.currentTime, not Date.now() |
| Performance degradation with many notes | Low | High | Limit concurrent notes to 10, optimize scheduling |
| Piano synthesis sounds unrealistic | High | Low | Acceptable for MVP, document upgrade path to samples |
| Memory leaks from audio nodes | Medium | High | Implement proper cleanup, test extensively |
| User confusion with controls | Low | Medium | Follow standard media player conventions |

### Contingency Plans

1. **If Web Audio API fails**: Fall back to silent mode with visual-only playback
2. **If performance is poor**: Reduce note density, simplify envelope
3. **If timing is inaccurate**: Switch to simpler scheduling algorithm
4. **If piano quality is unacceptable**: Integrate pre-recorded samples (requires additional work)

---

## Related Documentation

### Internal Docs
- `docs/CONTEXT-NOTES-PLOT-FEATURE.md` - Previous feature context (piano roll visualization)
- `docs/NOTES-PLOT-QUICK-REFERENCE.md` - Implementation reference for notes plot
- `docs/ADR-001-pitch-resampling.md` - Architecture decision on pitch data processing
- `README.md` - Project overview and setup instructions

### External References
- [Web Audio API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [OscillatorNode Reference](https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode)
- [AudioContext Timing](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/currentTime)
- [Piano Frequency Chart](https://en.wikipedia.org/wiki/Piano_key_frequencies)

### Code References
- `frequencyToNote()` in `app.js` - Existing frequency to note conversion
- `draw()` method in `PitchMatcher` class - Canvas rendering pipeline
- `pitchData` structure - Time-series pitch data format

---

## Implementation Phases

### Phase 1: Core Audio Engine (MVP)
**Deliverables**:
- PianoSynthesizer class with basic tone generation
- PlaybackController with play/pause/stop
- Basic UI with play/stop buttons
- Playhead visualization

**Estimate**: 1-2 days

### Phase 2: Enhanced Controls
**Deliverables**:
- Speed control (0.5x to 2x)
- Mode selector (target/user/both)
- Volume and mute controls
- Improved piano envelope (ADSR)

**Estimate**: 1 day

### Phase 3: Polish & Testing
**Deliverables**:
- Cross-browser testing and fixes
- Performance optimization
- Edge case handling
- Documentation updates
- Code review and refinement

**Estimate**: 1 day

### Future Enhancements (Post-MVP)
- Pre-recorded piano samples for better quality
- Visual note highlighting during playback
- Loop playback mode
- Export audio to file
- MIDI file import/export
- Reverb and effects

---

## Success Metrics

### Quantitative Metrics
- Playback latency: < 100ms ✅
- Frame rate during playback: 60 FPS ✅
- Maximum concurrent notes: 10+ ✅
- File size increase: < 50KB ✅
- Memory usage: < 100MB increase ✅
- Browser compatibility: 95%+ of users ✅

### Qualitative Metrics
- User feedback: "Piano sounds realistic enough"
- Developer feedback: "Code is maintainable and well-structured"
- No regression in existing features
- Feature is intuitive without documentation

---

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-08 | Context Manager | Initial context document created |

---

## Approval & Sign-off

**Feature Specification**: Ready for Implementation  
**Technical Design**: Approved  
**Risk Assessment**: Reviewed  
**Timeline**: Estimated 3-4 days total  

**Next Steps**:
1. Create feature branch: `feature/piano-audio-playback`
2. Begin Phase 1 implementation
3. Daily progress updates in this document
4. Code review after Phase 2 completion

---

**Document Version**: 1.0  
**Status**: ACTIVE - Ready for Development  
**Review Date**: 2026-01-15 (1 week review cycle)
