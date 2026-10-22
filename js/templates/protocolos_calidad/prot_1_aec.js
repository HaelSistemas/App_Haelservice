// ==========================================
// PLANTILLA: Liberación de Vaciado de Concreto
// RUTA: js/templates/protocolos_calidad/PROT_CONCRETO.js
// ==========================================

export default {
    id: "PROT_CONCRETO",
    nombreVisible: "Liberación de Vaciado de Concreto",
    requiereVolumenConcreto: true, // Esto enciende el acordeón de vínculo con la app de vaceado
    
    secciones: [
        {
            titulo: "CHECK LIST DE VERIFICACIÓN DE COLOCACIÓN DE ARMADURA",
            items: [
                "Limpieza de armadura (concreto, corrosión o grasa)",
                "Diámetro Especificado (Ø = según plano)",
                "Colocación de Armadura (Tolerancia ± 1 cm)",
                "Verificación de cantidades",
                "Verificación de espaciamientos",
                "Verificación de longitudes de Traslape (Tolerancia ± 1 cm)",
                "Colocación de separadores de acero para doble malla",
                "Verificación de doblado según especificación"
            ]
        },
        {
            titulo: "CHECK LIST DE VERIFICACIÓN DE COLOCACIÓN DE ENCOFRADO",
            items: [
                "Verificación de trazos y niveles",
                "Limpieza de paneles y accesorios (planchas o madera)",
                "Colocación de desmoldante / sellador",
                "Conformidad de dimensiones (modulación) y accesorios (alineadores, cuñas, etc)",
                "Verificación de niveles, alineamiento, verticalidad y horizontalidad",
                "Conformidad de recubrimientos (dados de concreto / ruedas de plástico)",
                "Verificación de contraflechas (de acuerdo a planos)",
                "Verificación de ochavos y/o biseles",
                "Verificación de insertos y embebidos",
                "Verificación de hermeticidad de encofrado"
            ]
        },
        {
            titulo: "CHECK LIST DE LIBERACIÓN DE INSTALACIONES",
            items: [
                "IISS: tendido de redes, ubicación de puntos de salida y pases",
                "IIEE: todos los puntos (interruptores, tomacorrientes, TV, intercom,etc)",
                "Pernos de Anclaje y embebidos fijados correctamente",
            ]
        },

        {
            titulo: "CHECK LIST DE LIBERACIÓN DE VACEADO DE CONCRETO",
            items: [
                "Limpieza previa al vaciado",
                "Topografía, cotas de fondo y nivel de concreto",
                "Ejes y dimensiones",
                "Verificación del procedimiento de seguridad",
                "Equipos y materiales operativos",
                "Aplicación de puente de adherencia"
            ]
        }


        
    ]
};