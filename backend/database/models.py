import uuid
from sqlalchemy import Boolean, Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .connection import Base

def generate_public_code():
    return uuid.uuid4().hex[:8]

class Crop(Base):
    __tablename__ = "crops"

    id = Column(Integer, primary_key=True, index=True)
    farmer_name = Column(String, nullable=False)
    crop_type = Column(String, nullable=False)
    variety = Column(String, default="")
    location = Column(String, default="")
    planted_on = Column(String, default="")
    public_code = Column(String, unique=True, index=True, nullable=False, default=generate_public_code)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    scans = relationship("Scan", back_populates="crop")
    harvests = relationship("Harvest", back_populates="crop")

class Scan(Base):
    __tablename__ = "scans"

    id = Column(Integer, primary_key=True, index=True)
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False)
    disease = Column(String, nullable=False)
    crop_type = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    risk_score = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False)
    recommendation = Column(String, nullable=False)
    temperature = Column(Float)
    humidity = Column(Float)
    rainfall = Column(Float)
    latitude = Column(Float)
    longitude = Column(Float)
    source = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    crop = relationship("Crop", back_populates="scans")

class TreatmentCourse(Base):
    __tablename__ = "treatment_courses"

    id = Column(Integer, primary_key=True, index=True)
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False, index=True)
    disease_class = Column(String, nullable=False)
    status = Column(String, nullable=False, default="under_treatment", index=True)
    recommendation_snapshot = Column(Text, nullable=True)
    recommendation_verified = Column(Boolean, nullable=False, default=False)
    follow_up_interval_days = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TreatmentCourseScan(Base):
    __tablename__ = "treatment_course_scans"

    scan_id = Column(Integer, ForeignKey("scans.id"), primary_key=True)
    treatment_course_id = Column(Integer, ForeignKey("treatment_courses.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    linked_at = Column(DateTime(timezone=True), server_default=func.now())

class TreatmentApplication(Base):
    __tablename__ = "treatment_applications"

    id = Column(Integer, primary_key=True, index=True)
    treatment_course_id = Column(Integer, ForeignKey("treatment_courses.id"), nullable=False, index=True)
    applied_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Harvest(Base):
    __tablename__ = "harvests"

    id = Column(Integer, primary_key=True, index=True)
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False)
    quality_grade = Column(String, nullable=False)
    verified = Column(Integer, default=0)
    verification_status = Column(String, default="PENDING")
    verification_reason = Column(String, default="")
    notes = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    crop = relationship("Crop", back_populates="harvests")
    listings = relationship("MarketListing", back_populates="harvest")

class Buyer(Base):
    __tablename__ = "buyers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    district = Column(String, default="")
    interest = Column(String, nullable=False)
    min_grade = Column(String, nullable=False)
    buyer_type = Column(String, default="Wholesale Buyer")
    phone = Column(String, default="")
    whatsapp = Column(String, default="")
    website = Column(String, default="")
    rating = Column(Float, nullable=True)
    rating_source = Column(String, default="")
    verified = Column(Boolean, default=False)
    verification_source = Column(String, default="")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    status = Column(String, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    requests = relationship("BuyerRequest", back_populates="buyer")
    crops = relationship("BuyerCrop", back_populates="buyer", cascade="all, delete-orphan")
    contacts = relationship("BuyerContact", back_populates="buyer", cascade="all, delete-orphan")

class BuyerCrop(Base):
    __tablename__ = "buyer_crops"

    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=False, index=True)
    crop_name = Column(String, nullable=False, index=True)

    buyer = relationship("Buyer", back_populates="crops")

class BuyerContact(Base):
    __tablename__ = "buyer_contacts"

    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=False, index=True)
    contact_type = Column(String, nullable=False)  # PHONE, WHATSAPP, WEBSITE, EMAIL
    contact_value = Column(String, nullable=False)
    is_primary = Column(Boolean, default=True)
    verified = Column(Boolean, default=True)

    buyer = relationship("Buyer", back_populates="contacts")

