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
const preenchimentoMax = document.getElementById("max-fill");
const preenchimentoMin = document.getElementById("min-fill");
const tabelaCorpo = document.getElementById("readings-body");

const canvas = document.getElementById("temperature-chart");
const ctx = canvas.getContext("2d");

const FONTE = "'IBM Plex Sans', Arial, sans-serif";

let historico = [];
let temperaturaMaxima = null;
let temperaturaMinima = null;

let contadorLeituras = 0;   // identifica cada leitura do gráfico
let pontosGrafico = [];     // posições dos pontos, usadas no mouse
let pontoSelecionado = null; // id da leitura sob o mouse

const MAX_LEITURAS = 20;

function percentual(valor) {
    return Math.max(0, Math.min(100, (valor / 50) * 100));
}

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

    maximaElemento.textContent = temperaturaMaxima.toFixed(1);
    minimaElemento.textContent = temperaturaMinima.toFixed(1);

    // Barras (escala visual de 0 a 50 °C)
    preenchimento.style.width = `${percentual(valor)}%`;
    preenchimentoMax.style.width = `${percentual(temperaturaMaxima)}%`;
    preenchimentoMin.style.width = `${percentual(temperaturaMinima)}%`;

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

    // Origem dos dados
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
    contadorLeituras += 1;

    historico.push({
        id: contadorLeituras,
        hora: new Date().toLocaleTimeString("pt-BR"),
        valor: valor
    });

    if (historico.length > MAX_LEITURAS) {
        historico.shift();
    }

    ultimaAtualizacao.textContent = new Date().toLocaleTimeString("pt-BR");

    desenharGrafico();
}

/* ---------- GRÁFICO ---------- */

function caixaArredondada(x, y, largura, altura, raio) {
    ctx.beginPath();
    ctx.moveTo(x + raio, y);
    ctx.arcTo(x + largura, y, x + largura, y + altura, raio);
    ctx.arcTo(x + largura, y + altura, x, y + altura, raio);
    ctx.arcTo(x, y + altura, x, y, raio);
    ctx.arcTo(x, y, x + largura, y, raio);
    ctx.closePath();
}

function desenharTooltip(ponto, ehAtual, larguraCanvas) {
    const linhaSuperior = ehAtual ? `Atual · ${ponto.hora}` : ponto.hora;
    const linhaInferior = `${ponto.valor.toFixed(1)} °C`;

    ctx.font = `11px ${FONTE}`;
    const larguraSuperior = ctx.measureText(linhaSuperior).width;

    ctx.font = `600 16px ${FONTE}`;
    const larguraInferior = ctx.measureText(linhaInferior).width;

    const largura = Math.max(larguraSuperior, larguraInferior) + 24;
    const altura = 50;

    let x = ponto.x - largura / 2;
    x = Math.max(4, Math.min(larguraCanvas - largura - 4, x));

    let y = ponto.y - altura - 14;
    if (y < 4) {
        y = ponto.y + 14;
    }

    ctx.fillStyle = "#2a1e22";
    caixaArredondada(x, y, largura, altura, 8);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.fillStyle = "#cdbfc4";
    ctx.font = `11px ${FONTE}`;
    ctx.fillText(linhaSuperior, x + 12, y + 19);

    ctx.fillStyle = "#ffffff";
    ctx.font = `600 16px ${FONTE}`;
    ctx.fillText(linhaInferior, x + 12, y + 39);
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
    ctx.strokeStyle = "#d3cdcf";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
        const y = margem.topo + (areaAltura / 4) * i;

        ctx.beginPath();
        ctx.moveTo(margem.esquerda, y);
        ctx.lineTo(largura - margem.direita, y);
        ctx.stroke();

        ctx.fillStyle = "#6b5f63";
        ctx.font = `11px ${FONTE}`;
        ctx.textAlign = "left";
        ctx.fillText(`${50 - i * 12.5}°`, 2, y + 4);
    }

    if (historico.length === 0) {
        pontosGrafico = [];
        ctx.fillStyle = "#6b5f63";
        ctx.font = `14px ${FONTE}`;
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

        return { x, y, id: item.id, hora: item.hora, valor: item.valor };
    });

    pontosGrafico = pontos;

    // Área preenchida abaixo da linha
    ctx.beginPath();
    ctx.moveTo(pontos[0].x, margem.topo + areaAltura);

    pontos.forEach(ponto => {
        ctx.lineTo(ponto.x, ponto.y);
    });

    ctx.lineTo(pontos[pontos.length - 1].x, margem.topo + areaAltura);
    ctx.closePath();

    const gradiente = ctx.createLinearGradient(0, margem.topo, 0, altura);
    gradiente.addColorStop(0, "rgba(200, 32, 47, 0.22)");
    gradiente.addColorStop(1, "rgba(200, 32, 47, 0.02)");

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

    ctx.strokeStyle = "#c8202f";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // Marcador da última leitura
    const ultimo = pontos[pontos.length - 1];

    ctx.beginPath();
    ctx.arc(ultimo.x, ultimo.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#c8202f";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ultimo.x, ultimo.y, 9, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(200, 32, 47, 0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ponto sob o mouse: guia, destaque e caixa com valor e hora
    const selecionado = pontos.find(p => p.id === pontoSelecionado);

    if (selecionado) {
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(selecionado.x, margem.topo);
        ctx.lineTo(selecionado.x, margem.topo + areaAltura);
        ctx.strokeStyle = "rgba(35, 26, 29, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(selecionado.x, selecionado.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#c8202f";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        desenharTooltip(selecionado, selecionado.id === ultimo.id, largura);
    }
}

