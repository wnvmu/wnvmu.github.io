function calcularIdade(data) {
    var now = new Date();
    var today = new Date(now.getYear(), now.getMonth(), now.getDate());
    var yearNow = now.getYear();
    var monthNow = now.getMonth();
    var dateNow = now.getDate();
    var dob = new Date(
        data.substring(6, 10),
        data.substring(3, 5) - 1,
        data.substring(0, 2)
    );
    var yearDob = dob.getYear();
    var monthDob = dob.getMonth();
    var dateDob = dob.getDate();
    var age = {};
    yearAge = yearNow - yearDob;
    if (monthNow >= monthDob) var monthAge = monthNow - monthDob;
    else {
        yearAge--;
        var monthAge = 12 + monthNow - monthDob;
    }
    if (dateNow >= dateDob) var dateAge = dateNow - dateDob;
    else {
        monthAge--;
        var dateAge = 31 + dateNow - dateDob;

        if (monthAge < 0) {
            monthAge = 11;
            yearAge--;
        }
    }
    age = {
        years: yearAge,
        months: monthAge,
        days: dateAge
    };
    document.getElementById('idade').innerHTML = age.years;
}

function disponivel() {
    const hora = new Date();
    let h = hora.getHours();

    if (h >= 18 && h < 22) {
        document.getElementById('trabalho').innerHTML = "<div style='color:rgb(42, 240, 2);'>Disponível</div> das 18h às 22h";
    } else {
        document.getElementById('trabalho').innerHTML = "<div style='color:rgb(252, 6, 6);'>Indisponível</div>";
    }
}


function temposervico(data) {
    var now = new Date();
    var today = new Date(now.getYear(), now.getMonth(), now.getDate());
    var yearNow = now.getYear();
    var monthNow = now.getMonth();
    var dateNow = now.getDate();
    var dob = new Date(
        data.substring(6, 10),
        data.substring(3, 5) - 1,
        data.substring(0, 2)
    );
    var yearDob = dob.getYear();
    var monthDob = dob.getMonth();
    var dateDob = dob.getDate();
    var age = {};
    yearAge = yearNow - yearDob;
    if (monthNow >= monthDob) var monthAge = monthNow - monthDob;
    else {
        yearAge--;
        var monthAge = 12 + monthNow - monthDob;
    }
    if (dateNow >= dateDob) var dateAge = dateNow - dateDob;
    else {
        monthAge--;
        var dateAge = 31 + dateNow - dateDob;

        if (monthAge < 0) {
            monthAge = 11;
            yearAge--;
        }
    }
    age = {
        years: yearAge,
        months: monthAge,
        days: dateAge
    };
    document.getElementById('servico').innerHTML = age.years;
}


