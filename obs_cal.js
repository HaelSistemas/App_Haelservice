// ==========================================
// obs_cal.js - Módulo de Observaciones de Calidad
// ==========================================

import { auth, db, initAppCore } from "./app_core.js";
import { doc, setDoc, collection, query, where, getDocs, updateDoc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const storage = getStorage();

// ==========================================
// 0. MATRIZ DE PERMISOS (SISTEMA RBAC)
// ==========================================
const PERMISOS_OBS = {
    "registrar_hallazgo": ["Admin", "Supervision"],
    "enviar_revision": ["Admin", "Supervision", "Contratista"], 
    "aprobar_levantamiento": ["Admin", "Supervision"],
    "rechazar_levantamiento": ["Admin", "Supervision"],
    "generar_pdf": ["Admin", "Supervision"],
    "enviar_correo": ["Admin", "Supervision"],
    "ver_pestanas_avanzadas": ["Admin", "Supervision"] // Permiso visual
};

window.tienePermiso = function(accion, mostrarAlerta = true) {
    // Si por algún motivo no hay rol cargado, asume el más restrictivo: Cliente
    const rolActual = (window.APP_STATE && window.APP_STATE.user && window.APP_STATE.user.rolUser) ? window.APP_STATE.user.rolUser : "Cliente"; 
    const rolesPermitidos = PERMISOS_OBS[accion] || [];
    
    if (rolesPermitidos.includes(rolActual)) {
        return true;
    } else {
        if (mostrarAlerta) alert(`⛔ Acceso denegado: El perfil '${rolActual}' no tiene autorización para realizar esta acción.`);
        return false;
    }
};

// ==========================================
// 1. INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initAppCore(true).then((estadoGlobal) => {
        if (!estadoGlobal || !estadoGlobal.proyectoActivo || !estadoGlobal.proyectoActivo.id) {
            alert("⚠️ Acceso denegado. No se seleccionó un proyecto válido.");
            window.location.href = "index.html"; 
            return;
        }

        const proj = estadoGlobal.proyectoActivo;

        // 1. Llenar Select de Frentes
        const frenteSelect = document.getElementById('frente');
        if (proj.frentes && proj.frentes.length > 0) {
            proj.frentes.forEach(f => frenteSelect.innerHTML += `<option value="${f}">${f}</option>`);
        }

        // Llenar filtro de Especialidad en la pestaña Status
        const filtroEsp = document.getElementById('filtroEspecialidad');
        if (proj.especialidades && filtroEsp) {
            proj.especialidades.forEach(e => filtroEsp.innerHTML += `<option value="${e}">${e}</option>`);
        }

        // 2. Llenar Select de Sectores
        const sectorSelect = document.getElementById('sector');
        if (proj.sectores && proj.sectores.length > 0) {
            proj.sectores.forEach(s => sectorSelect.innerHTML += `<option value="${s}">${s}</option>`);
        } else if (proj.frentes) { 
            proj.frentes.forEach(s => sectorSelect.innerHTML += `<option value="${s}">${s}</option>`);
        }

        // 3. Llenar Select de Especialidades
        const espSelect = document.getElementById('especialidad');
        if (proj.especialidades && proj.especialidades.length > 0) {
            proj.especialidades.forEach(e => espSelect.innerHTML += `<option value="${e}">${e}</option>`);
        }

        // 4. Setear Fechas de Hoy
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('dateregis_obscal').value = today;
        
        const pastWeek = new Date();
        pastWeek.setDate(pastWeek.getDate() - 7);
        document.getElementById('filtroDesde').value = pastWeek.toISOString().split('T')[0];
        document.getElementById('filtroHasta').value = today;

        // 5. Ocultar pantalla de carga y mostrar UI
        document.getElementById('pantalla-carga').classList.add('hidden');
        document.getElementById('navbar-global').classList.remove('hidden');
        document.getElementById('main-content').classList.remove('hidden');

        // --- RESTRICCIÓN VISUAL DE PESTAÑAS USANDO EL GUARDIÁN ---
        // Pasamos 'false' para que no muestre la alerta al iniciar sesión, solo oculte.
        if (!window.tienePermiso("ver_pestanas_avanzadas", false)) {
            // Se corrigieron los IDs para que coincidan exactamente con tu HTML
            const tabRegistrar = document.getElementById('btnTabRegistrar'); 
            if (tabRegistrar) tabRegistrar.classList.add('hidden');
            
            const tabPDF = document.getElementById('btnTabPdf'); 
            if (tabPDF) tabPDF.classList.add('hidden');

            const tabCorreo = document.getElementById('btnTabEnviar'); 
            if (tabCorreo) tabCorreo.classList.add('hidden');
            
            // Forzamos al usuario a iniciar directamente en la pestaña de Status
            window.switchTab('status');
        }

    }).catch(error => {
        console.error("Error al iniciar Obs. de Calidad:", error);
        alert("Ocurrió un error al cargar el contexto del proyecto.");
    });
});

// ==========================================
// 2. CONTROL DE PESTAÑAS (TABS) Y NAVEGACIÓN
// ==========================================
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-corpBlue-600', 'text-white', 'border-corpBlue-600', 'active');
        btn.classList.add('bg-white', 'text-slate-500', 'border-slate-300');
    });

    const selectedTab = document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if (selectedTab) selectedTab.classList.add('active');

    const selectedBtn = document.getElementById('btnTab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if (selectedBtn) {
        selectedBtn.classList.remove('bg-white', 'text-slate-500', 'border-slate-300');
        selectedBtn.classList.add('bg-corpBlue-600', 'text-white', 'border-corpBlue-600', 'active');
    }

    // Carga automática del combo de observaciones si entra a Reporte o Enviar
    if (tabId === 'pdf' || tabId === 'enviar') {
        window.cargarComboObservaciones();
    }
};

window.toggleObsAccordion = function(bodyId, iconId) {
    const body = document.getElementById(bodyId);
    const icon = document.getElementById(iconId);
    if (body) {
        body.classList.toggle('hidden');
        body.classList.toggle('flex');
    }
    if (icon) icon.classList.toggle('rotate-180');
};

// ==========================================
// 3. PESTAÑA: REGISTRAR HALLAZGO
// ==========================================

// --- Manejo de la Imagen de Evidencia ---
window.previewImagenHallazgo = function(input) {
    if (input.files && input.files[0]) {
        document.getElementById('preview_hallazgo_container').classList.remove('hidden');
        document.getElementById('img_preview_hallazgo').src = "https://i.gifer.com/ZKZg.gif"; // loading rápido
        
        window.procesarFotoConSello(input.files[0], function(base64Compresa) {
            document.getElementById('img_preview_hallazgo').src = base64Compresa;
            document.getElementById('foto_base64_hallazgo').value = base64Compresa; 
        });
    }
};

window.borrarImagenHallazgo = function() {
    document.getElementById('img_preview_hallazgo').src = '';
    document.getElementById('foto_base64_hallazgo').value = '';
    document.getElementById('preview_hallazgo_container').classList.add('hidden');
    document.getElementById('input_foto_obscal_cam').value = '';
    document.getElementById('input_foto_obscal_gal').value = '';
};

// Conversor interno para subida a Firebase
function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], {type: mimeString});
}

