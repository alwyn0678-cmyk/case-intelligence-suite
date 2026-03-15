import os
import math
import json
import traceback
from datetime import date, datetime
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from analyser import analyse_file


def safe_json(obj: object) -> str:
    """JSON serialiser that converts any pandas/numpy NA types to null."""
    def default(o: object) -> object:
        if o is pd.NaT:
            return None
        if isinstance(o, float) and math.isnan(o):
            return None
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        try:
            if pd.isna(o):  # type: ignore[arg-type]
                return None
        except (TypeError, ValueError):
            pass
        return str(o)
    return json.dumps(obj, default=default)

app = FastAPI(title="Case Intelligence Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".xlsx", ".xls", ".csv"}:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
    try:
        contents = await file.read()
        result = analyse_file(contents, file.filename)
        return Response(content=safe_json(result), media_type="application/json")
    except Exception as exc:
        tb = traceback.format_exc()
        raise HTTPException(status_code=422, detail=f"{exc}\n\nTraceback:\n{tb}")
