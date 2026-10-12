// ==========================================
// app_core.js - NÚCLEO CENTRAL DE LA APLICACIÓN (Optimizado)
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
const firebaseConfig = {
    apiKey: "AIzaSyCiTCag6lwIZcwjnAHPDf0ANaBX0B7DYlY",
    authDomain: "indexscorp.firebaseapp.com",
    projectId: "indexscorp",
    storageBucket: "indexscorp.firebasestorage.app",
    messagingSenderId: "925382774481",
    appId: "1:925382774481:web:19a3bcbc23bfc89fecbff0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

window.APP_STATE = {
    user: {},
    empresa: {},
    proyectoActivo: {}
};

function cargarEstadoDesdeCache() {
    const cache = localStorage.getItem("INDEX_APP_STATE");
    if (cache) {
        window.APP_STATE = JSON.parse(cache);
        return true;
    }
    return false;
}

// NUEVO: Manejo del diccionario de empresas en caché local
function obtenerDiccionarioEmpresas() {
    const cache = localStorage.getItem("INDEX_EMPRESAS_DICT");
    return cache ? JSON.parse(cache) : {};
}

function guardarDiccionarioEmpresas(dict) {
    localStorage.setItem("INDEX_EMPRESAS_DICT", JSON.stringify(dict));
}

export function initAppCore(requiereProyecto = true) {
    return new Promise((resolve, reject) => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get('projectId');
        
        const tieneCache = cargarEstadoDesdeCache();

        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                localStorage.removeItem("INDEX_APP_STATE");
                localStorage.removeItem("INDEX_EMPRESAS_DICT");
                if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
                    window.location.href = "index.html"; 
                }
                resolve(null);
                return;
            }

            // OPTIMIZACIÓN 1: Separar la carga de Usuario y la carga de Proyecto
            const necesitaCargarUsuario = !tieneCache; 
            const proyectoCambiado = requiereProyecto && urlProjectId && window.APP_STATE.proyectoActivo.id !== urlProjectId;
            const necesitaCargarProyecto = requiereProyecto && urlProjectId && (!tieneCache || proyectoCambiado);

            try {
                // A. Consultar Usuario y Empresa Matriz (Solo si no hay caché en absoluto)
                if (necesitaCargarUsuario) {
                    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
                    if (!userDoc.exists()) throw new Error("Usuario no encontrado en la base de datos.");
                    const userData = userDoc.data();

                    window.APP_STATE.user = {
                        uid: user.uid,
                        email: userData.email_user || user.email,
                        nombre: userData.name_user || "Usuario Desconocido",
                        cargo: userData.cargo_user || "Sin Cargo",
                        rolUser: userData.rol_user || "Usuario",
                        rolEmpresa: userData.rol_empresa || "Personal",
                        idEmpresa: userData.id_empresa || "",
                        firmaUrl: userData.firma_user || "",
                        proyectosPermitidos: userData.proyect_user || "",
                        appsHabilitadas: userData.apps_habilitadas || []
                    };

                    if (window.APP_STATE.user.idEmpresa) {
                        // 1. Extraer datos de la empresa (incluyendo marca de agua)
                        const empDoc = await getDoc(doc(db, "empresas", window.APP_STATE.user.idEmpresa));
                        if (empDoc.exists()) {
                            const empData = empDoc.data();
                            window.APP_STATE.empresa = {
                                id: empDoc.id,
                                nombre: empData.nombre_empresa || "",
                                logo: empData.logo_empresa || "",
                                logo_marca_agua: empData.logo_marca_agua || "" 
                            };
                        }
                        
                        // 2. Extraer lista de proyectos
                        const proyectosQuery = query(collection(db, "proyectos"), where("id_empresa", "==", window.APP_STATE.user.idEmpresa));
                        const proySnap = await getDocs(proyectosQuery);
                        const listaProyectos = [];
                        const permitidos = (window.APP_STATE.user.proyectosPermitidos || "").split(/[,;]/).map(p => p.trim());
                        
                        proySnap.forEach(docSnap => {
                            if (window.APP_STATE.user.rolUser === "Admin" || permitidos.includes(docSnap.id)) {
                                const pData = docSnap.data();
                                listaProyectos.push({
                                    id: docSnap.id,
                                    nombre: pData.name_proyect,
                                    estado: pData.state_proyect
                                });
                            }
                        });
                        localStorage.setItem("INDEX_PROYECTOS_LIST", JSON.stringify(listaProyectos));
                    }
                }

                // B. Consultar Proyecto (Solo si es un proyecto nuevo o no hay caché)
                if (necesitaCargarProyecto) {
                    const proyDoc = await getDoc(doc(db, "proyectos", urlProjectId));
                    if (proyDoc.exists()) {
                        const proyData = proyDoc.data();
                        const idCliente = proyData.client_proyect || "";
                        const idContratista = proyData.contratista_proyect || "";
                        const idSupervision = proyData.supervision_proyect || "";

                        // OPTIMIZACIÓN 2: Diccionario de Empresas para evitar lecturas repetidas
                        const dictEmpresas = obtenerDiccionarioEmpresas();
                        let dictModificado = false;

                        const buscarNombreEmpresa = async (idEmpresaBusqueda) => {
                            if (!idEmpresaBusqueda) return "";
                            // Si ya la leímos antes en otro proyecto, usamos la memoria
                            if (dictEmpresas[idEmpresaBusqueda]) return dictEmpresas[idEmpresaBusqueda];
                            
                            try {
                                const empRef = await getDoc(doc(db, "empresas", idEmpresaBusqueda));
                                if (empRef.exists()) {
                                    const nombre = empRef.data().nombre_empresa || "";
                                    dictEmpresas[idEmpresaBusqueda] = nombre;
                                    dictModificado = true;
                                    return nombre;
                                }
                            } catch (e) {
                                console.warn(`Error al leer empresa relacional ${idEmpresaBusqueda}`, e);
                            }
                            return ""; 
                        };

                        const [nombreCliente, nombreContratista, nombreSupervision] = await Promise.all([
                            buscarNombreEmpresa(idCliente),
                            buscarNombreEmpresa(idContratista),
                            buscarNombreEmpresa(idSupervision)
                        ]);

                        if (dictModificado) guardarDiccionarioEmpresas(dictEmpresas);

                        window.APP_STATE.proyectoActivo = {
                            id: proyDoc.id,
                            nombre: proyData.name_proyect || urlProjectId,
                            frentes: proyData.frentes || [],
                            sectores: proyData.sectores || [],
                            especialidades: proyData.especialidad || [],
                            rubrosMap: proyData.rubrosmap || {},
                            protocolosMap: proyData.protocolos_map || {},
                            cliente: nombreCliente,
                            contratista: nombreContratista,
                            supervision: nombreSupervision,
                            idClienteOficial: idCliente,
                            idContratistaOficial: idContratista,
                            idSupervisionOficial: idSupervision,
                            correosrepdiaPara: proyData.correos_repdia_para || "",
                            correosrepdiaCC: proyData.correos_repdia_cc || "",
                            correosobscalPara: proyData.correos_obscal_para || "",
                            correosobscalCC: proyData.correos_obscal_cc || "",
                            appsHabilitadas: proyData.apps || [], 
                            idfolder_regfoto_proyect: proyData.idfolder_regfoto_proyect || "",
                            idfolder_repdia_proyect: proyData.idfolder_repdia_proyect || "",
                            idfolder_obscal_proyect: proyData.idfolder_obscal_proyect || "" 
                        };
                    }
                }

                // C. Recalcular Permisos y Guardar (Solo si algo cambió)
                if (necesitaCargarUsuario || necesitaCargarProyecto) {
                    if (requiereProyecto && window.APP_STATE.proyectoActivo.id) {
                        const appsProyecto = window.APP_STATE.proyectoActivo.appsHabilitadas;
                        const appsUsuario = window.APP_STATE.user.appsHabilitadas;
                        window.APP_STATE.user.appsPermitidasEnEsteProyecto = appsUsuario.filter(app => appsProyecto.includes(app));
                    } else {
                        window.APP_STATE.user.appsPermitidasEnEsteProyecto = window.APP_STATE.user.appsHabilitadas;
                    }

                    localStorage.setItem("INDEX_APP_STATE", JSON.stringify(window.APP_STATE));
                }

            } catch (error) {
                console.error("Error al sincronizar el Core:", error);
                reject(error);
                return;
            }

            actualizarUiGlobal();

            // NUEVO: Avisar a los componentes de la interfaz (como el sidebar) que los datos ya están en caché
            window.dispatchEvent(new CustomEvent('CoreStateReady'));


            resolve(window.APP_STATE);
        });
    });
}

