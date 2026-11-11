"""Category and product API endpoints."""

from collections.abc import Awaitable
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.catalog import (
    ActiveUpdate,
    AvailabilityUpdate,
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    ProductCreate,
    ProductRead,
    ProductUpdate,
)
from app.services.catalog import (
    CatalogConflict,
    CatalogNotFound,
    CatalogService,
    CategoryReferenceNotFound,
)

router = APIRouter()
T = TypeVar("T")


def get_catalog_service(db: AsyncSession = Depends(get_db)) -> CatalogService:
    return CatalogService(db)


async def _run(operation: Awaitable[T]) -> T:
    try:
        return await operation
    except CatalogNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{exc.resource} not found") from exc
    except CategoryReferenceNotFound as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Category does not exist") from exc
    except CatalogConflict as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Catalog value conflicts with an existing record") from exc


@router.get("/categories", response_model=list[CategoryRead], tags=["categories"])
async def list_categories(service: CatalogService = Depends(get_catalog_service)) -> list[CategoryRead]:
    return await _run(service.list_categories())


@router.get("/categories/{category_id}", response_model=CategoryRead, tags=["categories"])
async def get_category(category_id: int, service: CatalogService = Depends(get_catalog_service)) -> CategoryRead:
    return await _run(service.get_category(category_id))


@router.post(
    "/categories", response_model=CategoryRead, status_code=status.HTTP_201_CREATED, tags=["categories"]
)
async def create_category(
    payload: CategoryCreate, service: CatalogService = Depends(get_catalog_service)
) -> CategoryRead:
    return await _run(service.create_category(payload.model_dump(exclude_unset=True)))


@router.patch("/categories/{category_id}", response_model=CategoryRead, tags=["categories"])
async def update_category(
    category_id: int,
    payload: CategoryUpdate,
    service: CatalogService = Depends(get_catalog_service),
) -> CategoryRead:
    return await _run(service.update_category(category_id, payload.model_dump(exclude_unset=True)))


@router.patch("/categories/{category_id}/activation", response_model=CategoryRead, tags=["categories"])
async def set_category_active(
    category_id: int,
    payload: ActiveUpdate,
    service: CatalogService = Depends(get_catalog_service),
) -> CategoryRead:
    return await _run(service.set_category_active(category_id, payload.is_active))


@router.get("/products", response_model=list[ProductRead], tags=["products"])
async def list_products(service: CatalogService = Depends(get_catalog_service)) -> list[ProductRead]:
    return await _run(service.list_products())


@router.get("/products/{product_id}", response_model=ProductRead, tags=["products"])
async def get_product(product_id: int, service: CatalogService = Depends(get_catalog_service)) -> ProductRead:
    return await _run(service.get_product(product_id))


@router.post("/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED, tags=["products"])
async def create_product(
    payload: ProductCreate, service: CatalogService = Depends(get_catalog_service)
) -> ProductRead:
    return await _run(service.create_product(payload.model_dump(exclude_unset=True)))


@router.patch("/products/{product_id}", response_model=ProductRead, tags=["products"])
async def update_product(
    product_id: int,
    payload: ProductUpdate,
    service: CatalogService = Depends(get_catalog_service),
) -> ProductRead:
    return await _run(service.update_product(product_id, payload.model_dump(exclude_unset=True)))


@router.patch("/products/{product_id}/activation", response_model=ProductRead, tags=["products"])
async def set_product_active(
    product_id: int,
    payload: ActiveUpdate,
    service: CatalogService = Depends(get_catalog_service),
) -> ProductRead:
    return await _run(service.set_product_active(product_id, payload.is_active))


@router.patch("/products/{product_id}/availability", response_model=ProductRead, tags=["products"])
async def set_product_available(
    product_id: int,
    payload: AvailabilityUpdate,
    service: CatalogService = Depends(get_catalog_service),
) -> ProductRead:
    return await _run(service.set_product_available(product_id, payload.is_available))