// --- MOTOR DE ESTAMPADO Y COMPRESIÓN (WATERMARK CANVAS) ---
window.procesarFotoConSello = function(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const MAX_WIDTH = 1920;
            let width = img.width;
            let height = img.height;
            
            if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Configuramos la tipografía y sombra
            const fontSize = Math.max(12, Math.floor(height * 0.02)); 
            const interlineado = fontSize * 1.5; 
            const logoX = width * 0.03;
            
            ctx.font = `${fontSize}px sans-serif`; 
            ctx.fillStyle = "white";
            ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;

            const sellarFoto = (logoHeightPx, logoWidthPx, logoObject) => {
                const bloqueTextoHeight = interlineado * 4;
                let currentY = height - (bloqueTextoHeight + logoHeightPx + (height * 0.04));

                if (logoObject) ctx.drawImage(logoObject, logoX, currentY, logoWidthPx, logoHeightPx);
                
                let textY = currentY + logoHeightPx + (interlineado * 0.8); 
                ctx.fillText(window.APP_STATE.empresa?.nombre || "Empresa Contratista", logoX, textY);
                textY += interlineado;
                ctx.fillText((window.APP_STATE.proyectoActivo?.nombre || "PROYECTO").substring(0, 40), logoX, textY);
                textY += interlineado;
                
                const hoy = new Date();
                const dia = String(hoy.getDate()).padStart(2, '0');
                const mes = String(hoy.getMonth() + 1).padStart(2, '0');
                const horas = String(hoy.getHours()).padStart(2, '0');
                const minutos = String(hoy.getMinutes()).padStart(2, '0');
                ctx.fillText(`${dia}.${mes}.${hoy.getFullYear()} ${horas}:${minutos}`, logoX, textY);
                textY += interlineado;
                
                ctx.fillText("Observación de Calidad", logoX, textY);
                
                ctx.shadowColor = "transparent";
                // Devolvemos el Base64 comprimido
                callback(canvas.toDataURL("image/jpeg", 0.85));
            };

            const logoUrl = window.APP_STATE.empresa?.logo;
            if (logoUrl) {
                const watermarkObj = new Image();
                watermarkObj.crossOrigin = "Anonymous"; 
                watermarkObj.onload = function() {
                    const aspect = watermarkObj.naturalWidth / watermarkObj.naturalHeight;
                    const targetLogoHeight = height * 0.06; 
                    const targetLogoWidth = targetLogoHeight * aspect;
                    sellarFoto(targetLogoHeight, targetLogoWidth, watermarkObj);
                };
                watermarkObj.onerror = () => sellarFoto(0, 0, null);
                watermarkObj.src = logoUrl;
            } else {
                sellarFoto(0, 0, null);
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.guardarObservacionCalidad = async function() {
    // ==========================================
    // --- 1. CANDADO DE SEGURIDAD LÓGICA ---
    // ==========================================
    if (!window.tienePermiso("registrar_hallazgo")) return;

    const PROJECT_ID = window.APP_STATE.proyectoActivo.id;
    const ID_FOLDER_DRIVE = window.APP_STATE.proyectoActivo.idfolder_obscal_proyect;
    const btn = document.getElementById('btnGuardarNuevaObs');
    
    if (!ID_FOLDER_DRIVE) {
        return alert("⚠️ Error: El proyecto no tiene configurada la carpeta de Drive para Calidad (idfolder_obscal_proyect).");
    }

    const fecha = document.getElementById('dateregis_obscal').value;
    const frente = document.getElementById('frente').value;
    const sector = document.getElementById('sector').value;
    const ubicacion = document.getElementById('ubicacion_obscal').value.trim();
    const momento = document.getElementById('timeiden_obscal').value;
    const especialidad = document.getElementById('especialidad').value;
    const categoria = document.getElementById('categoria_obscal').value;
    const palabraClave = document.getElementById('wordkey_obscal').value.trim();
    const gravedad = document.getElementById('gravedad').value;
    const responsable = document.getElementById('responsable_subcontrata').value.trim();
    const fechaLimite = document.getElementById('datecierrecom_obscal').value;
    const descripcion = document.getElementById('descrip_obscal').value.trim();
    
    let fileOriginalHallazgo = null;
    const camInput = document.getElementById('input_foto_obscal_cam');
    const galInput = document.getElementById('input_foto_obscal_gal');
    if (camInput && camInput.files[0]) fileOriginalHallazgo = camInput.files[0];
    else if (galInput && galInput.files[0]) fileOriginalHallazgo = galInput.files[0];

    // ==========================================
    // --- 2. VALIDACIÓN DE FOTO OBLIGATORIA ---
    // ==========================================
    if (!fecha || !frente || !sector || !ubicacion || !especialidad || !descripcion || !fileOriginalHallazgo) {
        return alert("⚠️ Por favor complete los campos obligatorios y ADJUNTE UNA FOTO del hallazgo.");
    }

    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `Generando Código y Guardando... <span class="material-symbols-outlined animate-spin">refresh</span>`;

    try {
        // 1. TRANSACCIÓN ATÓMICA PARA EL CONTADOR
        const counterRef = doc(db, "contadores_modulos", `OBSCAL_${PROJECT_ID}`);
        
        const nuevoNumero = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextNum = 1;
            if (!counterDoc.exists()) {
                transaction.set(counterRef, { ultimo_numero: 1 });
            } else {
                nextNum = (counterDoc.data().ultimo_numero || 0) + 1;
                transaction.update(counterRef, { ultimo_numero: nextNum });
            }
            return nextNum;
        });

        const correlativo = String(nuevoNumero).padStart(3, '0');
        const obsId = `OBS-${correlativo}`;
        const docCustomId = `${PROJECT_ID}_${obsId}`;
        const nuevaObsRef = doc(db, "observaciones_calidad", docCustomId);

        // 2. GUARDAR CASCARÓN EN FIRESTORE
        const observacionData = {
            id_observacion: obsId,
            id_proyecto: PROJECT_ID,
            fecha_registro: fecha,
            frente: frente,
            sector: sector,
            ubicacion_especifica: ubicacion,
            momento_identificacion: momento || "No especificado",
            especialidad: especialidad,
            categoria: categoria,
            palabra_clave: palabraClave || "General",
            gravedad: gravedad,
            responsable_subcontrata: responsable || "No especificado",
            fecha_limite_cierre: fechaLimite || "",
            descripcion_hallazgo: descripcion,
            estado: "Pendiente",
            creado_por: window.APP_STATE.user.nombre || window.APP_STATE.user.email,
            fecha_creacion_sistema: new Date().toISOString()
        };

        await setDoc(nuevaObsRef, observacionData);

        // 3. ENVIAR FOTO AL "MENSAJERO CIEGO"
        if (fileOriginalHallazgo) {
            btn.innerHTML = `Enviando a Drive... <span class="material-symbols-outlined animate-spin">refresh</span>`;
            
            const tempPath = `temp_fotos/${docCustomId}_H_${Date.now()}.jpg`; 
            const tempRef = ref(storage, tempPath);
            
            const metadatosBackend = {
                customMetadata: {
                    idFolderDrive: ID_FOLDER_DRIVE,
                    empresa: window.APP_STATE.empresa?.nombre || "Empresa",
                    logoUrl: window.APP_STATE.empresa?.logo || "",
                    proyecto: window.APP_STATE.proyectoActivo.nombre,
                    fecha: fecha,
                    gps: "Ubicación en sitio", 
                    docId: docCustomId,
                    tipoOrigen: "observacion_calidad", 
                    tipoFoto: "hallazgo",
                    rutaSubcarpetas: JSON.stringify(["Fotos", obsId])
                }
            };
            await uploadBytes(tempRef, fileOriginalHallazgo, metadatosBackend);
        }

        // 4. ACTUALIZAR CACHÉ LOCAL MAGÍCAMENTE
        if (window.OBS_CACHE_LOADED) {
            observacionData._docId = docCustomId;
            window.OBS_CACHE.unshift(observacionData); 
        }

        // 5. MOSTRAR ALERTA DE ÉXITO
        alert(`✅ Observación registrada con éxito.\nCódigo generado: ${obsId}\nLas fotos están siendo procesadas en la nube.`);
        
        // 6. Limpieza de pantalla
        document.getElementById('formObservacionCalidad').reset();
        window.borrarImagenHallazgo();
        document.getElementById('dateregis_obscal').value = new Date().toISOString().split('T')[0];

    } catch (error) {
        console.error("Error al guardar la observación:", error);
        alert("Ocurrió un error al guardar: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
};

// ==========================================
// 4. PESTAÑA: STATUS Y SEGUIMIENTO
// ==========================================

// ==========================================
// MOTOR DE CACHÉ Y RENDERIZADO
// ==========================================
window.OBS_CACHE = [];
window.OBS_CACHE_LOADED = false;

window.buscarObservaciones = async function(forzarActualizacion = false) {
    const PROJECT_ID = window.APP_STATE.proyectoActivo.id;
    const loading = document.getElementById('loadingStatus');
    
    // Si NO hay caché o el usuario exige actualizar, vamos a Firebase a gastar lecturas
    if (!window.OBS_CACHE_LOADED || forzarActualizacion) {
        loading.classList.remove('hidden');
        document.getElementById('resultadosStatus').innerHTML = '';
        
        try {
            const q = query(collection(db, "observaciones_calidad"), where("id_proyecto", "==", PROJECT_ID));
            const querySnapshot = await getDocs(q);

            window.OBS_CACHE = [];
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                data._docId = docSnap.id;
                window.OBS_CACHE.push(data);
            });

            // Ordenar del más reciente al más antiguo
            window.OBS_CACHE.sort((a, b) => (b.fecha_creacion_sistema || '').localeCompare(a.fecha_creacion_sistema || ''));
            window.OBS_CACHE_LOADED = true;
        } catch (error) {
            console.error("Error buscando observaciones:", error);
            alert("Error al conectar con la base de datos: " + error.message);
        } finally {
            loading.classList.add('hidden');
        }
    }
    
    // Una vez asegurado el caché (o si ya existía), filtramos y dibujamos en memoria (0 lecturas, 0 segundos)
    window.renderizarDesdeCache();
};

