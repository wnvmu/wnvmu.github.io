// Vari�vel global para armazenar refer�ncia ao combo do Google Tradutor
var comboGoogleTradutor = null;

// Inicializa o componente de tradu��o do Google
function googleTranslateElementInit() {
    new google.translate.TranslateElement({
        pageLanguage: 'pt',
        includedLanguages: 'en,es,it',
        layout: google.translate.TranslateElement.InlineLayout.HORIZONTAL
    }, 'google_translate_element');
}

// For�a o disparo do evento de "change" em um elemento
function changeEvent(el) {
    if (typeof Event === 'function') {
        el.dispatchEvent(new Event("change"));
    } else {
        // Para navegadores mais antigos
        var evObj = document.createEvent("HTMLEvents");
        evObj.initEvent("change", false, true);
        el.dispatchEvent(evObj);
    }
}

// Troca o idioma programaticamente (ex: "en", "es", "it")
function trocarIdioma(idioma) {
    var select = document.querySelector("select.goog-te-combo");

    if (select) {
        select.value = idioma;
        changeEvent(select);
    } else {
        alert("O tradutor ainda n�o foi carregado.");
    }
}
