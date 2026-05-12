# AWS Setup — HomePlan

## IAM Policy (add to dunphy-ec2-ssm-role)

Add inline policy `homeplan-access`:

```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
        "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:CreateTable", "dynamodb:DescribeTable"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:712715586889:table/homeplan-data",
        "arn:aws:dynamodb:us-east-1:712715586889:table/homeplan-data/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem"],
      "Resource": "arn:aws:dynamodb:us-east-1:712715586889:table/homeaudit-data"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::datatrav-homeplan-media/*"
    }
  ]
}
```

Note: Bedrock `InvokeModel` is already granted by the existing `homeaudit-access` policy.

## S3 Bucket

Create bucket: `datatrav-homeplan-media` in `us-east-1`
- Block all public access: ON
- No bucket policy needed (EC2 IAM role grants access)

## DynamoDB Table

Run `python3 scripts/create_table.py` to create `homeplan-data`.

Table structure (single-table design):
| Entity | PK | SK |
|--------|----|----|
| Project | `TENANT#fulton` | `PROJECT#<id>` |
| Plan | `TENANT#fulton` | `PROJECT#<id>#PLAN#<id>` |
| AccessPoint | `TENANT#fulton` | `PROJECT#<id>#AP#<id>` |
| Rack | `TENANT#fulton` | `PROJECT#<id>#RACK#<id>` |
| HandoffPackage | `TENANT#fulton` | `PROJECT#<id>#PACKAGE#<id>` |

Auth (users) are read from `homeaudit-data` — no write access needed.

## Cloudflare Tunnel

Add to `/etc/cloudflared/datatrav-demo-config.yml` **before** the `http_status:404` catch-all:

```yaml
- hostname: homeplan.datatrav.com
  service: http://localhost:3902
```

Then:
```bash
systemctl restart cloudflared-demo.service
```

Add CNAME DNS record in Cloudflare:
- Name: `homeplan`
- Target: `<tunnel-id>.cfargotunnel.com`
- Proxied: ON

## Server Bootstrap

```bash
# On datatrav-demo-prod (via SSM or SSH)
cd /opt
git clone https://github.com/tmoodev/homeplan.git
cd homeplan
cp .env.example .env
# Edit .env with JWT_SECRET (same as homeaudit for cross-app SSO), TENANT_ID=fulton

# Create DynamoDB table and seed AP models
python3 scripts/create_table.py
python3 scripts/seed.py

# Build and start
docker compose up -d --build
```
