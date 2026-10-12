// ==========================================
// index.js - PORTAL PRINCIPAL (Optimizado)
// ==========================================

import { auth, db, initAppCore } from "./app_core.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let proyectoActual = null;
window.proyectosEnMemoria = {}; // Caché en RAM para no releer proyectos

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('indexCorp_user');
    const savedPass = localStorage.getItem('indexCorp_pass');
    if(savedUser && savedPass) {
        document.getElementById('user-input').value = savedUser;
        document.getElementById('pass-input').value = savedPass;
        document.getElementById('recordar').checked = true;
    }

    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.addEventListener('click', iniciarSesion);

    initAppCore(false).then((estadoGlobal) => {
        const pantallaCarga = document.getElementById('pantalla-carga');
        const bloqueLogin = document.getElementById('bloque-login');

        if (estadoGlobal && estadoGlobal.user.uid) {
            bloqueLogin.classList.add('hidden');
            document.getElementById('navbar-global').classList.remove('hidden');
            document.getElementById('bloque-proyectos').classList.remove('hidden');
            document.getElementById('bloque-apps').classList.add('hidden');
            
            window.cargarProyectos();
            
            if(pantallaCarga) pantallaCarga.classList.add('hidden');
        } else {
            bloqueLogin.classList.remove('hidden');
            bloqueLogin.classList.add('flex');
            if(pantallaCarga) pantallaCarga.classList.add('hidden');
        }
    }).catch(error => {
        console.error("Error al inicializar la app:", error);
        alert("Hubo un problema de conexión. Intente actualizar la página.");
    });
});

// --- LÓGICA DE LOGIN ---
function iniciarSesion() {
    const usuario = document.getElementById('user-input').value.trim();
    const pass = document.getElementById('pass-input').value.trim();
    const recordar = document.getElementById('recordar').checked;
    const btn = document.getElementById('btn-login');
    
    if(!usuario || !pass) {
        alert("Por favor, ingresa tu usuario y contraseña.");
        return;
    }

    btn.innerHTML = 'Cargando... <span class="material-symbols-outlined text-lg animate-spin">refresh</span>';
    btn.disabled = true;

    signInWithEmailAndPassword(auth, usuario, pass)
        .then(() => {
            if(recordar) {
                localStorage.setItem('indexCorp_user', usuario);
                localStorage.setItem('indexCorp_pass', pass);
            } else {
                localStorage.removeItem('indexCorp_user');
                localStorage.removeItem('indexCorp_pass');
            }
            // Forzamos la limpieza del catálogo de apps para descargar uno fresco
            localStorage.removeItem('INDEX_CATALOGO_APPS');
            window.location.reload(); 
        })
        .catch((error) => {
            alert("Error de inicio de sesión: Verifique sus credenciales.");
            btn.innerHTML = 'Ingresar <span class="material-symbols-outlined text-lg">login</span>';
            btn.disabled = false;
        });
}

// --- OPTIMIZACIÓN: CARGAR CATÁLOGO DE APPS UNA SOLA VEZ ---
async function obtenerCatalogoApps() {
    const cache = localStorage.getItem('INDEX_CATALOGO_APPS');
    if (cache) return JSON.parse(cache);

    try {
        const snapshot = await getDocs(collection(db, "apps"));
        const catalogo = {};
        snapshot.forEach(doc => {
            catalogo[doc.id] = doc.data();
        });
        localStorage.setItem('INDEX_CATALOGO_APPS', JSON.stringify(catalogo));
        return catalogo;
    } catch (error) {
        console.error("Error descargando el catálogo de apps:", error);
        return {};
    }
}

// --- CARGAR PROYECTOS ---
window.cargarProyectos = async function() {
    const contenedor = document.getElementById('contenedor-proyectos');
    contenedor.innerHTML = '<div class="col-span-full flex items-center gap-2 text-slate-500"><span class="material-symbols-outlined animate-spin">refresh</span> Consultando base de datos...</div>';
    
    try {
        const user = window.APP_STATE.user;
        let proyectosQuery = user.idEmpresa 
            ? query(collection(db, "proyectos"), where("id_empresa", "==", user.idEmpresa))
            : collection(db, "proyectos");

        const querySnapshot = await getDocs(proyectosQuery);
        let html = '';
        window.proyectosEnMemoria = {}; // Limpiamos la RAM
        
        if(querySnapshot.empty) {
            html = '<p class="text-slate-500 col-span-full">No tienes proyectos asignados en este momento.</p>';
        } else {
            const listaPermitidos = user.proyectosPermitidos ? user.proyectosPermitidos.split(/[,;]/).map(p => p.trim()).filter(p => p !== "") : [];
            const esAdmin = user.rolUser === "Admin";
            let proyectosMostrados = 0;

            querySnapshot.forEach((docSnap) => {
                if (esAdmin || listaPermitidos.includes(docSnap.id)) {
                    proyectosMostrados++;
                    const p = docSnap.data();
                    const id = docSnap.id;
                    
                    // Guardamos en RAM para no tener que leer Firestore al hacer clic
                    window.proyectosEnMemoria[id] = p;

                    const badgeColor = p.state_proyect === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
                    const badgeIcon = p.state_proyect === 'Activo' ? 'check_circle' : 'pending';

                    html += `
                    <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow group flex flex-col">
                        <div class="flex justify-between items-start mb-4">
                            <span class="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-md">${id}</span>
                            <span class="${badgeColor} text-[11px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">${badgeIcon}</span> ${p.state_proyect}
                            </span>
                        </div>
                        <h3 class="text-lg font-bold text-slate-800 mb-1">${p.name_proyect}</h3>
                        <p class="text-sm text-slate-500 flex items-center gap-1 mb-6 flex-grow">
                            <span class="material-symbols-outlined text-[16px]">location_on</span> ${p.ubi_proyect}
                        </p>
                        <button onclick="window.abrirProyecto('${id}', '${p.name_proyect}')" class="w-full bg-slate-50 hover:bg-corpBlue-50 text-corpBlue-600 border border-slate-200 hover:border-teal-200 font-bold py-2 rounded-lg transition flex justify-center items-center gap-2 text-sm">
                            <span class="material-symbols-outlined text-[18px]">apps</span> Ver Aplicaciones
                        </button>
                    </div>`;
                }
            });

            if (proyectosMostrados === 0) {
                html = '<p class="text-slate-500 col-span-full">No tienes proyectos asignados en este momento.</p>';
            }
        }
        contenedor.innerHTML = html;
    } catch (error) {
        console.error("Error cargando proyectos:", error);
        contenedor.innerHTML = `<p class="text-red-500 col-span-full">Error al cargar proyectos.</p>`;
    }
};