window.renderizarDesdeCache = function() {
    const resultados = document.getElementById('resultadosStatus');
    const desde = document.getElementById('filtroDesde').value;
    const hasta = document.getElementById('filtroHasta').value;
    const estado = document.getElementById('filtroEstado').value;
    const especialidad = document.getElementById('filtroEspecialidad').value;

    resultados.innerHTML = '';

    // Filtrar la memoria RAM en microsegundos
    const docsFiltrados = window.OBS_CACHE.filter(obs => {
        const f = obs.fecha_registro || '';
        const cumpleFecha = (!desde || f >= desde) && (!hasta || f <= hasta);
        const cumpleEstado = !estado || obs.estado === estado;
        const cumpleEsp = especialidad === 'Todas' || !especialidad || obs.especialidad === especialidad;
        return cumpleFecha && cumpleEstado && cumpleEsp;
    });

    if (docsFiltrados.length === 0) {
        resultados.innerHTML = `
            <div class="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold">
                <span class="material-symbols-outlined text-4xl mb-2 text-slate-300">search_off</span>
                <p>No se encontraron observaciones con los filtros seleccionados.</p>
                <button type="button" onclick="window.buscarObservaciones(true)" class="mt-4 text-corpBlue-600 hover:text-corpBlue-700 underline text-sm transition">Forzar sincronización con la nube</button>
            </div>`;
        return;
    }

    // Renderizar las tarjetas
    docsFiltrados.forEach((obs, index) => {
        resultados.innerHTML += renderizarTarjetaStatus(obs, index);
    });
    
    // Botón discreto por si el QA sabe que un subcontratista acaba de enviar fotos y quiere verlas
    resultados.innerHTML += `<div class="text-center mt-6 mb-4"><button type="button" onclick="window.buscarObservaciones(true)" class="text-xs text-slate-400 hover:text-corpBlue-600 transition flex items-center justify-center gap-1 mx-auto bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm"><span class="material-symbols-outlined text-[14px]">sync</span> Sincronizar últimos cambios de la nube</button></div>`;
};

// Utilidad maestra para actualizar el caché local sin ir a Firebase
window.actualizarCacheLocal = function(docId, nuevosDatos) {
    const index = window.OBS_CACHE.findIndex(o => o._docId === docId);
    if (index !== -1) {
        window.OBS_CACHE[index] = { ...window.OBS_CACHE[index], ...nuevosDatos };
        window.renderizarDesdeCache(); // Redibuja la pantalla mágicamente con los nuevos datos
    }
};

