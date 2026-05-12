# AI Prompt Design — HomePlan

## Overview

HomePlan uses Bedrock (Claude Sonnet 4.5) for two AI calls:

1. **Vision AP Proposal** — analyzes floor plan images and proposes WiFi AP placements
2. **Contractor Summary** — generates a 2-page text narrative for the handoff package

Both calls are driven from `backend/services/bedrock.py`. The vision prompt is tunable via `config/ai_prompt.json`.

## `config/ai_prompt.json` Schema

```json
{
  "system_prompt": "String — system-level instruction for the model",
  "rules_of_thumb": ["Array of placement heuristics injected into context"],
  "output_schema": { "floors": [...] }
}
```

### Tuning `system_prompt`

The system prompt sets the model's persona and constraints. Key elements:
- Domain expertise framing ("high-end residential WiFi planning assistant")
- Construction material knowledge
- Mandate to return ONLY valid JSON

### Tuning `rules_of_thumb`

These are injected into the user message as context. Add/remove rules to adjust model behavior:
- Coverage radius assumptions
- Ceiling vs wall mount preferences
- Room-type-specific recommendations
- Separation distances to avoid co-channel interference

### Output Schema

The model is instructed to return JSON matching this schema:
```json
{
  "floors": [
    {
      "floor_number": "1",
      "aps": [
        {
          "x": 320,
          "y": 480,
          "mount_type": "ceiling",
          "coverage_radius_ft": 22,
          "recommended_model": "Ruckus R650",
          "rationale": "Placed center of great room for omnidirectional coverage."
        }
      ]
    }
  ]
}
```

Coordinates are pixel positions on the rendered PNG (150 DPI).

## Vision Call Context

Beyond the floor plan images, the model receives:
- `project.total_sqft`, `wall_material`, `construction_type`
- `floors[]` — floor number, plan_id, scale_ppf, image_index
- `racks[]` — rack positions (x, y, label, plan_id) for proximity-to-IDF context
- `rules_of_thumb` from config

## Contractor Summary Call

Text-only call, no vision. Input is a structured summary of confirmed APs:
- Project metadata
- Per-floor AP count, models, mount types, cable estimates
- Rack assignments

Output is an HTML fragment (no wrapper) with:
1. Installation intent overview
2. Mounting standards
3. Cable termination (T568B, CAT6/6A)
4. Head-end/IDF requirements
5. Testing checklist

Rendered by WeasyPrint via `contractor_summary.html` template.

## Model

`anthropic.claude-sonnet-4-5-20250929-v1:0` via EC2 IAM role (no API key).
Set via env var: `BEDROCK_MODEL_ID`.
