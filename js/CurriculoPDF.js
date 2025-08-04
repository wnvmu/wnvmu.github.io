
function gerarCurriculoPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait', 'mm', 'a4');

    const nome = "Wellington Nunes Verzola";
    const email = "wellingtonnunesverzola@gmail.com";
    const telefone = "+55 28 99912-6625";
    const perfil = "Desenvolvedor back-end com sólida formação em Sistemas de Informação, ampla experiência em DevOps e desenvolvimento web, com foco em soluções escaláveis e de qualidade.";

    const educacao = [
        "Git e GitHub - Udemy (2022)",
        "REST APIs com Delphi - Udemy (2022)",
        "C#, JavaScript, PHP, Flutter e outros - Udemy (2022–2024)",
        "Técnico em Eletrônica - Instituto Padre Réus (2010)"
    ];

    const experiencia = [
        "Analista de Sistemas Pleno 3 | Tecsystem Tecnologia (Jun/2021 - Atual)",
        "Programador - WNV Internet e Conectividade (2017 – 2021)",
        "Técnico de Manutenção - Casa do Toner LTDA (2007 – 2008)"
    ];

    const habilidades = [
        "Delphi", "C#", "JavaScript", "TypeScript", "PHP", "Flutter",
        "MySQL", "SQL Server", "Oracle", "Firebird",
        "Git", "Azure DevOps", "Scrum", "Kanban", "TDD", "Redmine"
    ];

    const projetos = [
        "Geagro: Gestão agropecuária",
        "Facture-e: Emissão de documentos fiscais",
        "PDV: Sistema de frente de caixa",
        "Comanda: Gestão de pedidos"
    ];

    const diplomas = Array.from({ length: 22 }, (_, i) =>
        `images/portfolio/${i + 1}.${i + 1 >= 12 ? 'jpeg' : 'jpg'}`
    );

    const imgUrl = 'images/wnv.jpg';
    const marginLeft = 20;
    const maxWidth = 170;
    const imgWidth = 30;
    const imgHeight = 30;
    const pageHeight = doc.internal.pageSize.height;

    let y = 30;

    function addNewPageIfNeeded(linesHeight) {
        if (y + linesHeight > pageHeight - 20) {
            doc.addPage();
            y = 30;
        }
    }

    const img = new Image();
    img.src = imgUrl;
    img.onload = () => {
        doc.addImage(img, 'JPEG', marginLeft, 10, imgWidth, imgHeight);
        y += imgHeight + 5;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text(nome, marginLeft + imgWidth + 10, 20);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Email: ${email} | Tel: ${telefone}`, marginLeft + imgWidth + 10, 28);
        y += 10;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Perfil Profissional", marginLeft, y);
        y += 8;
        doc.setFont("helvetica", "normal");
        const perfilLines = doc.splitTextToSize(perfil, maxWidth);
        doc.text(perfilLines, marginLeft, y);
        y += perfilLines.length * 7 + 5;

        const blocos = [
            { titulo: "Educação", dados: educacao },
            { titulo: "Experiência Profissional", dados: experiencia },
            { titulo: "Habilidades", dados: habilidades },
            { titulo: "Projetos Relevantes", dados: projetos }
        ];

        blocos.forEach(bloco => {
            addNewPageIfNeeded(20);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text(bloco.titulo, marginLeft, y);
            y += 8;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);

            if (Array.isArray(bloco.dados)) {
                bloco.dados.forEach(item => {
                    addNewPageIfNeeded(8);
                    const lines = doc.splitTextToSize(`• ${item}`, maxWidth);
                    doc.text(lines, marginLeft, y);
                    y += lines.length * 6;
                });
            }

            y += 5;
        });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Diplomas", marginLeft, y);
        y += 8;

        const DpLargura = 150;
        const DpAltura = 100;
        let loadedDiplomas = 0;

        diplomas.forEach((diploma) => {
            const diplomaImg = new Image();
            diplomaImg.src = diploma;
            diplomaImg.onload = () => {
                addNewPageIfNeeded(DpAltura + 10);
                doc.addImage(diplomaImg, 'JPEG', marginLeft, y, DpLargura, DpAltura);
                y += DpAltura + 10;
                loadedDiplomas++;
                if (loadedDiplomas === diplomas.length) {
                    doc.save("curriculo_profissional.pdf");
                }
            };
        });
    };
}