// --- Renderizado Dinámico de la Tarjeta ---
function renderizarTarjetaStatus(obs, index) {
    const bodyId = `body-obs-${index}`;
    const iconId = `icon-obs-${index}`;
    
    const esPendiente = obs.estado === 'Pendiente';
    const esRevision = obs.estado === 'En revisión';
    const esLevantada = obs.estado === 'Levantada';

    let statusBadge = '';
    if (esPendiente) statusBadge = `<span class="text-xs font-bold px-2.5 py-1 rounded bg-red-100 text-red-700 uppercase tracking-wider flex items-center gap-1 shadow-sm"><span class="material-symbols-outlined text-[14px]">warning</span> Pendiente</span>`;
    else if (esRevision) statusBadge = `<span class="text-xs font-bold px-2.5 py-1 rounded bg-blue-100 text-blue-700 uppercase tracking-wider flex items-center gap-1 shadow-sm"><span class="material-symbols-outlined text-[14px]">policy</span> En Revisión</span>`;
    else statusBadge = `<span class="text-xs font-bold px-2.5 py-1 rounded bg-green-100 text-green-700 uppercase tracking-wider flex items-center gap-1 shadow-sm"><span class="material-symbols-outlined text-[14px]">done_all</span> Levantada</span>`;

    const urlVisorHallazgo = obs.url_foto_hallazgo_visor || obs.url_foto_hallazgo;
    const urlVisorLevan = obs.url_foto_levantamiento_visor || obs.url_foto_levantamiento;
    const clickUrlHallazgo = obs.url_foto_hallazgo || obs.url_foto_hallazgo_visor || '#';
    const clickUrlLevan = obs.url_foto_levantamiento || obs.url_foto_levantamiento_visor || '#';

    // Botón con "this" para animarlo directamente
    const btnRecargaIndividual = `<button type="button" onclick="event.stopPropagation(); window.forzarRecargaFotoIndividual('${obs._docId}', this)" class="mt-2 text-[10px] bg-slate-200 hover:bg-corpBlue-100 text-corpBlue-700 px-3 py-1.5 rounded-full flex items-center gap-1 transition font-bold"><span class="material-symbols-outlined text-[14px]">sync</span> Consultar Nube</button>`;

    // Envolvemos las fotos en un ID único para inyectarlas directamente ahí
    let fotoHallazgoHtml = `<div id="wrapper_hallazgo_${obs._docId}" class="w-full">`;
    fotoHallazgoHtml += urlVisorHallazgo 
        ? `<div class="relative w-full h-40 md:h-48 rounded-lg overflow-hidden border border-slate-200 group bg-slate-100"><img src="${urlVisorHallazgo}" class="w-full h-full object-cover"><div class="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] font-bold py-1.5 text-center uppercase tracking-widest">Antes</div><a href="${clickUrlHallazgo}" target="_blank" class="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center text-white text-xs font-bold uppercase tracking-widest transition">Ver Alta Calidad</a></div>`
        : `<div class="w-full h-40 md:h-48 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs font-bold">Sin Foto ${btnRecargaIndividual}</div>`;
    fotoHallazgoHtml += `</div>`;

    let fotoSolucionHtml = '';
    if (obs.estado !== 'Pendiente') {
        fotoSolucionHtml = `<div id="wrapper_levan_${obs._docId}" class="w-full">`;
        fotoSolucionHtml += urlVisorLevan 
            ? `<div class="relative w-full h-40 md:h-48 rounded-lg overflow-hidden border border-slate-200 group bg-slate-100"><img src="${urlVisorLevan}" class="w-full h-full object-cover"><div class="absolute bottom-0 left-0 right-0 bg-blue-600/90 text-white text-[10px] font-bold py-1.5 text-center uppercase tracking-widest">Después (Solución)</div><a href="${clickUrlLevan}" target="_blank" class="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center text-white text-xs font-bold uppercase tracking-widest transition">Ver Alta Calidad</a></div>`
            : `<div class="w-full h-40 md:h-48 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs font-bold">Sin Foto ${btnRecargaIndividual}</div>`;
        fotoSolucionHtml += `</div>`;
    }

    // ==========================================
    // --- SEGURIDAD CENTRALIZADA (RBAC) ---
    // ==========================================
    // Preguntamos al Guardián en modo silencioso (false) qué botones debemos mostrarle a este usuario
    const puedeMandarRevision = window.tienePermiso("enviar_revision", false);
    const puedeAprobar = window.tienePermiso("aprobar_levantamiento", false);
    
    const usuarioAutenticado = (window.APP_STATE && window.APP_STATE.user && window.APP_STATE.user.nombre) ? window.APP_STATE.user.nombre : "Usuario Actual";

    let bodyExpandidoHtml = '';

    if (esPendiente) {
        const today = new Date().toISOString().split('T')[0];
        
        const alertaRechazo = obs.motivo_rechazo 
            ? `<div class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm shadow-sm flex items-start gap-2">
                 <span class="material-symbols-outlined text-[18px]">error</span>
                 <div><strong>⚠️ Levantamiento Rechazado Anteriormente:</strong><br>${obs.motivo_rechazo}</div>
               </div>`
            : '';

        let formularioAccionHtml = '';
        
        if (!puedeMandarRevision) {
             // Vista para Cliente (Solo Lectura)
             formularioAccionHtml = `
             <div class="bg-slate-50 p-5 border-t border-slate-200 text-center text-slate-500">
                 <span class="material-symbols-outlined text-3xl mb-2 text-slate-400">visibility</span>
                 <p class="text-sm font-bold">Modo Solo Lectura</p>
                 <p class="text-xs">El contratista aún no ha reportado la acción correctiva.</p>
             </div>`;
        } else {
             // Vista para Contratista, Admin y QA: Ven el formulario para subir fotos
             formularioAccionHtml = `
             <div class="bg-slate-50 p-5 border-t border-slate-200">
                <h5 class="text-sm font-bold text-corpBlue-600 mb-4 flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">build</span> Ingresar Acción Correctiva</h5>
                
                ${alertaRechazo}

                <div class="grid grid-cols-1 md:grid-cols-12 gap-5">
                    <div class="md:col-span-7 space-y-3">
                        <textarea id="descriplevan_${obs._docId}" class="w-full p-3 text-sm border border-slate-300 rounded-lg outline-none focus:border-corpBlue-500 shadow-sm" rows="2" placeholder="Detalle la acción correctiva ejecutada..."></textarea>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div class="bg-slate-100 p-2.5 rounded-lg border border-slate-200 flex flex-col justify-center">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Levantado por:</span>
                                <span class="text-sm font-semibold text-slate-700 truncate">${usuarioAutenticado}</span>
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha:</label>
                                <input type="date" id="fechaejecucion_${obs._docId}" value="${today}" class="w-full p-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-corpBlue-500 bg-white shadow-sm">
                            </div>
                        </div>
                    </div>
                    <div class="md:col-span-3 flex flex-col justify-center">
                        <label id="label_btn_levan_${obs._docId}" class="flex flex-col items-center justify-center w-full h-full min-h-[7rem] border-2 border-dashed border-slate-300 rounded-lg bg-white cursor-pointer hover:bg-slate-100 transition p-2 text-center shadow-sm">
                            <span class="material-symbols-outlined text-slate-400 text-3xl">add_a_photo</span>
                            <span class="text-[11px] text-slate-500 font-bold mt-2 uppercase tracking-wider">Subir Evidencia</span>
                            <input type="file" id="fotolevan_${obs._docId}" class="hidden" accept="image/*" capture="environment" onchange="window.previewFotoLevan(this, '${obs._docId}')">
                        </label>
                        <div id="prev_levan_cont_${obs._docId}" class="hidden relative w-full h-full min-h-[7rem] rounded-lg overflow-hidden border border-slate-300 shadow-sm">
                            <img id="img_prev_levan_${obs._docId}" class="w-full h-full object-cover">
                            <button type="button" onclick="window.borrarFotoLevan('${obs._docId}')" class="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex justify-center items-center shadow border border-white hover:bg-red-700">
                                <span class="material-symbols-outlined text-[14px]">close</span>
                            </button>
                        </div>
                    </div>
                    <div class="md:col-span-2 flex">
                        <button type="button" onclick="window.enviarARevision('${obs._docId}')" class="w-full h-full min-h-[4rem] bg-corpBlue-600 hover:bg-corpBlue-700 text-white font-bold rounded-lg flex flex-col items-center justify-center transition shadow-md">
                            <span class="material-symbols-outlined mb-1 text-2xl">send</span>
                            <span class="text-xs uppercase tracking-widest text-center px-1">Enviar a Revisión</span>
                        </button>
                    </div>
                </div>
            </div>`;
        }

        bodyExpandidoHtml = `
            <div class="p-4 bg-white flex flex-col md:flex-row gap-5">
                <div class="flex-1 bg-amber-50 text-amber-900 p-4 rounded-xl border border-amber-200 flex flex-col justify-between">
                    <div>
                        <span class="font-bold text-[11px] uppercase tracking-wider mb-2 block flex items-center gap-1"><span class="material-symbols-outlined text-sm">info</span> Descripción del Hallazgo</span>
                        <p class="text-sm">${obs.descripcion_hallazgo}</p>
                    </div>
                    <p class="text-xs mt-4 font-semibold text-amber-700">Registrado por: ${obs.creado_por} (${obs.fecha_registro})</p>
                </div>
                <div class="w-full md:w-64 shrink-0">${fotoHallazgoHtml}</div>
            </div>
            ${formularioAccionHtml}
        `;
    }
    else {
        // DISEÑO PARA "EN REVISIÓN" O "LEVANTADA" (Modo Vista de Fotos)
        bodyExpandidoHtml = `
            <div class="bg-white p-5 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100">
               <div class="flex flex-col gap-4">
                   <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex-grow">
                       <span class="font-bold text-[11px] text-slate-500 uppercase mb-2 block tracking-wider">Descripción del Hallazgo</span>
                       <p class="text-sm text-slate-800">${obs.descripcion_hallazgo}</p>
                   </div>
                   ${fotoHallazgoHtml}
               </div>
               <div class="flex flex-col gap-4">
                   <div class="bg-${esRevision ? 'blue' : 'green'}-50 p-4 rounded-xl border border-${esRevision ? 'blue' : 'green'}-200 flex-grow">
                       <span class="font-bold text-[11px] text-${esRevision ? 'blue-600' : 'corpGreen'} uppercase mb-2 block tracking-wider flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">${esRevision ? 'hourglass_top' : 'verified'}</span> Acción Correctiva Ejecutada</span>
                       <p class="text-sm text-${esRevision ? 'blue' : 'green'}-900">${obs.descripcion_levantamiento}</p>
                   </div>
                   ${fotoSolucionHtml}
               </div>
            </div>`;

        if (esRevision) {
            bodyExpandidoHtml += `
            <div class="bg-blue-50/50 p-4 border-t border-blue-100 text-xs flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-xl">
                <div class="text-slate-600">
                    <div><b>Registrado por:</b> ${obs.creado_por} (${obs.fecha_registro})</div>
                    <div><b>Solucionado por:</b> ${obs.ejecutado_por} (${obs.fecha_levantamiento})</div>
                </div>`;
            
            if (puedeAprobar) {
                // QA o Administrador: Tienen el poder de aprobar o rechazar
                bodyExpandidoHtml += `
                <div class="flex gap-2">
                    <button onclick="window.rechazarLevantamiento('${obs._docId}')" class="px-4 py-2 bg-white border border-red-500 text-red-600 hover:bg-red-50 font-bold rounded shadow-sm transition">Rechazar / Revertir</button>
                    <button onclick="window.aprobarLevantamiento('${obs._docId}')" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded shadow-sm transition">Aprobar y Cerrar</button>
                </div>`;
            } else {
                // Contratista o Cliente: Solo ven mensaje de espera
                bodyExpandidoHtml += `
                <div class="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded shadow-sm font-bold">
                    <span class="material-symbols-outlined text-[16px] animate-pulse">hourglass_empty</span> Esperando revisión de Calidad
                </div>`;
            }
            bodyExpandidoHtml += `</div>`;
        } else {
            bodyExpandidoHtml += `
            <div class="bg-slate-50 p-4 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row justify-between gap-2 rounded-b-xl">
                <div class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px] text-slate-400">person_edit</span> <b>Registrado por:</b> ${obs.creado_por} (${obs.fecha_registro})</div>
                <div class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px] text-corpGreen">task_alt</span> <b>Solucionado por:</b> ${obs.ejecutado_por} | <b>Validado por:</b> ${obs.validado_por}</div>
            </div>`;
        }
    }

    return `
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col transition-all mb-4">
            <div class="bg-slate-50 border-b border-slate-200 p-4 cursor-pointer hover:bg-slate-100 transition" onclick="window.toggleObsAccordion('${bodyId}', '${iconId}')">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-3">
                        <span class="font-black text-slate-800 text-lg">${obs.id_observacion}</span>
                        ${statusBadge}
                    </div>
                    <span id="${iconId}" class="material-symbols-outlined text-slate-500 transition-transform duration-300 bg-white rounded-full border border-slate-200 shadow-sm p-1">expand_more</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-slate-600">
                    <p><span class="font-semibold text-slate-800">Frente / Sector:</span> ${obs.frente} - ${obs.sector}</p>
                    <p><span class="font-semibold text-slate-800">Ubicación:</span> ${obs.ubicacion_especifica}</p>
                    <p><span class="font-semibold text-slate-800">Especialidad:</span> ${obs.especialidad} (${obs.gravedad})</p>
                    <p><span class="font-semibold text-slate-800">Responsable:</span> ${obs.responsable_subcontrata}</p>
                </div>
            </div>
            <div id="${bodyId}" class="hidden flex-col">
                ${bodyExpandidoHtml}
            </div>
        </div>
    `;
}

