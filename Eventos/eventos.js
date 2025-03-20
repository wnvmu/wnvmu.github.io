const horariosBC = [
    "21:10", "21:40", "22:10", "22:40", "23:10", "23:40",
    "00:10", "00:40", "02:10", "04:10", "06:10", "08:10",
    "10:10", "12:10", "14:10", "16:10", "18:10", "18:40",
    "19:10", "19:40", "20:10"
];

const horariosDS = [
    "21:20", "21:50", "22:20", "22:50", "23:20", "23:50", "00:20", "00:50",
    "02:20", "04:20", "06:20", "08:20", "10:20", "12:20", "14:20", "16:20",
    "18:20", "18:50", "19:20", "19:50", "20:20"
];

const horariosCC = ["22:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

var REFRESH = 1000;
var dialTimeout;
var txtBC;
var txtDS;
var txtCC;

function loadMain() {
    txtBC = document.getElementById("tempoBC");
    txtDS = document.getElementById("tempoDS");
    txtCC = document.getElementById("tempoCC");
    txtBC.innerHTML = "Carregando...";
    txtDS.innerHTML = "Carregando...";  
    txtCC.innerHTML = "Carregando...";
    updateGadgetDials();
};

function updateGadgetDials() {
    clearTimeout(dialTimeout);
    if (txtBC) {
        txtBC.innerHTML = calcularTempoRestante(horariosBC);
    }

    if (txtDS) {
        txtDS.innerHTML = calcularTempoRestante(horariosDS);
    }

    if (txtCC) {
        txtCC.innerHTML = calcularTempoRestante(horariosCC);
    }

        setTimeout(updateGadgetDials, REFRESH); 
};

function calcularTempoRestante(horarios) {
    let now = new Date();
    let currentTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    let horariosComDiferenca = horarios.map(horario => {
        let [horas, minutos] = horario.split(":").map(Number);
        let horarioSegundos = horas * 3600 + minutos * 60;

        // Se o horário já passou, considera o próximo dia
        if (horarioSegundos < currentTime) {
            horarioSegundos += 24 * 3600;
        }

        let timeDifference = horarioSegundos - currentTime;
        return { horario, timeDifference };
    });

    // Ordena para pegar o próximo horário mais próximo
    horariosComDiferenca.sort((a, b) => a.timeDifference - b.timeDifference);
    let nextHorario = horariosComDiferenca[0].horario;
    let nextTime = horariosComDiferenca[0].timeDifference;

    // Exibir "Aberto" 5 minutos antes do horário alvo
    if (nextTime <= 300) { // 300 segundos = 5 minutos antes do evento
        return "<font color='green'>Aberto</font>";
    }

    // Converte para HH:MM:SS formatado
    let hours = Math.floor(nextTime / 3600);
    let min = Math.floor((nextTime % 3600) / 60);
    let sec = nextTime % 60;

    return `${String(hours).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
