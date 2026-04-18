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


# ── DRL Functions & Imports ───────────────────────────────────────────────────

class DrlFunctionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    rule_type_id: UUID
    name: str
    body: str


class DrlFunctionCreate(BaseModel):
    name: str
    body: str


class DrlFunctionUpdate(BaseModel):
    name: Optional[str] = None
    body: Optional[str] = None


class DrlImportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    rule_type_id: UUID
    statement: str
    kind: str
    is_shared: bool


class DrlImportCreate(BaseModel):
    statement: str
    kind: str = "import"
    is_shared: bool = False


class DrlImportUpdate(BaseModel):
    statement: Optional[str] = None
    kind: Optional[str] = None
    is_shared: Optional[bool] = None


# ── Rule Types ────────────────────────────────────────────────────────────────

class RuleTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    pipeline_stage: int
    drl_package: str
    functions: list[DrlFunctionOut] = []
    imports: list[DrlImportOut] = []


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
    required_function_names: Optional[list[str]] = None
    required_import_statements: Optional[list[str]] = None
    created_at: datetime
    updated_at: datetime


class RuleCopyRequest(BaseModel):
    target_client_id: UUID


class RuleExportRequest(BaseModel):
    rule_ids: list[UUID]


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
    required_function_names: list[str] = []
    required_import_statements: list[str] = []


class ParsedFilePreview(BaseModel):
    filename: str
    package: str
    rule_count: int
    functions: list[dict] = []
    imports: list[dict] = []
    rules: list[ParsedRulePreview]


class DrlFunctionImport(BaseModel):
    name: str
    body: str


class DrlImportImport(BaseModel):
    statement: str
    kind: str = "import"


class ImportConfirmRule(BaseModel):
    client_id: UUID
    rule_type_id: UUID
    name: str
    description: Optional[str] = None
    tool: Optional[str] = None
    condition_raw: str
    action_raw: str
    required_function_names: list[str] = []
    required_import_statements: list[str] = []


class ImportConfirmRequest(BaseModel):
    rule_type_id: UUID
    functions: list[DrlFunctionImport] = []
    imports: list[DrlImportImport] = []
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
    must_change_password: bool


class MeOut(BaseModel):
    id: UUID
    username: str
    role: str
    client_access_ids: list[UUID]
    must_change_password: bool


class UserWithClientsOut(BaseModel):
    id: UUID
    username: str
    role: str
    client_ids: list[UUID]


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class AdminResetPasswordRequest(BaseModel):
    new_password: str
