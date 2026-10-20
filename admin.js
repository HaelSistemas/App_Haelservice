// ==========================================
// admin.js - PANEL DE ADMINISTRACIÓN GLOBAR
// ==========================================

import { auth, db, initAppCore } from "./app_core.js";
import { collection, getDocs, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let todosLosUsuarios = []; // Memoria local de usuarios
let catalogoAppsLocal = {}; // Memoria de las apps existentes

document.addEventListener("DOMContentLoaded", () => {
    // Inicializamos el core. false = No necesitamos que se cargue un proyecto específico
    initAppCore(false).then(async (estadoGlobal) => {
        
        // 1. Validar que sea Admin
        if (!estadoGlobal || estadoGlobal.user.rolUser !== "Admin") {
            alert("⚠️ Acceso denegado. No tienes permisos de Administrador.");
            window.location.href = "index.html"; 
            return;
        }

        // 2. Cargar UI inicial
        document.getElementById('pantalla-carga').classList.add('hidden');
        document.getElementById('navbar-global').classList.remove('hidden');
        document.getElementById('main-content').classList.remove('hidden');

        // 3. Obtener el catálogo de apps para construir los checkboxes de permisos
        catalogoAppsLocal = await obtenerCatalogoApps();

        // 4. Cargar lista de usuarios
        window.cargarUsuarios();

    }).catch(error => {
        console.error("Error al iniciar App Admin:", error);
        alert("Ocurrió un error al verificar permisos.");
    });
});

// --- LÓGICA DE PESTAÑAS ---
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => { 
        b.classList.remove('active', 'bg-corpBlue-600', 'text-white', 'border-corpBlue-600'); 
        b.classList.add('bg-white', 'text-slate-500', 'border-slate-300'); 
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    const targetBtn = document.getElementById('btnTab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if(targetBtn) {
        targetBtn.classList.remove('bg-white', 'text-slate-500', 'border-slate-300'); 
        targetBtn.classList.add('active', 'bg-corpBlue-600', 'text-white', 'border-corpBlue-600');
    }
    document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1)).classList.add('active');
};

// --- GESTIÓN DE USUARIOS ---

window.cargarUsuarios = async function() {
    const tbody = document.getElementById('tabla-usuarios');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-slate-500 flex justify-center items-center gap-2"><span class="material-symbols-outlined animate-spin">refresh</span> Cargando base de datos...</td></tr>';
    
    try {
        // Consultamos toda la colección 'usuarios' (o puedes filtrarla por id_empresa si es multi-tenant)
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        todosLosUsuarios = [];
        let html = '';

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.uid = docSnap.id;
            todosLosUsuarios.push(data);

            const isAdmin = data.rol_user === "Admin";
            const badgeColor = isAdmin ? "bg-red-100 text-red-700 border-red-200" : "bg-emerald-100 text-emerald-700 border-emerald-200";

            html += `
            <tr class="hover:bg-slate-50 transition">
                <td class="px-4 py-3 border-t border-slate-100">
                    <p class="font-bold text-slate-800">${data.name_user || 'Sin nombre'}</p>
                </td>
                <td class="px-4 py-3 border-t border-slate-100">
                    <p class="text-sm text-slate-600">${data.email_user || '--'}</p>
                    <p class="text-xs text-slate-400 font-medium">${data.cargo_user || 'Sin cargo'}</p>
                </td>
                <td class="px-4 py-3 border-t border-slate-100 text-center">
                    <span class="px-2.5 py-1 text-[11px] font-bold rounded-full border ${badgeColor}">${data.rol_user || 'Usuario'}</span>
                </td>
                <td class="px-4 py-3 border-t border-slate-100 text-center">
                    <button onclick="window.abrirEditorUsuario('${data.uid}')" class="text-corpBlue-600 hover:text-corpBlue-800 hover:bg-corpBlue-50 p-2 rounded-lg transition" title="Editar Usuario">
                        <span class="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;
    } catch (error) {
        console.error("Error al cargar usuarios:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500 font-bold">Error al descargar usuarios.</td></tr>';
    }
};

window.abrirEditorUsuario = function(uid) {
    const usuario = todosLosUsuarios.find(u => u.uid === uid);
    if(!usuario) return;

    document.getElementById('edit-uid').value = uid;
    document.getElementById('edit-nombre-usuario').textContent = usuario.name_user;
    document.getElementById('edit-cargo').value = usuario.cargo_user || "";
    document.getElementById('edit-rol').value = usuario.rol_user || "Usuario";
    document.getElementById('edit-proyectos').value = usuario.proyect_user || "";

    // Construir checkboxes de Apps
    const contenedorApps = document.getElementById('edit-apps-container');
    contenedorApps.innerHTML = "";
    
    const appsDelUsuario = usuario.apps_habilitadas || [];

    Object.keys(catalogoAppsLocal).forEach(appId => {
        const app = catalogoAppsLocal[appId];
        const estaSeleccionada = appsDelUsuario.includes(appId) ? "checked" : "";
        
        contenedorApps.innerHTML += `
            <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer p-1 hover:bg-slate-50 rounded">
                <input type="checkbox" value="${appId}" class="checkbox-app w-4 h-4 text-corpBlue-600 rounded border-slate-300 focus:ring-corpBlue-500" ${estaSeleccionada}>
                <span class="truncate" title="${app.name_app}">${app.name_app}</span>
            </label>
        `;
    });

    document.getElementById('editor-usuario').classList.remove('hidden');
    // Scroll suave hacia el editor
    document.getElementById('editor-usuario').scrollIntoView({ behavior: 'smooth' });
};

window.cerrarEditorUsuario = function() {
    document.getElementById('editor-usuario').classList.add('hidden');
};

window.guardarCambiosUsuario = async function() {
    const uid = document.getElementById('edit-uid').value;
    const btn = document.getElementById('btn-guardar-usuario');
    const origText = btn.innerHTML;

    const cargo = document.getElementById('edit-cargo').value.trim();
    const rol = document.getElementById('edit-rol').value;
    const proyectos = document.getElementById('edit-proyectos').value.trim();
    
    // Recolectar checkboxes marcados
    const appsHabilitadas = [];
    document.querySelectorAll('.checkbox-app:checked').forEach(chk => {
        appsHabilitadas.push(chk.value);
    });

    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span> Guardando...`;

    try {
        const userRef = doc(db, "usuarios", uid);
        await updateDoc(userRef, {
            cargo_user: cargo,
            rol_user: rol,
            proyect_user: proyectos,
            apps_habilitadas: appsHabilitadas
        });

        alert("✅ Usuario actualizado correctamente.");
        window.cerrarEditorUsuario();
        window.cargarUsuarios(); // Recargar la tabla

    } catch (error) {
        console.error("Error actualizando usuario:", error);
        alert("Error al guardar: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
};

// --- UTILERÍA ---
async function obtenerCatalogoApps() {
    // Si tenemos en localStorage del index.js, la usamos
    const cache = localStorage.getItem('INDEX_CATALOGO_APPS');
    if (cache) return JSON.parse(cache);

    // Si no, la bajamos de Firestore
    try {
        const snapshot = await getDocs(collection(db, "apps"));
        const catalogo = {};
        snapshot.forEach(docSnap => catalogo[docSnap.id] = docSnap.data());
        localStorage.setItem('INDEX_CATALOGO_APPS', JSON.stringify(catalogo));
        return catalogo;
    } catch (error) {
        console.error("Error descargando catálogo apps:", error);
        return {};
    }
}