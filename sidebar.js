// ==========================================
// sidebar.js - MENÚ LATERAL (100% Caché - 0 Lecturas)
// ==========================================

const urlParams = new URLSearchParams(window.location.search);
const CURRENT_PROJECT_ID = urlParams.get('projectId');
const CURRENT_PATH = window.location.pathname;

window.renderizarSidebarGlobal = function() {
    const container = document.getElementById('sidebar');
    if (!container) return;

    // 1. Leer estado global y catálogos desde el Caché
    const estadoGlobal = JSON.parse(localStorage.getItem("INDEX_APP_STATE")) || {};
    if (!estadoGlobal.user || !estadoGlobal.user.uid) return;

    const logoEmpresa = estadoGlobal.empresa?.logo || "";
    const nombreEmpresa = estadoGlobal.empresa?.nombre || "";
    const proyectoActualData = estadoGlobal.proyectoActivo || null;
    const rolUsuario = estadoGlobal.user.rolUser;
    const appsPermitidas = estadoGlobal.user.appsPermitidasEnEsteProyecto || [];
    
    // Leemos los proyectos y el catálogo general de apps desde la memoria local
    const proyectosCache = JSON.parse(localStorage.getItem("INDEX_PROYECTOS_LIST")) || [];
    const catalogoApps = JSON.parse(localStorage.getItem("INDEX_CATALOGO_APPS")) || {};

    let aplicacionesRenderizadas = "";

    // 2. GENERACIÓN DINÁMICA DE APLICACIONES (COSTO 0)
    if (proyectoActualData && proyectoActualData.appsHabilitadas) {
        let categoriasApps = {}; 
        
        for (const idApp of proyectoActualData.appsHabilitadas) {
            // DOBLE CANDADO: Verificamos si el usuario tiene la app en su lista
            if (rolUsuario === "Admin" || appsPermitidas.includes(idApp)) {
                const a = catalogoApps[idApp];
                if (a) {
                    const cat = a.category_app || "General";
                    if (!categoriasApps[cat]) {
                        categoriasApps[cat] = {
                            icono: obtenerIconoCategoria(cat),
                            apps: []
                        };
                    }
                    categoriasApps[cat].apps.push({
                        id: idApp,
                        nombre: a.name_app,
                        icono: a.icon_app,
                        html: a.archivohtml_app
                    });
                }
            }
        }

        // Armado del HTML para los Acordeones de Aplicaciones
        for (const [categoria, dataCat] of Object.entries(categoriasApps)) {
            const isOpen = dataCat.apps.some(app => CURRENT_PATH.includes(app.html));
            
            aplicacionesRenderizadas += `
            <details class="group mb-1" ${isOpen ? 'open' : ''}>
                <summary class="flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer list-none">
                    <span class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[20px] text-slate-500">${dataCat.icono}</span> ${categoria}
                    </span>
                    <span class="material-symbols-outlined text-[16px] text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
                </summary>
                <div class="pl-8 pt-1 pb-2 space-y-1">
                    ${dataCat.apps.map(a => {
                        const isAppActive = CURRENT_PATH.includes(a.html);
                        return `
                        <a href="${a.html}?projectId=${CURRENT_PROJECT_ID}&appId=${a.id}" class="flex items-center gap-2 py-1.5 px-2 text-xs rounded transition ${isAppActive ? 'font-bold text-corpBlue-600 bg-slate-100' : 'text-slate-600 hover:text-slate-900'}">
                            ${a.nombre}
                        </a>`;
                    }).join('')}
                </div>
            </details>`;
        }
    }

    const nombreProyectoActual = proyectoActualData ? (proyectoActualData.nombre || CURRENT_PROJECT_ID) : "Portal General";

    // 3. Construcción Final del HTML
    container.innerHTML = `
        <div class="px-6 py-6 flex flex-col items-center justify-center border-b border-slate-200 bg-slate-50 text-center shrink-0 min-h-[128px]">
            ${logoEmpresa 
                ? `<img src="${logoEmpresa}" class="h-12 object-contain mb-2" alt="${nombreEmpresa}">`
                : `<div class="h-10 w-10 bg-corpBlue-100 text-corpBlue-600 rounded-full flex items-center justify-center mb-1"><span class="material-symbols-outlined text-xl">domain</span></div>`
            }
            
            ${CURRENT_PROJECT_ID ? `
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Proyecto Activo</span>
                <h2 class="text-sm font-bold text-slate-800 leading-tight">${nombreProyectoActual}</h2>
            ` : `
                <h2 class="text-sm font-bold text-slate-800">${nombreEmpresa || 'Panel de Control'}</h2>
                <span class="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Portal General</span>
            `}
        </div>

        <div class="p-4 flex-1 overflow-y-auto space-y-6">
            <div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Navegación</p>
                <button onclick="window.irAlPanelPrincipal()" class="w-full text-left flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition ${!CURRENT_PROJECT_ID ? 'bg-slate-100 font-bold text-corpBlue-600' : ''}">
                    <span class="material-symbols-outlined text-[20px]">grid_view</span> Panel Principal
                </button>
            </div>

            <div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Mis Proyectos</p>
                <div class="relative mb-2">
                    <input type="text" id="sidebarSearchInput" placeholder="Buscar proyecto..." class="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-corpBlue-500">
                    <span class="material-symbols-outlined absolute left-2 top-2 text-slate-400 text-[16px]">search</span>
                </div>
                <div id="sidebarProjectList" class="space-y-1 max-h-40 overflow-y-auto pr-1">
                    ${proyectosCache.map(p => `
                        <button onclick="window.cambiarProyectoNavegacion('${p.id}')" class="w-full text-left px-2.5 py-2 text-xs rounded-lg flex items-center justify-between transition ${p.id === CURRENT_PROJECT_ID ? 'bg-corpBlue-50 font-bold text-corpBlue-600' : 'text-slate-600 hover:bg-slate-100'}">
                            <span class="truncate pr-2">${p.nombre || p.id}</span>
                            <span class="w-2 h-2 rounded-full ${p.estado === 'Activo' ? 'bg-emerald-500' : 'bg-amber-500'} shrink-0"></span>
                        </button>
                    `).join('')}
                    ${proyectosCache.length === 0 ? '<p class="text-xs text-slate-400 italic text-center py-2">Sin proyectos asignados</p>' : ''}
                </div>
            </div>

            ${CURRENT_PROJECT_ID ? `
            <div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Aplicaciones (PMBOK)</p>
                ${aplicacionesRenderizadas ? aplicacionesRenderizadas : '<p class="text-xs text-slate-400 italic px-2">No hay aplicaciones vinculadas a este proyecto.</p>'}
            </div>
            ` : ''}
        </div>
    `;

    // 4. Evento de Búsqueda de proyectos
    const searchInput = document.getElementById('sidebarSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const buttons = document.querySelectorAll('#sidebarProjectList button');
            buttons.forEach(btn => {
                const text = btn.innerText.toLowerCase();
                btn.style.display = text.includes(term) ? 'flex' : 'none';
            });
        });
    }
};

