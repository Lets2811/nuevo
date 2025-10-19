// tiempos.js - Script con zona horaria local del navegador

// Variables globales
let tiemposCompletados = [];
let categoriaActual = 'all';

// Elementos del DOM
const categoriaFilter = document.getElementById('categoriaFilter');
const actualizarBtn = document.getElementById('actualizarBtn');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const tableContainer = document.getElementById('tableContainer');
const timesList = document.getElementById('timesList');
const contadorResultados = document.getElementById('contadorResultados');

// Elementos de estadísticas
const totalCompletados = document.getElementById('totalCompletados');
const tiempoPromedio = document.getElementById('tiempoPromedio');
const tiempoMejor = document.getElementById('tiempoMejor');
const podiumSection = document.getElementById('podiumSection');
const podiumGrid = document.getElementById('podiumGrid');

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    console.log('⏱️ Sistema de tiempos completados inicializado');
    console.log('🌍 Zona horaria del navegador:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    // Event listeners
    categoriaFilter.addEventListener('change', aplicarFiltroCategoria);
    actualizarBtn.addEventListener('click', cargarTiempos);
    
    // Cargar datos iniciales
    cargarTiempos();
    
    // Auto-actualización cada 30 segundos
    //setInterval(cargarTiempos, 30000);
});

// ===== FUNCIÓN NUEVA: Formatear timestamp a hora local =====
function formatearHoraLocal(timestamp) {
    const fecha = new Date(timestamp);
    return fecha.toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

// ===== FUNCIÓN NUEVA: Formatear solo la hora (sin fecha) =====
function formatearSoloHora(timestamp) {
    const fecha = new Date(timestamp);
    return fecha.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

// Cargar tiempos desde el servidor
async function cargarTiempos() {
    console.log('📊 Cargando tiempos completados...');
    mostrarCargando();
    
    try {
        const response = await fetch('/api/llegadas');
        if (!response.ok) {            
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📦 Respuesta del servidor:', data);
        
        if (!data.success) {
            throw new Error('El servidor retornó un error');
        }
        
        // Procesar los datos y agregar formato local
        tiemposCompletados = (data.data || []).map(participante => ({
            ...participante,
            // Formatear las fechas usando la zona horaria local del navegador
            salidaFormateada: formatearHoraLocal(participante.salida),
            llegadaFormateada: formatearHoraLocal(participante.llegada),
            salidaSoloHora: formatearSoloHora(participante.salida),
            llegadaSoloHora: formatearSoloHora(participante.llegada)
        }));
        
        console.log(`✅ ${tiemposCompletados.length} tiempos completados cargados`);
        console.log('🕐 Ejemplo de formateo:', tiemposCompletados[0] ? {
            nombre: tiemposCompletados[0].nombre,
            salidaOriginal: new Date(tiemposCompletados[0].salida),
            salidaFormateada: tiemposCompletados[0].salidaFormateada,
            llegadaOriginal: new Date(tiemposCompletados[0].llegada),
            llegadaFormateada: tiemposCompletados[0].llegadaFormateada
        } : 'No hay datos');
        
        // Actualizar categorías disponibles
        actualizarFiltrosCategorias();
        
        // Mostrar resultados
        aplicarFiltroCategoria();
        
    } catch (error) {
        console.error('❌ Error al cargar tiempos:', error);
        mostrarError('Error al cargar los datos. Verifica la conexión.');
    }
}

// Actualizar filtros de categorías
function actualizarFiltrosCategorias() {
    const categorias = [...new Set(tiemposCompletados.map(t => t.categoria))].sort();
    
    // Guardar selección actual
    const seleccionActual = categoriaFilter.value;
    
    // Limpiar opciones existentes excepto "Todas"
    categoriaFilter.innerHTML = '<option value="all">Elige categoria</option>';
    
    // Agregar categorías encontradas
    categorias.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria;
        option.textContent = categoria;
        categoriaFilter.appendChild(option);
    });
    
    // Restaurar selección si existe
    if (categorias.includes(seleccionActual)) {
        categoriaFilter.value = seleccionActual;
    }
}

function obtenerNombreArchivoCategoria() {
    const categoria = document.getElementById('categoriaFilter')?.value || 'general';
    return categoria === 'all' ? 'todas_las_categorias' : categoria.replace(/\s+/g, '_').toLowerCase();
}

function descargarTablaComoZip() {
    const listaOriginal = document.getElementById('timesList');
    const tablaContainer = document.getElementById('tableContainer');
    const categoria = obtenerNombreArchivoCategoria();
  
    if (!listaOriginal) {
      alert('No se encontró la lista');
      return;
    }
  
    const items = Array.from(listaOriginal.querySelectorAll('li'));
    const estiloOriginal = tablaContainer.style.maxHeight;
    const overflowOriginal = tablaContainer.style.overflow;
  
    tablaContainer.style.maxHeight = 'none';
    tablaContainer.style.overflow = 'visible';
  
    const zip = new JSZip();
  
    // Crear contenedor temporal oculto
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '-9999px';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = listaOriginal.offsetWidth + 'px';
    tempContainer.className = 'times-table';
    document.body.appendChild(tempContainer);
  
    const chunkSize = 4;
    const bloques = Math.ceil(items.length / chunkSize);
  
    const capturarBloque = (i) => {
      return new Promise((resolve) => {
        tempContainer.innerHTML = '';
  
        const ul = document.createElement('ul');
        ul.className = 'times-list';
  
        const bloque = items.slice(i * chunkSize, (i + 1) * chunkSize);
        bloque.forEach(item => ul.appendChild(item.cloneNode(true)));
  
        tempContainer.appendChild(ul);
  
        requestAnimationFrame(() => {
          html2canvas(tempContainer).then(canvas => {
            canvas.toBlob(blob => {
              const filename = `${categoria}_parte_${i + 1}.png`;
              zip.file(filename, blob);
              resolve();
            });
          });
        });
      });
    };
  
    (async function () {
      for (let i = 0; i < bloques; i++) {
        await capturarBloque(i);
      }
  
      document.body.removeChild(tempContainer);
      tablaContainer.style.maxHeight = estiloOriginal;
      tablaContainer.style.overflow = overflowOriginal;
  
      zip.generateAsync({ type: 'blob' }).then(content => {
        saveAs(content, `${categoria}.zip`);
      });
    })();
}

// Aplicar filtro por categoría
function aplicarFiltroCategoria() {
    categoriaActual = categoriaFilter.value;
    
    const timesTable = document.querySelector('.times-table');
    const podiumSection = document.getElementById('podiumSection');
    
    if (categoriaActual === 'all') {
        if (timesTable) timesTable.style.display = 'none';
        if (podiumSection) podiumSection.style.display = 'none';
        return;
    }
    
    if (timesTable) timesTable.style.display = 'block';
    
    let datosFiltrados = tiemposCompletados;
    if (categoriaActual !== 'all') {
        datosFiltrados = tiemposCompletados.filter(t => t.categoria === categoriaActual);
    }
    
    mostrarResultados(datosFiltrados);
    actualizarEstadisticas(datosFiltrados);
}

// Mostrar resultados en la tabla
function mostrarResultados(datos) {
    contadorResultados.textContent = `${datos.length} completado${datos.length === 1 ? '' : 's'}`;
    
    if (datos.length === 0) {
        mostrarEstadoVacio();
        return;
    }
    
    timesList.innerHTML = '';
    
    datos.forEach((participante, index) => {
        const item = crearElementoTiempo(participante, index + 1);
        timesList.appendChild(item);
    });
    
    ocultarCargando();
    tableContainer.style.display = 'block';
    
    if (datos.length > 0) {
        const datosFiltrados = categoriaActual == 'all' ? datos : datos.filter(t => t.categoria === categoriaActual);
        mostrarPodium(datosFiltrados.slice(0, 3));
    }
}

// Crear elemento HTML para un tiempo
function crearElementoTiempo(participante, posicion) {
    const li = document.createElement('li');
    li.className = 'time-item';
    
    if (posicion === 1) li.classList.add('podium-1');
    else if (posicion === 2) li.classList.add('podium-2');
    else if (posicion === 3) li.classList.add('podium-3');
    
    let medalla = '';
    if (posicion === 1) medalla = '🥇 ';
    else if (posicion === 2) medalla = '🥈 ';
    else if (posicion === 3) medalla = '🥉 ';
    
    // CAMBIO IMPORTANTE: Usar las horas formateadas con zona horaria local
    const horaSalida = participante.salidaSoloHora;
    const horaLlegada = participante.llegadaSoloHora;
    
    // Vista desktop
    li.innerHTML = `
        <div class="position">${medalla}${posicion}</div>
        <div class="participant-info">
            <div class="participant-name">${participante.nombre}</div>
            <div class="participant-category">${participante.categoria}</div>
        </div>
        <div class="time-value">${participante.tiempoFormateado}</div>
        <div class="time-value">${horaSalida} / ${horaLlegada}</div>
    `;
    
    // Vista móvil
    if (window.innerWidth <= 768) {
        li.innerHTML = `
            <div class="position">${medalla}${posicion}</div>
            <div class="participant-info">
                <div class="participant-name">${participante.nombre}</div>
                <div class="participant-category">${participante.categoria}</div>
                <div class="time-details">
                    <div class="time-value total-time"><small>Tiempo:</small><br>${participante.tiempoFormateado}</div>
                    <div class="time-value">${horaSalida} / ${horaLlegada}</div>
                </div>
            </div>
        `;
    }
    
    return li;
}

// Mostrar podium
function mostrarPodium(top3) {
    if (top3.length === 0) {
        podiumSection.style.display = 'none';
        return;
    }
    
    const medallas = ['🥇', '🥈', '🥉'];
    const colores = ['#FFD700', '#C0C0C0', '#CD7F32'];
    const posiciones = ['1er Lugar', '2do Lugar', '3er Lugar'];
    
    podiumGrid.innerHTML = '';
    
    top3.forEach((participante, index) => {
        const div = document.createElement('div');
        div.className = 'action-card';
        div.style.borderLeft = `4px solid ${colores[index]}`;
        
        div.innerHTML = `
            <div class="action-icon">${medallas[index]}</div>
            <div class="action-content">
                <h4>${posiciones[index]}</h4>
                <p><strong>${participante.nombre}</strong></p>
                <p>${participante.categoria}</p>
                <p style="color: ${colores[index]}; font-weight: bold; font-size: 1.1rem;">
                    ${participante.tiempoFormateado}
                </p>
            </div>
        `;
        
        podiumGrid.appendChild(div);
    });
    
    podiumSection.style.display = 'block';
}

// Actualizar estadísticas
function actualizarEstadisticas(datos) {
    const total = datos.length;
    
    let promedioTexto = '-';
    let mejorTexto = '-';
    
    if (total > 0) {
        const tiempos = datos.map(t => t.tiempo);
        const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
        const mejor = Math.min(...tiempos);
        
        promedioTexto = formatearDuracion(promedio);
        mejorTexto = formatearDuracion(mejor);
    }
    
    totalCompletados.textContent = total;
    tiempoPromedio.textContent = promedioTexto;
    tiempoMejor.textContent = mejorTexto;
}

// Formatear duración en milisegundos a HH:MM:SS
function formatearDuracion(milisegundos) {
    if (!milisegundos || milisegundos < 0) return '-';
    
    const segundos = Math.floor(milisegundos / 1000);
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;
    
    if (horas > 0) {
        return `${horas}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    } else {
        return `${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    }
}

// Estados de carga
function mostrarCargando() {
    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
    tableContainer.style.display = 'none';
    podiumSection.style.display = 'none';
    actualizarBtn.disabled = true;
    actualizarBtn.textContent = '⏳ Cargando...';
}

function ocultarCargando() {
    loadingState.style.display = 'none';
    actualizarBtn.disabled = false;
    actualizarBtn.innerHTML = '🔄 Actualizar';
}

function mostrarEstadoVacio() {
    loadingState.style.display = 'none';
    emptyState.style.display = 'block';
    tableContainer.style.display = 'none';
    podiumSection.style.display = 'none';
    actualizarBtn.disabled = false;
    actualizarBtn.innerHTML = '🔄 Actualizar';
}

function mostrarError(mensaje) {
    loadingState.style.display = 'none';
    emptyState.style.display = 'block';
    emptyState.innerHTML = `
        <div style="color: #dc3545;">
            ❌<br>
            <h3>Error al cargar datos</h3>
            <p>${mensaje}</p>
            <button onclick="cargarTiempos()" class="btn btn-primary" style="margin-top: 15px;">
                🔄 Reintentar
            </button>
        </div>
    `;
    tableContainer.style.display = 'none';
    podiumSection.style.display = 'none';
    actualizarBtn.disabled = false;
    actualizarBtn.innerHTML = '🔄 Actualizar';
}

// Manejo de redimensionamiento para vista móvil
window.addEventListener('resize', function() {
    if (tiemposCompletados.length > 0) {
        aplicarFiltroCategoria();
    }
});

// Debug: Mostrar datos en consola
window.debugTiempos = function() {
    console.log('🐛 DEBUG - Datos actuales:', {
        tiemposCompletados,
        categoriaActual,
        totalElementos: tiemposCompletados.length,
        zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ejemploTimestamp: tiemposCompletados[0] ? {
            salida: new Date(tiemposCompletados[0].salida),
            llegada: new Date(tiemposCompletados[0].llegada),
            salidaFormateada: tiemposCompletados[0].salidaFormateada,
            llegadaFormateada: tiemposCompletados[0].llegadaFormateada
        } : null
    });
};

console.log('⏱️ tiempos.js con zona horaria local cargado');
console.log('🌍 Zona horaria detectada:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('💡 Usa debugTiempos() en la consola para ver los datos');