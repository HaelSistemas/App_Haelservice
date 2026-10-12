// ==========================================
// registro_fotografico.js (Conectado al Backend Drive)
// ==========================================

import { auth, db, initAppCore } from "./app_core.js";
import { getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const storage = getStorage();

// Ahora guardaremos objetos { fileOriginal, thumbBase64 }
let fotosLote = []; 
let ubicacionGPS = "-0.00000, -0.00000";

// --- INICIALIZACIÓN DE LA MICRO-APP ---
document.addEventListener("DOMContentLoaded", () => {
    initAppCore(true).then((estadoGlobal) => {
        if (!estadoGlobal || !estadoGlobal.proyectoActivo || !estadoGlobal.proyectoActivo.id) {
            alert("⚠️ Acceso denegado. No se seleccionó un proyecto válido.");
            window.location.href = "index.html"; 
            return;
        }

        // Setear la fecha de hoy
        const now = new Date();
        const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        document.getElementById('fechaRegistro').value = localDate;

        obtenerUbicacion();

        // Ocultar carga y mostrar contenido principal
        document.getElementById('pantalla-carga').classList.add('hidden');
        document.getElementById('navbar-global').classList.remove('hidden');
        document.getElementById('main-content').classList.remove('hidden');

    }).catch(error => {
        console.error("Error al iniciar:", error);
        alert("Ocurrió un error al cargar el contexto del proyecto.");
    });
});

function obtenerUbicacion() {
    navigator.geolocation.getCurrentPosition(
        (pos) => { 
            ubicacionGPS = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`; 
            document.getElementById('statusText').innerHTML = `<span class="text-green-600 flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[16px]">location_on</span> Ubicación detectada</span>`;
        },
        (err) => { 
            document.getElementById('statusText').innerHTML = `<span class="text-red-500 flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[16px]">location_off</span> Ubicación no disponible</span>`;
        },
        { enableHighAccuracy: true }
    );
}

// =====================================
// LÓGICA DE FOTOS Y MARCA DE AGUA (THUMBNAIL)
// =====================================

window.procesarFotoMultiple = async function(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    document.getElementById('statusText').innerHTML = `<span class="text-corpBlue-600 flex items-center justify-center gap-1"><span class="material-symbols-outlined animate-spin text-[16px]">refresh</span> Procesando miniatura(s)...</span>`;
    
    try {
        for (let i = 0; i < files.length; i++) {
            await procesarUnaFoto(files[i]);
        }
        
        // Si todo sale bien, actualizamos el texto al éxito
        document.getElementById('statusText').innerHTML = `<span class="text-green-600 flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[16px]">check_circle</span> Fotos listas para subir</span>`;
    } catch (error) {
        console.error("Error procesando las fotos:", error);
        document.getElementById('statusText').innerHTML = `<span class="text-red-500 flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[16px]">error</span> Error al procesar</span>`;
    }

    // --- LIMPIEZA ABSOLUTA DE MEMORIA (A PRUEBA DE FALLOS) ---
    // 1. Limpiamos directamente el input que disparó el evento (la forma más segura)
    if (event.target) {
        event.target.value = "";
    }
    
    // 2. Limpiamos los inputs específicos solo si existen en el HTML
    const camInput = document.getElementById('cameraInput');
    if (camInput) camInput.value = "";
    
    const galInput = document.getElementById('galleryInput');
    if (galInput) galInput.value = "";
};

function procesarUnaFoto(file) {
    return new Promise((resolve) => {
        try {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const img = new Image();
                    img.onload = function() {
                        try {
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            
                            const MAX_WIDTH = 1920;
                            let width = img.width || MAX_WIDTH;
                            let height = img.height || 1080;
                            
                            if (width > MAX_WIDTH) {
                                height = Math.round((height * MAX_WIDTH) / width);
                                width = MAX_WIDTH;
                            }
                            
                            canvas.width = width;
                            canvas.height = height;
                            ctx.drawImage(img, 0, 0, width, height);

                            const fontGrande = Math.max(40, Math.floor(height * 0.06));  
                            const fontMedia = Math.max(18, Math.floor(height * 0.028));  
                            const fontPequena = Math.max(12, Math.floor(height * 0.014));  
                            const margin = width * 0.03;
                            
                            const sombraOffset = Math.max(3, Math.floor(width * 0.004)); 
                            const sombraBlur = Math.max(8, Math.floor(width * 0.012));   

                            ctx.fillStyle = "white";
                            ctx.shadowColor = "rgba(0, 0, 0, 1)"; 
                            ctx.shadowBlur = sombraBlur;
                            ctx.shadowOffsetX = sombraOffset;
                            ctx.shadowOffsetY = sombraOffset;

                            const sellarFoto = (logoHeightPx, logoWidthPx, logoObject) => {
                                try {
                                    const dibujarTextoConSombra = (texto, x, y) => {
                                        ctx.strokeStyle = "rgba(0, 0, 0, 0.8)"; 
                                        ctx.lineWidth = Math.max(2, Math.floor(width * 0.0015)); 
                                        ctx.strokeText(texto, x, y); 
                                        ctx.fillText(texto, x, y);   
                                    };
                                    
                                    ctx.textAlign = "right"; 
                                    let cursorYRight = margin;
                                    
                                    if (logoObject) {
                                        const logoX = width - margin - logoWidthPx;
                                        ctx.drawImage(logoObject, logoX, cursorYRight, logoWidthPx, logoHeightPx);
                                        cursorYRight += logoHeightPx + (fontPequena * 1.5);
                                    } else {
                                        cursorYRight += (fontPequena * 1.5);
                                    }

                                    ctx.font = `${fontPequena}px sans-serif`;
                                    dibujarTextoConSombra(window.APP_STATE.empresa.nombre || "Empresa Contratista", width - margin, cursorYRight);
                                    cursorYRight += (fontPequena * 1.5);
                                    dibujarTextoConSombra((window.APP_STATE.proyectoActivo.nombre || "").substring(0, 40), width - margin, cursorYRight);

                                    ctx.textAlign = "left"; 
                                    const fechaSeleccionada = document.getElementById('fechaRegistro').value; 
                                    const dateObj = new Date(fechaSeleccionada + "T12:00:00"); 
                                    const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
                                    const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
                                    
                                    const strFecha = `${dateObj.getDate()} de ${meses[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
                                    const strDia = dias[dateObj.getDay()];

                                    const now = new Date();
                                    const horaTexto = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                                    let cursorYLeft = height - margin;

                                    ctx.font = `${fontPequena}px sans-serif`;
                                    dibujarTextoConSombra(ubicacionGPS, margin, cursorYLeft);
                                    
                                    cursorYLeft -= (fontPequena * 2);

                                    ctx.font = `bold ${fontGrande}px sans-serif`;
                                    dibujarTextoConSombra(horaTexto, margin, cursorYLeft);
                                    const timeWidth = ctx.measureText(horaTexto).width;

                                    const lineX = margin + timeWidth + 20;
                                    ctx.beginPath();
                                    ctx.moveTo(lineX, cursorYLeft - fontGrande + (fontGrande * 0.2));
                                    ctx.lineTo(lineX, cursorYLeft);
                                    ctx.lineWidth = Math.max(3, Math.floor(width * 0.003));
                                    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)"; 
                                    ctx.shadowColor = "rgba(0, 0, 0, 1)";
                                    ctx.shadowBlur = sombraBlur;
                                    ctx.stroke();
                                    ctx.shadowColor = "transparent"; 

                                    ctx.font = `bold ${fontMedia}px sans-serif`;
                                    const textXFecha = lineX + 20;
                                    dibujarTextoConSombra(strFecha, textXFecha, cursorYLeft - (fontGrande / 2) + (fontMedia * 0.3));
                                    dibujarTextoConSombra(strDia, textXFecha, cursorYLeft);

                                    // Si falla la generación Base64 por caché, lo atrapamos aquí sin trabar la app
                                    const base64Generado = canvas.toDataURL("image/jpeg", 0.60);
                                    
                                    fotosLote.push({
                                        fileOriginal: file,
                                        thumbBase64: base64Generado
                                    });
                                    
                                    actualizarGaleria();
                                    resolve();
                                } catch (e) {
                                    console.error("Error al sellar foto:", e);
                                    resolve(); // Resolvemos igual para desatascar la aplicación
                                }
                            };

                            const logoUrl = window.APP_STATE.empresa.logo_marca_agua || window.APP_STATE.empresa.logo;
                            if (logoUrl) {
                                const watermarkObj = new Image();
                                watermarkObj.crossOrigin = "Anonymous";
                                watermarkObj.onload = function() {
                                    const aspect = watermarkObj.naturalWidth / watermarkObj.naturalHeight;
                                    const targetLogoHeight = Math.max(10, height * 0.04);
                                    const targetLogoWidth = targetLogoHeight * aspect;
                                    sellarFoto(targetLogoHeight, targetLogoWidth, watermarkObj);
                                };
                                watermarkObj.onerror = function() { sellarFoto(0, 0, null); };
                                
                                // Truco de seguridad para caché con validador de URL
                                const separator = logoUrl.includes('?') ? '&' : '?';
                                watermarkObj.src = logoUrl + separator + "bypass=" + Date.now();
                            } else {
                                sellarFoto(0, 0, null);
                            }
                        } catch (e) {
                            console.error("Error procesando canvas:", e);
                            resolve(); 
                        }
                    };
                    img.onerror = function() { resolve(); };
                    img.src = e.target.result;
                } catch (e) { resolve(); }
            };
            reader.onerror = function() { resolve(); };
            reader.readAsDataURL(file);
        } catch (globalError) { resolve(); }
    });
}

