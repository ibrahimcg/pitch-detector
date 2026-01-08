# Notes Plot Feature - Quick Reference Card

**Status:** Active Development  
**Priority:** High  
**Full Documentation:** [CONTEXT-NOTES-PLOT-FEATURE.md](./CONTEXT-NOTES-PLOT-FEATURE.md)

---

## 🎯 Quick Summary

Add a **Piano Roll visualization** (notes plot) alongside the existing frequency plot.

**What it does:**
- Displays musical notes (C4, D#5, etc.) instead of raw frequencies
- Piano-style Y-axis with octaves C2-C7
- Same pan/zoom controls as frequency plot
- Green bars = target notes (YouTube), Red bars = user notes (microphone)

---

## 📋 Implementation Checklist

### Phase 1: Canvas Setup (30 min)
- [ ] Add `notesCanvas` and `notesCtx` to constructor
- [ ] Setup dimensions (match frequency plot)
- [ ] Bind event listeners (wheel, mouse)
- [ ] Share `viewState` object

### Phase 2: Grid Rendering (45 min)
- [ ] Create `drawNotesGrid()` method
- [ ] Draw 60 semitone lines (C2 to C7)
- [ ] Add octave labels
- [ ] White keys solid, black keys dashed
- [ ] Sync time grid with frequency plot

### Phase 3: Note Drawing (60 min)
- [ ] Create `noteToY()` helper function
- [ ] Create `drawNotesPlot()` method
- [ ] Convert frequencies to notes
- [ ] Draw horizontal bars at note positions
- [ ] Handle both target and user data

### Phase 4: Synchronization (30 min)
- [ ] Update main `draw()` method
- [ ] Ensure pan/zoom affects both
- [ ] Add notes tooltip
- [ ] Test real-time microphone input

### Phase 5: Polish (30 min)
- [ ] Add CSS styles
- [ ] Test edge cases
- [ ] Cross-browser testing
- [ ] Code cleanup & documentation

**Total Time:** ~3 hours

---

## 🔧 Key Functions to Use

### Already Exists (DO NOT MODIFY)
```javascript
frequencyToNote(frequency)    // Line 430 - Converts Hz to note string
viewState                      // Lines 18-27 - Shared pan/zoom state
autoCorrelate(buffer, rate)   // Line 369 - Pitch detection
```

### To Create (NEW)
```javascript
noteToY(noteString, height)   // Maps "C4" → Y pixel position
drawNotesGrid(width, height)  // Renders piano-style grid
drawNotesPlot(data, color)    // Draws note bars/blocks
```

---

## 🎨 Design Specs

### Canvas
- **Dimensions:** Same as frequency plot (100% width × 400px height)
- **Background:** #1a1a2e (dark)
- **Location:** Already added to HTML (line 56)

### Colors
- **Target notes:** rgba(0, 255, 136, 0.8) - Green
- **User notes:** rgba(255, 107, 107, 0.8) - Red
- **Grid (white keys):** rgba(255, 255, 255, 0.15)
- **Grid (black keys):** rgba(255, 255, 255, 0.08)

### Y-Axis
- **Range:** C2 (65.41 Hz) to C7 (2093 Hz)
- **Total semitones:** 60
- **Grid spacing:** Even (12 semitones per octave)

### Note Bars
- **Width:** Represents duration
- **Height:** 6-8 pixels
- **Style:** Rounded caps, semi-transparent

---

## 📁 Files to Modify

| File | What to Change | LOC |
|------|---------------|-----|
| `frontend/app.js` | Add notes canvas logic | +208 |
| `frontend/style.css` | Add notes-specific styles | +10 |
| `frontend/index.html` | ✅ Already done | 0 |

**Total new code:** ~218 lines

---

## 🧪 Testing Checklist

### Functionality
- [ ] Empty data (no crash)
- [ ] Single note
- [ ] Rapid note changes
- [ ] Long duration (10+ min)
- [ ] Pan in all directions
- [ ] Zoom in/out (0.5× to 10×)
- [ ] Microphone start/stop

### Browsers
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### Performance
- [ ] 60 FPS maintained
- [ ] No lag during pan/zoom
- [ ] Real-time updates smooth

---

## 🚨 Critical Constraints

1. **DO NOT modify** existing `frequencyToNote()` function
2. **SHARE** the `viewState` object between canvases
3. **REUSE** existing event handlers where possible
4. **MAINTAIN** 60 FPS performance
5. **TEST** all browsers before completion

---

## 📊 Note Conversion Reference

| Note | Frequency (Hz) | MIDI # |
|------|----------------|--------|
| C2   | 65.41         | 36     |
| A4   | 440.00        | 69     |
| C7   | 2093.00       | 108    |

**Formula (already implemented):**
```
noteNum = 12 × log₂(frequency / 440) + 69
octave = floor(noteNum / 12) - 1
note = notes[round(noteNum) % 12]
```

---

## 💡 Implementation Tips

1. **Start simple:** Get a basic grid rendering first
2. **Test incrementally:** Don't wait until everything is done
3. **Use console.log:** Debug note positions and conversions
4. **Copy patterns:** Use `drawPitchCurve()` as reference
5. **Performance:** Only render visible notes (viewport culling)

---

## 🔗 Related Documents

- **Full Context:** [CONTEXT-NOTES-PLOT-FEATURE.md](./CONTEXT-NOTES-PLOT-FEATURE.md) (747 lines)
- **Project Status:** [PROJECT_STATUS.md](../PROJECT_STATUS.md)
- **Architecture:** [ADR-001-pitch-resampling.md](./ADR-001-pitch-resampling.md)
- **API Reference:** [backend/main.py](../backend/main.py)

---

## 🎯 Exit Criteria (Must Complete All)

✅ **Visual:** Both frequency and notes plots visible and functional  
✅ **Accuracy:** Notes accurately converted from frequency data  
✅ **Interaction:** Pan/zoom works on both canvases  
✅ **Real-time:** Microphone input updates both plots smoothly  
✅ **Quality:** Code reviewed, no console errors, well-documented  
✅ **Testing:** All browsers tested, performance validated  

---

**Last Updated:** January 8, 2026  
**For Questions:** See full context document

**Quick Start:**
```bash
# 1. Open in editor
code frontend/app.js frontend/style.css

# 2. Open in browser
open frontend/index.html

# 3. Start backend (if needed)
cd backend && python main.py
```
