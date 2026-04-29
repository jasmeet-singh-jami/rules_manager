import uuid
import secrets
from datetime import datetime, timezone, timedelta
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, ForeignKey,
    TIMESTAMP, Enum as SAEnum, UniqueConstraint, text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)

    rules = relationship("Rule", back_populates="client", cascade="all, delete-orphan")
    deployments = relationship("Deployment", back_populates="client", cascade="all, delete-orphan")


class RuleType(Base):
    __tablename__ = "rule_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    pipeline_stage = Column(Integer, nullable=False)
    drl_package = Column(String(200), nullable=False)

    rules = relationship("Rule", back_populates="rule_type")
    functions = relationship("DrlFunction", back_populates="rule_type", cascade="all, delete-orphan", lazy="selectin")
    imports = relationship("DrlImport", back_populates="rule_type", cascade="all, delete-orphan", lazy="selectin")

    @property
    def is_system_locked(self) -> bool:
        from seed_data import SEEDED_RULE_TYPE_SLUGS
        return self.slug in SEEDED_RULE_TYPE_SLUGS


DrlImportKind = SAEnum("import", "global", name="drl_import_kind")


class DrlFunction(Base):
    __tablename__ = "drl_functions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_type_id = Column(UUID(as_uuid=True), ForeignKey("rule_types.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    body = Column(Text, nullable=False)

    rule_type = relationship("RuleType", back_populates="functions")

    __table_args__ = (UniqueConstraint("rule_type_id", "name", name="uq_drl_function_name"),)


class DrlImport(Base):
    __tablename__ = "drl_imports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_type_id = Column(UUID(as_uuid=True), ForeignKey("rule_types.id", ondelete="CASCADE"), nullable=False)
    statement = Column(Text, nullable=False)
    kind = Column(DrlImportKind, nullable=False, default="import")
    is_shared = Column(Boolean, default=False, nullable=False)

    rule_type = relationship("RuleType", back_populates="imports")

    __table_args__ = (UniqueConstraint("rule_type_id", "statement", name="uq_drl_import_stmt"),)


class Rule(Base):
    __tablename__ = "rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    rule_type_id = Column(UUID(as_uuid=True), ForeignKey("rule_types.id"), nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    tool = Column(String(50), nullable=True)
    condition_raw = Column(Text, nullable=True)
    action_raw = Column(Text, nullable=True)
    condition_meta = Column(JSONB, nullable=True)
    action_meta = Column(JSONB, nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    window = Column(Integer, nullable=True)
    required_function_names = Column(JSONB, nullable=True)
    required_import_statements = Column(JSONB, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    client = relationship("Client", back_populates="rules")
    rule_type = relationship("RuleType", back_populates="rules")
    snapshots = relationship("DeploymentRuleSnapshot", back_populates="rule")


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    version = Column(String(20), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)
    rule_types_snapshot = Column(JSONB, nullable=True)

    client = relationship("Client", back_populates="deployments")
    snapshots = relationship("DeploymentRuleSnapshot", back_populates="deployment", cascade="all, delete-orphan")


class DeploymentRuleSnapshot(Base):
    __tablename__ = "deployment_rule_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deployment_id = Column(UUID(as_uuid=True), ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("rules.id", ondelete="SET NULL"), nullable=True)
    rule_snapshot = Column(JSONB, nullable=False)
    drl_block = Column(Text, nullable=False)
    rule_type_snapshot = Column(JSONB, nullable=True)

    deployment = relationship("Deployment", back_populates="snapshots")
    rule = relationship("Rule", back_populates="snapshots")


UserRole = SAEnum("admin", "contributor", name="user_role")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(UserRole, nullable=False, default="contributor")
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)
    must_change_password = Column(Boolean, nullable=False, default=False, server_default="false")

    tokens = relationship("Token", back_populates="user", cascade="all, delete-orphan")
    client_access = relationship("UserClientAccess", back_populates="user", cascade="all, delete-orphan")


class Token(Base):
    __tablename__ = "tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(Text, unique=True, nullable=False, default=lambda: secrets.token_hex(32))
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)
    expires_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc) + timedelta(hours=24),
        server_default=text("NOW() + INTERVAL '24 hours'"),
    )

    user = relationship("User", back_populates="tokens")


class UserClientAccess(Base):
    __tablename__ = "user_client_access"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)

    user = relationship("User", back_populates="client_access")
    client = relationship("Client")

    __table_args__ = (UniqueConstraint("user_id", "client_id", name="uq_user_client"),)


AccessRequestStatus = SAEnum("pending", "approved", "denied", name="access_request_status")


class ClientAccessRequest(Base):
    __tablename__ = "client_access_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    status = Column(AccessRequestStatus, nullable=False, default="pending")
    requested_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)
    reviewed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    client = relationship("Client")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])


class KbCategory(Base):
    __tablename__ = "kb_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    kb_category_id = Column(UUID(as_uuid=True), ForeignKey("kb_categories.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)

    client = relationship("Client", viewonly=True)
    kb_category = relationship("KbCategory", lazy="joined")


class ScriptCategory(Base):
    __tablename__ = "script_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    file_extension = Column(String(10), nullable=False)
    mime_type = Column(String(100), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)


class CronJob(Base):
    __tablename__ = "cron_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    script_category_id = Column(UUID(as_uuid=True), ForeignKey("script_categories.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)

    client = relationship("Client", viewonly=True)
    script_category = relationship("ScriptCategory", lazy="joined")