class CropPost(Base):
    __tablename__ = "crop_posts"

    id = Column(Integer, primary_key=True, index=True)
    farmer_name = Column(String, default="Farmer")
    farmer_phone = Column(String, nullable=False)
    crop_type = Column(String, nullable=False, index=True)
    quantity_kg = Column(Float, nullable=False)
    price_per_kg = Column(Float, nullable=False)
    location = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    quality_grade = Column(String, default="Grade A")
    health_status = Column(String, default="Verified Healthy")
    health_risk_score = Column(Float, nullable=True)
    passport_id = Column(Integer, ForeignKey("crops.id"), nullable=True)
    status = Column(String, default="AVAILABLE", index=True)  # AVAILABLE, SOLD
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    interests = relationship("CropInterest", back_populates="crop_post", cascade="all, delete-orphan")

class CropInterest(Base):
    __tablename__ = "crop_interests"

    id = Column(Integer, primary_key=True, index=True)
    crop_post_id = Column(Integer, ForeignKey("crop_posts.id"), nullable=False, index=True)
    buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=True)
    buyer_name = Column(String, nullable=False)
    buyer_type = Column(String, default="Buyer")
    buyer_phone = Column(String, nullable=False)
    buyer_whatsapp = Column(String, default="")
    message = Column(String, default="")
    status = Column(String, default="INTERESTED", index=True)  # INTERESTED, CONTACTED, CLOSED
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    crop_post = relationship("CropPost", back_populates="interests")

class MarketPrice(Base):
    __tablename__ = "market_prices"

    id = Column(Integer, primary_key=True, index=True)
    crop_name = Column(String, nullable=False, index=True)
    market_name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    modal_price_per_kg = Column(Float, nullable=False)
    min_price_per_kg = Column(Float, nullable=False)
    max_price_per_kg = Column(Float, nullable=False)
    unit = Column(String, default="₹/kg")
    price_date = Column(String, nullable=False)
    source = Column(String, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    district = Column(String, nullable=False)
    state = Column(String, default="Karnataka")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

class BuyerRequest(Base):
    __tablename__ = "buyer_requests"

    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=False)
    crop_type = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, default="kg")
    min_grade = Column(String, nullable=False)
    location = Column(String, default="")
    window_start = Column(DateTime(timezone=True), nullable=True)
    window_end = Column(DateTime(timezone=True), nullable=True)
    price_min = Column(Float, nullable=True)
    price_max = Column(Float, nullable=True)
    status = Column(String, default="OPEN", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)

    buyer = relationship("Buyer", back_populates="requests")

class MarketListing(Base):
    __tablename__ = "market_listings"

    id = Column(Integer, primary_key=True, index=True)
    harvest_id = Column(Integer, ForeignKey("harvests.id"), nullable=False)
    crop_type = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False)
    quality_grade = Column(String, nullable=False)
    ask_price_per_kg = Column(Float, default=0.0)
    quantity_remaining = Column(Float, nullable=False)
    ready_from = Column(DateTime(timezone=True), nullable=True)
    ready_to = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="AVAILABLE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    harvest = relationship("Harvest", back_populates="listings")

class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, index=True)
    buyer_request_id = Column(Integer, ForeignKey("buyer_requests.id"), nullable=False)
    listing_id = Column(Integer, ForeignKey("market_listings.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    price_per_kg = Column(Float, nullable=False)
    status = Column(String, default="PENDING", index=True)
    parent_offer_id = Column(Integer, ForeignKey("offers.id"), nullable=True)
    counter_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    buyer_request = relationship("BuyerRequest")
    listing = relationship("MarketListing")
    parent_offer = relationship("Offer", remote_side=[id])

class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=False, unique=True)
    buyer_request_id = Column(Integer, ForeignKey("buyer_requests.id"), nullable=False)
    listing_id = Column(Integer, ForeignKey("market_listings.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    price_per_kg = Column(Float, nullable=False)
    status = Column(String, default="CONFIRMED", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    offer = relationship("Offer")
    buyer_request = relationship("BuyerRequest")
    listing = relationship("MarketListing")
