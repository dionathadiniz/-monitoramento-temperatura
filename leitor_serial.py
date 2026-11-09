
import random
import time
import serial
from serial.tools import list_ports

conexao = None
ultima_tentativa = 0


def conectar_arduino():
    global conexao, ultima_tentativa

    if conexao is not None and conexao.is_open:
        return conexao

    # Evita tentar reconectar a cada atualização
    if time.monotonic() - ultima_tentativa < 5:
        return None

    ultima_tentativa = time.monotonic()

    for porta in list_ports.comports():
        if not porta.device.startswith(("/dev/ttyACM", "/dev/ttyUSB")):
            continue

        try:
            conexao = serial.Serial(
                porta.device,
                baudrate=9600,
                timeout=2
            )

            # Aguarda a inicialização do Arduino
            time.sleep(2)
            conexao.reset_input_buffer()

            return conexao

        except serial.SerialException:
            conexao = None

    return None


def ler_temperatura():
    global conexao

    arduino = conectar_arduino()

    if arduino is not None:
        try:
            linha = arduino.readline()
            texto = linha.decode("utf-8").strip()

            # Sensor não conseguiu realizar a leitura
            if texto == "ERRO" or not texto:
                return {
                    "temperatura": None,
                    "status": "erro"
                }

            temperatura = float(texto)

            return {
                "temperatura": temperatura,
                "status": "real"
            }

        except (ValueError, UnicodeDecodeError):
            return {
                "temperatura": None,
                "status": "erro"
            }

        except serial.SerialException:
            if conexao is not None:
                try:
                    conexao.close()
                except serial.SerialException:
                    pass

            conexao = None

    # Simulação quando o Arduino não está conectado
    return {
        "temperatura": round(random.uniform(20, 30), 1),
        "status": "simulado"
    }
