#!/usr/bin/env python3
"""Idempotent DynamoDB table creation for homeplan-data."""

import boto3
from botocore.exceptions import ClientError

TABLE_NAME = "homeplan-data"
REGION = "us-east-1"


def create_table():
    client = boto3.client("dynamodb", region_name=REGION)

    try:
        client.create_table(
            TableName=TABLE_NAME,
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"},
            ],
            KeySchema=[
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"},
            ],
        )
        print(f"Table '{TABLE_NAME}' created successfully.")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceInUseException":
            print(f"Table '{TABLE_NAME}' already exists — skipping creation.")
        else:
            raise

    waiter = client.get_waiter("table_exists")
    waiter.wait(TableName=TABLE_NAME)
    print(f"Table '{TABLE_NAME}' is active.")


if __name__ == "__main__":
    create_table()
