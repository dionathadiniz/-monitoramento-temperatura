
const temperaturaElemento = document.getElementById("temperature");
const statusElemento = document.getElementById("temperature-status");
const conexaoElemento = document.getElementById("connection-text");
const pontoConexao = document.getElementById("connection-dot");
const ultimaAtualizacao = document.getElementById("last-update");

const maximaElemento = document.getElementById("max-temperature");
const minimaElemento = document.getElementById("min-temperature");

const fonteElemento = document.getElementById("sensor-source");
const descricaoElemento = document.getElementById("sensor-description");

const cacheElemento = document.getElementById("cache-source");
const cacheDescricao = document.getElementById("cache-description");

const preenchimento = document.getElementById("temperature-fill");

const canvas = document.getElementById("temperature-chart");
const ctx = canvas.getContext("2d");

let historico = [];
let temperaturaMaxima = null;
let temperaturaMinima = null;

const MAX_LEITURAS = 20;

function atualizarConexao(conectado, mensagem) {
    conexaoElemento.textContent = mensagem;

    pontoConexao.classList.toggle("online", conectado);
    pontoConexao.classList.toggle("offline", !conectado);
}

function atualizarTemperatura(dados) {
    const temperatura = dados.temperatura;

    if (temperatura === null || temperatura === undefined) {
        throw new Error("Temperatura indisponível");
    }

    const valor = Number(temperatura);

    if (!Number.isFinite(valor)) {
        throw new Error("Valor de temperatura inválido");
    }

    temperaturaElemento.textContent = valor.toFixed(1);

    // Atualiza máxima e mínima
    if (temperaturaMaxima === null || valor > temperaturaMaxima) {
        temperaturaMaxima = valor;
    }

    if (temperaturaMinima === null || valor < temperaturaMinima) {
        temperaturaMinima = valor;
    }

    maximaElemento.textContent = `${temperaturaMaxima.toFixed(1)} °C`;
    minimaElemento.textContent = `${temperaturaMinima.toFixed(1)} °C`;

    // Atualiza a barra de temperatura (escala visual de 0 a 50 °C)
    const percentual = Math.max(0, Math.min(100, (valor / 50) * 100));
    preenchimento.style.width = `${percentual}%`;

    // Classificação visual
    if (valor >= 35) {
        statusElemento.textContent = "Temperatura elevada";
        statusElemento.className = "temperature-status hot";
    } else if (valor >= 28) {
        statusElemento.textContent = "Temperatura moderada";
        statusElemento.className = "temperature-status warning";
    } else {
        statusElemento.textContent = "Temperatura normal";
        statusElemento.className = "temperature-status normal";
    }

    // Identifica a origem dos dados
    if (dados.status === "real") {
        fonteElemento.textContent = "Arduino conectado";
        descricaoElemento.textContent = "Dados recebidos diretamente do sensor.";
    } else if (dados.status === "simulado") {
        fonteElemento.textContent = "Modo simulado";
        descricaoElemento.textContent = "Temperatura gerada pelo servidor.";
    } else {
        fonteElemento.textContent = "Sensor com erro";
        descricaoElemento.textContent = "Verifique a comunicação com o Arduino.";
    }
        // Indica se a leitura veio do cache Redis
    if (dados.cache === true) {
        cacheElemento.textContent = "Servida do cache";
        cacheDescricao.textContent = "Leitura recente reaproveitada do Redis.";
    } else {
        cacheElemento.textContent = "Leitura nova";
        cacheDescricao.textContent = "Dado lido do sensor e gravado no cache.";
    }

    // Guarda as últimas 20 leituras
    historico.push({
        hora: new Date().toLocaleTimeString("pt-BR"),
        valor: valor
    });

    if (historico.length > MAX_LEITURAS) {
        historico.shift();
    }

    ultimaAtualizacao.textContent = new Date().toLocaleTimeString("pt-BR");

    desenharGrafico();
}

