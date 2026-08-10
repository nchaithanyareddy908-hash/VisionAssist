import json
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import DATABASE_PATH


class Database:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = Path(db_path or DATABASE_PATH)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        with closing(sqlite3.connect(self.db_path)) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS analysis_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    analysis_type TEXT NOT NULL,
                    result TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def insert_analysis(self, analysis_type: str, result: Dict[str, Any]) -> Dict[str, Any]:
        payload = json.dumps(result)
        with closing(sqlite3.connect(self.db_path)) as conn:
            cursor = conn.execute(
                "INSERT INTO analysis_history (analysis_type, result, created_at) VALUES (?, ?, datetime('now'))",
                (analysis_type, payload),
            )
            conn.commit()
            return {"id": cursor.lastrowid, "analysis_type": analysis_type, "result": result}

    def list_history(self) -> List[Dict[str, Any]]:
        with closing(sqlite3.connect(self.db_path)) as conn:
            rows = conn.execute(
                "SELECT id, analysis_type, result, created_at FROM analysis_history ORDER BY created_at DESC"
            ).fetchall()
        items: List[Dict[str, Any]] = []
        for row in rows:
            items.append(
                {
                    "id": row[0],
                    "analysis_type": row[1],
                    "result": json.loads(row[2]),
                    "created_at": row[3],
                }
            )
        return items

    def delete_history(self, history_id: int) -> bool:
        with closing(sqlite3.connect(self.db_path)) as conn:
            cursor = conn.execute("DELETE FROM analysis_history WHERE id = ?", (history_id,))
            conn.commit()
            return cursor.rowcount > 0

    def clear_history(self) -> int:
        with closing(sqlite3.connect(self.db_path)) as conn:
            cursor = conn.execute("DELETE FROM analysis_history")
            conn.commit()
            return cursor.rowcount
