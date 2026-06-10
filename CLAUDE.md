# homeplan

## Deploy Configuration

- **deploy_method:** `github_actions`
- **deploy_path:** `/opt/homeplan`
- **instance_id:** `i-0aa8799631327ddc3`
- **docker_service:** `homeplan-backend`
- Merge to `main` triggers auto-deploy via GitHub Actions. Do NOT manually deploy.
- **Fallback SSM commands** (if CI is down):
  ```
  cd /opt/homeplan && git pull origin main && docker compose --env-file .env up -d --build
  ```
