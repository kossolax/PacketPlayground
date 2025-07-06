import os
import traceback
import threading
import uuid
import asyncio
import logging
from datetime import timedelta
from dotenv import load_dotenv
from functools import wraps
from typing import Type, Any, List, Dict, Union, Optional, TypeVar, Generic, Callable
import time

from sqlalchemy import JSON, column, create_engine, Column, Integer, REAL, String, Text, DateTime, DDL, PrimaryKeyConstraint, cast, func, inspect, text, literal, ForeignKey, select, delete
from sqlalchemy.dialects.postgresql import TIMESTAMP, INTEGER, UUID
from sqlalchemy.ext.declarative import declarative_base, declared_attr
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker

from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.autogenerate import produce_migrations
from alembic.operations.ops import ModifyTableOps, AlterColumnOp


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
file_handler = logging.FileHandler(f"/tmp/{__name__}.log")
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(file_handler)
logger.addHandler(logging.StreamHandler())

def get_database_url(async_driver=False):
    load_dotenv()
    db_host = os.getenv("DB_HOST", "localhost")
    db_user = os.getenv("DB_USER", "postgres")
    db_pass = os.getenv("DB_PASS", "postgres")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "postgres")

    prefix = 'postgresql'
    if async_driver:
        driver = 'asyncpg'
    else:
        driver = 'psycopg2'
    
    return f'{prefix}+{driver}://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}'

class Base:
    @declared_attr
    def __tablename__(cls):
        return cls.__name__.lower()
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

Database = declarative_base(cls=Base)

