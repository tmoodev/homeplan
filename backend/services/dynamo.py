import os
from typing import Any, Optional

import boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "homeplan-data")
AUTH_TABLE_NAME = os.environ.get("AUTH_DYNAMODB_TABLE", "homeaudit-data")
REGION = os.environ.get("AWS_REGION", "us-east-1")

_resource = None
_auth_table_ref = None


def _table():
    global _resource
    if _resource is None:
        _resource = boto3.resource("dynamodb", region_name=REGION)
    return _resource.Table(TABLE_NAME)


def _auth_table():
    """Separate table handle for homeaudit-data (read auth records)."""
    global _auth_table_ref
    if _auth_table_ref is None:
        resource = boto3.resource("dynamodb", region_name=REGION)
        _auth_table_ref = resource.Table(AUTH_TABLE_NAME)
    return _auth_table_ref


def put_item(item: dict) -> None:
    _table().put_item(Item=item)


def get_item(pk: str, sk: str) -> Optional[dict]:
    resp = _table().get_item(Key={"pk": pk, "sk": sk})
    return resp.get("Item")


def get_item_auth(pk: str, sk: str) -> Optional[dict]:
    """Read from the auth table (homeaudit-data)."""
    resp = _auth_table().get_item(Key={"pk": pk, "sk": sk})
    return resp.get("Item")


def query_sk_prefix(pk: str, sk_prefix: str) -> list[dict]:
    resp = _table().query(
        KeyConditionExpression=Key("pk").eq(pk) & Key("sk").begins_with(sk_prefix)
    )
    return resp.get("Items", [])


def delete_item(pk: str, sk: str) -> None:
    _table().delete_item(Key={"pk": pk, "sk": sk})


def update_item(pk: str, sk: str, updates: dict) -> dict:
    """Partial update — only sets provided fields."""
    if not updates:
        return get_item(pk, sk) or {}

    expr_parts = []
    expr_names = {}
    expr_values = {}

    for i, (key, val) in enumerate(updates.items()):
        placeholder = f"#f{i}"
        value_key = f":v{i}"
        expr_parts.append(f"{placeholder} = {value_key}")
        expr_names[placeholder] = key
        expr_values[value_key] = val

    update_expr = "SET " + ", ".join(expr_parts)

    resp = _table().update_item(
        Key={"pk": pk, "sk": sk},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
        ReturnValues="ALL_NEW",
    )
    return resp.get("Attributes", {})
