// 1. Importar módulos necesarios
const express = require('express');
const PDFDocument = require('pdfkit');
// const fs = require('fs'); // No lo usaremos para enviar directamente

// 2. Crear la aplicación Express
const app = express();
const port = 3000; // Puedes cambiar este puerto si el 3000 está ocupado

// 3. Middleware para entender JSON y permitir CORS (IMPORTANTE para pruebas locales)
app.use(express.json()); // Para leer el body JSON de la petición fetch
app.use((req, res, next) => { // Middleware CORS básico
    res.header('Access-Control-Allow-Origin', '*'); // Permite cualquier origen (¡Cuidado en producción!)
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Expose-Headers', 'Content-Disposition'); // Exponer este header al JS del cliente
    next();
});


// 4. Definir la ruta POST para generar el PDF
app.post('/generate-pdf', (req, res) => {
    console.log("-> Petición POST recibida en /generate-pdf");
    const data = req.body; // Aquí están los datos del formulario

    // Validar datos básicos (puedes añadir más validaciones)
    if (!data || !data.evaluatorName || !data.residentName || !data.scores || !data.comments) {
        console.error("Error: Faltan datos en la petición.");
        return res.status(400).json({ message: 'Faltan datos necesarios para generar el PDF.' });
    }

    console.log("   Evaluador:", data.evaluatorName);
    console.log("   Residente:", data.residentName);

    try {
        // 5. Crear un nuevo documento PDF
        const doc = new PDFDocument({
            size: 'LETTER',
            margins: { top: 50, bottom: 50, left: 60, right: 60 }, // Márgenes ajustados
            bufferPages: true // Bueno para calcular saltos de página más fácil
        });

        // 6. Configurar la respuesta HTTP para que sea un PDF descargable
        const safeEvaluatorName = (data.evaluatorName || 'Evaluador').replace(/[^a-zA-Z0-9_]/g, '_');
        const safeResidentName = (data.residentName || 'Residente').replace(/[^a-zA-Z0-9_]/g, '_');
        const filename = `Evaluacion_${safeResidentName}_${safeEvaluatorName}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        // Asegúrate que el nombre de archivo no tenga caracteres problemáticos y use comillas dobles
        res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);

        // 7. Conectar ("pipe") el documento PDF a la respuesta HTTP
        // Lo que dibujemos en 'doc' se enviará directamente al navegador.
        doc.pipe(res);

        // 8. Añadir contenido al PDF (usando pdfkit)

        // --- Funciones auxiliares para añadir contenido ---
        const addSectionTitle = (title) => {
            doc.moveDown(1.5).fontSize(13).font('Helvetica-Bold').text(title, { align: 'left' });
            doc.lineCap('butt').moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2).lineWidth(0.5).strokeColor("#aaaaaa").stroke().moveDown(0.5);
        };

        const addCriteriaLine = (label, score) => {
             const scoreText = `[ ${score || '?'} ]`;
             const labelWidth = doc.widthOfString(label);
             const scoreWidth = doc.widthOfString(scoreText);
             const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right - scoreWidth - 5; // Espacio para puntos

             // Truncar etiqueta si es muy larga (opcional)
             let displayLabel = label;
             if (labelWidth > availableWidth) {
                 displayLabel = doc.font('Helvetica').fontSize(9).ellipsise(label, availableWidth); // Necesita un plugin o lógica custom para ellipsis
                 // Simplificación: simplemente lo dejamos que haga wrap si pdfkit lo soporta o cortamos manualmente
                 // displayLabel = label.substring(0, Math.floor(availableWidth / (doc.widthOfString('M')/1))) + '...'; // Estimación muy burda
             }

             doc.font('Helvetica').fontSize(9).text(displayLabel, { continued: true, width: availableWidth, lineBreak: false }); // No continuar línea si no cabe
             doc.text(scoreText, { align: 'right' }); // Alinear puntaje a la derecha
        };

        const addCommentBlock = (label, text) => {
             doc.moveDown(0.5).font('Helvetica-Oblique').fontSize(9).text(label, { continued: false }); // Resetear posición
             doc.font('Helvetica').fontSize(9).text(text || '(Sin comentarios)', { indent: 15 });
        };


        // --- Contenido Principal ---
        doc.fontSize(16).font('Helvetica-Bold').text('Evaluación de Pase de Visita - R2 Cuidados Intensivos', { align: 'center' });
        doc.moveDown(1.5);
        doc.fontSize(11).font('Helvetica-Bold').text(`Residente: ${data.residentName}`);
        doc.text(`Evaluador: ${data.evaluatorName}`);

        // Mapeo de IDs a etiquetas legibles (¡IMPORTANTE COMPLETAR ESTO BIEN!)
        const criteriaLabels = {
            'crit_1_1': 'Evaluación inicial y priorización de problemas',
            'crit_1_2': 'Razonamiento diagnóstico e interpretación de exámenes',
            'crit_1_3': 'Plan terapéutico integral (farma/no-farma, objetivos)',
            'crit_1_4': 'Manejo de soporte orgánico (VM, vasoactivos, etc.)',
            'crit_2_1': 'Presentación del caso (claridad, concisión, síntesis)',
            'crit_2_2': 'Comunicación con paciente/familia (plan, empatía)',
            'crit_2_3': 'Interacción con equipo (claridad, respeto, colaboración)',
            'crit_3_1': 'Dirección del pase de visita',
            'crit_3_2': 'Gestión del tiempo y enfoque',
            'crit_3_3': 'Involucramiento del equipo (enfermería, etc.)',
            'crit_4_1': 'Actitud y conducta profesional (respeto, responsabilidad)',
            'crit_4_2': 'Respuesta a preguntas (reflexiva, honesta, no defensiva)',
            'crit_4_3': 'Reconocimiento de limitaciones y búsqueda de ayuda',
        };

        // Secciones
        const sectionsData = [
            { title: '1. Manejo Clínico y Toma de Decisiones', criteriaPrefix: 'crit_1_', commentKey: 'comments_1' },
            { title: '2. Comunicación', criteriaPrefix: 'crit_2_', commentKey: 'comments_2' },
            { title: '3. Liderazgo y Organización', criteriaPrefix: 'crit_3_', commentKey: 'comments_3' },
            { title: '4. Profesionalismo', criteriaPrefix: 'crit_4_', commentKey: 'comments_4' }
        ];

        sectionsData.forEach(section => {
            addSectionTitle(section.title);
            Object.keys(data.scores).forEach(scoreKey => {
                if (scoreKey.startsWith(section.criteriaPrefix)) {
                    const label = criteriaLabels[scoreKey] || scoreKey; // Usar etiqueta o ID si no se encuentra
                    addCriteriaLine(label, data.scores[scoreKey]);
                }
            });
            addCommentBlock('Comentarios:', data.comments[section.commentKey]);
        });

        // Evaluación General
        addSectionTitle('Evaluación General');
        addCommentBlock('Comentarios Generales / Síntesis:', data.comments['comments_general']);
        doc.moveDown();
        doc.font('Helvetica-Bold').fontSize(11);
        doc.text(`Recomendación Final: ${data.recommendation || 'N/A'}`);
        doc.text(`Puntaje Promedio: ${data.averageScore || '--'}`);


        // 9. Finalizar el documento PDF (esto cierra el stream)
        doc.end();
        console.log(`   PDF "${filename}" generado y enviado.`);

    } catch (error) {
        console.error("Error durante la generación del PDF:", error);
        // Si ocurre un error DESPUÉS de empezar a enviar la respuesta, no podemos cambiar el status code.
        // Simplemente cerramos la conexión si es posible (aunque 'pipe' y 'end' deberían manejarlo).
        // Si el error ocurre antes de 'doc.pipe(res)', podemos enviar un 500.
        if (!res.headersSent) {
             res.status(500).json({ message: 'Error interno del servidor al generar el PDF.' });
        } else {
            // Si ya se enviaron headers, sólo podemos intentar cerrar.
             res.end();
        }
    }
});

// 5. Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor Node.js escuchando en http://localhost:${port}`);
    console.log(`Abre el archivo evaluacion.html en tu navegador.`);
});