class GenericDAL:
    initialized = False
    lock = threading.Lock()
    SyncEngine = None
    SyncSession = None
    AsyncEngine = None
    AsyncSession = None

    def __init__(self):
        if not GenericDAL.SyncSession:
            with GenericDAL.lock:
                GenericDAL.SyncEngine  = create_engine(
                    get_database_url(async_driver=False), 
                    echo=True, 
                    pool_pre_ping=True,
                    connect_args={'client_encoding': 'utf8'},
                    pool_size=2,
                    max_overflow=1,
                    pool_timeout=30,
                    pool_recycle=1*60*60
                )
                GenericDAL.SyncSession = sessionmaker(bind=GenericDAL.SyncEngine , expire_on_commit=False)
        
        if not GenericDAL.AsyncSession:
            with GenericDAL.lock:
                GenericDAL.AsyncEngine = create_async_engine(
                    get_database_url(async_driver=True), 
                    echo=True,
                    pool_pre_ping=True,
                    pool_size=20,
                    max_overflow=5,
                    pool_timeout=30,
                    pool_recycle=1*60*60,
                )
                GenericDAL.AsyncSession = async_sessionmaker(bind=GenericDAL.AsyncEngine, expire_on_commit=False)
        
        if not GenericDAL.initialized:
            with GenericDAL.lock:
                if not GenericDAL.initialized:
                    GenericDAL.__update_schema(self)
                    GenericDAL.__seed_database(self)
                    GenericDAL.__init_cron(self)
                    GenericDAL.initialized = True
    
    def __update_schema(self):
        def add_using_clause(op):
            if isinstance(op.modify_type, Integer) and isinstance(op.existing_type, Text):
                using_clause = (f"COALESCE(NULLIF(REGEXP_REPLACE({op.column_name}, '[^0-9]', '', 'g'), ''), '0')::integer")
                return AlterColumnOp(
                    table_name=op.table_name,
                    column_name=op.column_name,
                    modify_type=op.modify_type,
                    existing_type=op.existing_type,
                    schema=op.schema,
                    existing_nullable=op.existing_nullable,
                    existing_server_default=op.existing_server_default,
                    existing_comment=op.existing_comment,
                    postgresql_using=using_clause
                )
            elif isinstance(op.modify_type, UUID) and isinstance(op.existing_type, Integer):
                using_clause = f"('00000000-0000-0000-0000-' || lpad(to_hex({op.column_name}), 12, '0'))::uuid"
                
                # Drop the existing default value
                drop_default_op = AlterColumnOp(
                    table_name=op.table_name,
                    column_name=op.column_name,
                    existing_type=op.existing_type,
                    existing_server_default=True,  # Set this to True to indicate an existing default
                    modify_server_default=None     # Set to None to drop the default
                )
                
                # Alter the column type with the using clause
                alter_type_op = AlterColumnOp(
                    table_name=op.table_name,
                    column_name=op.column_name,
                    existing_type=op.existing_type,
                    modify_type=op.modify_type,
                    postgresql_using=using_clause,
                )
                
                # Set the new default value
                set_default_op = AlterColumnOp(
                    table_name=op.table_name,
                    column_name=op.column_name,
                    existing_type=op.modify_type,
                    existing_server_default=None,
                    modify_server_default=text('gen_random_uuid()')
                )
                return [drop_default_op, alter_type_op, set_default_op]

            else:
                return op

        with GenericDAL.SyncSession() as session:
            session.execute(DDL("SET client_encoding TO 'UTF8'"))
            session.execute(DDL("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
            session.commit()
        
        logger.info("Binding schema to engine...")
        Database.metadata.reflect(GenericDAL.SyncEngine)
        Database.metadata.create_all(GenericDAL.SyncEngine)

        logger.info("Trying to update schema...")
        with create_engine(get_database_url(async_driver=False), echo=False, connect_args={'client_encoding': 'utf8'}).connect() as conn:
            trans = conn.begin()
            try:
                # Configure the migration context with the connection
                context = MigrationContext.configure(conn)
                migrations = produce_migrations(context, Database.metadata)
                if not migrations.upgrade_ops.is_empty():

                    logger.info("Updating schema...")

                    operations = Operations(context)

                    use_batch = GenericDAL.SyncEngine.name == "sqlite"
                    stack = [migrations.upgrade_ops]
                    while stack:
                        elem = stack.pop(0)
                        logger.debug(elem)

                        if use_batch and isinstance(elem, ModifyTableOps):
                            with operations.batch_alter_table(elem.table_name, schema=elem.schema) as batch_ops:
                                for table_elem in elem.ops:
                                    batch_ops.invoke(table_elem)
                        elif hasattr(elem, "ops"):
                            stack.extend(elem.ops)
                        else:
                            if isinstance(elem, AlterColumnOp):
                                elem = add_using_clause(elem)
                                if isinstance(elem, list):
                                    for op in elem:
                                        operations.invoke(op)
                                else:
                                    operations.invoke(elem)
                            else:
                                operations.invoke(elem)

                trans.commit()
            except Exception as e:
                trans.rollback()
                logger.error(f"An error occurred during migration: {e}")
            logger.info("Schema updated")
        
        logger.info("Schema is ready")

    def __seed_database(self):
        with GenericDAL.SyncSession() as session:
            pass

    # ----- Synchronous API methods -----
    def add(self, obj) -> uuid.UUID:
        with GenericDAL.SyncSession() as session:
            session.add(obj)
            session.commit()
            session.refresh(obj)
            return obj.id
            
    def update(self, obj) -> Any:
        with GenericDAL.SyncSession() as session:
            session.add(obj)
            session.commit()
            session.refresh(obj)
            return obj.id

    def remove(self, obj) -> bool:
        with GenericDAL.SyncSession() as session:
            session.delete(obj)
            session.commit()
            return True
    
    # ----- Asynchronous API methods -----
    async def async_add(self, obj) -> uuid.UUID:
        async with GenericDAL.AsyncSession() as session:
            session.add(obj)
            await session.commit()
            await session.refresh(obj)
            return obj.id

    async def async_get(self, cls, _func=None, _group=None, _having=None, _order=None, _limit=None, **filters) -> List[Any]:
        async with GenericDAL.AsyncSession() as session:
            # Remplacement de session.query(cls)
            if _func is not None:
                if isinstance(_func, list):
                    stmt = select(*_func)
                else:
                    stmt = select(_func)
            else:
                stmt = select(cls)
            
            # Conversion de filter_by en where
            if filters:
                conditions = [getattr(cls, key) == value for key, value in filters.items()]
                stmt = stmt.where(*conditions)
            
            if _group is not None:
                stmt = stmt.add_columns(_group)
                stmt = stmt.group_by(_group)
            
            if _having is not None:
                stmt = stmt.having(_having)
            
            if _order is not None:
                stmt = stmt.order_by(_order)
            
            if _limit is not None:
                stmt = stmt.limit(_limit)
            
            result = await session.execute(stmt)
            # Si _func est utilisé, on renvoie le résultat complet (tuple), sinon les objets mappés
            if _func is None:
                result = result.scalars().all()
            else:
                result = result.all()
            return result
    
    async def async_update(self, obj) -> Any:
        async with GenericDAL.AsyncSession() as session:
            result = await session.merge(obj)
            await session.commit()
            return result

    async def async_remove(self, obj) -> bool:
        async with GenericDAL.AsyncSession() as session:
            await session.delete(obj)
            await session.commit()
            return True
    