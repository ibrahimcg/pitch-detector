# Context Document: Notes Plot Feature Implementation

**Document Type:** Feature Context & Requirements  
**Created:** January 8, 2026  
**Status:** Active Development  
**Priority:** High  
**Target Completion:** January 9, 2026  

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Current System State](#current-system-state)
3. [Feature Requirements](#feature-requirements)
4. [Technical Specifications](#technical-specifications)
5. [Architecture & Design](#architecture--design)
6. [Implementation Plan](#implementation-plan)
7. [Files Affected](#files-affected)
8. [Data Flow](#data-flow)
9. [Exit Criteria](#exit-criteria)
10. [Dependencies & Constraints](#dependencies--constraints)

---

## Project Overview

### Project Information
- **Project Name:** Pitch Detector Web Application
- **Location:** `/Users/ibrahim/Documents/CS/pitch-detector`
- **Repository:** Git-enabled
- **Platform:** macOS (darwin)
- **Tech Stack:**
  - Backend: Python 3.8+ (FastAPI, Librosa, yt-dlp)
  - Frontend: Vanilla JavaScript, HTML5 Canvas, Web Audio API

### Current Application State
The Pitch Detector is a working web application that:
- Extracts pitch contours from YouTube videos
- Displays frequency data on an interactive canvas with pan/zoom controls
- Captures real-time microphone input for pitch matching
- Shows target pitch (green) vs. user pitch (red) on a frequency plot
- Provides note detection and display
- Implements smooth pitch resampling (0.5s intervals, configurable)

**Production Status:** Production-ready for existing features (116/116 tests passing)

---

## Current System State

### Existing Frontend Components

#### HTML Structure (`frontend/index.html`)
```
Lines 1-71:
- Container with input section for YouTube URL
- Control buttons (process, start/stop microphone, zoom controls)
- Info panel (status, current note, time, zoom level)
- Canvas container for frequency plot (lines 49-53)
- Canvas container for notes plot (lines 55-59) ← ALREADY ADDED
- Legend for target/user pitch differentiation
```

**Key Elements:**
- `#pitchCanvas` - Frequency visualization (EXISTING, WORKING)
- `#notesCanvas` - Notes visualization (ADDED, NOT YET IMPLEMENTED)
- `#tooltip` - Frequency plot tooltip
- `#notesTooltip` - Notes plot tooltip (ADDED, NOT YET IMPLEMENTED)

#### JavaScript (`frontend/app.js`)
```
Lines 1-602:
Main PitchMatcher class with:
- API configuration (line 6)
- State management (targetPitchData, userPitchData, isRecording)
- View state for pan/zoom (lines 18-27)
- Canvas setup for frequency plot (lines 40-42)
- Event bindings for controls and mouse interactions
- Pitch detection using auto-correlation algorithm
- frequencyToNote() converter (line 430) ← REUSABLE FOR NOTES PLOT
- Drawing methods (draw, drawGrid, drawPitchCurve)
```

**Critical Existing Functions:**
1. `frequencyToNote(frequency)` (line 430) - Converts Hz to note format (e.g., "C4", "D#5")
2. `viewState` object (lines 18-27) - Manages pan/zoom state (offsetX, offsetY, zoom)
3. Pan/zoom handlers (lines 97-181) - Fully implemented, reusable
4. `autoCorrelate()` (line 369) - Real-time pitch detection from microphone
5. `draw()` method (line 446) - Main rendering loop

#### CSS (`frontend/style.css`)
```
Lines 1-248:
- Global styles and container layout
- Canvas styling (lines 152-162)
- Tooltip styling (lines 164-191)
- Legend styling (lines 193-230)
```

### Backend API

#### Endpoint: POST /api/extract-pitch
**Location:** `backend/main.py`

**Response Format:**
```json
{
  "status": "success",
  "pitch_data": [
    {"time": 0.0, "frequency": 440.0},
    {"time": 0.5, "frequency": 442.5},
    ...
  ],
  "duration": 120.5
}
```

**Features:**
- Pitch extraction from YouTube videos
- Median filtering (kernel_size=5)
- Fixed-time resampling (default 0.5s intervals, configurable 0.1-2.0s)
- Binary search algorithm (O(n log m) efficiency)
- Input validation and error handling

---

## Feature Requirements

### New Feature: Notes Plot (Piano Roll Visualization)

Add a second canvas that displays musical notes in a piano roll style, synchronized with the existing frequency plot.

### Functional Requirements

1. **Visual Display**
   - Second canvas element for note-only visualization (NO frequency values)
   - Piano roll style: Time on X-axis, Notes on Y-axis
   - Display notes as discrete steps (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
   - Each octave clearly marked with labels
   - Horizontal bars or blocks representing note durations

2. **Data Visualization**
   - Show target notes (from YouTube audio) in green
   - Show user notes (from microphone) in red
   - Visual differentiation between white keys (naturals) and black keys (sharps)
   - Clear octave boundaries

3. **Interaction**
   - Same pan/zoom controls as frequency plot
   - Mouse wheel zoom
   - Click-and-drag panning
   - Reset view button applies to both canvases
   - Tooltip showing note, time, and frequency on hover

4. **Synchronization**
   - Time axis synchronized with frequency plot
   - Same zoom level and pan offset on X-axis (time)
   - Independent Y-axis scaling (notes vs. frequency)
   - Real-time updates when recording from microphone

### Non-Functional Requirements

1. **Performance**
   - Smooth rendering at 60 FPS
   - Efficient note conversion (reuse existing frequencyToNote function)
   - No lag during pan/zoom operations

2. **Code Quality**
   - DRY principle: Share code between frequency and notes canvases
   - Maintainable architecture
   - Clear separation of concerns
   - Comprehensive inline comments

3. **Compatibility**
   - Works in all modern browsers (Chrome, Firefox, Safari, Edge)
   - Responsive design (adapts to different screen sizes)
   - No breaking changes to existing functionality

---

## Technical Specifications

### Notes Plot Canvas Specifications

#### Canvas Dimensions
- Width: 100% of container (same as frequency plot)
- Height: 400px (same as frequency plot)
- Background: #1a1a2e (dark background for contrast)

#### Y-Axis Mapping (Notes)
- Range: C2 to C7 (5 octaves, typical vocal range extended)
- Grid lines for each semitone (12 per octave)
- Octave labels on left side
- White key grid lines: Solid, thicker
- Black key grid lines: Dashed, thinner

#### X-Axis Mapping (Time)
- Same time range as frequency plot
- Synchronized with frequency plot viewState
- Grid lines at regular intervals (same as frequency plot)

#### Note Rendering
- Convert frequency to note using `frequencyToNote()`
- Draw horizontal bars/blocks at note positions
- Bar thickness: 4-8 pixels
- Bar color: 
  - Target (YouTube): rgba(0, 255, 136, 0.8) - semi-transparent green
  - User (mic): rgba(255, 107, 107, 0.8) - semi-transparent red
- Round caps for better aesthetics

#### Frequency to Note Conversion
Existing function (line 430 in app.js):
```javascript
frequencyToNote(frequency) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteNum = 12 * (Math.log2(frequency / 440)) + 69;
    const octave = Math.floor((noteNum + 0.0001) / 12) - 1;
    const note = notes[Math.round(noteNum + 0.0001) % 12];
    return `${note}${octave}`;
}
```

#### Note to Y-Position Mapping
```javascript
// Pseudo-code for note to Y position
noteToY(noteString, canvasHeight) {
    // Parse note string (e.g., "C#4")
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = parseInt(noteString.slice(-1));
    const noteName = noteString.slice(0, -1);
    const noteIndex = noteNames.indexOf(noteName);
    
    // Calculate semitone position (0 = C2, 60 = C7)
    const semitone = (octave - 2) * 12 + noteIndex;
    
    // Map to Y position (inverted: lower notes at bottom)
    const totalSemitones = 60; // C2 to C7
    return canvasHeight - (semitone / totalSemitones) * canvasHeight;
}
```

---

## Architecture & Design

### Design Decisions

1. **Shared View State**
   - Single `viewState` object controls both canvases
   - X-axis (time) pan/zoom synchronized
   - Y-axis (frequency vs. notes) independent scaling
   - Rationale: Maintains temporal alignment between views

2. **Color Scheme**
   - Target: #00ff88 (green) - consistent with existing design
   - User: #ff6b6b (red) - consistent with existing design
   - Grid: rgba(255, 255, 255, 0.1) - subtle, non-intrusive
   - Rationale: Visual consistency with existing interface

3. **Piano Roll Visualization**
   - Horizontal bars for note durations
   - Discrete note steps (no continuous curve)
   - Rationale: More intuitive for musicians, clearer pitch accuracy feedback

4. **Component Architecture**
   ```
   PitchMatcher (main class)
   ├── Frequency Plot Components
   │   ├── pitchCanvas (existing)
   │   ├── ctx (context, existing)
   │   ├── drawPitchCurve() (existing)
   │   └── tooltip (existing)
   └── Notes Plot Components (TO BE ADDED)
       ├── notesCanvas (element exists, needs setup)
       ├── notesCtx (context, to add)
       ├── drawNotesPlot() (to add)
       ├── drawNotesGrid() (to add)
       ├── noteToY() (to add)
       └── notesTooltip (element exists, needs handlers)
   ```

5. **Code Reuse Strategy**
   - Reuse: frequencyToNote(), viewState, event handlers
   - Extend: tooltip logic for notes-specific data
   - New: note-to-Y mapping, piano grid rendering, note bar drawing

### Data Flow

```
YouTube URL Input
    ↓
Backend API (/api/extract-pitch)
    ↓
pitch_data: [{time, frequency}, ...]
    ↓
Frontend: targetPitchData array
    ↓
┌─────────────────┬─────────────────┐
│ Frequency Plot  │   Notes Plot    │
│                 │                 │
│ frequency       │ frequency       │
│    ↓            │    ↓            │
│ frequencyToY()  │ frequencyToNote()│
│    ↓            │    ↓            │
│ Draw curve      │ noteToY()       │
│                 │    ↓            │
│                 │ Draw bars       │
└─────────────────┴─────────────────┘

Microphone Input
    ↓
autoCorrelate() → pitch detection
    ↓
userPitchData array: [{time, frequency}, ...]
    ↓
[Same split to both plots as above]
```

---

## Implementation Plan

### Phase 1: Setup Notes Canvas (Est. 30 min)

**Tasks:**
1. Add notesCanvas and notesCtx to constructor
2. Setup canvas dimensions and scaling
3. Add event listeners (wheel, mousedown, mousemove, mouseup, mouseleave)
4. Share viewState with frequency plot

**Code Location:** `frontend/app.js`, constructor section (lines 3-60)

**Acceptance Criteria:**
- notesCanvas renders with dark background
- Mouse interactions work (pan/zoom)
- viewState correctly affects both canvases

---

### Phase 2: Implement Note Grid (Est. 45 min)

**Tasks:**
1. Create `drawNotesGrid()` method
2. Draw horizontal lines for each semitone (C2 to C7)
3. Add octave labels on left side
4. Differentiate white keys (solid) vs black keys (dashed)
5. Draw vertical time grid (same as frequency plot)

**Code Location:** `frontend/app.js`, new method after `drawGrid()`

**Grid Specifications:**
- Semitone range: C2 (65.41 Hz) to C7 (2093 Hz)
- Total semitones: 60
- Line colors:
  - White keys: rgba(255, 255, 255, 0.15)
  - Black keys: rgba(255, 255, 255, 0.08)
- Octave labels: Font 14px, rgba(255, 255, 255, 0.6)

**Acceptance Criteria:**
- Piano-style grid visible with proper spacing
- Octave boundaries clearly marked
- Labels readable and correctly positioned
- Grid scales properly with zoom

---

### Phase 3: Implement Note Drawing (Est. 60 min)

**Tasks:**
1. Create `noteToY()` helper function
2. Create `drawNotesPlot()` method
3. Convert frequency data to notes
4. Draw horizontal bars at correct note positions
5. Handle both targetPitchData and userPitchData

**Code Location:** `frontend/app.js`, new methods

**Drawing Logic:**
```javascript
drawNotesPlot(pitchData, color, width, height) {
    for (const point of pitchData) {
        const note = frequencyToNote(point.frequency);
        const x = timeToX(point.time, width);
        const y = noteToY(note, height);
        
        // Draw bar/block
        ctx.fillStyle = color;
        ctx.fillRect(x - barWidth/2, y - barHeight/2, barWidth, barHeight);
    }
}
```

**Note Grouping:**
- Group consecutive points with same note into single bar
- Bar width = time duration * pixelsPerSecond
- Bar height = 6-8 pixels (fits within semitone grid spacing)

**Acceptance Criteria:**
- Notes display as horizontal bars at correct positions
- Target notes (green) and user notes (red) both visible
- No visual artifacts or overlaps
- Performance remains smooth (60 FPS)

---

### Phase 4: Synchronization & Interaction (Est. 30 min)

**Tasks:**
1. Update main `draw()` method to render both canvases
2. Ensure pan/zoom affects both views
3. Add notes-specific tooltip
4. Test real-time microphone input visualization

**Code Location:** 
- `frontend/app.js`, `draw()` method (line 446)
- Event handlers (lines 72-94)
- Tooltip logic (lines 187-247)

**Synchronization Points:**
- X-axis offset (viewState.offsetX) → shared
- X-axis zoom (viewState.zoom) → shared
- Time range → shared
- Y-axis → independent

**Acceptance Criteria:**
- Both canvases update simultaneously
- Pan/zoom controls affect time axis of both
- Tooltips work independently for each canvas
- Real-time updates work for both views

---

### Phase 5: Polish & Testing (Est. 30 min)

**Tasks:**
1. Add CSS styles for visual consistency
2. Test edge cases (empty data, single note, rapid changes)
3. Cross-browser testing
4. Performance optimization if needed
5. Code cleanup and documentation

**Test Cases:**
- Empty pitch data
- Single note/frequency
- Rapid note changes (chromatic scale)
- Long duration (10+ minutes)
- Extreme zoom in/out
- Pan to boundaries
- Microphone start/stop transitions

**Acceptance Criteria:**
- No console errors
- Smooth performance in all tested browsers
- Code passes review for quality and best practices
- All functionality documented

---

## Files Affected

### Primary Files

| File | Lines to Modify | Changes Required | Estimated LOC |
|------|----------------|------------------|---------------|
| `frontend/app.js` | Constructor (40-60) | Add notesCanvas setup | +15 |
| | After drawGrid (~540) | Add drawNotesGrid() | +80 |
| | After drawPitchCurve (~590) | Add drawNotesPlot() | +60 |
| | Before drawPitchCurve (~590) | Add noteToY() | +20 |
| | draw() method (446-476) | Call notes drawing methods | +5 |
| | Event handlers (72-94) | Bind to notesCanvas | +8 |
| | Tooltip (187-247) | Add notes tooltip logic | +20 |
| `frontend/style.css` | End of file (~248) | Add notes-specific styles | +10 |
| `frontend/index.html` | ✅ Already updated | Canvas elements added | 0 |

**Total Estimated New Code:** ~218 lines

### Supporting Files (Reference Only)

| File | Relevance | Notes |
|------|-----------|-------|
| `backend/main.py` | Data source | No changes needed |
| `PROJECT_STATUS.md` | Documentation | Update after completion |
| `README.md` | Documentation | Update feature list |
| `docs/ADR-001-pitch-resampling.md` | Reference | Architecture context |

---

## Data Flow

### Data Structures

#### Input: pitch_data (from API)
```javascript
[
    { time: 0.0, frequency: 440.0 },    // A4
    { time: 0.5, frequency: 493.88 },   // B4
    { time: 1.0, frequency: 523.25 },   // C5
    ...
]
```

#### Intermediate: Note conversion
```javascript
// Using frequencyToNote()
440.0 Hz → "A4"
493.88 Hz → "B4"
523.25 Hz → "C5"
```

#### Output: Canvas rendering
```javascript
// Using noteToY()
"A4" → Y position 250 (example)
"B4" → Y position 235
"C5" → Y position 220
```

### State Management

#### Shared State (Both Canvases)
- `targetPitchData[]` - YouTube pitch data
- `userPitchData[]` - Microphone pitch data
- `viewState.offsetX` - Horizontal pan
- `viewState.zoom` - Zoom level
- `isRecording` - Microphone active status

#### Notes Canvas Specific State
- `notesCanvas` - Canvas element
- `notesCtx` - 2D rendering context
- `notesTooltipData` - Tooltip state for notes plot
- Y-axis range: C2 to C7 (fixed)

---

## Exit Criteria

### Feature Complete Checklist

- [ ] **Canvas Setup**
  - [ ] notesCanvas element functional
  - [ ] Context initialized
  - [ ] Dimensions match frequency plot
  - [ ] Background renders correctly

- [ ] **Grid Rendering**
  - [ ] Piano-style grid visible
  - [ ] White key lines solid
  - [ ] Black key lines dashed
  - [ ] Octave labels displayed
  - [ ] Time grid synchronized

- [ ] **Note Visualization**
  - [ ] Target notes display in green
  - [ ] User notes display in red
  - [ ] Note positions accurate
  - [ ] Bar widths represent duration
  - [ ] No visual artifacts

- [ ] **Interaction**
  - [ ] Pan works on both canvases
  - [ ] Zoom works on both canvases
  - [ ] Tooltip shows note, time, frequency
  - [ ] Reset view affects both canvases
  - [ ] Mouse controls responsive

- [ ] **Real-time Updates**
  - [ ] Microphone input updates notes plot
  - [ ] Performance remains smooth (60 FPS)
  - [ ] No lag or stuttering

- [ ] **Code Quality**
  - [ ] No console errors
  - [ ] Code properly commented
  - [ ] Functions well-named and organized
  - [ ] No duplicate logic
  - [ ] Follows existing code style

- [ ] **Cross-browser Testing**
  - [ ] Chrome: Working
  - [ ] Firefox: Working
  - [ ] Safari: Working
  - [ ] Edge: Working

- [ ] **Documentation**
  - [ ] Inline code comments added
  - [ ] PROJECT_STATUS.md updated
  - [ ] README.md updated
  - [ ] This context document marked complete

---

## Dependencies & Constraints

### Technical Dependencies

1. **Existing Functions (DO NOT MODIFY)**
   - `frequencyToNote()` - Note conversion (line 430)
   - `autoCorrelate()` - Pitch detection (line 369)
   - Pan/zoom event handlers (lines 97-181)
   - `viewState` object structure (lines 18-27)

2. **External Libraries**
   - None required (vanilla JavaScript)
   - HTML5 Canvas API (built-in)

3. **Browser APIs**
   - Web Audio API (already in use)
   - Canvas 2D Context (already in use)
   - RequestAnimationFrame (already in use)

### Constraints

1. **Performance**
   - Must maintain 60 FPS during rendering
   - Max pitch points: 100,000 (backend limit)
   - Real-time latency: < 50ms

2. **Compatibility**
   - No ES6+ features not supported in Safari
   - No experimental canvas features
   - Must work without polyfills

3. **Design**
   - Must match existing visual style
   - Colors consistent with current theme
   - No breaking changes to existing UI

4. **Data**
   - Input data format cannot change (backend constraint)
   - Note range limited to C2-C7 (practical vocal range)
   - Time precision: 0.5s intervals (backend default)

### Assumptions

1. Users will primarily view 2-5 minute audio clips
2. Vocal range typically falls within C2-C7
3. Users are familiar with musical note notation
4. Modern browser with Canvas 2D support
5. Screen width ≥ 768px for optimal viewing

### Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Performance degradation with long audio | High | Medium | Implement viewport culling (only render visible notes) |
| Note conversion accuracy | Medium | Low | Use existing tested frequencyToNote() function |
| Cross-browser rendering differences | Medium | Low | Test early and often, use standard Canvas APIs |
| Synchronization drift between canvases | High | Low | Share viewState object, update in single draw() call |
| Tooltip overlap between canvases | Low | Medium | Use separate tooltip elements (#tooltip, #notesTooltip) |

---

## Reference Information

### Key File Locations

```
pitch-detector/
├── frontend/
│   ├── app.js              ← PRIMARY: Main logic (602 lines)
│   ├── index.html          ← UPDATED: Canvas elements added
│   ├── style.css           ← UPDATE: Add notes styles
│   └── tests/
│       └── test_interactive.py
├── backend/
│   ├── main.py             ← REFERENCE: API endpoint
│   └── tests/
│       ├── test_api.py
│       └── test_smoothing.py
├── docs/
│   ├── ADR-001-pitch-resampling.md
│   ├── CONTEXT-NOTES-PLOT-FEATURE.md  ← THIS FILE
│   └── QA_VALIDATION_REPORT.md
├── PROJECT_STATUS.md       ← UPDATE: After completion
├── README.md               ← UPDATE: After completion
└── start.sh
```

### Existing Codebase Statistics

- **Backend Tests:** 116/116 passing (100%)
- **Production Ready:** Yes (for existing features)
- **Total Frontend LOC:** ~850 lines (HTML + CSS + JS)
- **API Latency:** < 50ms (typical)
- **Data Reduction:** 43× (86 pts/sec → 2 pts/sec)

### Recent Development History

```
33948d5 - update project status
2436e6f - Add fixed-time pitch sampling with comprehensive validation
5280a31 - Add median filtering and comprehensive test suite
62e40a2 - Add median filtering for smoother pitch detection
07af8c9 - Initial commit: Pitch Matcher web app
```

### Contact & Resources

- **Project Location:** /Users/ibrahim/Documents/CS/pitch-detector
- **Git Branch:** main (assumed)
- **Backend URL:** http://localhost:8000
- **Frontend URL:** http://localhost:3000
- **Platform:** macOS (darwin)

---

## Context Document Metadata

- **Version:** 1.0
- **Last Updated:** January 8, 2026
- **Document Owner:** Context Manager Agent
- **Review Status:** Active Development
- **Next Review:** January 9, 2026 (post-implementation)

---

## Agent Coordination Notes

### For Frontend Developers
- Focus on `frontend/app.js` modifications
- Reuse existing functions where possible
- Test in browser console before committing
- Maintain existing code style and patterns

### For QA/Testing Agents
- Test all browsers (Chrome, Firefox, Safari, Edge)
- Verify performance with long audio files
- Check edge cases (empty data, single note)
- Validate visual accuracy of note positions

### For Documentation Agents
- Update PROJECT_STATUS.md when tasks complete
- Add feature to README.md after validation
- Mark this context document complete
- Create screenshots for documentation

### For Code Review Agents
- Check for code duplication
- Verify proper error handling
- Ensure accessibility (keyboard navigation)
- Validate performance optimizations

---

**END OF CONTEXT DOCUMENT**

This document serves as the single source of truth for the Notes Plot feature implementation. All agents working on this feature should reference this document for requirements, technical specifications, and coordination.
