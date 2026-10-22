/**
 * Plantilla PDFMake
 * Estructura parametrizada para fácil personalización de colores por empresa.
 */
export function generarDocDefinition(datos) {
    
    // ==========================================
    // CONFIGURACIÓN DE TEMA (Modificar por empresa)
    // ==========================================
    const TEMA = {
        colorPrimario: '#000000',    // Azul corporativo (Fondos de encabezado y barras laterales)
        colorSecundario: '#FBC501',  // Verde corporativo (Texto 'PROYECTO')
        colorAcento: '#DC2626',      // Rojo (Para el N° de correlativo)
        fondoTituloLista: '#E2E8F0', // Gris claro (Fondo de barras de títulos de secciones)
        lineaBordes: '#1E293B',      // Azul oscuro casi negro (Bordes de tablas)
        textoGrisSecundario: '#64748B',// Gris medio (Cargo bajo la firma)
        fondoPieFoto: '#F8FAFC',     // Gris muy claro (Fondo del texto debajo de cada foto)
        textoEncabezado: '#FFFFFF'   // Blanco (Texto sobre el color primario)
    };
    // ==========================================

    // 1. Estructura de Encabezado
    const crearHeader = () => ({
        table: {
            widths: ['30%', '70%'],
            body: [[
                datos.logo 
                    ? { image: datos.logo, fit: [110, 35], alignment: 'center', margin: [0, 2, 0, 2] } 
                    : { text: datos.nombreEmpresa || '', color: TEMA.textoEncabezado, bold: true, fontSize: 12, alignment: 'center', margin: [0, 8, 0, 0] },
                {
                    stack: [
                        { text: 'REPORTE DIARIO DE AVANCE DE OBRA', fontSize: 10, bold: true, color: TEMA.textoEncabezado, alignment: 'center' },
                        { text: 'PROYECTO', fontSize: 7, bold: true, color: TEMA.colorSecundario, alignment: 'center', margin: [0, 1, 0, 0] },
                        { text: (datos.nombreProyecto || '').toUpperCase(), fontSize: 9, bold: true, color: TEMA.textoEncabezado, alignment: 'center' }
                    ],
                    margin: [0, 2, 0, 2]
                }
            ]]
        },
        layout: { fillColor: () => TEMA.colorPrimario, hLineWidth: () => 0, vLineWidth: () => 0 },
        margin: [0, 0, 0, 3]
    });

    // 2. Estructura de Metadatos Dinámica (Cuadro de Cliente / Fecha / Cargo)
    const crearMetadata = () => {
        const lineasIzquierda = [];
        
        // 1. Cliente
        if (datos.cliente) {
            lineasIzquierda.push({ text: [{ text: 'CLIENTE: ', bold: true }, { text: datos.cliente.toUpperCase() }] });
        }
        
        // 2. Supervisión
        if (datos.supervision) {
            lineasIzquierda.push({ text: [{ text: 'SUPERVISIÓN: ', bold: true }, { text: datos.supervision.toUpperCase() }] });
        }
        
        // 3. Contratista / Subcontratista
        let contratistaText = '';
        if (datos.rolEmpresaUsuario === 'Subcontratista' && datos.nombreEmpresa) {
           contratistaText = datos.nombreEmpresa.toUpperCase();
        } else if (datos.contratista) {
           contratistaText = datos.contratista.toUpperCase();
        }
        
        if (contratistaText) {
             lineasIzquierda.push({ text: [{ text: 'CONTRATISTA / SUBCONTRATISTA: ', bold: true }, { text: contratistaText }] });
        }

        // 4. Elaborado por
        const nombreAutor = (datos.elaboradoPor || '').toUpperCase();
        const cargoAutor = datos.cargoElaborador || 'Personal';
        
        lineasIzquierda.push({ 
            text: [
                { text: 'ELABORADO POR: ', bold: true }, 
                { text: `${nombreAutor} (${cargoAutor})` }
            ] 
        });

        return {
            table: {
                widths: ['65%', '35%'],
                body: [[
                    {
                        stack: lineasIzquierda,
                        fontSize: 8, margin: [2, 2, 2, 2]
                    },
                    {
                        stack: [
                            { text: [{ text: 'FECHA: ', bold: true }, datos.fecha] },
                            { text: [{ text: 'N° REGISTRO: ', bold: true }, { text: datos.correlativo, color: TEMA.colorAcento, bold: true }] }
                        ],
                        fontSize: 8, margin: [2, 2, 2, 2]
                    }
                ]]
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
            margin: [0, 0, 0, 0]
        };
    };

    // Función que transforma cada ítem en una FILA INDEPENDIENTE para forzar la repetición del título
    const crearTablaLista = (titulo, listaItems, textoVacio) => {
        const body = [
            [{ text: titulo.toUpperCase(), fontSize: 8, bold: true, color: TEMA.colorPrimario, fillColor: TEMA.fondoTituloLista }]
        ];

        if (listaItems && listaItems.length > 0) {
            listaItems.forEach(item => {
                body.push([{ ul: [item], margin: [5, 1, 5, 1] }]);
            });
        } else {
            body.push([{ text: textoVacio, fontSize: 8, italic: true, margin: [5, 2, 5, 2] }]);
        }

        return {
            table: {
                headerRows: 1, 
                dontBreakRows: true, 
                widths: ['*'],
                body: body
            },
            layout: {
                hLineWidth: () => 0,
                vLineWidth: (i) => (i === 0 ? 3 : 0),
                vLineColor: () => TEMA.colorPrimario
            },
            margin: [0, 4, 0, 4]
        };
    };

    // Estructura de Personal con título integrado como Fila 0
    const bodyPersonalConTitulo = [
        [{ text: '2. DISTRIBUCIÓN DE PERSONAL Y FRENTES DE TRABAJO', colSpan: 4, fontSize: 8, bold: true, color: TEMA.colorPrimario, fillColor: TEMA.fondoTituloLista, margin: [2, 2, 2, 2] }, {}, {}, {}],
        ...(datos.bodyPersonal || [])
    ];

    // 3. Contenido Principal de Texto
    const docContent = [
        crearTablaLista('1. Actividades Realizadas', datos.listaActividades, 'Sin actividades registradas.'),

        {
            table: {
                headerRows: 2, 
                dontBreakRows: true,
                widths: [25, '*', '*', 60],
                body: bodyPersonalConTitulo
            },
            layout: {
                hLineWidth: () => 1,
                vLineWidth: (i) => (i === 0 ? 3 : 1),
                hLineColor: () => TEMA.lineaBordes,
                vLineColor: (i) => (i === 0 ? TEMA.colorPrimario : TEMA.lineaBordes)
            },
            margin: [0, 4, 0, 4]
        },

        crearTablaLista('3. Anotaciones del Día / Observaciones', datos.listaAnotaciones, 'Sin anotaciones registradas.')
    ];

    // --- BLOQUE DE FIRMA AL FINAL DEL TEXTO ---
    const bloqueFirma = {
        margin: [0, 30, 0, 10], 
        stack: [],
        unbreakable: true 
    };

    if (datos.firmaGrafica) {
        bloqueFirma.stack.push({ image: datos.firmaGrafica, fit: [120, 60], alignment: 'center', margin: [0, 0, 0, 5] });
    } else {
        bloqueFirma.stack.push({ text: '_______________________', alignment: 'center', margin: [0, 30, 0, 5], color: TEMA.textoGrisSecundario });
    }

    const nombreFirma = datos.elaboradoPor ? datos.elaboradoPor.toUpperCase() : 'USUARIO NO IDENTIFICADO';
    const cargoFirma = datos.cargoElaborador ? datos.cargoElaborador.toUpperCase() : 'PERSONAL';

    bloqueFirma.stack.push(
        { text: nombreFirma, alignment: 'center', fontSize: 9, bold: true, color: TEMA.lineaBordes },
        { text: cargoFirma, alignment: 'center', fontSize: 8, color: TEMA.textoGrisSecundario }
    );

    docContent.push(bloqueFirma);

    // ==========================================
    // 4. BLOQUES FOTOGRÁFICOS DINÁMICOS
    // ==========================================
    if (datos.bloquesFotograficos && datos.bloquesFotograficos.length > 0) {
        
        // 4.1 Título General y Salto de Página
        docContent.push({ text: '', pageBreak: 'before' });
        docContent.push({
            table: {
                headerRows: 1,
                widths: ['*'],
                body: [
                    [{ text: 'REGISTRO FOTOGRÁFICO Y EVIDENCIAS', fontSize: 8, bold: true, color: TEMA.colorPrimario, fillColor: TEMA.fondoTituloLista }]
                ]
            },
            layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 3 : 0), vLineColor: () => TEMA.colorPrimario },
            margin: [0, 4, 0, 10]
        });

        // 4.2 Iterar por cada Bloque de Actividad
        datos.bloquesFotograficos.forEach(bloque => {
            
            // A. Creamos el objeto del Título pero NO lo inyectamos al documento todavía
            const tituloObj = {
                table: {
                    widths: ['*'],
                    body: [
                        [{ text: bloque.titulo, fontSize: 8, bold: true, color: TEMA.colorPrimario, fillColor: '#F8FAFC', margin: [4, 4, 4, 4] }]
                    ]
                },
                layout: { hLineWidth: () => 1, vLineWidth: () => 3, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.colorPrimario },
                margin: [0, 0, 0, 6]
            };

            // B. Pre-calculamos todas las filas de fotos de esta actividad
            const filasDeFotos = [];
            for (let i = 0; i < bloque.fotos.length; i += 2) {
                const f1 = bloque.fotos[i];
                const f2 = bloque.fotos[i + 1];
                const rowCols = [];

                // Columna 1 (Foto Izquierda)
                rowCols.push({
                    stack: [{
                        table: { widths: ['*'], body: [
                            [{ image: f1, fit: [260, 160], alignment: 'center', margin: [0, 2, 0, 2] }]
                        ]},
                        layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes }
                    }], width: '50%'
                });

                // Columna 2 (Foto Derecha o Vacío)
                if (f2) {
                    rowCols.push({
                        stack: [{
                            table: { widths: ['*'], body: [
                                [{ image: f2, fit: [260, 160], alignment: 'center', margin: [0, 2, 0, 2] }]
                            ]},
                            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes }
                        }], width: '50%'
                    });
                } else {
                    rowCols.push({ text: '', width: '50%' }); 
                }

                filasDeFotos.push({ columns: rowCols, columnGap: 12, margin: [0, 0, 0, 8] });
            }

            // C. MAGIA ANTIO-HUÉRFANOS: Amarra el Título con la PRIMERA fila de fotos
            if (filasDeFotos.length > 0) {
                // Inyectamos el título y la fila 1 en un "stack" inquebrantable
                docContent.push({
                    stack: [
                        tituloObj,
                        filasDeFotos[0]
                    ],
                    unbreakable: true 
                });

                // D. Inyectamos el resto de las filas de fotos (si la actividad tiene más de 2 fotos)
                for (let j = 1; j < filasDeFotos.length; j++) {
                    docContent.push({
                        stack: [ filasDeFotos[j] ],
                        unbreakable: true // Que no se corte la foto a la mitad
                    });
                }
            } else {
                // Por si alguna vez hay una actividad guardada extrañamente sin fotos
                docContent.push(tituloObj);
            }
            
            // Espaciado extra al terminar la actividad completa
            docContent.push({ text: '', margin: [0, 0, 0, 6] });
        });
    }

    // 5. Definición final con membrete global ajustado
    return {
        pageSize: 'A4',
        pageMargins: [25, 115, 25, 20],
        header: function(currentPage, pageCount) {
            return {
                margin: [25, 12, 25, 0],
                stack: [
                    crearHeader(),
                    crearMetadata()
                ]
            };
        },
        content: docContent
    };
}