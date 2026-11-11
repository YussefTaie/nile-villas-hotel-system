"""Database access for category and product records."""

from collections.abc import Mapping
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.product import Product


class CatalogRepository:
    """Persistence operations for catalog resources."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_categories(self) -> list[Category]:
        result = await self.session.scalars(
            select(Category).order_by(Category.display_order, Category.id)
        )
        return list(result.all())

    async def get_category(self, category_id: int) -> Category | None:
        return await self.session.get(Category, category_id)

    async def create_category(self, values: Mapping[str, Any]) -> Category:
        category = Category(**values)
        self.session.add(category)
        await self.session.commit()
        await self.session.refresh(category)
        return category

    async def save_category(self, category: Category) -> Category:
        await self.session.commit()
        await self.session.refresh(category)
        return category

    async def list_products(self) -> list[Product]:
        result = await self.session.scalars(select(Product).order_by(Product.id))
        return list(result.all())

    async def get_product(self, product_id: int) -> Product | None:
        return await self.session.get(Product, product_id)

    async def create_product(self, values: Mapping[str, Any]) -> Product:
        product = Product(**values)
        self.session.add(product)
        await self.session.commit()
        await self.session.refresh(product)
        return product

    async def save_product(self, product: Product) -> Product:
        await self.session.commit()
        await self.session.refresh(product)
        return product