function encontrarPontoProximo(mx, my) {
    if (pontosGrafico.length === 0) return null;

    // Ponto mais próximo na horizontal
    let maisProximo = pontosGrafico[0];
    for (const ponto of pontosGrafico) {
        if (Math.abs(ponto.x - mx) < Math.abs(maisProximo.x - mx)) {
            maisProximo = ponto;
        }
    }

    // Sobre a bolinha de um ponto
    const distancia = Math.hypot(maisProximo.x - mx, maisProximo.y - my);
    if (distancia <= 14) return maisProximo;

    // Sobre a linha entre dois pontos
    for (let i = 0; i < pontosGrafico.length - 1; i++) {
        const a = pontosGrafico[i];
        const b = pontosGrafico[i + 1];

        if (mx >= a.x && mx <= b.x) {
            const t = (mx - a.x) / (b.x - a.x);
            const yLinha = a.y + (b.y - a.y) * t;

            if (Math.abs(my - yLinha) <= 14) return maisProximo;
        }
    }

    return null;
}

canvas.addEventListener("pointermove", evento => {
    const area = canvas.getBoundingClientRect();
    const mx = evento.clientX - area.left;
    const my = evento.clientY - area.top;

    const ponto = encontrarPontoProximo(mx, my);
    const novoId = ponto ? ponto.id : null;

    if (novoId !== pontoSelecionado) {
        pontoSelecionado = novoId;
        canvas.style.cursor = ponto ? "pointer" : "default";
        desenharGrafico();
    }
});

canvas.addEventListener("pointerleave", () => {
    if (pontoSelecionado !== null) {
        pontoSelecionado = null;
        canvas.style.cursor = "default";
        desenharGrafico();
    }
});

/* ---------- TABELA ---------- */

function criarCelula(texto, classe) {
    const td = document.createElement("td");
    td.textContent = texto;
    if (classe) td.className = classe;
    return td;
}

async function carregarTabela() {
    try {
        const resposta = await fetch("/historico");
        if (!resposta.ok) return;

        const dados = await resposta.json();

        const ultimas = [...dados.leituras]
            .sort((a, b) => b.id - a.id)
            .slice(0, 6);

        if (ultimas.length === 0) return;

        tabelaCorpo.replaceChildren();

        ultimas.forEach(leitura => {
            const data = new Date(leitura.data_hora);
            const dataTexto = isNaN(data)
                ? leitura.data_hora
                : data.toLocaleString("pt-BR");

            const origem = leitura.status === "real" ? "Arduino" : "Simulado";

            const linha = document.createElement("tr");
            linha.appendChild(criarCelula(leitura.id));
            linha.appendChild(criarCelula(dataTexto));
            linha.appendChild(criarCelula(origem));
            linha.appendChild(
                criarCelula(`${Number(leitura.temperatura).toFixed(1)} °C`, "num")
            );

            tabelaCorpo.appendChild(linha);
        });
    } catch (erro) {
        console.error("Erro ao carregar a tabela:", erro);
    }
}

/* ---------- COMUNICAÇÃO COM O SERVIDOR ---------- */

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
        carregarTabela();

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