function desenharGrafico() {
    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;

    if (!largura || !altura) return;

    const escala = window.devicePixelRatio || 1;

    canvas.width = largura * escala;
    canvas.height = altura * escala;

    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.clearRect(0, 0, largura, altura);

    const margem = {
        esquerda: 35,
        direita: 15,
        topo: 20,
        baixo: 25
    };

    const areaLargura = largura - margem.esquerda - margem.direita;
    const areaAltura = altura - margem.topo - margem.baixo;

    // Linhas horizontais do gráfico
    ctx.strokeStyle = "#293449";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
        const y = margem.topo + (areaAltura / 4) * i;

        ctx.beginPath();
        ctx.moveTo(margem.esquerda, y);
        ctx.lineTo(largura - margem.direita, y);
        ctx.stroke();

        ctx.fillStyle = "#8793a8";
        ctx.font = "11px Arial";
        ctx.fillText(`${50 - i * 12.5}°`, 2, y + 4);
    }

    if (historico.length === 0) {
        ctx.fillStyle = "#8793a8";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Aguardando dados...", largura / 2, altura / 2);
        ctx.textAlign = "left";
        return;
    }

    const pontos = historico.map((item, index) => {
        const x = margem.esquerda +
            (historico.length === 1
                ? areaLargura / 2
                : (index / (MAX_LEITURAS - 1)) * areaLargura);

        const valorLimitado = Math.max(0, Math.min(50, item.valor));
        const y = margem.topo + areaAltura -
            (valorLimitado / 50) * areaAltura;

        return { x, y };
    });

    // Área preenchida abaixo da linha
    ctx.beginPath();
    ctx.moveTo(pontos[0].x, margem.topo + areaAltura);

    pontos.forEach(ponto => {
        ctx.lineTo(ponto.x, ponto.y);
    });

    ctx.lineTo(pontos[pontos.length - 1].x, margem.topo + areaAltura);
    ctx.closePath();

    const gradiente = ctx.createLinearGradient(0, margem.topo, 0, altura);
    gradiente.addColorStop(0, "rgba(40, 150, 255, 0.30)");
    gradiente.addColorStop(1, "rgba(40, 150, 255, 0.01)");

    ctx.fillStyle = gradiente;
    ctx.fill();

    // Linha da temperatura
    ctx.beginPath();

    pontos.forEach((ponto, index) => {
        if (index === 0) {
            ctx.moveTo(ponto.x, ponto.y);
        } else {
            ctx.lineTo(ponto.x, ponto.y);
        }
    });

    ctx.strokeStyle = "#39a5ff";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // Marcador da última leitura
    const ultimo = pontos[pontos.length - 1];

    ctx.beginPath();
    ctx.arc(ultimo.x, ultimo.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ultimo.x, ultimo.y, 9, 0, Math.PI * 2);
    ctx.strokeStyle = "#39a5ff";
    ctx.lineWidth = 2;
    ctx.stroke();
}

async function buscarTemperatura() {
    try {
        const resposta = await fetch("/temperatura");

        if (!resposta.ok) {
            throw new Error("Erro ao consultar o servidor");
        }

        const dados = await resposta.json();

        if (dados.status === "erro" || dados.temperatura === null) {
            throw new Error("Falha na leitura do sensor");
        }

        atualizarTemperatura(dados);

        if (dados.status === "real") {
            atualizarConexao(true, "Arduino conectado");
        } else if (dados.status === "simulado") {
            atualizarConexao(true, "Modo simulado");
        } else {
            atualizarConexao(false, "Sensor indisponível");
        }

    } catch (erro) {
        console.error("Erro:", erro);

        temperaturaElemento.textContent = "--";
        statusElemento.textContent = "Não foi possível obter a temperatura";
        statusElemento.className = "temperature-status hot";

        fonteElemento.textContent = "Sem comunicação";
        descricaoElemento.textContent = "Verifique se o servidor está funcionando.";

        atualizarConexao(false, "Servidor desconectado");
        ultimaAtualizacao.textContent = "--:--:--";
    }
}

// Primeira leitura imediata
buscarTemperatura();

// Atualização a cada 3 segundos
setInterval(buscarTemperatura, 3000);

// Redesenha o gráfico quando a janela muda de tamanho
window.addEventListener("resize", desenharGrafico);
