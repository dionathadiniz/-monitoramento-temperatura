
import sqlite3
from pathlib import Path
from datetime import datetime

CAMINHO_BANCO = Path(__file__).resolve().parent / "historico.db"


def conectar():
    return sqlite3.connect(CAMINHO_BANCO, timeout=10)


def inicializar_banco():
    with conectar() as conexao:
        conexao.execute("""
            CREATE TABLE IF NOT EXISTS leituras (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                temperatura REAL NOT NULL,
                unidade TEXT NOT NULL,
                status TEXT NOT NULL,
                data_hora TEXT NOT NULL
            )
        """)


def salvar_leitura(temperatura, status):
    data_hora = datetime.now().astimezone().isoformat(
        timespec="seconds"
    )

    with conectar() as conexao:
        conexao.execute("""
            INSERT INTO leituras
            (temperatura, unidade, status, data_hora)
            VALUES (?, ?, ?, ?)
        """, (temperatura, "°C", status, data_hora))


def obter_historico(limite=100):
    with conectar() as conexao:
        conexao.row_factory = sqlite3.Row

        registros = conexao.execute("""
            SELECT id, temperatura, unidade, status, data_hora
            FROM leituras
            ORDER BY id DESC
            LIMIT ?
        """, (limite,)).fetchall()

    return [dict(registro) for registro in reversed(registros)]


def obter_todas_leituras():
    with conectar() as conexao:
        conexao.row_factory = sqlite3.Row

        registros = conexao.execute("""
            SELECT id, temperatura, unidade, status, data_hora
            FROM leituras
            ORDER BY id ASC
        """).fetchall()

    return [dict(registro) for registro in registros]
