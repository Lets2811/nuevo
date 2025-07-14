// tiempos.js - Script simplificado para trabajar con /api/llegadas

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
    
    // Event listeners
    categoriaFilter.addEventListener('change', aplicarFiltroCategoria);
    actualizarBtn.addEventListener('click', cargarTiempos);
    
    // Cargar datos iniciales
    cargarTiempos();
    
    // Auto-actualización cada 30 segundos
    //setInterval(cargarTiempos, 30000);
});

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
        
        // Los datos ya vienen procesados desde el servidor
        tiemposCompletados = data.data || [];
        
        console.log(`✅ ${tiemposCompletados.length} tiempos completados cargados`);
        
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
    categoriaFilter.innerHTML = '<option value="all">Todas las categorías</option>';
    
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

function descargarTablaComoZip() {
    const tabla = document.querySelector('.times-table');
    const tablaContainer = document.getElementById('tableContainer');
  
    if (!tabla) {
      alert('No se encontró la tabla');
      return;
    }
  
    const estiloOriginal = tablaContainer.style.maxHeight;
    const overflowOriginal = tablaContainer.style.overflow;
  
    tablaContainer.style.maxHeight = 'none';
    tablaContainer.style.overflow = 'visible';
  
    setTimeout(() => {
      html2canvas(tabla).then(canvas => {
        tablaContainer.style.maxHeight = estiloOriginal;
        tablaContainer.style.overflow = overflowOriginal;
  
        const imageData = canvas.toDataURL('image/png');
  
        // Convertir la imagen base64 a blob
        fetch(imageData)
          .then(res => res.blob())
          .then(blob => {
            const zip = new JSZip();
            zip.file('tabla_tiempos.png', blob);
  
            zip.generateAsync({ type: 'blob' }).then(function(content) {
              saveAs(content, 'tiempos_completados.zip');
            });
          });
      });
    }, 100);
  }
  
