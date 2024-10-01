function gerarCurriculoPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait', 'mm', 'a4');

    const nome = "Wellington Nunes Verzola";
    const email = "wellingtonnunesverzola@gmail.com";
    const telefone = "+55 28 99912-6625";
    const perfil = "Desenvolvedor back-end apaixonado com sólida formação em Sistemas de Informação e experiência em ambientes DevOps e desenvolvimento web.";

    const educacao = [
        "Especialização em Git e GitHub - Udemy, 2022",
        "Especialização em REST APIs com Delphi - Udemy, 2022",
        "Técnico em Eletrônica - Instituto Padre Réus, 2010",
        "Cursos Avançados em C#, JavaScript, PHP, Flutter e outros - 2022-2024"
    ];

    const experiencia = [
        "Desenvolvedor Back-End na Tecsystem Tecnologia em Software (Junho 2021 - Presente)",
        "Técnico de Informática - Programador na WNV Internet e Conectividade (2017 - 2021)",
        "Técnico de Manutenção de Sistemas na Casa do Toner LTDA (Maio 2007 - Jan 2008)"
    ];

    const habilidades = [
        "Delphi", "PHP", "C#", "JavaScript", "TypeScript", 
        "MySQL", "SQL Server", "Oracle", "Firebird", 
        "Scrum", "Kanban", "TDD", "Git", "Azure", "Redmine"
    ];

    const projetos = [
        "Geagro: Sistema de gestão agropecuária",
        "Facture-e: Plataforma de emissão de documentos fiscais",
        "PDV: Desenvolvimento de sistema de frente de caixa",
        "Comanda: Solução de gestão de pedidos"
    ];

    // Array para os diplomas
    const diplomas = [
        "images/portfolio/1.jpg",
        "images/portfolio/2.jpg",
        "images/portfolio/3.jpg",
        "images/portfolio/4.jpg",
        "images/portfolio/5.jpg",
        "images/portfolio/6.jpg",
        "images/portfolio/7.jpg",
        "images/portfolio/8.jpg",
        "images/portfolio/9.jpg",
        "images/portfolio/10.jpg",
        "images/portfolio/11.jpg",
        "images/portfolio/12.jpeg",
        "images/portfolio/13.jpeg",
        "images/portfolio/14.jpeg",
        "images/portfolio/15.jpeg",
        "images/portfolio/16.jpeg",
        "images/portfolio/17.jpeg",
        "images/portfolio/18.jpeg",
        "images/portfolio/19.jpeg",
        "images/portfolio/20.jpg",
        "images/portfolio/21.jpeg",
        "images/portfolio/22.jpeg"
    ];

    let y = 30;
    const marginLeft = 20;
    const maxWidth = 180;
    const pageHeight = doc.internal.pageSize.height;

    // Função para verificar se o texto excede a página
    function addNewPageIfNeeded(linesHeight) {
        if (y + linesHeight > pageHeight - marginLeft) {
            doc.addPage();
            y = 30; // Reseta a posição y para o topo da nova página
        }
    }

    // Adiciona a foto
    const imgUrl = 'images/wnv.jpg';
    const imgWidth = 30;
    const imgHeight = 30;

    // Baixa a imagem da foto e adiciona ao PDF
    const img = new Image();
    img.src = imgUrl;
    img.onload = () => {
        doc.addImage(img, 'JPEG', marginLeft, 10, imgWidth, imgHeight);
        y += imgHeight + 10;

        // Adiciona o restante do currículo
        doc.setFontSize(22);
        doc.text(nome, marginLeft, y);
        y += 10;
        doc.setFontSize(12);
        doc.text(`Email: ${email} | Telefone: ${telefone}`, marginLeft, y);
        y += 20;

        doc.setFontSize(14);
        doc.text("Perfil Profissional:", marginLeft, y);
        y += 10;
        doc.setFontSize(12);
        const perfilLines = doc.splitTextToSize(perfil, maxWidth);
        doc.text(perfilLines, marginLeft, y);
        y += perfilLines.length * 10 + 10;

        doc.setFontSize(14);
        doc.text("Educação:", marginLeft, y);
        y += 10;
        educacao.forEach((edu) => {
            doc.text(`- ${edu}`, marginLeft, y);
            y += 10;
        });

        doc.setFontSize(14);
        doc.text("Experiência Profissional:", marginLeft, y);
        y += 10;
        experiencia.forEach((exp) => {
            addNewPageIfNeeded(10);
            doc.text(`- ${exp}`, marginLeft, y);
            y += 10;
        });

        doc.setFontSize(14);
        doc.text("Habilidades:", marginLeft, y);
        y += 10;
        habilidades.forEach((habilidade) => {
            addNewPageIfNeeded(10);
            doc.text(`- ${habilidade}`, marginLeft, y);
            y += 10;
        });

        doc.setFontSize(14);
        doc.text("Projetos Relevantes:", marginLeft, y);
        y += 10;
        projetos.forEach((projeto) => {
            addNewPageIfNeeded(10);
            doc.text(`- ${projeto}`, marginLeft, y);
            y += 10;
        });

        // Adiciona os diplomas
        doc.setFontSize(14);
        doc.text("Diplomas:", marginLeft, y);
        y += 10;

        // Função para carregar os diplomas
        const DpLargura = 150;
        const DpAltura  = 100;
        const loadDiplomas = (diplomas, callback) => {
            let loadedDiplomas = 0;
            diplomas.forEach((diploma) => {
                const diplomaImg = new Image();
                diplomaImg.src = diploma;
                diplomaImg.onload = () => {
                    addNewPageIfNeeded(DpAltura + 10); // Ajusta a verificação de nova página
                    doc.addImage(diplomaImg, 'JPEG', marginLeft, y, DpLargura, DpAltura); // Define a largura e altura do diploma
                    y += DpAltura + 10; // Ajusta a posição y após o diploma

                    loadedDiplomas++;
                    if (loadedDiplomas === diplomas.length) {
                        callback(); // Chama o callback quando todos os diplomas forem carregados
                    }
                };
            });
        };


        loadDiplomas(diplomas, () => {
            doc.save("curriculo.pdf"); // Salva o PDF após carregar todos os diplomas
        });
    };
}
