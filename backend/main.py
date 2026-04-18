from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine, Base
from seed_data import seed_rule_types, seed_admin_user
from database import AsyncSessionLocal
from routers import clients, rule_types, rules, deployments, import_drl, auth, admin, functions


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await seed_rule_types(session)
        await seed_admin_user(session)
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
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(functions.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve compiled React frontend in production
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
