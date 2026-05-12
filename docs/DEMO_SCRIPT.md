# Demo Script — HomePlan (7-minute walkthrough)

## Setup (before demo)
- Log in to homeplan.datatrav.com as `wade`
- Have a 2-floor PDF floor plan ready (letter size, clear room labels)
- Have the Projects list empty (or one existing project for continuity)

---

## 1. Create a Project (1 min)

1. Click **+ New Project**
2. Fill in:
   - Client Name: `Meadow Lane`
   - Address: `1234 Meadow Lane, Franklin, TN`
   - Total Sq Ft: `5200`
   - Number of Floors: `3`
   - Construction Type: `New Build`
   - Wall Material: `Drywall`
3. Click **Create Project** → lands on Project Detail

*Talk track: "Each project captures the construction context — wall material matters a lot for our AI recommendations, since signal attenuation through concrete is dramatically different than drywall."*

---

## 2. Upload Floor Plans (1 min)

1. Set Floor Number to `1`, type `floor`
2. Drag & drop the 2-page PDF
3. Watch the "Uploading and rasterizing…" spinner
4. Two plans appear: Floor 1 and Floor 2, both uncalibrated
5. Click **Open Canvas Workspace**

*Talk track: "The server rasterizes each PDF page to a normalized PNG at 150 DPI. Multi-page PDFs automatically become separate floor plans."*

---

## 3. Calibrate Scale (1 min)

1. In the canvas, click **Calibrate Scale**
2. Click one end of a known dimension (e.g., a room that's 20 ft wide)
3. Click the other end
4. Enter `20` feet → **Set Scale**
5. Sidebar shows "Calibrated: X.XX px/ft"
6. Switch to Floor 2 using the floor switcher, repeat calibration

*Talk track: "Scale calibration is how the AI knows the difference between a closet and a great room. Cable run estimates depend on accurate scale."*

---

## 4. Place a Rack / IDF (30 sec)

1. Click **+ Rack**
2. Click the mechanical room or utility room on the floor plan
3. Rack appears labeled `IDF-1`

*Talk track: "The IDF location anchors all cable run calculations. The AI will prioritize shorter runs to this point when placing APs."*

---

## 5. AI AP Proposal (1.5 min)

1. Click **Propose APs** → loading overlay appears
2. Wait ~15-20 seconds
3. AI-drafted APs appear on both floors (dashed circles = AI draft)
4. Click one AP → sidebar shows AI rationale
5. Point out: coverage circles, dashed vs solid, rationale text

*Talk track: "The AI analyzed both floor plan images simultaneously, along with the wall material, square footage, and rack location. Each AP has a rationale — you can read the AI's reasoning before accepting."*

---

## 6. Refine Placements (1 min)

1. Drag one AP to a better position → watch it save automatically
2. Click an AP → click **Confirm AP** → circle turns solid green
3. Delete one AI AP that's redundant
4. Add one manual AP with **+ AP** button

*Talk track: "Planners are in control. AI proposals are starting points — you drag to adjust, confirm what's right, and delete what isn't. Cable run estimates update in real-time as you reposition."*

---

## 7. Generate Handoff Package (1 min)

1. Confirm 3-4 more APs quickly
2. Click **Generate Handoff Package** → spinner (30 sec)
3. Three download buttons appear
4. Click each:
   - **Annotated PDF** — open in browser, show markers on plan
   - **BOM CSV** — show in spreadsheet, point to totals row
   - **Contractor Summary PDF** — show AI narrative, installation standards

*Talk track: "One click produces everything the contractor needs: the marked-up plan, a complete materials list with cable footage, and a custom installation guide written by AI based on this specific project."*

---

## Key Numbers to Mention
- ~15 minutes to go from uploaded plan to contractor-ready package
- AI considers wall material, square footage, IDF proximity, room function
- BOM includes CAT6 boxes, keystone count — no spreadsheet math needed
- All data persists — reopen project anytime to refine

---

## Fallback if AI is slow
If Bedrock takes >45 seconds, note: "In production this is faster — I'll manually place a few APs to show the same workflow." Use **+ AP** button to place manually.
