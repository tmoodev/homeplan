#!/usr/bin/env python3
"""Seed AP model library into homeplan-data. Does NOT seed users (uses homeaudit-data)."""

import json
import os
from pathlib import Path

import boto3

TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "homeplan-data")
TENANT_ID = os.environ.get("TENANT_ID", "fulton")
REGION = "us-east-1"

SEED_FILE = Path(__file__).parent.parent / "seed" / "ap_models.json"


def seed_ap_models(table):
    with open(SEED_FILE) as f:
        entries = json.load(f)

    for entry in entries:
        manufacturer = entry["manufacturer"]
        model = entry["model"]
        item = {
            "pk": f"TENANT#{TENANT_ID}",
            "sk": f"APMODEL#{manufacturer}#{model}",
            "tenant_id": TENANT_ID,
            "manufacturer": manufacturer,
            "model": model,
            "tier": entry.get("tier", "mid"),
            "max_coverage_ft": entry.get("max_coverage_ft", 22),
            "notes": entry.get("notes", ""),
        }
        table.put_item(Item=item)
        print(f"  Seeded AP model: {manufacturer} {model}")

    print(f"Seeded {len(entries)} AP model entries.")


def main():
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)

    print("Seeding AP model library...")
    seed_ap_models(table)

    print("\nSeed complete.")
    print("NOTE: Users are NOT seeded here — they live in homeaudit-data.")
    print("      Use the homeaudit seed.py to create/reset users.")


if __name__ == "__main__":
    main()
