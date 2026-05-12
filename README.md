# HomePlan

Desktop-first WiFi infrastructure planning platform for high-end residential construction. Planners upload architectural floor plans, calibrate scale, place rack/IDF locations, and receive AI-proposed WiFi access point placements via Bedrock vision. Generates contractor-ready handoff packages: annotated PDF, CAT6 BOM CSV, and AI-written contractor summary.

Part of the DataTrav platform. Auth reuses HomeAudit's `homeaudit-data` users table.

## Stack

- **Backend**: FastAPI + DynamoDB + S3 + Bedrock (Claude vision)
- **Frontend**: React + TypeScript + Vite + react-konva → nginx
- **PDF**: WeasyPrint
- **Rasterization**: pypdfium2 + Pillow
- **Auth**: httpOnly JWT cookies (bcrypt, HS256) — reads from homeaudit-data
- **Deploy**: Docker Compose on datatrav-demo-prod, GitHub Actions → SSM

## Local Development

```bash
cp .env.example .env
# Fill in JWT_SECRET and AWS credentials

docker compose up --build
```

Frontend: http://localhost:3902
Backend API: http://localhost:3903

## Initial Setup

```bash
# Create homeplan-data DynamoDB table
python3 scripts/create_table.py

# Seed AP model library
python3 scripts/seed.py
```

Users are NOT seeded here — they come from `homeaudit-data`. Run `python3 scripts/seed.py` in the homeaudit repo to create/reset users.

## Ports

| Service | Port |
|---------|------|
| Frontend (nginx) | 3902 |
| Backend (FastAPI) | 3903 |

## Production

`https://homeplan.datatrav.com` — served via Cloudflare Tunnel → datatrav-demo-prod.

Push to `main` → GitHub Actions deploys automatically via SSM.

See `docs/AWS_SETUP.md` for IAM policy, DynamoDB, S3, Bedrock, and Cloudflare setup.

## Workflow

1. Create project (client, address, sqft, wall material, floors)
2. Upload floor plan PDFs or images — server rasterizes to PNG
3. Calibrate scale: click two points on plan, enter real-world distance
4. Place rack/IDF locations on each floor
5. Click "Propose APs" — Bedrock vision analyzes all floors and returns draft placements
6. Drag APs to adjust, confirm placement, delete/add as needed
7. Generate Handoff Package → download annotated PDF, BOM CSV, contractor summary
