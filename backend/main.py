from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from database import engine, Base
from seed_data import seed_rule_types, seed_admin_user, seed_script_categories, seed_kb_categories
from database import AsyncSessionLocal
from routers import clients, rule_types, rules, deployments, import_drl, auth, admin, functions, knowledge_base, kb_categories, cron_jobs, script_categories, automations


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await seed_rule_types(session)
        await seed_kb_categories(session)
        await seed_script_categories(session)
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
app.include_router(knowledge_base.router, prefix="/api")
app.include_router(kb_categories.router, prefix="/api")
app.include_router(cron_jobs.router, prefix="/api")
app.include_router(script_categories.router, prefix="/api")
app.include_router(automations.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve compiled React frontend in production with SPA fallback
_frontend_dist = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
)
if os.path.isdir(_frontend_dist):
    _index_html = os.path.join(_frontend_dist, "index.html")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        candidate = os.path.abspath(os.path.join(_frontend_dist, full_path))
        if (
            full_path
            and candidate.startswith(_frontend_dist)
            and os.path.isfile(candidate)
        ):
            return FileResponse(candidate)
        return FileResponse(_index_html)
