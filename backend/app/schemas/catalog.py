"""Pydantic request and response schemas for categories and products."""

from datetime import datetime
from decimal import Decimal
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    description: str | None = Field(default=None, max_length=255)
    display_order: int | None = Field(default=None, ge=-2_147_483_648, le=2_147_483_647)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("display_order", mode="before")
    @classmethod
    def reject_null_display_order(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field cannot be null")
        return value


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = Field(default=None, max_length=255)
    display_order: int | None = Field(default=None, ge=-2_147_483_648, le=2_147_483_647)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("name", "display_order", mode="before")
    @classmethod
    def reject_null_for_required_columns(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field cannot be null")
        return value

    @model_validator(mode="after")
    def require_at_least_one_change(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class ProductCreate(BaseModel):
    category_id: int = Field(gt=0, le=2_147_483_647)
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    unit_price_usd: Decimal = Field(ge=0, max_digits=10, decimal_places=2)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ProductUpdate(BaseModel):
    category_id: int | None = Field(default=None, gt=0, le=2_147_483_647)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    unit_price_usd: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("category_id", "name", "unit_price_usd", mode="before")
    @classmethod
    def reject_null_for_required_columns(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field cannot be null")
        return value

    @model_validator(mode="after")
    def require_at_least_one_change(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class ActiveUpdate(BaseModel):
    is_active: bool


class AvailabilityUpdate(BaseModel):
    is_available: bool


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: datetime


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    name: str
    description: str | None
    unit_price_usd: Decimal
    is_available: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