function actualizarGaleria() {
    const zonaSubida = document.getElementById('zonaSubida');
    const galeriaScroll = document.getElementById('galeriaScroll');
    
    if(fotosLote.length > 0) {
        zonaSubida.classList.remove('hidden');
        zonaSubida.classList.add('flex');
        document.getElementById('contadorFotos').innerText = fotosLote.length;
        
        // Blindaje: Si el span existe lo actualiza, si no, reconstruye el interior del botón
        const spanTextoBtn = document.getElementById('textoBtnGuardar');
        if (spanTextoBtn) {
            spanTextoBtn.innerText = `Subir ${fotosLote.length} foto(s)`;
        } else {
            document.getElementById('btnGuardarMasivo').innerHTML = `<span class="material-symbols-outlined">cloud_upload</span> <span id="textoBtnGuardar">Subir ${fotosLote.length} foto(s)</span>`;
        }
        
        let htmlConstructor = "";
        fotosLote.forEach((fotoItem, index) => {
            htmlConstructor += `
                <div class="relative w-full aspect-[3/4]">
                    <img src="${fotoItem.thumbBase64}" class="w-full h-full object-cover rounded-lg border border-slate-300 shadow-sm bg-white">
                    <button onclick="window.eliminarFoto(${index})" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-[12px] font-bold shadow-md hover:bg-red-600 transition z-10">✕</button>
                </div>
            `;
        });
        galeriaScroll.innerHTML = htmlConstructor;
        
    } else {
        zonaSubida.classList.add('hidden');
        zonaSubida.classList.remove('flex');
        galeriaScroll.innerHTML = "";
    }
}

