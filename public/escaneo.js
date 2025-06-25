document.addEventListener('DOMContentLoaded', async () => {
    const codeReader = new ZXing.BrowserQRCodeReader();
    const videoElement = document.getElementById('qr-video');
    const startBtn = document.getElementById('start-scanner');
    const stopBtn = document.getElementById('stop-scanner');
    const statusDisplay = document.getElementById('scanner-status');
    const resultadoDiv = document.getElementById('resultado');

    // Limpiar resultados previos
    resultadoDiv.classList.add('hidden');

    startBtn.addEventListener('click', async () => {
        try {
            updateStatus('📷 Iniciando cámara...', 'info');
            
            // Agregar clase activa al contenedor
            document.getElementById('scanner-container').classList.add('scanner-active');
            
            await codeReader.decodeFromVideoDevice(null, videoElement, async (result, error) => {
                if (result) {
                    const id = result.text;
                    updateStatus('🎯 QR detectado! Buscando participante...', 'success');
                    
                    try {
                        const participante = await buscarParticipante(id);
                        mostrarResultado(participante);
                        codeReader.reset();
                        stopScanner();
                        
                        // Mostrar notificación de éxito
                        mostrarNotificacion('🎉 ¡Participante identificado exitosamente!', 'success');
                        
                    } catch (err) {
                        updateStatus('❌ Error: ' + err.message, 'error');
                        mostrarNotificacion('❌ ' + err.message, 'error');
                    }
                }
                if (error && !error.message.includes('No QR code found')) {
                    updateStatus('⚠️ Error: ' + error.message, 'error');
                }
            });

            startBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            updateStatus('📱 Enfoca el código QR del participante', 'scanning');
            
        } catch (error) {
            updateStatus('❌ Error: ' + error.message, 'error');
            mostrarNotificacion('❌ Error al acceder a la cámara: ' + error.message, 'error');
        }
    });

    stopBtn.addEventListener('click', () => {
        stopScanner();
    });

    function stopScanner() {
        codeReader.reset();
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        updateStatus('ℹ️ Escáner listo', 'ready');
        
        // Remover clase activa
        document.getElementById('scanner-container').classList.remove('scanner-active');
    }

    // Función mejorada para actualizar estado
    function updateStatus(mensaje, tipo = 'info') {
        const iconos = {
            'info': 'ℹ️',
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'scanning': '📱',
            'ready': '🟢'
        };
        
        const icon = iconos[tipo] || 'ℹ️';
        statusDisplay.innerHTML = `
            <span class="status-icon">${icon}</span>
            <span class="status-text">${mensaje}</span>
        `;
        
        // Aplicar clase CSS para el tipo
        statusDisplay.className = `status-display scanner-${tipo}`;
    }

    async function buscarParticipante(qrData) {
        try {
            let id;
            try {
                const parsedData = JSON.parse(qrData);
                id = parsedData.id;
            } catch {
                id = qrData; // Si no es JSON, usar el valor directamente
            }

            const response = await fetch(`/participante/${id}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Error al buscar participante');
            }
            
            // Si el QR contenía JSON completo, usar esos datos
            try {
                const qrInfo = JSON.parse(qrData);
                if (qrInfo.nombre) {
                    data.nombre = qrInfo.nombre;
                    data.categoria = qrInfo.categoria;
                }
            } catch (e) {
                // No era JSON, usar datos del servidor
            }
            
            return data;
        } catch (error) {
            console.error('Error en buscarParticipante:', error);
            throw error;
        }
    }

    // Función mejorada para mostrar resultado
    function mostrarResultado(participante) {
        try {
            // Si el participante viene como string JSON, parsearlo
            if (typeof participante === 'string') {
                try {
                    participante = JSON.parse(participante);
                } catch (e) {
                    participante = { nombre: participante };
                }
            }

            // Actualizar datos con animación
            document.getElementById('nombreParticipante').textContent = participante.nombre || 'No disponible';
            document.getElementById('categoriaParticipante').textContent = participante.categoria || 'No registrada';
            
            // Mostrar resultado con animación
            resultadoDiv.classList.remove('hidden');
            resultadoDiv.style.opacity = '0';
            resultadoDiv.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                resultadoDiv.style.transition = 'all 0.5s ease';
                resultadoDiv.style.opacity = '1';
                resultadoDiv.style.transform = 'translateY(0)';
            }, 50);
            
            // Scroll suave hacia el resultado
            setTimeout(() => {
                resultadoDiv.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 300);
            
        } catch (error) {
            console.error('Error al mostrar resultado:', error);
            updateStatus('❌ Error al mostrar datos', 'error');
        }
    }

    // Función para mostrar notificaciones (usando la misma paleta)
    function mostrarNotificacion(mensaje, tipo = 'info') {
        // Remover notificaciones existentes
        const existingNotifs = document.querySelectorAll('.notification');
        existingNotifs.forEach(notif => notif.remove());
        
        // Crear nueva notificación
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
        
        // Auto remover después de 4 segundos
        setTimeout(() => {
            notif.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notif.remove(), 300);
        }, 4000);
    }

    function getNotificationBorderColor(tipo) {
        switch (tipo) {
            case 'success': return '#00FF3C';  // Verde neón
            case 'error': return '#ff4444';    // Rojo para errores
            case 'warning': return '#FFD700';  // Dorado especial
            default: return '#2196F3';         // Azul secundario
        }
    }

    // Función global para resetear escáner
    window.resetScanner = function() {
        // Ocultar resultado con animación
        resultadoDiv.style.transition = 'all 0.3s ease';
        resultadoDiv.style.opacity = '0';
        resultadoDiv.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
            resultadoDiv.classList.add('hidden');
            resultadoDiv.style.transition = '';
            resultadoDiv.style.opacity = '';
            resultadoDiv.style.transform = '';
        }, 300);
        
        // Resetear estado del escáner
        updateStatus('ℹ️ Presiona "Iniciar Escáner"', 'ready');
        
        // Asegurar que el escáner esté detenido
        codeReader.reset();
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        
        // Remover clase activa
        document.getElementById('scanner-container').classList.remove('scanner-active');
        
        mostrarNotificacion('🔄 Escáner reiniciado', 'info');
    };

    // Agregar animaciones CSS dinámicamente si no existen
    if (!document.querySelector('#scan-animations')) {
        const style = document.createElement('style');
        style.id = 'scan-animations';
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
        `;
        document.head.appendChild(style);
    }

    // Mensaje de bienvenida
    updateStatus('ℹ️ Presiona "Iniciar Escáner"', 'ready');
});