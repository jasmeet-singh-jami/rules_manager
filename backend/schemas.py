from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


# ── Clients ──────────────────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    description: Optional[str]
    created_at: datetime


# ── Rule Types ────────────────────────────────────────────────────────────────

class RuleTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    pipeline_stage: int
    drl_package: str
    drl_imports: str
    drl_functions: Optional[str]


# ── Rules ─────────────────────────────────────────────────────────────────────

class RuleCreate(BaseModel):
    client_id: UUID
    rule_type_id: UUID
    name: str
    description: Optional[str] = None
    tool: Optional[str] = None
    condition_raw: Optional[str] = None
    action_raw: Optional[str] = None
    condition_meta: Optional[Any] = None
    action_meta: Optional[Any] = None
    enabled: bool = True
    priority: Optional[str] = None
    window: Optional[int] = None


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tool: Optional[str] = None
    condition_raw: Optional[str] = None
    action_raw: Optional[str] = None
    condition_meta: Optional[Any] = None
    action_meta: Optional[Any] = None
    enabled: Optional[bool] = None
    priority: Optional[str] = None
    window: Optional[int] = None


class RuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client_id: UUID
    rule_type_id: UUID
    name: str
    description: Optional[str]
    tool: Optional[str]
    condition_raw: Optional[str]
    action_raw: Optional[str]
    condition_meta: Optional[Any]
    action_meta: Optional[Any]
    enabled: bool
    priority: Optional[str]
    window: Optional[int]
    created_at: datetime
    updated_at: datetime


class RuleCopyRequest(BaseModel):
    target_client_id: UUID


# ── Deployments ───────────────────────────────────────────────────────────────

class DeploymentCreate(BaseModel):
    client_id: UUID
    version: str
    notes: Optional[str] = None


class DeploymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client_id: UUID
    version: str
    status: str
    notes: Optional[str]
    created_at: datetime


# ── DRL Import ────────────────────────────────────────────────────────────────

class ParsedRulePreview(BaseModel):
    name: str
    condition_raw: str
    action_raw: str


class ParsedFilePreview(BaseModel):
    filename: str
    package: str
    rule_count: int
    rules: list[ParsedRulePreview]


class ImportConfirmRule(BaseModel):
    client_id: UUID
    rule_type_id: UUID
    name: str
    description: Optional[str] = None
    tool: Optional[str] = None
    condition_raw: str
    action_raw: str


class ImportConfirmRequest(BaseModel):
    rules: list[ImportConfirmRule]


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    role: str


class TokenOut(BaseModel):
    token: str
    user: UserOut
    client_access_ids: list[UUID]


class MeOut(BaseModel):
    id: UUID
    username: str
    role: str
    client_access_ids: list[UUID]


class UserWithClientsOut(BaseModel):
    id: UUID
    username: str
    role: str
    client_ids: list[UUID]