function capturarTabla() {
    const tabla = document.querySelector('.times-table');
    const tablaContainer = document.getElementById('tableContainer');
  
    if (!tabla) {
      alert('No se encontró la tabla');
      return;
    }
  
    // 1. Guardar estilo original
    const estiloOriginal = tablaContainer.style.maxHeight;
    const overflowOriginal = tablaContainer.style.overflow;
  
    // 2. Expandir sin scroll
    tablaContainer.style.maxHeight = 'none';
    tablaContainer.style.overflow = 'visible';
  
    // 3. Esperar un pequeño delay para que el DOM se actualice
    setTimeout(() => {
      html2canvas(tabla).then(canvas => {
        // 4. Restaurar estilo original
        tablaContainer.style.maxHeight = estiloOriginal;
        tablaContainer.style.overflow = overflowOriginal;
  
        // 5. Descargar imagen
        const link = document.createElement('a');
        link.download = 'tiempos_completados.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    }, 100); // pequeño delay para que el DOM tenga tiempo de aplicar los estilos
  }
  
  function capturarTablaMobile() {
    const tabla = document.querySelector('.times-table');
    const tablaContainer = document.getElementById('tableContainer');
  
    if (!tabla) {
      alert('No se encontró la tabla');
      return;
    }
  
    // Guardar estilo original
    const estiloOriginal = tablaContainer.style.maxHeight;
    const overflowOriginal = tablaContainer.style.overflow;
  
    // Expandir sin scroll
    tablaContainer.style.maxHeight = 'none';
    tablaContainer.style.overflow = 'visible';
  
    // Esperar pequeño delay para que DOM se actualice
    setTimeout(() => {
      html2canvas(tabla).then(canvas => {
        // Restaurar estilos
        tablaContainer.style.maxHeight = estiloOriginal;
        tablaContainer.style.overflow = overflowOriginal;
  
        const imageData = canvas.toDataURL('image/png');
  
        // Detectar si es móvil
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
        if (isMobile) {
          // Abrir imagen en nueva pestaña
          const nuevaVentana = window.open();
          if (nuevaVentana) {
            nuevaVentana.document.write(`<img src="${imageData}" style="width:100%;"/>`);
          } else {
            alert('Por favor, permite ventanas emergentes para ver la imagen');
          }
        } else {
          // Forzar descarga en escritorio
          const link = document.createElement('a');
          link.download = 'tiempos_completados.png';
          link.href = imageData;
          link.click();
        }
      });
    }, 100);
  }
  
  

// Aplicar filtro por categoría
// Aplicar filtro por categoría - SOLO REEMPLAZA ESTA FUNCIÓN
function aplicarFiltroCategoria() {
    categoriaActual = categoriaFilter.value;
    
    // Obtener referencias a las secciones
    const timesTable = document.querySelector('.times-table');
    const podiumSection = document.getElementById('podiumSection');
    
    // Si está en "all", ocultar las secciones y salir
    if (categoriaActual === 'all') {
        if (timesTable) timesTable.style.display = 'none';
        if (podiumSection) podiumSection.style.display = 'none';
        return;
    }
    
    // Si hay una categoría específica, mostrar las secciones
    if (timesTable) timesTable.style.display = 'block';
    
    // Filtrar por categoría
    let datosFiltrados = tiemposCompletados;
    if (categoriaActual !== 'all') {
        datosFiltrados = tiemposCompletados.filter(t => t.categoria === categoriaActual);
    }
    
    // Los datos ya vienen ordenados por tiempo desde el servidor
    // pero si queremos reordenar por posición de llegada podríamos hacerlo aquí
    
    // Mostrar resultados
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
    
    // Limpiar lista
    timesList.innerHTML = '';
    
    // Crear elementos de la lista
    datos.forEach((participante, index) => {
        const item = crearElementoTiempo(participante, index + 1);
        timesList.appendChild(item);
    });
    
    // Mostrar tabla
    ocultarCargando();
    tableContainer.style.display = 'block';
    
    // Mostrar podium con top 3
    if (datos.length > 0) {
        const categoria = categoriaActual;
        const datosFiltrados = categoriaActual == 'all' ? datos : datos.filter(t => t.categoria === categoriaActual);
        console.log('📊 Datos filtrados para el podium:', categoriaActual);
        mostrarPodium(datosFiltrados.slice(0, 3));
    }
}

// Crear elemento HTML para un tiempo
function crearElementoTiempo(participante, posicion) {
    const li = document.createElement('li');
    li.className = 'time-item';
    
    // Agregar clase de podium para top 3
    if (posicion === 1) li.classList.add('podium-1');
    else if (posicion === 2) li.classList.add('podium-2');
    else if (posicion === 3) li.classList.add('podium-3');
    
    // Agregar medalla para top 3
    let medalla = '';
    if (posicion === 1) medalla = '🥇 ';
    else if (posicion === 2) medalla = '🥈 ';
    else if (posicion === 3) medalla = '🥉 ';
    
    // Formatear las horas para mostrar solo HH:MM:SS
    const horaSalida = participante.salidaFormateada ? 
        participante.salidaFormateada.split(', ')[1] : // Extraer solo la hora
        new Date(participante.salida).toLocaleTimeString('es-ES');
        
    const horaLlegada = participante.llegadaFormateada ? 
        participante.llegadaFormateada.split(', ')[1] : // Extraer solo la hora
        new Date(participante.llegada).toLocaleTimeString('es-ES');
    
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
    
    // Calcular tiempo promedio y mejor tiempo
    let promedioTexto = '-';
    let mejorTexto = '-';
    
    if (total > 0) {
        // Usar los tiempos en milisegundos que vienen del servidor
        const tiempos = datos.map(t => t.tiempo);
        const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
        const mejor = Math.min(...tiempos);
        
        promedioTexto = formatearDuracion(promedio);
        mejorTexto = formatearDuracion(mejor);
    }
    
    // Actualizar elementos
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
        totalElementos: tiemposCompletados.length
    });
};

console.log('⏱️ tiempos.js optimizado cargado - Trabajando con /api/llegadas');
console.log('💡 Usa debugTiempos() en la consola para ver los datos');