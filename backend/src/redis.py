from dotenv import load_dotenv

import logging
import redis
import os
import redis.asyncio as aioredis

load_dotenv()

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
logger.addHandler(logging.StreamHandler())
file_handler = logging.FileHandler(f"/tmp/{__name__}.log")
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(file_handler)
logger.addHandler(logging.StreamHandler())

class Redis:
    def __init__(self, db: int = 1):
        self.host = os.getenv("DB_HOST", "localhost")
        self.db = db
        self._redis = None

    async def __aenter__(self):
        self._redis = await aioredis.Redis.from_url(f'redis://{self.host}:6379/{self.db}')
        return self._redis

    async def __aexit__(self, exc_type, exc_value, traceback):
        if self._redis:
            await self._redis.close()
    
    def __enter__(self):
        self._redis = redis.Redis(host=self.host, port=6379, db=self.db)
        return self._redis

    def __exit__(self, exc_type, exc_value, traceback):
        if self._redis:
            self._redis.close()


