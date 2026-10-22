/**
 * Plantilla Maestra pdfMake - PROTOCOLOS DE CALIDAD
 * Archivo: EMP00002.js
 */

export function generarDocDefinition(datos) {
    
    // ==========================================
    // CONFIGURACIÓN DE TEMA CORPORATIVO
    // ==========================================
    const TEMA = {
        colorPrimario: '#0000',    // Azul marino oscuro
        colorTitulos: '#FBC501',     // Azul corporativo (Titulos de tablas)
        colorAcento: '#DC2626',      // Rojo
        fondoCabecera: '#F8FAFC',    // Gris muy claro
        lineaBordes: '#CBD5E1',      // Gris intermedio
        textoGris: '#64748B',        // Gris etiquetas secundarias
        textoEncabezado: '#FFFFFF'   // Blanco
    };

    // ==========================================
    // 1. ENCABEZADO DE PÁGINA (HEADER GLOBAL)
    // ==========================================
    const crearHeader = () => ({
        table: {
            widths: ['28%', '72%'],
            body: [[
                datos.logo 
                    ? { image: datos.logo, fit: [110, 35], alignment: 'center', margin: [0, 2, 0, 2] } 
                    : { text: (datos.proyecto.contratista || '').toUpperCase(), color: TEMA.textoEncabezado, bold: true, fontSize: 10, alignment: 'center', margin: [0, 8, 0, 0] },
                {
                    stack: [
                        { text: 'PROTOCOLO DE LIBERACIÓN Y CALIDAD', fontSize: 10, bold: true, color: TEMA.textoEncabezado, alignment: 'center' },
                        { text: (datos.protocolo.codigo_visible || '').toUpperCase(), fontSize: 9, bold: true, color: '#FBC501', alignment: 'center', margin: [0, 1, 0, 0] },
                        { text: `PROYECTO: ${(datos.proyecto.nombre || '').toUpperCase()}`, fontSize: 8, bold: true, color: TEMA.textoEncabezado, alignment: 'center' }
                    ],
                    margin: [0, 2, 0, 2]
                }
            ]]
        },
        layout: { fillColor: () => TEMA.colorPrimario, hLineWidth: () => 0, vLineWidth: () => 0 },
        margin: [0, 0, 0, 3]
    });

    // ==========================================
    // 2. METADATOS Y DATOS GENERALES
    // ==========================================
    const crearMetadata = () => {
        return {
            table: {
                widths: ['20%', '30%', '15%', '35%'],
                body: [
                    [
                        { text: 'CLIENTE:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: (datos.proyecto.cliente || '').toUpperCase(), fontSize: 8 },
                        { text: 'SUPERVISIÓN:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: (datos.proyecto.supervision || '').toUpperCase(), fontSize: 8 }
                    ],
                    [
                        { text: 'CONTRATISTA:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: (datos.proyecto.contratista || '').toUpperCase(), fontSize: 8 },
                        { text: 'CORRELATIVO:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: `N° ${datos.protocolo.correlativo}`, fontSize: 8, bold: true, color: TEMA.colorAcento }
                    ],
                    [
                        { text: 'FECHA:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: datos.protocolo.fecha_inspeccion, fontSize: 8 },
                        { text: 'ESTADO:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: (datos.protocolo.estado || 'En proceso').toUpperCase(), fontSize: 8, bold: true, color: '#16A34A' }
                    ],
                    [
                        { text: 'FRENTE / SECTOR:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: `${datos.protocolo.frente} / ${datos.protocolo.sector}`, fontSize: 8 },
                        { text: 'UBICACIÓN (EJES):', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: datos.protocolo.ubicacion_ejes, fontSize: 8 }
                    ],
                    [
                        { text: 'PLANO REF.:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: datos.protocolo.plano_referencia, fontSize: 8 },
                        { text: 'ELEMENTO:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: datos.protocolo.elemento_liberar, fontSize: 8, bold: true }
                    ]
                ]
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
            margin: [0, 0, 0, 8]
        };
    };

    // ==========================================
    // 3. CUERPO DINÁMICO (CHECKLISTS, OBS Y LIBERACIÓN)
    // ==========================================
    const docContent = [];

    if (datos.checklists && datos.checklists.length > 0) {
        datos.checklists.forEach((seccion, indexSeccion) => {
            
            // Título de la sección de checklist
            docContent.push({
                table: {
                    widths: ['*'],
                    body: [[
                        { text: `${indexSeccion + 1}. ${(seccion.titulo || '').toUpperCase()}`, fontSize: 8, bold: true, color: TEMA.colorPrimario, fillColor: TEMA.fondoCabecera, margin: [2, 2, 2, 2] }
                    ]]
                },
                layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 3 : 0), vLineColor: () => TEMA.colorTitulos },
                margin: [0, 6, 0, 2]
            });

            // Encabezado de tabla de ítems
            const tablaChecklistBody = [
                [
                    { text: 'ÍTEM', bold: true, fontSize: 8, alignment: 'center', fillColor: TEMA.fondoCabecera },
                    { text: 'DESCRIPCIÓN DE LA ACTIVIDAD', bold: true, fontSize: 8, fillColor: TEMA.fondoCabecera },
                    { text: 'SÍ', bold: true, fontSize: 8, alignment: 'center', fillColor: TEMA.fondoCabecera },
                    { text: 'NO', bold: true, fontSize: 8, alignment: 'center', fillColor: TEMA.fondoCabecera },
                    { text: 'N/A', bold: true, fontSize: 8, alignment: 'center', fillColor: TEMA.fondoCabecera }
                ]
            ];

            // Inyección de filas con trazabilidad por ítem
            if (seccion.items && seccion.items.length > 0) {
                seccion.items.forEach((item, itemIndex) => {
                    const descTexto = item.descripcion || item;
                    // Detectar quién lo marcó y a qué hora
                    const trazaUsuario = item.traza?.usuario ? `Editado por ${item.traza.usuario}` : '';
                    const trazaHora = item.traza?.fecha ? ` (${new Date(item.traza.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})` : '';

                    tablaChecklistBody.push([
                        { text: itemIndex + 1, fontSize: 8, alignment: 'center', color: TEMA.textoGris, margin: [0, 2, 0, 2] },
                        { 
                            stack: [
                                { text: descTexto, fontSize: 8 },
                                trazaUsuario 
                                    ? { text: `${trazaUsuario}${trazaHora}`, fontSize: 6, italics: true, color: TEMA.textoGris, margin: [0, 2, 0, 0] } 
                                    : {}
                            ],
                            margin: [0, 2, 0, 2]
                        },
                        { text: item.estado === 'SI' ? 'X' : '', bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
                        { text: item.estado === 'NO' ? 'X' : '', bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
                        { text: item.estado === 'NA' ? 'X' : '', bold: true, alignment: 'center', margin: [0, 2, 0, 2] }
                    ]);
                });
            } else {
                tablaChecklistBody.push([{ text: 'Sin criterios registrados en esta fase.', colSpan: 5, italic: true, fontSize: 8, alignment: 'center', color: TEMA.textoGris }, {}, {}, {}, {}]);
            }

            docContent.push({
                table: {
                    headerRows: 1,
                    dontBreakRows: true,
                    widths: ['6%', '76%', '6%', '6%', '6%'],
                    body: tablaChecklistBody
                },
                layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
                margin: [0, 0, 0, 4]
            });

            // Bloque de Anotaciones y Observaciones Levantadas con Autor, Fecha y Hora
            if (seccion.observaciones && seccion.observaciones.length > 0) {
                const stackObs = [
                    { text: 'REGISTRO DE ANOTACIONES Y OBSERVACIONES:', fontSize: 7, bold: true, color: TEMA.textoGris, margin: [0, 0, 0, 4] }
                ];

                seccion.observaciones.forEach(o => {
                    const fechaVisible = o.fecha ? new Date(o.fecha).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'}) : '';
                    const cabeceraObs = `• [${(o.tipo || 'Anotación').toUpperCase()}] - ${o.usuario || 'Usuario'} (${fechaVisible}):`;
                    
                    let detalleTexto = o.texto;
                    // Si fue levantada, mostramos quién y cuándo la solucionó
                    if (o.tipo === 'Levantado' && o.levantadoPor) {
                        const fechaLev = o.levantadoPor.fecha ? new Date(o.levantadoPor.fecha).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'}) : '';
                        detalleTexto += `\n   ↳ Solucionado por: ${o.levantadoPor.nombre} (${fechaLev})`;
                    }

                    stackObs.push({
                        text: [
                            { text: `${cabeceraObs} `, bold: true, fontSize: 7.5, color: o.tipo === 'Por Levantar' ? '#DC2626' : (o.tipo === 'Levantado' ? '#16A34A' : TEMA.colorPrimario) },
                            { text: detalleTexto, fontSize: 7.5, italics: true }
                        ],
                        margin: [0, 1, 0, 3]
                    });
                });

                docContent.push({
                    table: {
                        widths: ['*'],
                        body: [[{ stack: stackObs, fillColor: '#F8FAFC', margin: [4, 4, 4, 4] }]]
                    },
                    layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
                    margin: [0, 0, 0, 4]
                });
            }

            // Bloque de Responsable y Fecha de Liberación por Sección
            if (seccion.responsable_fase || seccion.fecha_fase) {
                docContent.push({
                    table: {
                        widths: ['60%', '40%'],
                        body: [[
                            { text: [{ text: 'RESPONSABLE DE LIBERACIÓN: ', bold: true, color: TEMA.textoGris }, { text: (seccion.responsable_fase || '-').toUpperCase(), bold: true }], fontSize: 7.5, margin: [4, 3, 4, 3] },
                            { text: [{ text: 'FECHA DE LIBERACIÓN: ', bold: true, color: TEMA.textoGris }, { text: seccion.fecha_fase || '-' }], fontSize: 7.5, alignment: 'right', margin: [4, 3, 4, 3] }
                        ]]
                    },
                    layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
                    margin: [0, 0, 0, 10]
                });
            }
        });
    }

    // ==========================================
    // 4. BLOQUE DE FIRMAS DIGITALES FINALES
    // ==========================================
    const renderFirma = (firmaObjeto, tituloLabel) => {
        if (!firmaObjeto || !firmaObjeto.nombre) {
            return {
                stack: [
                    { text: '_______________________', alignment: 'center', margin: [0, 25, 0, 3], color: TEMA.lineaBordes },
                    { text: tituloLabel, alignment: 'center', fontSize: 7, bold: true, color: TEMA.colorTitulos }
                ]
            };
        }
        return {
            stack: [
                { text: firmaObjeto.nombre.toUpperCase(), alignment: 'center', fontSize: 8, bold: true, color: TEMA.colorPrimario },
                { text: (firmaObjeto.cargo || 'PERSONAL').toUpperCase(), alignment: 'center', fontSize: 6.5, color: TEMA.textoGris },
                { text: firmaObjeto.fecha, alignment: 'center', fontSize: 6, color: TEMA.textoGris, margin: [0, 1, 0, 2] },
                { text: '_______________________', alignment: 'center', margin: [0, 0, 0, 3], color: TEMA.lineaBordes },
                { text: tituloLabel, alignment: 'center', fontSize: 7, bold: true, color: '#000000' }
            ]
        };
    };

    docContent.push({
        columns: [
            renderFirma(datos.firmas.elaborado, 'ELABORADO POR'),
            renderFirma(datos.firmas.revisado, 'REVISADO POR'),
            renderFirma(datos.firmas.aprobado, 'APROBADO POR')
        ],
        margin: [0, 20, 0, 0],
        unbreakable: true
    });

    // ==========================================
    // RETORNO DEL DOCUMENTO DEFINITIVO
    // ==========================================
    return {
        pageSize: 'A4',
        pageMargins: [25, 120, 25, 20],
        header: function() {
            return {
                margin: [25, 12, 25, 0],
                stack: [
                    crearHeader(),
                    crearMetadata()
                ]
            };
        },
        content: docContent,
        defaultStyle: { fontSize: 9, color: TEMA.colorPrimario }
    };
}