// Preview visual de la foto de solución
window.previewFotoLevan = function(input, docId) {
    if (input.files && input.files[0]) {
        document.getElementById(`label_btn_levan_${docId}`).classList.add('hidden'); // Ocultar el cuadro punteado
        document.getElementById(`prev_levan_cont_${docId}`).classList.remove('hidden'); // Mostrar miniatura
        document.getElementById(`img_prev_levan_${docId}`).src = "https://i.gifer.com/ZKZg.gif";
        
        window.procesarFotoConSello(input.files[0], function(base64Compresa) {
            document.getElementById(`img_prev_levan_${docId}`).src = base64Compresa;
            document.getElementById(`b64_levan_${docId}`).value = base64Compresa;
        });
    }
};

window.borrarFotoLevan = function(docId) {
    document.getElementById(`prev_levan_cont_${docId}`).classList.add('hidden');
    document.getElementById(`label_btn_levan_${docId}`).classList.remove('hidden');
    document.getElementById(`fotolevan_${docId}`).value = '';
    document.getElementById(`b64_levan_${docId}`).value = '';
};

// --- 1. ENVIAR A REVISIÓN ---
window.enviarARevision = async function(docId) {
    if (!window.tienePermiso("enviar_revision")) return;

    const PROJECT_ID = window.APP_STATE.proyectoActivo.id;
    const ID_FOLDER_DRIVE = window.APP_STATE.proyectoActivo.idfolder_obscal_proyect;
    
    const desc = document.getElementById(`descriplevan_${docId}`)?.value.trim() || '';
    const fechaLev = document.getElementById(`fechaejecucion_${docId}`)?.value || '';
    const fotoInput = document.getElementById(`fotolevan_${docId}`);
    
    let fileOriginalLevan = null;
    if (fotoInput && fotoInput.files && fotoInput.files[0]) fileOriginalLevan = fotoInput.files[0];

    if (!desc || !fechaLev || !fileOriginalLevan) return alert("⚠️ Por favor complete la descripción, la fecha y adjunte la foto de evidencia.");
    if (!confirm("¿Desea enviar este levantamiento para su revisión por el área de Calidad?")) return;

    try {
        const obsRef = doc(db, "observaciones_calidad", docId);
        const tempPath = `temp_fotos/${docId}_L_${Date.now()}.jpg`;
        const tempRef = ref(storage, tempPath);
        const obsId = docId.substring(docId.indexOf('_') + 1);

        const metadatosBackend = {
            customMetadata: {
                idFolderDrive: ID_FOLDER_DRIVE, empresa: window.APP_STATE.empresa?.nombre || "Empresa",
                logoUrl: window.APP_STATE.empresa?.logo || "", proyecto: window.APP_STATE.proyectoActivo.nombre,
                fecha: fechaLev, gps: "Ubicación en sitio", docId: docId, tipoOrigen: "observacion_calidad", 
                tipoFoto: "levantamiento", rutaSubcarpetas: JSON.stringify(["Fotos", obsId])
            }
        };
        
        await uploadBytes(tempRef, fileOriginalLevan, metadatosBackend);
        
        const usuarioRastreado = window.APP_STATE.user.nombre || window.APP_STATE.user.email;

        const nuevosDatos = {
            estado: "En revisión", 
            descripcion_levantamiento: desc, 
            ejecutado_por: usuarioRastreado, 
            fecha_levantamiento: fechaLev, 
            motivo_rechazo: ""
        };

        await updateDoc(obsRef, nuevosDatos);
        alert("✅ Levantamiento enviado a revisión.");
        window.actualizarCacheLocal(docId, nuevosDatos);

    } catch (error) { alert("Ocurrió un error: " + error.message); }
};

