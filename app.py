
from flask import Flask, render_template, jsonify
from leitor_serial import ler_temperatura

app = Flask(__name__)


@app.route("/")
def inicio():
    return render_template("index.html")


@app.route("/temperatura")
def temperatura():
    dados = ler_temperatura()

    return jsonify({
        "temperatura": dados["temperatura"],
        "unidade": "°C",
        "status": dados["status"]
    })


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
