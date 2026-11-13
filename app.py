import time
import csv
import io
import json
import os
import threading
from pathlib import Path


import redis
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from leitor_serial import ler_temperatura
from historico import (
    inicializar_banco,
    salvar_leitura,
    obter_historico,
    obter_todas_leituras
)

BASE_DIR = Path(__file__).resolve().parent

CHAVE_CACHE = "furacao:ultima_leitura"
TEMPO_CACHE = 5  # segundos (o dashboard consulta a cada 3 s)

app = FastAPI(title="Furação 2000 - Monitoramento de Temperatura")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

# Conexão com o Redis (cache distribuído)
cache = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    decode_responses=True,
    socket_connect_timeout=0.3,
    socket_timeout=0.3,
)

# Se o Redis falhar, não tenta de novo por alguns segundos
redis_pausado_ate = 0

# Evita que duas requisições leiam a porta serial ao mesmo tempo
trava_sensor = threading.Lock()

# Inicializa o banco de dados
inicializar_banco()


def ler_do_cache():
    """Retorna a última leitura guardada no Redis, ou None."""
    global redis_pausado_ate

    if time.monotonic() < redis_pausado_ate:
        return None

    try:
        valor = cache.get(CHAVE_CACHE)
        return json.loads(valor) if valor else None
    except redis.RedisError:
        redis_pausado_ate = time.monotonic() + 10
        return None  # Redis fora do ar: segue sem cache


def gravar_no_cache(dados):
    global redis_pausado_ate

    if time.monotonic() < redis_pausado_ate:
        return

    try:
        cache.set(CHAVE_CACHE, json.dumps(dados), ex=TEMPO_CACHE)
    except redis.RedisError:
        redis_pausado_ate = time.monotonic() + 10


@app.get("/")
def inicio(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.get("/temperatura")
def temperatura():
    # 1) Tenta o cache (evita ler o Arduino e gravar duplicado no banco)
    em_cache = ler_do_cache()
    if em_cache:
        em_cache["cache"] = True
        return em_cache

    # 2) Cache vazio: lê o sensor, com trava de concorrência
    with trava_sensor:
        # Outra requisição pode ter preenchido o cache enquanto esperávamos
        em_cache = ler_do_cache()
        if em_cache:
            em_cache["cache"] = True
            return em_cache

        dados = ler_temperatura()
        valor = dados["temperatura"]
        status = dados["status"]

        resposta = {
            "temperatura": valor,
            "unidade": "°C",
            "status": status,
            "cache": False,
        }

        # Registra e guarda em cache somente leituras válidas
        if valor is not None and status in ("real", "simulado"):
            salvar_leitura(valor, status)
            gravar_no_cache(resposta)

    return resposta


@app.get("/historico")
def historico():
    registros = obter_historico(100)

    return {
        "total": len(registros),
        "leituras": registros
    }


@app.get("/historico/csv")
def exportar_csv():
    registros = obter_todas_leituras()

    arquivo = io.StringIO(newline="")
    escritor = csv.writer(arquivo, delimiter=";")

    escritor.writerow([
        "ID",
        "Temperatura",
        "Unidade",
        "Origem dos dados",
        "Data e hora"
    ])

    for registro in registros:
        escritor.writerow([
            registro["id"],
            registro["temperatura"],
            registro["unidade"],
            registro["status"],
            registro["data_hora"]
        ])

    return Response(
        content=arquivo.getvalue().encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=historico_temperaturas.csv"
        },
    )


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)