import sqlite3, os, datetime, uuid, json
BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, "mcp.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS sandboxes
                 (id TEXT PRIMARY KEY, name TEXT, status TEXT, created_at TEXT, expires_at TEXT, kubeconfig_path TEXT, owner TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS approvals
                 (id TEXT PRIMARY KEY, sandbox_id TEXT, approved INTEGER, approver TEXT, created_at TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS audit
                 (id TEXT PRIMARY KEY, timestamp TEXT, requester TEXT, action TEXT, inputs TEXT, result TEXT)""")
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
