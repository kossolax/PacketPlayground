import os
import uvicorn
import logging
from pydantic import Field, create_model
from dotenv import load_dotenv

from fastapi.staticfiles import StaticFiles
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Response, WebSocket, WebSocketDisconnect, HTTPException

from swagger import get_custom_swagger_ui_html

from pydantic import BaseModel, Field, Extra, RootModel

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
file_handler = logging.FileHandler(f"/tmp/{__name__}.log")
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(file_handler)
logger.addHandler(logging.StreamHandler())

load_dotenv()

# Please follow: https://www.belgif.be/specification/rest/api-guide/#resource-uri
class FastAPIServer:
    def __init__(self):
        self.app = FastAPI(
            docs_url=None, redoc_url=None,
            swagger_ui_parameters={
                "deepLinking": True,
                "displayRequestDuration": True,
                "docExpansion": "none",
                "operationsSorter": "alpha",
                "persistAuthorization": True,
                "tagsSorter": "alpha",
            },
            servers=[
                {"description": "production", "url": "/api"},
                {"description": "development", "url": "/"},
            ])

        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        if os.path.exists("/backend/assets"):
            self.app.mount("/static", StaticFiles(directory="/backend/assets/"), name="static")
        else:
            os.makedirs("assets", exist_ok=True)
            self.app.mount("/static", StaticFiles(directory="assets/"), name="static")

        self.__define_endpoints()

    def __define_endpoints(self):
        @self.app.get("/", include_in_schema=False)
        async def custom_swagger_ui_html():
            return get_custom_swagger_ui_html(
                openapi_url="openapi.json",
                title=self.app.title + " - Swagger UI",
                swagger_ui_parameters=self.app.swagger_ui_parameters
            )

        @self.app.get("/test", tags=["test"])
        async def get_test():
            return {"message": "Hello, World!"}

    def start(self, host="0.0.0.0", port=5020):
        uvicorn.run(self.app, host=host, port=port, root_path="/front-api", ws_ping_interval=30, ws_ping_timeout=30)