// --- CARGAR APPS POR PROYECTO (0 LECTURAS A FIRESTORE) ---
window.cargarApps = async function(idProyecto) {
    const contenedor = document.getElementById('contenedor-apps');
    contenedor.innerHTML = '<div class="col-span-full flex items-center gap-2 text-slate-500"><span class="material-symbols-outlined animate-spin">refresh</span> Cargando aplicaciones...</div>';

    try {
        // Obtenemos los datos desde nuestra variable en memoria (Costo 0)
        const dataProyecto = window.proyectosEnMemoria[idProyecto];
        
        if (!dataProyecto || !dataProyecto.apps) {
            contenedor.innerHTML = '<p class="text-slate-500 col-span-full">No hay aplicaciones habilitadas para este proyecto.</p>';
            return;
        }

        const idsAppsProyecto = dataProyecto.apps;
        const estadoGlobal = window.APP_STATE || JSON.parse(localStorage.getItem("INDEX_APP_STATE")) || { user: {} };
        const appsUsuario = estadoGlobal.user.appsHabilitadas || [];
        const esAdmin = estadoGlobal.user.rolUser === "Admin";
        
        // Obtenemos el catálogo completo desde localStorage (Costo 0)
        const catalogoApps = await obtenerCatalogoApps();

        let html = '';
        let appsMostradas = 0;

        for (const idApp of idsAppsProyecto) {
            if (esAdmin || appsUsuario.includes(idApp)) {
                const a = catalogoApps[idApp];
                if (a) {
                    appsMostradas++;
                    html += `
                    <button onclick="window.abrirApp('${a.archivohtml_app}', '${idApp}')" class="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-teal-300 transition-all flex flex-col items-center text-center group w-full">
                        <div class="w-16 h-16 bg-corpBlue-50 text-corpBlue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-corpBlue-500 group-hover:text-white transition-colors">
                            <span class="material-symbols-outlined text-3xl">${a.icon_app}</span>
                        </div>
                        <h3 class="font-bold text-slate-800 text-sm md:text-base mb-1">${a.name_app}</h3>
                        <p class="text-xs text-slate-500">${a.category_app}</p>
                    </button>`;
                }
            }
        }
        
        if (appsMostradas === 0) {
            html = '<p class="text-slate-500 col-span-full">No tienes los permisos necesarios para visualizar las aplicaciones de este proyecto.</p>';
        }

        contenedor.innerHTML = html;

    } catch (error) {
        console.error("Error al cargar apps:", error);
        contenedor.innerHTML = '<p class="text-red-500 col-span-full">Error al estructurar aplicaciones.</p>';
    }
};

// --- NAVEGACIÓN PRINCIPAL ---
window.abrirProyecto = function(idProyecto, nombreProyecto) {
    proyectoActual = idProyecto;
    document.getElementById('bloque-proyectos').classList.add('hidden');
    document.getElementById('bloque-apps').classList.remove('hidden');
    document.getElementById('nombre-proyecto-apps').innerText = `[${idProyecto}] ${nombreProyecto}`;
    document.getElementById('nav-title').innerText = 'Aplicaciones';
    
    window.cargarApps(idProyecto);
};

window.volverAProyectos = function() {
    proyectoActual = null;
    document.getElementById('bloque-apps').classList.add('hidden');
    document.getElementById('bloque-proyectos').classList.remove('hidden');
    document.getElementById('nav-title').innerText = 'Mis Proyectos';
};

window.abrirApp = function(archivoHtml, idApp) {
    if (!archivoHtml || archivoHtml === "undefined") {
        alert("Error: El archivo HTML de esta aplicación no está definido.");
        return;
    }
    window.location.href = archivoHtml + "?projectId=" + encodeURIComponent(proyectoActual) + "&appId=" + encodeURIComponent(idApp);
};

// --- BOTÓN DE SINCRONIZACIÓN MANUAL ---
// Puedes llamar a esta función desde cualquier botón del menú en tu HTML
window.sincronizarDatos = function() {
    localStorage.removeItem("INDEX_APP_STATE");
    localStorage.removeItem('INDEX_CATALOGO_APPS');
    window.location.reload(); 
};