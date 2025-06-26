// registrarLlegada.js - Script optimizado para registro de llegadas

// Variables globales
let codeReader = null;
let isScanning = false;
let participantesCache = new Map(); // Cache para acelerar lookups

// Timer de alta precisión
const getHighPrecisionTimestamp = () => {
    const now = Date.now();
    const perfNow = performance.now();
    return {
        timestamp: now,
        precision: perfNow,
        iso: new Date(now).toISOString()
    };
};

// Elementos del DOM
const video = document.getElementById('qr-video');
const startButton = document.getElementById('start-scanner');
const statusDisplay = document.getElementById('scanner-status');
const resultContainer = document.getElementById('resultado');

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    console.log('🏁 Sistema de registro de llegadas inicializado');
    
    // Pre-cargar datos de participantes para acelerar proceso
    preloadParticipants();
    
    // Event listeners
    startButton.addEventListener('click', toggleScanner);
    
    // Preparar lector QR
    initializeQRReader();
});

// Pre-cargar participantes en cache
async function preloadParticipants() {
    try {
        console.log('📋 Pre-cargando participantes...');
        // Aquí puedes cargar todos los participantes activos
        // const response = await fetch('/api/participantes-activos');
        // const participantes = await response.json();
        // participantes.forEach(p => participantesCache.set(p.id, p));
        console.log('✅ Cache de participantes listo');
    } catch (error) {
        console.warn('⚠️ No se pudo pre-cargar participantes:', error);
    }
}

// Inicializar lector QR
function initializeQRReader() {
    try {
        codeReader = new ZXing.BrowserQRCodeReader();
        console.log('📱 Lector QR inicializado');
        updateStatus('📱 Listo para escanear', 'ready');
    } catch (error) {
        console.error('❌ Error al inicializar lector QR:', error);
        updateStatus('❌ Error al inicializar escáner', 'error');
    }
}

// Toggle del escáner
async function toggleScanner() {
    if (!isScanning) {
        await startScanning();
    } else {
        stopScanning();
    }
}

// Iniciar escaneo
async function startScanning() {
    if (!codeReader) {
        console.error('❌ Lector QR no disponible');
        return;
    }

    try {
        console.log('🎬 Iniciando escáner de llegadas...');
        updateStatus('🎬 Iniciando cámara...', 'loading');
        
        startButton.disabled = true;
        
        // Iniciar escáner con callback optimizado
        await codeReader.decodeFromVideoDevice(null, video, (result, error) => {
            if (result) {
                // ⚡ TIMESTAMP INMEDIATO - CRÍTICO PARA PRECISIÓN
                const arrivalTime = getHighPrecisionTimestamp();
                console.log(`⚡ QR detectado a las ${arrivalTime.iso}`);
                
                // Procesar llegada con timestamp preciso
                processArrival(result.text, arrivalTime);
            }
            
            if (error && !(error instanceof ZXing.NotFoundException)) {
                console.warn('⚠️ Error de escaneo:', error);
            }
        });
        
        isScanning = true;
        startButton.textContent = '⏹️ Detener Escáner';
        startButton.disabled = false;
        updateStatus('🔍 Escaneando códigos QR...', 'scanning');
        
    } catch (error) {
        console.error('❌ Error al iniciar escáner:', error);
        updateStatus('❌ Error al acceder a la cámara', 'error');
        startButton.disabled = false;
    }
}

// Detener escaneo
function stopScanning() {
    if (codeReader) {
        codeReader.reset();
    }
    
    isScanning = false;
    startButton.innerHTML = '<span class="btn-icon">🏁</span><span class="btn-text">Registrar Llegada</span>';
    updateStatus('📱 Listo para escanear', 'ready');
    
    console.log('⏹️ Escáner detenido');
}

// Procesar llegada - OPTIMIZADO PARA VELOCIDAD
async function processArrival(qrData, arrivalTime) {
    console.log('🏁 Procesando llegada...', { qrData, arrivalTime });
    
    try {
        // Detener escáner inmediatamente
        stopScanning();
        
        // Parsear datos QR
        const participantData = parseQRData(qrData);
        if (!participantData) {
            throw new Error('Código QR inválido');
        }
        
        // 📱 MOSTRAR RESULTADO INMEDIATAMENTE (sin esperar BD)
        showArrivalResult(participantData, arrivalTime);
        
        // 🔄 REGISTRAR EN BD EN SEGUNDO PLANO
        registerArrivalInBackground(participantData, arrivalTime);
        
    } catch (error) {
        console.error('❌ Error al procesar llegada:', error);
        showError(`Error: ${error.message}`);
        
        // Reiniciar escáner automáticamente tras error
        setTimeout(() => {
            if (!isScanning) {
                startScanning();
            }
        }, 2000);
    }
}

