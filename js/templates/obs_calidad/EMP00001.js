/**
 * Plantilla PDFMake - Observaciones de Calidad
 * Estructura parametrizada para fácil personalización de colores por empresa.
 */
export function generarDocDefinition(datos) {
    
    // ==========================================
    // CONFIGURACIÓN DE TEMA 
    // ==========================================
    const TEMA = {
        colorPrimario: '#000000',    
        colorSecundario: '#FBC501',  
        colorAcento: '#DC2626',      // Rojo (Pendiente)
        colorExito: '#16A34A',       // Verde (Levantada)
        colorRevision: '#2563EB',    // Azul (En revisión)
        fondoTituloLista: '#E2E8F0', 
        lineaBordes: '#1E293B',      
        textoGrisSecundario: '#64748B', 
        fondoPieFoto: '#F8FAFC',     
        textoEncabezado: '#FFFFFF'   
    };

    let colorEstado = TEMA.colorAcento;
    if (datos.estado === 'Levantada') colorEstado = TEMA.colorExito;
    else if (datos.estado === 'En revisión') colorEstado = TEMA.colorRevision;

    // ==========================================
    // ESTRUCTURAS DE CABECERA
    // ==========================================
    
    const crearHeader = () => ({
        table: {
            widths: ['30%', '70%'],
            body: [[
                datos.logo 
                    ? { image: datos.logo, fit: [110, 35], alignment: 'center', margin: [0, 2, 0, 2] } 
                    : { text: datos.nombreEmpresa || '', color: TEMA.textoEncabezado, bold: true, fontSize: 12, alignment: 'center', margin: [0, 8, 0, 0] },
                {
                    stack: [
                        { text: 'REPORTE DE OBSERVACIÓN DE CALIDAD', fontSize: 11, bold: true, color: TEMA.textoEncabezado, alignment: 'center' },
                        { text: 'PROYECTO', fontSize: 7, bold: true, color: TEMA.colorSecundario, alignment: 'center', margin: [0, 2, 0, 0] },
                        { text: (datos.nombreProyecto || '').toUpperCase(), fontSize: 9, bold: true, color: TEMA.textoEncabezado, alignment: 'center' }
                    ],
                    margin: [0, 2, 0, 2]
                }
            ]]
        },
        layout: { fillColor: () => TEMA.colorPrimario, hLineWidth: () => 0, vLineWidth: () => 0 },
        margin: [0, 0, 0, 3]
    });

    const crearMetadata = () => {
        return {
            table: {
                widths: ['50%', '50%'],
                body: [[
                    {
                        stack: [
                            { text: [{ text: 'FRENTE / SECTOR: ', bold: true, color: TEMA.textoGrisSecundario }, datos.frenteSector.toUpperCase()] },
                            { text: [{ text: 'UBICACIÓN: ', bold: true, color: TEMA.textoGrisSecundario }, datos.ubicacion.toUpperCase()] },
                            { text: [{ text: 'MOMENTO IDENT.: ', bold: true, color: TEMA.textoGrisSecundario }, (datos.momentoIdentificacion || '').toUpperCase()] },
                            { text: [{ text: 'REGISTRADO POR: ', bold: true, color: TEMA.textoGrisSecundario }, (datos.registradoPor || '').toUpperCase()] }
                        ],
                        fontSize: 8, margin: [4, 4, 4, 4]
                    },
                    {
                        stack: [
                            { text: [{ text: 'FECHA REGISTRO: ', bold: true, color: TEMA.textoGrisSecundario }, datos.fechaRegistro] },
                            { text: [{ text: 'N° REGISTRO: ', bold: true, color: TEMA.textoGrisSecundario }, { text: datos.idObservacion, color: TEMA.colorPrimario, bold: true }] },
                            { text: [{ text: 'ESTADO ACTUAL: ', bold: true, color: TEMA.textoGrisSecundario }, { text: datos.estado.toUpperCase(), color: colorEstado, bold: true }] }
                        ],
                        fontSize: 8, margin: [4, 4, 4, 4]
                    }
                ]]
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
            margin: [0, 0, 0, 6]
        };
    };

    const crearTituloSeccion = (titulo) => ({
        table: { widths: ['*'], body: [[{ text: titulo.toUpperCase(), fontSize: 9, bold: true, color: TEMA.colorPrimario, fillColor: TEMA.fondoTituloLista, margin: [4, 2, 4, 2] }]] },
        layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 3 : 0), vLineColor: () => TEMA.colorPrimario },
        margin: [0, 6, 0, 4]
    });

    // ==========================================
    // CUERPO DEL DOCUMENTO
    // ==========================================
    const docContent = [];

    docContent.push(crearTituloSeccion('1. CLASIFICACIÓN TÉCNICA'));
    docContent.push({
        table: {
            widths: ['50%', '50%'],
            body: [
                [
                    { text: [{ text: 'ESPECIALIDAD / TEMA: ', bold: true, color: TEMA.textoGrisSecundario }, datos.especialidadTema.toUpperCase()], fontSize: 8, margin: [4, 3, 4, 3] },
                    { text: [{ text: 'CATEGORÍA: ', bold: true, color: TEMA.textoGrisSecundario }, (datos.categoria || '').toUpperCase()], fontSize: 8, margin: [4, 3, 4, 3] }
                ],
                [
                    { text: [{ text: 'RESPONSABLE / SUBCONTRATA: ', bold: true, color: TEMA.textoGrisSecundario }, datos.responsable.toUpperCase()], fontSize: 8, margin: [4, 3, 4, 3] },
                    { text: [{ text: 'GRAVEDAD: ', bold: true, color: TEMA.textoGrisSecundario }, { text: (datos.gravedad || 'MEDIA').toUpperCase(), bold: true }], fontSize: 8, margin: [4, 3, 4, 3] }
                ],
                [
                    { text: [{ text: 'FECHA LÍMITE DE CIERRE: ', bold: true, color: TEMA.textoGrisSecundario }, datos.fechaLimite], colSpan: 2, fontSize: 8, margin: [4, 3, 4, 3] },
                    {}
                ]
            ]
        },
        layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
        margin: [0, 0, 0, 6]
    });

    docContent.push(crearTituloSeccion('2. DESCRIPCIÓN DEL HALLAZGO / NO CONFORMIDAD'));
    docContent.push({
        table: { widths: ['*'], body: [[{ text: datos.descripcionHallazgo, fontSize: 9, margin: [4, 4, 4, 4] }]] },
        layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
        margin: [0, 0, 0, 6]
    });

    docContent.push(crearTituloSeccion('3. EVIDENCIA FOTOGRÁFICA (ANTES Y DESPUÉS)'));

    const tablaFotosBody = [];
    const titulosFotos = [];
    const imagenesFotos = [];

    titulosFotos.push({ text: 'REGISTRO DEL HALLAZGO', fontSize: 8, bold: true, alignment: 'center', fillColor: TEMA.fondoPieFoto, margin: [0, 2, 0, 2] });
    if (datos.fotoHallazgo) imagenesFotos.push({ image: datos.fotoHallazgo, fit: [240, 180], alignment: 'center', margin: [0, 4, 0, 4] });
    else imagenesFotos.push({ text: 'Sin registro fotográfico adjunto.', fontSize: 8, italic: true, alignment: 'center', margin: [0, 40, 0, 40], color: TEMA.textoGrisSecundario });

    titulosFotos.push({ text: 'REGISTRO DE LA SOLUCIÓN', fontSize: 8, bold: true, alignment: 'center', fillColor: TEMA.fondoPieFoto, margin: [0, 2, 0, 2] });
    if (datos.fotoLevantamiento) imagenesFotos.push({ image: datos.fotoLevantamiento, fit: [240, 180], alignment: 'center', margin: [0, 4, 0, 4] });
    else {
        const txtFaltante = datos.estado === 'Levantada' ? 'Sin registro fotográfico.' : 'Solución pendiente de validación.';
        imagenesFotos.push({ text: txtFaltante, fontSize: 8, italic: true, alignment: 'center', margin: [0, 40, 0, 40], color: TEMA.textoGrisSecundario });
    }

    tablaFotosBody.push(titulosFotos);
    tablaFotosBody.push(imagenesFotos);

    docContent.push({
        table: { widths: ['50%', '50%'], body: tablaFotosBody },
        layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
        margin: [0, 0, 0, 6]
    });

    docContent.push(crearTituloSeccion('4. ACCIÓN CORRECTIVA Y LEVANTAMIENTO'));
    
    if (datos.estado === 'Levantada' || datos.estado === 'En revisión') {
        docContent.push({
            table: {
                widths: ['*'],
                body: [
                    [{ text: datos.descripcionLevantamiento, fontSize: 9, margin: [4, 4, 4, 4] }],
                    [{ 
                        columns: [
                            { text: [{ text: 'FECHA DE EJECUCIÓN: ', bold: true, color: TEMA.textoGrisSecundario }, datos.fechaLevantamiento], fontSize: 8 },
                            { text: [{ text: 'VALIDADO POR: ', bold: true, color: TEMA.textoGrisSecundario }, (datos.estado === 'En revisión' ? 'PENDIENTE DE APROBACIÓN' : datos.validadoPor)], fontSize: 8, alignment: 'right', color: colorEstado }
                        ],
                        margin: [4, 2, 4, 2]
                    }]
                ]
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
            margin: [0, 0, 0, 15]
        });
    } else {
        docContent.push({
            table: { widths: ['*'], body: [[{ text: `Observación actualmente PENDIENTE.`, fontSize: 9, italic: true, color: TEMA.textoGrisSecundario, margin: [4, 8, 4, 8], alignment: 'center' }]] },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes, defaultBorder: false },
            margin: [0, 0, 0, 15]
        });
    }

    docContent.push({
        columns: [
            { stack: [{ text: '_______________________', alignment: 'center', margin: [0, 30, 0, 5], color: TEMA.textoGrisSecundario }, { text: 'REPRESENTANTE CONTRATISTA', alignment: 'center', fontSize: 8, bold: true, color: TEMA.lineaBordes }, { text: 'Área de Ejecución / Producción', alignment: 'center', fontSize: 7, color: TEMA.textoGrisSecundario }] },
            { stack: [{ text: '_______________________', alignment: 'center', margin: [0, 30, 0, 5], color: TEMA.textoGrisSecundario }, { text: 'ÁREA DE CALIDAD (QA/QC)', alignment: 'center', fontSize: 8, bold: true, color: TEMA.lineaBordes }, { text: 'Supervisión / Control de Calidad', alignment: 'center', fontSize: 7, color: TEMA.textoGrisSecundario }] }
        ],
        margin: [0, 20, 0, 0],
        unbreakable: true
    });

    return {
        pageSize: 'A4',
        pageMargins: [25, 120, 25, 20], 
        header: function() {
            return { margin: [25, 12, 25, 0], stack: [ crearHeader(), crearMetadata() ] };
        },
        content: docContent,
        defaultStyle: { fontSize: 9, color: TEMA.colorPrimario }
    };
}