// --- 2. APROBAR LEVANTAMIENTO ---
window.aprobarLevantamiento = async function(docId) {
    if (!window.tienePermiso("aprobar_levantamiento")) return;

    if (!confirm("¿Confirma que la solución es correcta y desea CERRAR la observación?")) return;
    try {
        const obsRef = doc(db, "observaciones_calidad", docId);
        const validador = window.APP_STATE.user.nombre || window.APP_STATE.user.email;
        const fechaVal = new Date().toISOString();
        
        const nuevosDatos = { estado: "Levantada", validado_por: validador, fecha_validacion: fechaVal };
        await updateDoc(obsRef, nuevosDatos);
        
        alert("✅ Observación validada y LEVANTADA con éxito.");
        window.actualizarCacheLocal(docId, nuevosDatos);
    } catch (error) { alert("Error al aprobar: " + error.message); }
};

// --- 3. RECHAZAR LEVANTAMIENTO ---
window.rechazarLevantamiento = async function(docId) {
    if (!window.tienePermiso("rechazar_levantamiento")) return;

    const motivo = prompt("Indique el motivo del rechazo:");
    if (motivo === null) return; 
    
    try {
        const obsRef = doc(db, "observaciones_calidad", docId);
        
        const nuevosDatos = {
            estado: "Pendiente", 
            descripcion_levantamiento: "", 
            motivo_rechazo: motivo, 
            ejecutado_por: "", 
            fecha_levantamiento: "", 
            url_foto_levantamiento: "", 
            url_foto_levantamiento_visor: ""
        };

        await updateDoc(obsRef, nuevosDatos);
        alert("❌ Levantamiento rechazado.");
        window.actualizarCacheLocal(docId, nuevosDatos);
    } catch (error) { alert("Error al rechazar: " + error.message); }
};

// Función inyectora directa (Mantiene el acordeón abierto)
window.forzarRecargaFotoIndividual = async function(docId, btnElement) {
    // 1. Mostrar estado de carga visual en el botón que el usuario cliqueó
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = `<span class="material-symbols-outlined text-[14px] animate-spin">sync</span> Cargando...`;
    btnElement.disabled = true;

    try {
        const docRef = doc(db, "observaciones_calidad", docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const dataFresca = docSnap.data();
            
            // Evaluamos si ya hay enlaces
            const vH = dataFresca.url_foto_hallazgo_visor || dataFresca.url_foto_hallazgo;
            const cH = dataFresca.url_foto_hallazgo || dataFresca.url_foto_hallazgo_visor || '#';
            
            const vL = dataFresca.url_foto_levantamiento_visor || dataFresca.url_foto_levantamiento;
            const cL = dataFresca.url_foto_levantamiento || dataFresca.url_foto_levantamiento_visor || '#';
            
            let actualizoAlgo = false;

            // 2. Si encontró el enlace del Antes, inyecta el HTML en su caja exacta
            if (vH) {
                const wrapperH = document.getElementById(`wrapper_hallazgo_${docId}`);
                if (wrapperH && wrapperH.innerHTML.includes('Sin Foto')) {
                    wrapperH.innerHTML = `<div class="relative w-full h-40 md:h-48 rounded-lg overflow-hidden border border-slate-200 group bg-slate-100"><img src="${vH}" class="w-full h-full object-cover"><div class="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] font-bold py-1.5 text-center uppercase tracking-widest">Antes</div><a href="${cH}" target="_blank" class="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center text-white text-xs font-bold uppercase tracking-widest transition">Ver Alta Calidad</a></div>`;
                    actualizoAlgo = true;
                }
            }

            // 3. Si encontró el enlace del Después, inyecta el HTML en su caja exacta
            if (vL) {
                const wrapperL = document.getElementById(`wrapper_levan_${docId}`);
                if (wrapperL && wrapperL.innerHTML.includes('Sin Foto')) {
                    wrapperL.innerHTML = `<div class="relative w-full h-40 md:h-48 rounded-lg overflow-hidden border border-slate-200 group bg-slate-100"><img src="${vL}" class="w-full h-full object-cover"><div class="absolute bottom-0 left-0 right-0 bg-blue-600/90 text-white text-[10px] font-bold py-1.5 text-center uppercase tracking-widest">Después (Solución)</div><a href="${cL}" target="_blank" class="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center text-white text-xs font-bold uppercase tracking-widest transition">Ver Alta Calidad</a></div>`;
                    actualizoAlgo = true;
                }
            }

            if (actualizoAlgo) {
                // 4. Actualizamos la memoria silenciosamente sin recargar la lista entera
                const index = window.OBS_CACHE.findIndex(o => o._docId === docId);
                if (index !== -1) {
                    window.OBS_CACHE[index].url_foto_hallazgo = dataFresca.url_foto_hallazgo || "";
                    window.OBS_CACHE[index].url_foto_hallazgo_visor = dataFresca.url_foto_hallazgo_visor || "";
                    window.OBS_CACHE[index].url_foto_levantamiento = dataFresca.url_foto_levantamiento || "";
                    window.OBS_CACHE[index].url_foto_levantamiento_visor = dataFresca.url_foto_levantamiento_visor || "";
                }
            } else {
                // Si todavía no hay link, devolvemos el botón a su estado normal
                btnElement.innerHTML = originalText;
                btnElement.disabled = false;
                alert("⏳ La nube aún está procesando las imágenes. Por favor, intente de nuevo en unos segundos.");
            }

        } else {
            alert("❌ Error: No se encontró el documento.");
            btnElement.innerHTML = originalText;
            btnElement.disabled = false;
        }
    } catch (error) {
        console.error("Error consultando la foto:", error);
        alert("Ocurrió un error al contactar la nube.");
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    }
};

// ==========================================
// 5. PESTAÑA: PREVISUALIZAR Y GENERAR REPORTE PDF
// ==========================================

let pdfBlobGeneradoObs = null;
let CURRENT_OBS_PREVIEW = null;

async function urlToBase64Obs(url) {
    if (!url) return null;
    if (url.startsWith('data:image')) return url;

    try {
        const response = await fetch(url);
        if (response.ok) {
            const blob = await response.blob();
            return await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        }
    } catch (e) {
        console.warn("Error convirtiendo URL a Base64:", e);
    }
    return null;
}

