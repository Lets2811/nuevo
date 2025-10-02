// Colores para notificaciones usando tu paleta específica
function getNotificationColor(tipo) {
    switch (tipo) {
        case 'success': return '#1C1C1C';
        case 'error': return '#1C1C1C';
        case 'warning': return '#1C1C1C';
        default: return '#1C1C1C';
    }
}

function getNotificationBorderColor(tipo) {
    switch (tipo) {
        case 'success': return '#00FF3C';
        case 'error': return '#ff4444';
        case 'warning': return '#FFD700';
        default: return '#2196F3';
    }
}

function getNotificationTextColor(tipo) {
    return '#FFFFFF';
}

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = 'info') {
    const existingNotifs = document.querySelectorAll('.notification');
    existingNotifs.forEach(notif => notif.remove());
    
    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background-color: ${getNotificationColor(tipo)};
        color: ${getNotificationTextColor(tipo)};
        border-radius: 10px;
        z-index: 10000;
        max-width: 350px;
        word-wrap: break-word;
        box-shadow: 0 6px 20px rgba(0,0,0,0.5);
        font-weight: bold;
        animation: slideInRight 0.3s ease;
        border: 2px solid ${getNotificationBorderColor(tipo)};
        font-family: Arial, sans-serif;
    `;
    notif.textContent = mensaje;
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 4000);
}

// Variables globales para carga masiva
let datosExcel = [];
let datosValidados = [];

// ===========================================
// FUNCIONES DE MODO (Individual vs Masivo)
// ===========================================

function cambiarModo(modo) {
    const modoIndividual = document.getElementById('modoIndividual');
    const modoMasivo = document.getElementById('modoMasivo');
    const seccionIndividual = document.getElementById('registroIndividual');
    const seccionMasiva = document.getElementById('cargaMasiva');

    if (modo === 'individual') {
        modoIndividual.classList.add('active');
        modoMasivo.classList.remove('active');
        seccionIndividual.classList.remove('hidden');
        seccionMasiva.classList.add('hidden');
        resetForm();
    } else {
        modoIndividual.classList.remove('active');
        modoMasivo.classList.add('active');
        seccionIndividual.classList.add('hidden');
        seccionMasiva.classList.remove('hidden');
        resetMasivaCarga();
    }
}

// Event listeners para cambio de modo
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('modoIndividual').addEventListener('click', () => cambiarModo('individual'));
    document.getElementById('modoMasivo').addEventListener('click', () => cambiarModo('masivo'));
});

// ===========================================
// FUNCIONES DE REGISTRO INDIVIDUAL
// ===========================================

function mostrarResultado(data) {
    const resultadoDiv = document.getElementById('resultado');

    // Actualizar datos del participante
    document.getElementById('numeroParticipante').textContent = data.numero || 'No asignado';
    document.getElementById('nombreParticipante').textContent = data.nombre || 'No disponible';
    document.getElementById('categoriaParticipante').textContent = data.categoria || 'No especificada';

    console.log('Mostrando en UI:', {
        numero: data.numero,
        nombre: data.nombre,
        categoria: data.categoria
    });

    // Actualizar QR con animación
    const qrContainer = document.getElementById('qrContainer');
    qrContainer.innerHTML = `
        <div style="opacity: 0; transition: opacity 0.5s ease;">
            <h3 style="color: #00FF3C; margin-bottom: 15px;">📱 Tu Código QR</h3>
            <img src="${data.qrUrl}" alt="QR Code" style="animation: slideInUp 0.6s ease; max-width: 200px;">
            <p style="color: #888888; font-size: 14px; margin-top: 10px;">
                💡 Guarda este código para el día del evento
            </p>
        </div>
    `;

    setTimeout(() => {
        qrContainer.firstElementChild.style.opacity = '1';
    }, 100);

    // Asignar evento para descargar usando la función personalizada
    const btnDescargar = document.getElementById('descargarQR');
    btnDescargar.onclick = () => descargarQR(data.qrUrl, data.nombre);

    // Mostrar resultado con animación
    resultadoDiv.classList.remove('hidden');
    resultadoDiv.style.opacity = '0';
    resultadoDiv.style.transform = 'translateY(20px)';

    setTimeout(() => {
        resultadoDiv.style.transition = 'all 0.5s ease';
        resultadoDiv.style.opacity = '1';
        resultadoDiv.style.transform = 'translateY(0)';
    }, 50);
}


// Formulario individual
document.getElementById('registroForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const numero = document.getElementById('numero').value.trim();
    const nombreP1 = document.getElementById('nombre_p1').value.trim();
    const nombreP2 = document.getElementById('nombre_p2').value.trim();
    const categoria = document.getElementById('categoria').value;
    
    console.log('Datos del formulario:', { numero, nombreP1, nombreP2, categoria });
    
    if (!numero || !nombreP1 || !nombreP2 || !categoria) {
        mostrarNotificacion('❌ Por favor complete todos los campos', 'error');
        return;
    }

    // Validar que el número sea positivo
    if (parseInt(numero) <= 0) {
        mostrarNotificacion('❌ El número debe ser mayor a 0', 'error');
        return;
    }
    
    const btn = e.target.querySelector('button[type="submit"]');
    const btnText = btn.querySelector('.btn-text');
    const btnIcon = btn.querySelector('.btn-icon');
    const btnLoader = btn.querySelector('.btn-loader');
    
    setButtonState(btn, btnText, btnIcon, btnLoader, true);
    
    console.log('Enviando datos:', { numero, nombreP1, nombreP2, categoria });
    
    fetch('/registrar', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `numero=${encodeURIComponent(numero)}&nombrep1=${encodeURIComponent(nombreP1)}&nombrep2=${encodeURIComponent(nombreP2)}&categoria=${encodeURIComponent(categoria)}`
    })
    .then(response => {
        console.log('Respuesta recibida, status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Datos recibidos del servidor:', data);
        
        if (data.error) {
            console.error('Error del servidor:', data.error);
            mostrarNotificacion(`❌ Error: ${data.error}`, 'error');
            throw new Error(data.error)
        };
        
        mostrarResultado(data);
        mostrarNotificacion('🎉 ¡Participante registrado exitosamente!', 'success');
        
        setTimeout(() => {
            document.getElementById('resultado').scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 300);
        
    })
    .catch(error => {
        console.error('Error en el proceso:', error);
        mostrarNotificacion(`❌ Error: ${error.message}`, 'error');
    })
    .finally(() => {
        setButtonState(btn, btnText, btnIcon, btnLoader, false);
    });
});

// ===========================================
// FUNCIONES DE CARGA MASIVA
// ===========================================

// Configurar zona de arrastre
function configurarZonaArrastre() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    // Prevenir comportamiento por defecto
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Resaltar zona de arrastre
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => uploadZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => uploadZone.classList.remove('dragover'), false);
    });

    // Manejar archivos arrastrados
    uploadZone.addEventListener('drop', manejarArchivos, false);
    fileInput.addEventListener('change', manejarArchivos, false);

    // Click en zona de arrastre
    uploadZone.addEventListener('click', () => fileInput.click());
}

function manejarArchivos(e) {
    const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
    
    if (files.length === 0) return;
    
    const file = files[0];
    
    // Validar tipo de archivo
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        mostrarNotificacion('❌ Por favor selecciona un archivo Excel (.xlsx o .xls)', 'error');
        return;
    }

    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
        mostrarNotificacion('❌ El archivo es demasiado grande. Máximo 5MB', 'error');
        return;
    }

    mostrarNotificacion('📂 Procesando archivo Excel...', 'info');
    leerArchivoExcel(file);
}

function leerArchivoExcel(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Tomar la primera hoja
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convertir a JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            procesarDatosExcel(jsonData);
            
        } catch (error) {
            console.error('Error al procesar Excel:', error);
            mostrarNotificacion('❌ Error al procesar el archivo Excel', 'error');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

function procesarDatosExcel(rawData) {
    if (rawData.length < 2) {
        mostrarNotificacion('❌ El archivo debe tener al menos una fila de datos', 'error');
        return;
    }

    const headers = rawData[0].map(h => h?.toString().toLowerCase().trim());
    const dataRows = rawData.slice(1);

    // Buscar columnas requeridas
    const numeroCol = encontrarColumna(headers, ['numero', 'número', 'num', '#']);
    const nombreCol = encontrarColumna(headers, ['nombre', 'name', 'participante']);
    const categoriaCol = encontrarColumna(headers, ['categoria', 'categoría', 'category', 'cat']);

    if (numeroCol === -1 || nombreCol === -1 || categoriaCol === -1) {
        mostrarNotificacion('❌ El archivo debe tener columnas: Número, Nombre, Categoría', 'error');
        return;
    }

    // Procesar datos
    datosExcel = [];
    dataRows.forEach((row, index) => {
        if (row.length === 0 || !row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
            return; // Saltar filas vacías
        }

        const numero = row[numeroCol]?.toString().trim();
        const nombre = row[nombreCol]?.toString().trim();
        const categoria = row[categoriaCol]?.toString().trim();

        datosExcel.push({
            fila: index + 2, // +2 porque empezamos desde la fila 2 (1 es header)
            numero,
            nombre,
            categoria,
            valido: false,
            errores: []
        });
    });

    validarDatos();
    mostrarVistaPrevia();
}

function encontrarColumna(headers, posibleNombres) {
    for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (posibleNombres.some(nombre => header.includes(nombre))) {
            return i;
        }
    }
    return -1;
}

function validarDatos() {
    const categoriesValidas = [
        'Principiante Femenino', 'Intermedio Femenino', 'Avanzado Femenino',
        'Principiante Masculino', 'Intermedio Masculino', 'Avanzado Masculino'
    ];

    const numerosUsados = new Set();

    datosExcel.forEach(item => {
        item.errores = [];
        item.valido = true;

        // Validar número
        if (!item.numero || item.numero === '') {
            item.errores.push('Número requerido');
            item.valido = false;
        } else if (isNaN(parseInt(item.numero)) || parseInt(item.numero) <= 0) {
            item.errores.push('Número inválido');
            item.valido = false;
        } else if (numerosUsados.has(item.numero)) {
            item.errores.push('Número duplicado');
            item.valido = false;
        } else {
            numerosUsados.add(item.numero);
        }

        // Validar nombre
        if (!item.nombre || item.nombre === '') {
            item.errores.push('Nombre requerido');
            item.valido = false;
        } else if (item.nombre.length < 2) {
            item.errores.push('Nombre muy corto');
            item.valido = false;
        }

        // Validar categoría
        if (!item.categoria || item.categoria === '') {
            item.errores.push('Categoría requerida');
            item.valido = false;
        } else if (!categoriesValidas.includes(item.categoria)) {
            item.errores.push('Categoría inválida');
            item.valido = false;
        }
    });

    datosValidados = datosExcel.filter(item => item.valido);
}

function mostrarVistaPrevia() {
    const previewSection = document.getElementById('previewSection');
    const totalRegistros = document.getElementById('totalRegistros');
    const errorCount = document.getElementById('errorCount');
    const tableBody = document.getElementById('previewTableBody');

    previewSection.classList.remove('hidden');

    // Actualizar estadísticas
    const totalValidos = datosValidados.length;
    const totalErrores = datosExcel.length - totalValidos;

    totalRegistros.textContent = `${totalValidos} registros válidos`;
    
    if (totalErrores > 0) {
        errorCount.textContent = `${totalErrores} errores`;
        errorCount.classList.remove('hidden');
    } else {
        errorCount.classList.add('hidden');
    }

    // Limpiar tabla
    tableBody.innerHTML = '';

    // Mostrar primeros 10 registros
    const registrosAMostrar = datosExcel.slice(0, 10);
    
    registrosAMostrar.forEach(item => {
        const row = document.createElement('tr');
        row.className = item.valido ? 'success' : 'error';
        
        row.innerHTML = `
            <td><span class="status-icon">${item.valido ? '✅' : '❌'}</span></td>
            <td>${item.numero || 'N/A'}</td>
            <td>${item.nombre || 'N/A'}</td>
            <td>${item.categoria || 'N/A'}</td>
        `;
        
        if (!item.valido) {
            row.title = 'Errores: ' + item.errores.join(', ');
        }
        
        tableBody.appendChild(row);
    });

    // Mostrar botón de procesar solo si hay datos válidos
    const procesarBtn = document.getElementById('procesarLote');
    procesarBtn.style.display = totalValidos > 0 ? 'inline-flex' : 'none';

    if (datosExcel.length > 10) {
        const moreRow = document.createElement('tr');
        moreRow.innerHTML = `<td colspan="4" style="text-align: center; font-style: italic; color: #666;">... y ${datosExcel.length - 10} registros más</td>`;
        tableBody.appendChild(moreRow);
    }

    mostrarNotificacion(`📊 ${totalValidos} registros listos para procesar`, 'success');
}

async function descargarQR(qrUrl, nombre, mostrarMensaje = true) {
    try {
        const response = await fetch(qrUrl);
        if (!response.ok) throw new Error('Error al descargar el archivo');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QR_${nombre.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        if (mostrarMensaje) mostrarNotificacion(`✅ QR de ${nombre} descargado`, 'success');

    } catch (error) {
        console.error('Error al descargar:', error);
        if (mostrarMensaje) mostrarNotificacion(`❌ Error al descargar QR de ${nombre}`, 'error');
    }
}

// Procesar lote de participantes
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('procesarLote').addEventListener('click', async function() {
        if (datosValidados.length === 0) {
            mostrarNotificacion('❌ No hay datos válidos para procesar', 'error');
            return;
        }

        // Mostrar sección de progreso
        const progressSection = document.getElementById('progressSection');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const progressPercent = document.getElementById('progressPercent');

        progressSection.classList.remove('hidden');
        
        // Ocultar vista previa
        document.getElementById('previewSection').classList.add('hidden');

        let procesados = 0;
        let exitosos = 0;
        let fallidos = 0;
        const errores = [];

        const total = datosValidados.length;

        // Procesar uno por uno para mostrar progreso
        for (const participante of datosValidados) {
            try {
                const response = await fetch('/registrar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `numero=${encodeURIComponent(participante.numero)}&nombre=${encodeURIComponent(participante.nombre)}&categoria=${encodeURIComponent(participante.categoria)}`
                });

                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                exitosos++;
            } catch (error) {
                console.error(`Error procesando ${participante.nombre}:`, error);
                fallidos++;
                errores.push(`Fila ${participante.fila} (${participante.nombre}): ${error.message}`);
            }

            procesados++;
            
            // Actualizar progreso
            const porcentaje = Math.round((procesados / total) * 100);
            progressFill.style.width = `${porcentaje}%`;
            progressText.textContent = `${procesados} / ${total} procesados`;
            progressPercent.textContent = `${porcentaje}%`;

            // Pequeña pausa para mostrar progreso
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Mostrar resultados
        mostrarResultadosMasivos(exitosos, fallidos, errores);
    });
});

function mostrarResultadosMasivos(exitosos, fallidos, errores) {
    const progressSection = document.getElementById('progressSection');
    const resultsSection = document.getElementById('resultsSection');
    const successCount = document.getElementById('successCount');
    const failCount = document.getElementById('failCount');
    const errorDetails = document.getElementById('errorDetails');
    const errorList = document.getElementById('errorList');

    // Ocultar progreso y mostrar resultados
    progressSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');

    // Actualizar contadores
    successCount.textContent = exitosos;
    failCount.textContent = fallidos;

    // Mostrar errores si los hay
    if (errores.length > 0) {
        errorDetails.classList.remove('hidden');
        errorList.innerHTML = '';
        errores.forEach(error => {
            const li = document.createElement('li');
            li.textContent = error;
            li.style.color = '#ff4444';
            li.style.marginBottom = '5px';
            errorList.appendChild(li);
        });
    } else {
        errorDetails.classList.add('hidden');
    }

    // Mostrar notificación final
    const mensaje = fallidos > 0 
        ? `✅ ${exitosos} exitosos, ❌ ${fallidos} fallidos`
        : `🎉 ¡${exitosos} participantes registrados exitosamente!`;
    
    mostrarNotificacion(mensaje, fallidos > 0 ? 'warning' : 'success');
}

// ===========================================
// FUNCIONES DE UTILIDAD
// ===========================================

function setButtonState(btn, btnText, btnIcon, btnLoader, loading) {
    if (loading) {
        btn.disabled = true;
        btnText.textContent = 'Registrando...';
        btnIcon.classList.add('hidden');
        btnLoader.classList.remove('hidden');
    } else {
        btn.disabled = false;
        btnText.textContent = 'Registrar Participante';
        btnIcon.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
}

function resetForm() {
    const form = document.getElementById('registroForm');
    const resultado = document.getElementById('resultado');
    
    resultado.style.transition = 'all 0.3s ease';
    resultado.style.opacity = '0';
    resultado.style.transform = 'translateY(-20px)';
    
    setTimeout(() => {
        resultado.classList.add('hidden');
        resultado.style.transition = '';
        resultado.style.opacity = '';
        resultado.style.transform = '';
    }, 300);
    
    form.reset();
    
    setTimeout(() => {
        document.getElementById('numero').focus();
    }, 400);
    
    mostrarNotificacion('🔄 Formulario limpiado', 'info');
}

function resetMasivaCarga() {
    // Resetear variables
    datosExcel = [];
    datosValidados = [];
    
    // Ocultar todas las secciones
    document.getElementById('previewSection').classList.add('hidden');
    document.getElementById('progressSection').classList.add('hidden');
    document.getElementById('resultsSection').classList.add('hidden');
    
    // Limpiar input de archivo
    document.getElementById('fileInput').value = '';
    
    // Remover clase dragover
    document.getElementById('uploadZone').classList.remove('dragover');
}

function cancelarCarga() {
    resetMasivaCarga();
    mostrarNotificacion('❌ Carga cancelada', 'info');
}

function descargarPlantilla() {
    // Crear datos de ejemplo
    const datosEjemplo = [
        ['Número', 'Nombre', 'Categoría'],
        [1, 'Juan Pérez', 'Principiante Masculino'],
        [2, 'María García', 'Intermedio Femenino'],
        [3, 'Carlos López', 'Avanzado Masculino'],
        [4, 'Ana Martínez', 'Principiante Femenino']
    ];

    // Crear libro de Excel
    const ws = XLSX.utils.aoa_to_sheet(datosEjemplo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Participantes');

    // Descargar archivo
    XLSX.writeFile(wb, 'plantilla_participantes.xlsx');
    
    mostrarNotificacion('📥 Plantilla descargada exitosamente', 'success');
}

// ===========================================
// INICIALIZACIÓN
// ===========================================

document.addEventListener('DOMContentLoaded', function() {
    // Auto-focus en el campo número
    document.getElementById('numero').focus();
    
    // Configurar zona de arrastre
    configurarZonaArrastre();
    
    // Animación de entrada para el formulario
    const form = document.querySelector('.registration-form');
    if (form) {
        form.style.opacity = '0';
        form.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            form.style.transition = 'all 0.6s ease';
            form.style.opacity = '1';
            form.style.transform = 'translateY(0)';
        }, 100);
    }
});

// Funciones globales para uso en HTML
window.resetForm = resetForm;
window.cancelarCarga = cancelarCarga;
window.resetMasivaCarga = resetMasivaCarga;
window.descargarPlantilla = descargarPlantilla;

// Agregar animaciones CSS dinámicamente
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    @keyframes slideInUp {
        from {
            transform: translateY(30px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);