function obtenerIconoCategoria(categoria) {
    const iconos = {
        "Comunicación": "forum",
        "Calidad": "verified",
        "Seguridad": "health_and_safety",
        "Costos": "payments",
        "Cronograma": "calendar_month",
        "Recursos": "groups",
        "Riesgos": "warning"
    };
    return iconos[categoria] || "apps";
}

window.cambiarProyectoNavegacion = function(newProjectId) {
    if (CURRENT_PATH.includes('index.html') || CURRENT_PATH.endsWith('/')) {
        // Redirige por defecto a la primera app que consideres (ej: reporte_diario.html)
        window.location.href = `reporte_diario.html?projectId=${newProjectId}`;
    } else {
        window.location.href = `${CURRENT_PATH}?projectId=${newProjectId}`;
    }
};

window.irAlPanelPrincipal = function() {
    if (CURRENT_PATH.includes('index.html') || CURRENT_PATH.endsWith('/')) {
        if (typeof window.volverAProyectos === 'function') window.volverAProyectos();
        if (typeof window.toggleSidebar === 'function') window.toggleSidebar();
    } else {
        window.location.href = 'index.html';
    }
};

// Disparador seguro: Espera a que el app_core avise que terminó de armar el caché
window.addEventListener('CoreStateReady', () => {
    if (document.getElementById('sidebar')) {
        // Hacemos una comprobación extra para asegurar que el catálogo de apps se haya descargado
        // Si no está, le damos un ligero margen de tiempo para que index.js termine de guardarlo
        if (!localStorage.getItem("INDEX_CATALOGO_APPS")) {
            setTimeout(window.renderizarSidebarGlobal, 500);
        } else {
            window.renderizarSidebarGlobal();
        }
    }
});

// Fallback por si la página se cargó desde caché y el evento ya pasó
document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("INDEX_APP_STATE") && document.getElementById('sidebar')) {
        window.renderizarSidebarGlobal();
    }
});