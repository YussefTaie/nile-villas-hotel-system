"""Application services for category and product operations."""

from collections.abc import Mapping
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.product import Product
from app.repositories.catalog import CatalogRepository


class CatalogNotFound(Exception):
    def __init__(self, resource: str) -> None:
        self.resource = resource
        super().__init__(f"{resource} not found")


class CategoryReferenceNotFound(Exception):
    """Raised when a product refers to a category that does not exist."""


class CatalogConflict(Exception):
    """Raised when a database uniqueness constraint rejects a catalog write."""


class CatalogService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = CatalogRepository(session)

    async def list_categories(self) -> list[Category]:
        return await self.repository.list_categories()

    async def get_category(self, category_id: int) -> Category:
        category = await self.repository.get_category(category_id)
        if category is None:
            raise CatalogNotFound("Category")
        return category

    async def create_category(self, values: Mapping[str, Any]) -> Category:
        try:
            return await self.repository.create_category(values)
        except IntegrityError as exc:
            await self.session.rollback()
            raise CatalogConflict from exc

    async def update_category(self, category_id: int, values: Mapping[str, Any]) -> Category:
        category = await self.get_category(category_id)
        for key, value in values.items():
            setattr(category, key, value)
        try:
            return await self.repository.save_category(category)
        except IntegrityError as exc:
            await self.session.rollback()
            raise CatalogConflict from exc

    async def set_category_active(self, category_id: int, is_active: bool) -> Category:
        category = await self.get_category(category_id)
        category.is_active = is_active
        return await self.repository.save_category(category)

    async def list_products(self) -> list[Product]:
        return await self.repository.list_products()

    async def get_product(self, product_id: int) -> Product:
        product = await self.repository.get_product(product_id)
        if product is None:
            raise CatalogNotFound("Product")
        return product

    async def _ensure_category_exists(self, category_id: int) -> None:
        if await self.repository.get_category(category_id) is None:
            raise CategoryReferenceNotFound

    async def create_product(self, values: Mapping[str, Any]) -> Product:
        await self._ensure_category_exists(values["category_id"])
        return await self.repository.create_product(values)

    async def update_product(self, product_id: int, values: Mapping[str, Any]) -> Product:
        product = await self.get_product(product_id)
        if "category_id" in values:
            await self._ensure_category_exists(values["category_id"])
        for key, value in values.items():
            setattr(product, key, value)
        return await self.repository.save_product(product)

    async def set_product_active(self, product_id: int, is_active: bool) -> Product:
        product = await self.get_product(product_id)
        product.is_active = is_active
        return await self.repository.save_product(product)

    async def set_product_available(self, product_id: int, is_available: bool) -> Product:
        product = await self.get_product(product_id)
        product.is_available = is_available
        return await self.repository.save_product(product)
