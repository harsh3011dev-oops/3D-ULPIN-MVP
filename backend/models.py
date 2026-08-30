import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, Text, TIMESTAMP, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geometry
from sqlalchemy.orm import relationship
from backend.database import Base

class Parcel(Base):
    __tablename__ = "parcels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id = Column(String(100), unique=True, index=True, nullable=False)
    boundary = Column(Geometry(geometry_type="POLYGON", srid=4326))
    center_lat = Column(Float)
    center_lon = Column(Float)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    buildings = relationship("Building", back_populates="parcel", cascade="all, delete-orphan")


class Building(Base):
    __tablename__ = "buildings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id = Column(UUID(as_uuid=True), ForeignKey("parcels.id"), nullable=False)
    building_id = Column(String(100), index=True, nullable=False)
    footprint = Column(Geometry(geometry_type="POLYGON", srid=4326))
    height_meters = Column(Float)
    floor_count = Column(Integer)
    total_units = Column(Integer)
    centroid_lat = Column(Float)
    centroid_lon = Column(Float)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    parcel = relationship("Parcel", back_populates="buildings")
    units = relationship("Unit", back_populates="building", cascade="all, delete-orphan")
    validation = relationship("ValidationLog", back_populates="building", uselist=False, cascade="all, delete-orphan")


class Unit(Base):
    __tablename__ = "units"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    building_id = Column(UUID(as_uuid=True), ForeignKey("buildings.id"), nullable=False)
    unit_id = Column(String(100), index=True, nullable=False)
    ulpin = Column(String(200), unique=True, index=True, nullable=False)
    floor = Column(Integer)
    floor_height_m = Column(Float)
    polygon_2d = Column(Geometry(geometry_type="POLYGON", srid=4326))
    centroid_lat = Column(Float)
    centroid_lon = Column(Float)
    area_sqft = Column(Float)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    building = relationship("Building", back_populates="units")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(String(100), unique=True, index=True, nullable=False)
    parcel_id = Column(String(100), index=True)
    building_id = Column(String(100), index=True)
    status = Column(String(20), default="pending")  # 'pending', 'processing', 'completed', 'failed'
    progress_pct = Column(Integer, default=0)
    progress_step = Column(String(200))
    result_json = Column(JSON)
    error_message = Column(Text)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    started_at = Column(TIMESTAMP)
    completed_at = Column(TIMESTAMP)


class ValidationLog(Base):
    __tablename__ = "validation_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    building_id = Column(UUID(as_uuid=True), ForeignKey("buildings.id"), nullable=False, unique=True)
    is_valid = Column(Boolean)
    overlaps_detected = Column(Integer, default=0)
    out_of_bounds = Column(Integer, default=0)
    confidence_score = Column(Float)
    validation_report = Column(JSON)
    checked_at = Column(TIMESTAMP, default=datetime.utcnow)

    building = relationship("Building", back_populates="validation")