window.cargarComboObservaciones = async function(filtro = "", pestana = "ambas") {
    // Si nunca se cargó el caché, lo forzamos.
    if (!window.OBS_CACHE_LOADED) {
        await window.buscarObservaciones(false); 
    }

    const prevSelect = document.getElementById('prevObsSelect');
    const envioSelect = document.getElementById('envioObsSelect');
    
    // Convertimos lo que el usuario escribe a minúsculas
    const textoBusqueda = filtro.toLowerCase().trim();

    let optionsHtml = '<option value="" disabled selected>Seleccione una observación de la lista...</option>';

    // Filtramos la memoria RAM
    window.OBS_CACHE.forEach(obs => {
        let badge = '[PENDIENTE]';
        if (obs.estado === 'Levantada') badge = '[LEVANTADA]';
        else if (obs.estado === 'En revisión') badge = '[REVISIÓN]';

        const cadenaInvisible = `${obs.id_observacion} ${obs.estado} ${obs.frente} ${obs.sector} ${obs.especialidad}`.toLowerCase();
        
        if (textoBusqueda === "" || cadenaInvisible.includes(textoBusqueda)) {
            optionsHtml += `<option value="${obs._docId}">${badge} ${obs.id_observacion} - ${obs.frente} / ${obs.sector} (${obs.especialidad})</option>`;
        }
    });

    // ¡Aquí está la magia! Solo inyecta los resultados en la pestaña correcta
    if (prevSelect && (pestana === "ambas" || pestana === "pdf")) prevSelect.innerHTML = optionsHtml;
    if (envioSelect && (pestana === "ambas" || pestana === "enviar")) envioSelect.innerHTML = optionsHtml;
};

window.generarPrevisualizacionObsPdf = async function() {
    if (!window.tienePermiso("generar_pdf")) return;
    
    const select = document.getElementById('prevObsSelect');
    const docId = select ? select.value : '';

    if (!docId) return alert("⚠️ Por favor, seleccione una observación de la lista.");

    const btn = document.getElementById('btnGenerarPrevPdf');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">refresh</span> Compilando Vectorial...`;

    try {
        const obsRef = doc(db, "observaciones_calidad", docId);
        const obsSnap = await getDoc(obsRef);

        if (!obsSnap.exists()) return alert("No se encontró la observación seleccionada.");

        const data = obsSnap.data();
        data._docId = obsSnap.id;
        CURRENT_OBS_PREVIEW = data;

        const logoB64 = window.APP_STATE.empresa?.logo ? await urlToBase64Obs(window.APP_STATE.empresa.logo) : null;
        const fotoHallazgoB64 = await urlToBase64Obs(data.url_foto_hallazgo);
        const fotoLevanB64 = await urlToBase64Obs(data.url_foto_levantamiento);

        const datosPlantilla = {
            logo: logoB64,
            nombreEmpresa: window.APP_STATE.empresa?.nombre || "EMPRESA CONTRATISTA",
            nombreProyecto: window.APP_STATE.proyectoActivo.nombre,
            idObservacion: data.id_observacion,
            fechaRegistro: data.fecha_registro || '-',
            frenteSector: `${data.frente} / ${data.sector}`,
            ubicacion: data.ubicacion_especifica || '-',
            especialidadTema: `${data.especialidad} ${data.palabra_clave ? '- ' + data.palabra_clave : ''}`,
            categoria: data.categoria || 'No especificada',
            momentoIdentificacion: data.momento_identificacion || 'No especificado',
            registradoPor: data.creado_por || 'No especificado',
            responsable: data.responsable_subcontrata || '-',
            estado: data.estado || 'Pendiente',
            gravedad: data.gravedad || 'Media',
            descripcionHallazgo: data.descripcion_hallazgo || 'Sin descripción.',
            fechaLimite: data.fecha_limite_cierre || 'No especificada',
            fotoHallazgo: fotoHallazgoB64,
            descripcionLevantamiento: data.descripcion_levantamiento || '',
            fechaLevantamiento: data.fecha_levantamiento || '-',
            validadoPor: data.validado_por || '-',
            fotoLevantamiento: fotoLevanB64
        };

        let generarDocDefinition;
        const idEmpresa = window.APP_STATE.empresa?.id || 'EMP00001';
        try {
            const modulo = await import(`./js/templates/obs_calidad/${idEmpresa}.js`);
            generarDocDefinition = modulo.generarDocDefinition;
        } catch (e) {
            const modulo = await import(`./js/templates/obs_calidad/EMP00002.js`);
            generarDocDefinition = modulo.generarDocDefinition;
        }

        const docDefinition = generarDocDefinition(datosPlantilla);
        const pdfDoc = pdfMake.createPdf(docDefinition);

        pdfDoc.getBlob((blob) => {
            pdfBlobGeneradoObs = blob;
            const pdfUrl = URL.createObjectURL(blob);

            document.getElementById('pdfPlaceholderObs')?.classList.add('hidden');
            const rootCont = document.getElementById('pdfContenedorRaiz');

            const esCelular = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (esCelular) {
                rootCont.innerHTML = `
                    <div class="text-center p-6 bg-slate-50 rounded-xl w-full border border-slate-300">
                        <span class="material-symbols-outlined text-4xl text-corpBlue-600 mb-2">picture_as_pdf</span>
                        <p class="text-slate-700 font-bold mb-3 text-sm">PDF Compilado Exitosamente</p>
                        <a href="${pdfUrl}" target="_blank" class="inline-block bg-corpBlue-600 text-white font-bold py-2.5 px-6 rounded-lg text-sm shadow">
                            Visualizar Documento
                        </a>
                    </div>`;
            } else {
                rootCont.innerHTML = `<iframe src="${pdfUrl}" class="w-full h-[600px] rounded-xl shadow-md border border-slate-300"></iframe>`;
            }

            rootCont.classList.remove('hidden');
            rootCont.classList.add('flex');

            const btnGuardar = document.getElementById('btnGuardarOficialObs');
            btnGuardar.classList.remove('hidden');
            btnGuardar.classList.add('flex');
        });

    } catch (error) {
        console.error("Error al generar PDF vectorial de observación:", error);
        alert("Error al procesar el documento: " + error.message);
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
};

window.accionGuardarPDFDefinitivoObs = async function() {
    if (!window.tienePermiso("generar_pdf")) return;
    
    if (!pdfBlobGeneradoObs || !CURRENT_OBS_PREVIEW) return alert("Primero debe compilar la vista previa del PDF.");

    const btn = document.getElementById('btnGuardarOficialObs');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">cloud_upload</span> Guardando Oficialmente...`;

    try {
        const ID_FOLDER_DRIVE = window.APP_STATE.proyectoActivo.idfolder_obscal_proyect;
        const obsId = CURRENT_OBS_PREVIEW.id_observacion; 
        const docId = CURRENT_OBS_PREVIEW._docId;
        const estadoObs = CURRENT_OBS_PREVIEW.estado || 'Pendiente';

        const nombreProyectoLimpio = window.APP_STATE.proyectoActivo.nombre
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "_");
        
        const numeroObs = obsId.replace("OBSCAL-", "").replace("OBS-", "").trim();
        const sufijo = (estadoObs === 'Levantada') ? '_LEV' : '';
        const nombreFinalPDF = `OBSCAL_${numeroObs}_${nombreProyectoLimpio}${sufijo}.pdf`;

        const pdfPath = `temp_pdfs/${Date.now()}_${nombreFinalPDF}`;
        const pdfRef = ref(storage, pdfPath);

        const metadatosBackend = {
            customMetadata: {
                idFolderDrive: ID_FOLDER_DRIVE, docId: docId, nombreArchivo: nombreFinalPDF,
                rutaSubcarpetas: JSON.stringify(["PDFs"]), coleccionDB: 'observaciones_calidad',
                carpetaResguardo: 'obscal_pdfs_finales', campoPdfDrive: 'url_pdf_oficial_visor', campoPdfStorage: 'url_pdf_oficial' 
            }
        };

        await uploadBytes(pdfRef, pdfBlobGeneradoObs, metadatosBackend);
        
        window.CURRENT_OBS_PDF_URL_TO_SEND = "Enlace en proceso (Actualice la pestaña en un momento)";
        
        btn.innerHTML = "✅ PDF Registrado Oficialmente";
        alert(`✅ PDF "${nombreFinalPDF}" enviado a la nube. Aparecerá directamente en la carpeta principal de Drive.`);

    } catch (error) {
        console.error("Error al guardar PDF:", error);
        alert("Error al guardar en la nube: " + error.message);
    } finally {
        setTimeout(() => { btn.disabled = false; btn.innerHTML = origText; }, 2000);
    }
};