window.eliminarFoto = function(index) {
    fotosLote.splice(index, 1);
    actualizarGaleria();
};

function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) { ia[i] = byteString.charCodeAt(i); }
    return new Blob([ab], {type: mimeString});
}

// =====================================
// ENVÍO A FIREBASE STORAGE (Bandeja Temporal)
// =====================================
window.guardarYEnviarLote = async function() {
    if (fotosLote.length === 0) return;
    
    const PROJECT_ID = window.APP_STATE.proyectoActivo.id;
    const ID_FOLDER_DRIVE = window.APP_STATE.proyectoActivo.idfolder_regfoto_proyect;
    
    if (!ID_FOLDER_DRIVE) {
        alert("⚠️ Error: El proyecto no tiene configurado un 'idfolder_regfoto_proyect' en la base de datos.");
        return;
    }

    const btn = document.getElementById('btnGuardarMasivo');
    const toggleLocal = document.getElementById('toggleLocal').checked;
    const fechaSeleccionada = document.getElementById('fechaRegistro').value;
    const docId = fechaSeleccionada + "_" + PROJECT_ID;
    
    btn.innerHTML = `Subiendo a la nube... <span class="material-symbols-outlined animate-spin text-lg">refresh</span>`;
    btn.disabled = true;

    // 1. Crear el "cascarón" del documento en Firestore si no existe
    try {
        const galeriaRef = doc(db, "registro_fotos", docId);
        const usuarioSube = window.APP_STATE.user.nombre || window.APP_STATE.user.email;

        await setDoc(galeriaRef, {
            id_proyect: PROJECT_ID,
            fecha_proyect: fechaSeleccionada,
            creadopor_proyect: usuarioSube,
            ultima_subida: new Date().toISOString()
        }, { merge: true });
    } catch (dbError) {
        console.error("Error creando documento base:", dbError);
        alert("Error al conectar con la base de datos.");
        restaurarBotonSubida(btn);
        return;
    }

    let errores = 0;

    // 2. Iterar sobre las fotos y subir a la bandeja temporal de Storage
    for (let i = 0; i < fotosLote.length; i++) {
        const fotoItem = fotosLote[i];
        
        // HUELLA DIGITAL: FOTO + Timestamp exacto + Índice
        const uniqueId = `FOTO_${Date.now()}_${i}`;

        // Descarga Local Opcional (Usa la miniatura con la info estampada)
        if (toggleLocal) {
            try {
                const a = document.createElement("a");
                a.href = fotoItem.thumbBase64;
                a.download = `${uniqueId}.jpg`; 
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch(e) { console.log("Error descarga local: ", e); }
        }

        try {
            // SE ELIMINÓ LA SUBIDA DE LA MINIATURA. 
            // Solo subimos la Original Pesada a temp_fotos/ (Para que el Backend trabaje)
            const tempPath = `temp_fotos/${uniqueId}.jpg`;
            const tempRef = ref(storage, tempPath);
            
            // Inyección de Metadatos cruciales para procesarFotoDrive.js
            const metadatosBackend = {
                customMetadata: {
                    idFolderDrive: ID_FOLDER_DRIVE,
                    empresa: window.APP_STATE.empresa.nombre || "Empresa Sin Nombre",
                    logoUrl: window.APP_STATE.empresa.logo_marca_agua || window.APP_STATE.empresa.logo || "", 
                    proyecto: window.APP_STATE.proyectoActivo.nombre || "Proyecto Sin Nombre",
                    fecha: fechaSeleccionada,
                    gps: ubicacionGPS,
                    docId: docId,
                    // --- NUEVAS ETIQUETAS DE ENRUTAMIENTO ---
                    tipoOrigen: 'registro_fotografico'
                }
            };

            await uploadBytes(tempRef, fotoItem.fileOriginal, metadatosBackend);

        } catch (error) {
            console.error("Error subiendo archivos de la foto:", error);
            errores++;
        }
    }

    if (errores === 0) {
        alert(`✅ Carga exitosa. Enviando fotos a Google Drive.`);
    } else {
        alert(`⚠️ Proceso terminado, pero ocurrieron ${errores} errores al enviar.`);
    }

    // 3. Limpiar pantalla
    fotosLote = [];
    actualizarGaleria();
    restaurarBotonSubida(btn);
};

function restaurarBotonSubida(btn) {
    // Restauramos incluyendo la etiqueta span para que actualizarGaleria no falle en el lote 2
    btn.innerHTML = `<span class="material-symbols-outlined">cloud_upload</span> <span id="textoBtnGuardar">Subir Fotos a la nube</span>`;
    btn.disabled = false;
    document.getElementById('statusText').innerHTML = `<span class="text-green-600 flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[16px]">check_circle</span> Listo para nuevo lote</span>`;
}