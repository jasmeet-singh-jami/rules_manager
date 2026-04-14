from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from seed_data import seed_rule_types
from database import AsyncSessionLocal
from routers import clients, rule_types, rules, deployments, import_drl


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await seed_rule_types(session)
        await session.commit()
    yield


app = FastAPI(title="Polycloud Rules Manager", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients.router, prefix="/api")
app.include_router(rule_types.router, prefix="/api")
app.include_router(rules.router, prefix="/api")
app.include_router(deployments.router, prefix="/api")
app.include_router(import_drl.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