// ==========================================
// 6. PESTAÑA: ENVIAR NOTIFICACIÓN Y CORREO
// ==========================================

window.CURRENT_OBS_PDF_URL_TO_SEND = null;

window.cargarDatosMensajeriaObs = async function() {
    if (!window.tienePermiso("enviar_correo")) return;
    const select = document.getElementById('envioObsSelect');
    const docId = select ? select.value : '';

    if (!docId) return alert("⚠️ Seleccione una observación de la lista para cargar la mensajería.");

    const btn = document.getElementById('btnCargarCorreoObs');
    const origText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">sync</span> Cargando...`;
        btn.disabled = true;
    }

    try {
        const obsRef = doc(db, "observaciones_calidad", docId);
        const obsSnap = await getDoc(obsRef);

        if (!obsSnap.exists()) {
            alert("No se encontró la observación en la base de datos.");
            return;
        }

        const obs = obsSnap.data();
        const projName = window.APP_STATE.proyectoActivo.nombre || "PROYECTO";
        const obsId = obs.id_observacion || "OBS-CAL";
        const estado = (obs.estado || "PENDIENTE").toUpperCase();

        // 1. Configurar Asunto del Correo
        document.getElementById('envioAsunto').value = `[CALIDAD] OBSERVACIÓN ${obsId} - ${projName} (${estado})`;

        // 2. Formatear Correos del Proyecto (Para / CC)
        const formatEmails = (str) => str ? str.replace(/;/g, ',').replace(/\s+/g, '') : "";
        document.getElementById('envioPara').value = formatEmails(window.APP_STATE.proyectoActivo.correosobscalPara);
        document.getElementById('envioCc').value = formatEmails(window.APP_STATE.proyectoActivo.correosobscalCC);

        // 3. Obtener el Enlace del PDF Oficial de Firestore
        let linkDescarga = "⚠️ (El PDF oficial aún no ha sido generado/guardado en la pestaña Reporte)";
        
        // Damos prioridad al enlace Visor de Drive, si no existe usamos el de Storage
        const enlaceFinal = obs.url_pdf_oficial_visor || obs.url_pdf_oficial;

        if (enlaceFinal) {
            window.CURRENT_OBS_PDF_URL_TO_SEND = enlaceFinal;
            linkDescarga = enlaceFinal;
        } else {
            window.CURRENT_OBS_PDF_URL_TO_SEND = null;
        }

        // 4. Redactar el Cuerpo del Mensaje
        let cuerpoTexto = `Estimados,\n\n`;
        cuerpoTexto += `Se remite la Notificación de Calidad correspondiente al proyecto ${projName}.\n\n`;
        cuerpoTexto += `--- RESUMEN DEL HALLAZGO ---\n`;
        cuerpoTexto += `• Código: ${obsId}\n`;
        cuerpoTexto += `• Estado: ${estado}\n`;
        cuerpoTexto += `• Frente / Sector: ${obs.frente || '-'} / ${obs.sector || '-'}\n`;
        cuerpoTexto += `• Ubicación: ${obs.ubicacion_especifica || '-'}\n`;
        cuerpoTexto += `• Especialidad: ${obs.especialidad || '-'}\n`;
        cuerpoTexto += `• Subcontrata / Responsable: ${obs.responsable_subcontrata || '-'}\n`;
        cuerpoTexto += `• Descripción: ${obs.descripcion_hallazgo || '-'}\n\n`;

        if (obs.estado === 'Levantada') {
            cuerpoTexto += `--- ACCIÓN CORRECTIVA / SOLUCIÓN ---\n`;
            cuerpoTexto += `• Descripción Solución: ${obs.descripcion_levantamiento || '-'}\n`;
            cuerpoTexto += `• Ejecutado por: ${obs.ejecutado_por || '-'}\n`;
            cuerpoTexto += `• Validado por: ${obs.validado_por || '-'}\n\n`;
        }

        cuerpoTexto += `Puede visualizar y descargar el documento oficial (PDF) desde el siguiente enlace seguro:\n${linkDescarga}\n\n`;
        cuerpoTexto += `Quedamos atentos a sus comentarios para la pronta atención de este registro.\n\n`;
        cuerpoTexto += `Atentamente,\n${window.APP_STATE.user.nombre || ''}\n${window.APP_STATE.user.cargo || 'Área de Calidad'}`;

        document.getElementById('envioCuerpo').value = cuerpoTexto;

    } catch (error) {
        console.error("Error al cargar mensajería de observación:", error);
        alert("Error al cargar datos: " + error.message);
    } finally {
        if (btn) {
            btn.innerHTML = origText;
            btn.disabled = false;
        }
    }
};

window.accionEnviarCorreoDefinitivoObs = async function(proveedor) {
    if (!window.tienePermiso("enviar_correo")) return;
    const para = document.getElementById('envioPara').value.trim();
    const cc = document.getElementById('envioCc').value.trim();
    const asunto = document.getElementById('envioAsunto').value.trim();
    const cuerpo = document.getElementById('envioCuerpo').value.trim();

    if (!para || !asunto) return alert("Por favor complete los campos 'Para' y 'Asunto'.");

    if (!window.CURRENT_OBS_PDF_URL_TO_SEND) {
        if (!confirm("⚠️ No se encontró un enlace de PDF guardado para esta observación. ¿Desea abrir el cliente de correo de todos modos?")) {
            return;
        }
    }

    const toEnc = para.split(',').map(e => encodeURIComponent(e.trim())).join(',');
    const ccEnc = cc ? cc.split(',').map(e => encodeURIComponent(e.trim())).join(',') : '';
    const suEnc = encodeURIComponent(asunto);
    const bodyEnc = encodeURIComponent(cuerpo);

    const esCelular = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    let mailtoEstandar = `mailto:${toEnc}?`;
    if (ccEnc) mailtoEstandar += `cc=${ccEnc}&`;
    mailtoEstandar += `subject=${suEnc}&body=${bodyEnc}`;

    if (proveedor === 'gmail' && !esCelular) {
        window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${toEnc}&cc=${ccEnc}&su=${suEnc}&body=${bodyEnc}`, '_blank');
    } else if (proveedor === 'outlook' && !esCelular) {
        window.open(`https://outlook.office.com/mail/deeplink/compose?to=${toEnc}&cc=${ccEnc}&subject=${suEnc}&body=${bodyEnc}`, '_blank');
    } else {
        window.location.href = mailtoEstandar;
    }
};