// Mostrar resultado inmediatamente
function showArrivalResult(participantData, arrivalTime) {
    console.log('✅ Mostrando resultado inmediato');
    
    // Actualizar UI inmediatamente
    document.getElementById('nombreParticipante').textContent = participantData.nombre;
    document.getElementById('categoriaParticipante').textContent = participantData.categoria;
    document.getElementById('horaLlegada').textContent = formatTime(arrivalTime.timestamp);
    
    // Mostrar resultado
    resultContainer.classList.remove('hidden');
    resultContainer.scrollIntoView({ behavior: 'smooth' });
    
    // Actualizar estado
    updateStatus('✅ Llegada registrada', 'success');
    
    // Sonido de confirmación (opcional)
    playSuccessSound();
}

// Registrar en base de datos (segundo plano)
async function registerArrivalInBackground(participantData, arrivalTime) {
    console.log('💾 Registrando en base de datos...');
    
    try {
        const payload = {
            participanteId: participantData.id,
            nombre: participantData.nombre,
            categoria: participantData.categoria,
            horaLlegada: arrivalTime.iso,
            timestampPrecision: arrivalTime.precision
        };
        
        const response = await fetch('/registrar-llegada', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            console.log('✅ Llegada guardada en BD:', data);
            showBackgroundSuccess();
        } else {
            throw new Error(data.error || 'Error al guardar en servidor');
        }
        
    } catch (error) {
        console.error('❌ Error al guardar en BD:', error);
        showBackgroundError(error.message);
        
        // TODO: Implementar retry automático
        // scheduleRetry(participantData, arrivalTime);
    }
}

// Parsear datos del QR
function parseQRData(qrText) {
    try {
        // Intentar parsear como JSON
        const data = JSON.parse(qrText);
        
        if (data.id && data.nombre) {
            return {
                id: data.id,
                nombre: data.nombre,
                categoria: data.categoria || 'No especificada'
            };
        }
        
        throw new Error('Datos QR incompletos');
        
    } catch (error) {
        console.error('❌ Error al parsear QR:', error);
        return null;
    }
}

// Formatear tiempo para mostrar
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3 // Mostrar milisegundos
    });
}

// Actualizar estado visual
function updateStatus(message, type = 'info') {
    const statusIcon = statusDisplay.querySelector('.status-icon');
    const statusText = statusDisplay.querySelector('.status-text');
    
    statusText.textContent = message;
    
    // Iconos según tipo
    const icons = {
        ready: 'ℹ️',
        loading: '⏳',
        scanning: '🔍',
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };
    
    statusIcon.textContent = icons[type] || 'ℹ️';
    
    // Clases CSS para estilos
    statusDisplay.className = `status-display ${type}`;
}

// Mostrar confirmación de guardado en segundo plano
function showBackgroundSuccess() {
    // Mostrar indicador sutil de que se guardó
    const indicator = document.createElement('div');
    indicator.textContent = '💾 Guardado en servidor';
    indicator.className = 'background-success-indicator';
    document.body.appendChild(indicator);
    
    setTimeout(() => {
        indicator.remove();
    }, 3000);
}

// Mostrar error de guardado en segundo plano
function showBackgroundError(message) {
    // Mostrar alerta de error pero sin bloquear UI
    const alert = document.createElement('div');
    alert.textContent = `⚠️ Error al guardar: ${message}`;
    alert.className = 'background-error-alert';
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Mostrar errores
function showError(message) {
    updateStatus(message, 'error');
    
    // También mostrar en resultado
    const resultHeader = resultContainer.querySelector('.result-header h2');
    resultHeader.textContent = `❌ ${message}`;
    resultHeader.className = 'error';
    
    resultContainer.classList.remove('hidden');
}

// Resetear escáner
function resetScanner() {
    resultContainer.classList.add('hidden');
    startScanning();
}

// Ver tiempos (placeholder)
function verTiempos() {
    window.location.href = '/reportes';
}

// Sonido de confirmación (opcional)
function playSuccessSound() {
    try {
        // Crear audio context para sonido de confirmación
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
        // Ignorar errores de audio
    }
}

// Manejo de errores globales
window.addEventListener('error', function(e) {
    console.error('❌ Error global:', e.error);
    updateStatus('❌ Error inesperado', 'error');
});

// Limpiar recursos al cerrar
window.addEventListener('beforeunload', function() {
    if (codeReader) {
        codeReader.reset();
    }
});

console.log('🏁 registrarLlegada.js cargado - Sistema optimizado para velocidad');