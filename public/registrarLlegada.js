// Variables globales
let codeReader = null;
let isScanning = false;
let participantesCache = new Map();
let currentMode = 'qr'; // 'qr' o 'manual'
let participanteSeleccionado = null;

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
const overlay = document.getElementById('confirmationOverlay');

// Elementos del registro manual
const manualSection = document.getElementById('manualSection');
const scannerSection = document.getElementById('scannerSection');
const numeroInput = document.getElementById('numeroParticipante');
const registrarManualBtn = document.getElementById('registrarManualBtn');
const participantPreview = document.getElementById('participantPreview');

// Inicialización
document.addEventListener('DOMContentLoaded', function () {
    console.log('🏁 Sistema de registro de llegadas inicializado');
    preloadParticipants();
    startButton.addEventListener('click', toggleScanner);
    initializeQRReader();
    
    // Event listeners para registro manual
    if (numeroInput) {
        numeroInput.addEventListener('input', buscarParticipantePorNumero);
        numeroInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !registrarManualBtn.disabled) {
                registrarLlegadaManual();
            }
        });
    }
});

// ===== FUNCIONES DE MODO DE REGISTRO =====

function toggleRegistrationMode() {
    const toggleBtn = document.getElementById('toggleModeBtn');
    const toggleText = document.getElementById('toggleModeText');
    
    if (currentMode === 'qr') {
        // Cambiar a modo manual
        currentMode = 'manual';
        scannerSection.classList.add('mode-hidden');
        manualSection.classList.remove('mode-hidden');
        toggleText.textContent = '📷 Cambiar a Escaneo QR';
        
        // Detener el escáner si está activo
        if (isScanning) {
            stopScanning();
        }
        
        // Focus en el input
        setTimeout(() => numeroInput.focus(), 300);
        
        console.log('🔄 Modo cambiado a: Manual');
    } else {
        // Cambiar a modo QR
        currentMode = 'qr';
        manualSection.classList.add('mode-hidden');
        scannerSection.classList.remove('mode-hidden');
        toggleText.textContent = '📝 Cambiar a Registro Manual';
        
        // Limpiar formulario manual
        limpiarFormularioManual();
        
        console.log('🔄 Modo cambiado a: QR');
    }
}

// ===== FUNCIONES DE REGISTRO MANUAL =====

function buscarParticipantePorNumero() {
    const numero = numeroInput.value.trim();
    
    if (!numero || numero === '') {
        ocultarPreviewParticipante();
        return;
    }
    
    // Buscar en el cache primero
    let participante = null;
    for (let [id, p] of participantesCache) {
        if (p.numero && p.numero.toString() === numero) {
            participante = p;
            break;
        }
    }
    
    if (participante) {
        mostrarPreviewParticipante(participante);
        participanteSeleccionado = participante;
        registrarManualBtn.disabled = false;
    } else {
        // Si no está en cache, buscar en el servidor
        buscarParticipanteEnServidor(numero);
    }
}

