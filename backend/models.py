import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, ForeignKey,
    TIMESTAMP, Enum as SAEnum
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
    drl_imports = Column(Text, nullable=False)
    drl_functions = Column(Text, nullable=True)

    rules = relationship("Rule", back_populates="rule_type")


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
    priority = Column(String(10), nullable=True)
    window = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    client = relationship("Client", back_populates="rules")
    rule_type = relationship("RuleType", back_populates="rules")
    snapshots = relationship("DeploymentRuleSnapshot", back_populates="rule")


DeploymentStatus = SAEnum("draft", "deployed", name="deployment_status")


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    version = Column(String(20), nullable=False)
    status = Column(DeploymentStatus, nullable=False, default="draft")
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)

    client = relationship("Client", back_populates="deployments")
    snapshots = relationship("DeploymentRuleSnapshot", back_populates="deployment", cascade="all, delete-orphan")


class DeploymentRuleSnapshot(Base):
    __tablename__ = "deployment_rule_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deployment_id = Column(UUID(as_uuid=True), ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("rules.id", ondelete="SET NULL"), nullable=True)
    rule_snapshot = Column(JSONB, nullable=False)
    drl_block = Column(Text, nullable=False)

    deployment = relationship("Deployment", back_populates="snapshots")
    rule = relationship("Rule", back_populates="snapshots")
