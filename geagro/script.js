function processFile() {
    const fileInput = document.getElementById('fileInput');
    const output = document.getElementById('output');
    const outdados = document.getElementById('outdados');

    // Limpa a saída para cada nova leitura de arquivo
    output.innerHTML = '';
    outdados.innerHTML = '';

    if (fileInput.files.length === 0) {
        alert('Por favor, selecione um arquivo SPED.');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(event) {
        const fileContent = event.target.result;
        const lines = fileContent.split('\n');

        let foundErrors = false;
        let empresa = '';
        let ano = '';
        let versao = '';

        // Loop para verificar cada linha em busca de registros
        lines.forEach((line, index) => {
            const registroTipo = line.substring(1, 5); // Extraí o tipo de registro (ex: D100)

            // Capture informações do registro '0000'
            if (registroTipo === '0000') {
                const fields = line.split('|'); // Separa os campos usando o delimitador "|"
                empresa = fields[6].trim(); // Nome da empresa
                ano = fields[4].substring(fields[4].length - 4); // Extraindo o ano da data de início (ex: 01082023 -> 2023)
                versao = fields[2]; // O número de versão pode estar neste campo ou ajuste conforme necessário
            }

            if (config.registros[registroTipo]) { // Verifica se o registro está configurado
                const fields = line.split('|'); // Separa os campos usando o delimitador "|"

                const div = document.createElement('div');
                div.classList.add('record');
                let errorMessages = [];

                // Validações para os campos configurados
                Object.keys(config.registros[registroTipo].campos).forEach((campo) => {
                    const campoValue = fields[campo] ? fields[campo].trim() : '';
                    if (!campoValue) {
                        errorMessages.push(`Campo: ${campo}<br>Mensagem de erro: ${config.registros[registroTipo].campos[campo]}`);
                    }
                });

                // Monta o cabeçalho do registro
                const recordHeader = `
                    <div class="record-header">
                        <button class="expand-btn" onclick="toggleErrorDetails(this)">+</button>
                        <p class="error-record">Registro ${registroTipo} (linha ${index + 1}): ${line}</p>
                    </div>
                `;

                // Se houver mensagens de erro, destacá-las
                if (errorMessages.length > 0) {
                    foundErrors = true;
                    div.innerHTML = `
                        ${recordHeader}
                        <div class="error-details" style="display: none;">${errorMessages.join('<br>')}</div>
                    `;
                    div.classList.add('error'); // Adiciona classe para o erro
                    output.appendChild(div);
                }
            }
        });

        // Exibe as informações da empresa, ano e versão
        if (empresa || ano || versao) {
            outdados.innerHTML = `
                <br><strong>Versão SPED:</strong> ${versao}
                <strong>Ano base:</strong> ${ano} 
                <strong>Empresa:</strong> ${empresa}   
            `;
        }

        // Mensagem se não houver erros encontrados
        if (!foundErrors) {
            output.innerHTML = 'Nenhum erro encontrado nos registros.';
        }
    };

    reader.readAsText(file);
}

function toggleErrorDetails(button) {
    const details = button.parentElement.nextElementSibling;
    const record = button.closest('.record'); // Obtém o registro atual

    // Alterna a exibição dos detalhes de erro
    if (details.style.display === 'none' || details.style.display === '') {
        details.style.display = 'block';
        button.textContent = '-';
        record.classList.add('expanded'); // Adiciona a classe para expandir
    } else {
        details.style.display = 'none';
        button.textContent = '+';
        record.classList.remove('expanded'); // Remove a classe para encolher
    }
}