async function buscarParticipanteEnServidor(numero) {
    try {
        const response = await fetch(`/api/participante-por-numero/${numero}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.participante) {
                const participante = data.participante;
                
                // Agregar al cache
                participantesCache.set(participante.id, participante);
                
                // Mostrar preview
                mostrarPreviewParticipante(participante);
                participanteSeleccionado = participante;
                registrarManualBtn.disabled = false;
            }
        } else {
            ocultarPreviewParticipante();
            participanteSeleccionado = null;
            registrarManualBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error al buscar participante:', error);
        ocultarPreviewParticipante();
        participanteSeleccionado = null;
        registrarManualBtn.disabled = true;
    }
}

function mostrarPreviewParticipante(participante) {
    document.getElementById('previewNombre').textContent = participante.nombre;
    document.getElementById('previewCategoria').textContent = participante.categoria;
    document.getElementById('previewNumero').textContent = participante.numero || participante.id;
    
    participantPreview.classList.add('visible');
}

function ocultarPreviewParticipante() {
    participantPreview.classList.remove('visible');
    participanteSeleccionado = null;
    registrarManualBtn.disabled = true;
}

async function registrarLlegadaManual() {
    if (!participanteSeleccionado) {
        mostrarNotificacion('⚠️ Selecciona un participante primero', 'warning');
        return;
    }
    
    try {
        registrarManualBtn.disabled = true;
        registrarManualBtn.innerHTML = '<span>⏳</span><span>Registrando...</span>';
        
        const arrivalTime = getHighPrecisionTimestamp();
        console.log(`⚡ Llegada manual registrada a las ${arrivalTime.iso}`);
        
        const rta = await registerArrivalInBackground(participanteSeleccionado, arrivalTime);
        
        if (rta) {
            showArrivalResult(participanteSeleccionado, arrivalTime);
            limpiarFormularioManual();
        } else {
            throw new Error('No se pudo registrar la llegada en el servidor');
        }
        
    } catch (error) {
        console.error('❌ Error al registrar llegada manual:', error);
        showError(`Error: ${error.message}`);
        mostrarNotificacion(`❌ ${error.message}`, 'error');
    } finally {
        registrarManualBtn.disabled = false;
        registrarManualBtn.innerHTML = '<span>🏁</span><span>Registrar Llegada</span>';
    }
}

function limpiarFormularioManual() {
    numeroInput.value = '';
    ocultarPreviewParticipante();
    participanteSeleccionado = null;
    registrarManualBtn.disabled = true;
}

// ===== FUNCIONES ORIGINALES (QR) =====

// Pre-cargar participantes
async function preloadParticipants() {
    try {
        console.log('📋 Pre-cargando participantes...');
        const response = await fetch('/api/participantes');
        
        if (response.ok) {
            const data = await response.json();
            if (data.participantes && Array.isArray(data.participantes)) {
                data.participantes.forEach(p => {
                    participantesCache.set(p._id, {
                        id: p._id,
                        nombre: p.nombre,
                        categoria: p.categoria,
                        numero: p.numero
                    });
                });
                console.log(`✅ Cache de participantes listo: ${participantesCache.size} participantes`);
            }
        }
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

// Toggle escáner
async function toggleScanner() {
    if (!isScanning) {
        await startScanning();
    } else {
        stopScanning();
    }
}

// Iniciar escaneo
async function startScanning() {
    if (!codeReader) return;

    try {
        updateStatus('🎬 Iniciando cámara...', 'loading');
        startButton.disabled = true;

        await codeReader.decodeFromVideoDevice(null, video, (result, error) => {
            if (result) {
                const arrivalTime = getHighPrecisionTimestamp();
                console.log(`⚡ QR detectado a las ${arrivalTime.iso}`);
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

// Detener escáner
function stopScanning() {
    if (codeReader) {
        codeReader.reset();
    }
    isScanning = false;
    startButton.innerHTML = '<span class="btn-icon">🏁</span><span class="btn-text">Registrar Llegada</span>';
    updateStatus('📱 Listo para escanear', 'ready');
    console.log('⏹️ Escáner detenido');
}

// Procesar llegada
async function processArrival(qrData, arrivalTime) {
    try {
        stopScanning();
        const participantData = parseQRData(qrData);
        if (!participantData) throw new Error('Código QR inválido');

        const rta = await registerArrivalInBackground(participantData, arrivalTime);

        console.log('Respuesta de registro en background:', rta);
        if (rta) {
            showArrivalResult(participantData, arrivalTime);
        } else {
            throw new Error('No se pudo registrar la llegada en el servidor');
        }

    } catch (error) {
        console.error('❌ Error al procesar llegada:', error);
        showError(`Error: ${error.message}`);

        setTimeout(() => {
            if (!isScanning) startScanning();
        }, 2000);
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
        background-color: #1C1C1C;
        color: #FFFFFF;
        border-radius: 10px;
        z-index: 10000;
        max-width: 300px;
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

// Mostrar resultado inmediato
function showArrivalResult(participantData, arrivalTime) {
    console.log('✅ Mostrando resultado inmediato');
    showBlockingConfirmation();

    document.getElementById('nombreParticipante').textContent = participantData.nombre;
    document.getElementById('categoriaParticipante').textContent = participantData.categoria;
    document.getElementById('horaLlegada').textContent = formatTime(arrivalTime.timestamp);

    resultContainer.classList.remove('hidden');
    resultContainer.scrollIntoView({ behavior: 'smooth' });
    updateStatus('✅ Llegada registrada', 'success');
    playSuccessSound();
}

// Mostrar overlay bloqueante
function showBlockingConfirmation() {
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 4000);
}

// Guardar llegada en BD
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        console.log('Respuesta del servidor:', data);
        if (response.ok && data.success) {
            console.log('✅ Llegada guardada en BD:', data);
            showBackgroundSuccess();
            return true;
        } else {
            mostrarNotificacion(`❌ Error al guardar llegada: ${data.error || 'Error desconocido'}`, 'error');
            return false;
        }

    } catch (error) {
        console.error('❌ Error al guardar en BD:', error);
        showBackgroundError(error.message);
        return false;
    }
}

// Parsear QR
function parseQRData(qrText) {
    try {
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

// Formatear hora
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    });
}

// Estado visual
function updateStatus(message, type = 'info') {
    const statusIcon = statusDisplay.querySelector('.status-icon');
    const statusText = statusDisplay.querySelector('.status-text');
    statusText.textContent = message;

    const icons = {
        ready: 'ℹ️', loading: '⏳', scanning: '🔍',
        success: '✅', error: '❌', warning: '⚠️'
    };
    statusIcon.textContent = icons[type] || 'ℹ️';
    statusDisplay.className = `status-display ${type}`;
}

// Confirmación guardado
function showBackgroundSuccess() {
    const indicator = document.createElement('div');
    indicator.textContent = '💾 Guardado en servidor';
    indicator.className = 'background-success-indicator';
    document.body.appendChild(indicator);
    setTimeout(() => indicator.remove(), 3000);
}

// Error en guardado
function showBackgroundError(message) {
    const alert = document.createElement('div');
    alert.textContent = `⚠️ Error al guardar: ${message}`;
    alert.className = 'background-error-alert';
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
}

// Mostrar error
function showError(message) {
    updateStatus(message, 'error');
    const resultHeader = resultContainer.querySelector('.result-header h2');
    resultHeader.textContent = `❌ ${message}`;
    resultHeader.className = 'error';
    resultContainer.classList.remove('hidden');
}

// Reset escáner
function resetScanner() {
    resultContainer.classList.add('hidden');
    
    if (currentMode === 'qr') {
        startScanning();
    } else {
        limpiarFormularioManual();
        numeroInput.focus();
    }
}

// Ir a reportes
function verTiempos() {
    window.location.href = '/reportes';
}

// Sonido éxito
function playSuccessSound() {
    try {
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
    } catch (error) {}
}

// Error global
window.addEventListener('error', function (e) {
    console.error('❌ Error global:', e.error);
    updateStatus('❌ Error inesperado', 'error');
});

// Reset al cerrar
window.addEventListener('beforeunload', function () {
    if (codeReader) {
        codeReader.reset();
    }
});