function actualizarUiGlobal() {
    const user = window.APP_STATE.user;
    const iniciales = user.nombre ? user.nombre.substring(0, 2).toUpperCase() : "US";
    
    const initialsBtn = document.getElementById("nav-user-initials");
    if (initialsBtn) initialsBtn.textContent = iniciales;

    const nameLabel = document.getElementById("dropdown-user-name");
    if (nameLabel) nameLabel.textContent = user.nombre;

    const rolLabel = document.getElementById("dropdown-user-rol");
    if (rolLabel) rolLabel.textContent = `${user.cargo} (${user.rolEmpresa})`;

    const projNameLabel = document.getElementById('sidebar-project-name');
    if (projNameLabel && window.APP_STATE.proyectoActivo.nombre) {
        projNameLabel.textContent = window.APP_STATE.proyectoActivo.nombre;
    }
}

// ==========================================
// FUNCIONES GLOBALES REUTILIZABLES
// ==========================================

window.cerrarSesionGlobal = function() {
    signOut(auth).then(() => {
        localStorage.removeItem("INDEX_APP_STATE");
        localStorage.removeItem("INDEX_EMPRESAS_DICT");
        localStorage.removeItem("INDEX_CATALOGO_APPS"); 
        localStorage.removeItem("INDEX_PROYECTOS_LIST"); // <--- AQUÍ SE AÑADE
        window.location.href = "index.html"; 
    });
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('-translate-x-full');
        sidebar.classList.toggle('translate-x-0');
        overlay.classList.toggle('hidden');
    }
};

window.toggleUserMenu = function() {
    const menu = document.getElementById('user-menu');
    if (menu) menu.classList.toggle('hidden');
};