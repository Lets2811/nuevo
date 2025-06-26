document.addEventListener('DOMContentLoaded', async () => {
    const codeReader = new ZXing.BrowserQRCodeReader();
    const videoElement = document.getElementById('qr-video');
    const startBtn = document.getElementById('start-scanner');
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
                    const qrData = result.text;
                    updateStatus('🎯 QR detectado! Preparando salida...', 'success');
                    
                    try {
                        // Detener el escáner inmediatamente
                        codeReader.reset();
                        
                        // Iniciar contador de salida
                        await iniciarContadorSalida(qrData);
                        
                    } catch (err) {
                        updateStatus('❌ Error: ' + err.message, 'error');
                        mostrarNotificacion('❌ ' + err.message, 'error');
                        
                        // Reiniciar automáticamente en caso de error
                        setTimeout(() => {
                            resetScanner();
                        }, 3000);
                    }
                }
                if (error && !error.message.includes('No QR code found')) {
                    updateStatus('⚠️ Error de cámara: ' + error.message, 'error');
                }
            });

            // Cambiar estado del botón mientras escanea
            startBtn.querySelector('.btn-text').textContent = 'Escaneando...';
            startBtn.querySelector('.btn-icon').textContent = '📱';
            startBtn.disabled = true;
            
            updateStatus('📱 Enfoca el código QR del participante', 'scanning');
            
        } catch (error) {
            updateStatus('❌ Error: ' + error.message, 'error');
            mostrarNotificacion('❌ Error al acceder a la cámara: ' + error.message, 'error');
            resetScanner();
        }
    });

    // Función para iniciar el contador de salida
    async function iniciarContadorSalida(qrData) {
        try {
            // Primero obtener datos del participante
            let participanteData;
            try {
                participanteData = JSON.parse(qrData);
            } catch {
                const response = await fetch(`/participante/${qrData}`);
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Participante no encontrado');
                }
                participanteData = data;
            }

            // Validar datos
            if (!participanteData.nombre) {
                throw new Error('Datos del participante incompletos');
            }

            // Mostrar información del participante y preparar contador
            mostrarContadorSalida(participanteData);
            
            // Vibración inicial si está disponible
            if (navigator.vibrate) {
                navigator.vibrate(200);
            }

            // Contador de 3, 2, 1
            for (let i = 5; i >= 1; i--) {
                actualizarContador(i, participanteData);
                
                // Sonido/vibración en cada número
                if (navigator.vibrate) {
                    navigator.vibrate(100);
                }
                
                // Esperar 1 segundo
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // ¡YA! - Momento exacto de la salida
            actualizarContador('¡YA!', participanteData);
            
            // Vibración larga para la salida
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }

            // Registrar la salida en este momento exacto
            const participante = await registrarSalida(qrData, participanteData);
            
            // Esperar un momento antes de mostrar el resultado
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Ocultar contador y mostrar resultado
            ocultarContador();
            mostrarResultadoSalida(participante);
            stopScanner();
            
            mostrarNotificacion('🏃‍♂️ ¡Salida registrada exitosamente!', 'success');

        } catch (error) {
            console.error('Error en contador de salida:', error);
            ocultarContador();
            throw error;
        }
    }

    // Función para mostrar el contador visual
    function mostrarContadorSalida(participante) {
        // Crear overlay del contador si no existe
        let contadorOverlay = document.getElementById('contador-overlay');
        if (!contadorOverlay) {
            contadorOverlay = document.createElement('div');
            contadorOverlay.id = 'contador-overlay';
            contadorOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.95);
                z-index: 99999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #FFFFFF;
                font-family: Arial, sans-serif;
            `;
            document.body.appendChild(contadorOverlay);
        }

        contadorOverlay.innerHTML = `
            <div style="text-align: center; max-width: 90%; margin-bottom: 40px;">
                <h2 style="color: #00FF3C; margin: 0 0 20px 0; font-size: 1.5em;">
                    🏃‍♂️ Preparando Salida
                </h2>
                <div style="background-color: #1C1C1C; padding: 20px; border-radius: 15px; border: 2px solid #00FF3C;">
                    <p style="margin: 10px 0; font-size: 1.1em;">
                        <strong>👤 ${participante.nombre}</strong>
                    </p>
                    <p style="margin: 10px 0; color: #00FF3C;">
                        🏆 ${participante.categoria || 'No especificada'}
                    </p>
                </div>
            </div>
            
            <div id="contador-numero" style="
                font-size: 8em;
                font-weight: bold;
                color: #00FF3C;
                text-shadow: 0 0 20px rgba(0, 255, 60, 0.8);
                margin: 20px 0;
                min-height: 1.2em;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                3
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <p style="color: #888; font-size: 1.1em; margin: 0 0 20px 0;">
                    ⏱️ Salida en...
                </p>
                <button onclick="cancelarContador()" style="
                    background-color: #ff4444;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 25px;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.3s ease;
                ">
                    ❌ Cancelar
                </button>
            </div>
        `;

        contadorOverlay.style.display = 'flex';
    }

    // Función para actualizar el número del contador
    function actualizarContador(numero, participante) {
        const contadorNumero = document.getElementById('contador-numero');
        if (contadorNumero) {
            // Animación de salida
            contadorNumero.style.transform = 'scale(0.5)';
            contadorNumero.style.opacity = '0.5';
            
            setTimeout(() => {
                contadorNumero.textContent = numero;
                
                // Color y efectos especiales para ¡YA!
                if (numero === '¡YA!') {
                    contadorNumero.style.color = '#FFD700';
                    contadorNumero.style.textShadow = '0 0 30px rgba(255, 215, 0, 1)';
                    contadorNumero.style.fontSize = '6em';
                } else {
                    contadorNumero.style.color = '#00FF3C';
                    contadorNumero.style.textShadow = '0 0 20px rgba(0, 255, 60, 0.8)';
                    contadorNumero.style.fontSize = '8em';
                }
                
                // Animación de entrada
                contadorNumero.style.transform = 'scale(1.2)';
                contadorNumero.style.opacity = '1';
                
                // Volver al tamaño normal
                setTimeout(() => {
                    contadorNumero.style.transform = 'scale(1)';
                }, 200);
                
            }, 150);
        }
    }

    // Función para ocultar el contador
    function ocultarContador() {
        const contadorOverlay = document.getElementById('contador-overlay');
        if (contadorOverlay) {
            contadorOverlay.style.opacity = '0';
            contadorOverlay.style.transform = 'scale(0.9)';
            contadorOverlay.style.transition = 'all 0.5s ease';
            
            setTimeout(() => {
                contadorOverlay.style.display = 'none';
                contadorOverlay.remove();
            }, 500);
        }
    }

    // Función específica para registrar salidas
    async function registrarSalida(qrData, participanteDataPrevio = null) {
        console.log('Registrando salida con QR:', qrData, 'Datos previos:', participanteDataPrevio);
        try {
            let participanteData = participanteDataPrevio;
            
            console.log('Datos del participante previos:', participanteData);
            // Si no tenemos datos previos, obtenerlos
            if (!participanteData) {
                try {
                    participanteData = JSON.parse(qrData);
                    console.log('QR parseado como JSON:', participanteData);
                } catch {
                    console.log('QR no es JSON, buscando por ID:', qrData);
                    const response = await fetch(`/participante/${qrData}`);
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.error || 'Participante no encontrado');
                    }
                    participanteData = data;
                }
            }

            // Validar que tenemos los datos necesarios
            if (!participanteData.nombre) {
                throw new Error('Datos del participante incompletos');
            }

            // Registrar la salida en el servidor con timestamp exacto
            const timestampSalida = new Date().toISOString();
            console.log('Registrando salida para:', participanteData, 'Timestamp:', timestampSalida);
            
            const body = {
                participanteId: participanteData.id || Date.now().toString(),
                nombre: participanteData.nombre,
                categoria: participanteData.categoria || 'No especificada',
                horaSalida: timestampSalida
            }
            console.log('Cuerpo de la solicitud:', body);
            const salidaResponse = await fetch('/registrar-salida', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            const salidaData = await salidaResponse.json();
            
            if (!salidaResponse.ok) {
                throw new Error(salidaData.error || 'Error al registrar salida');
            }

            console.log('Salida registrada exitosamente:', salidaData);

            return {
                ...participanteData,
                horaSalida: salidaData.horaSalida || new Date(timestampSalida).toLocaleString('es-ES', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }),
                salidaId: salidaData.id
            };

        } catch (error) {
            console.error('Error en registrarSalida:', error);
            throw error;
        }
    }

    // Función para mostrar resultado de salida
    function mostrarResultadoSalida(participante) {
        try {
            console.log('Mostrando resultado para:', participante);

            // Actualizar datos del participante
            document.getElementById('nombreParticipante').textContent = participante.nombre || 'No disponible';
            document.getElementById('categoriaParticipante').textContent = participante.categoria || 'No registrada';
            document.getElementById('horaSalida').textContent = participante.horaSalida || new Date().toLocaleString('es-ES');
            
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
            console.error('Error al mostrar resultado de salida:', error);
            updateStatus('❌ Error al mostrar datos', 'error');
        }
    }

    // Función para detener el escáner
    function stopScanner() {
        codeReader.reset();
        
        // Restaurar botón original
        startBtn.querySelector('.btn-text').textContent = 'Registrar Salida';
        startBtn.querySelector('.btn-icon').textContent = '🏃‍♂️';
        startBtn.disabled = false;
        
        updateStatus('🟢 Listo para registrar otra salida', 'ready');
        
        // Remover clase activa
        document.getElementById('scanner-container').classList.remove('scanner-active');
    }

    // Función para actualizar estado del escáner
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

    // Función para mostrar notificaciones
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

    // Función para obtener color de borde de notificación
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
        console.log('Reseteando escáner de salidas');
        
        // Ocultar contador si está activo
        ocultarContador();
        
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
        updateStatus('ℹ️ Presiona "Registrar Salida"', 'ready');
        
        // Asegurar que el escáner esté detenido
        codeReader.reset();
        startBtn.disabled = false;
        startBtn.querySelector('.btn-text').textContent = 'Registrar Salida';
        startBtn.querySelector('.btn-icon').textContent = '🏃‍♂️';
        
        // Remover clase activa
        document.getElementById('scanner-container').classList.remove('scanner-active');
        
        mostrarNotificacion('🔄 Listo para registrar otra salida', 'info');
    };

    // Función global para cancelar el contador
    window.cancelarContador = function() {
        console.log('Cancelando contador de salida');
        
        // Ocultar contador
        ocultarContador();
        
        // Resetear escáner
        resetScanner();
        
        // Notificación de cancelación
        mostrarNotificacion('🚫 Salida cancelada', 'warning');
    };

    // Función global para ver tiempos (placeholder)
    window.verTiempos = function() {
        // Aquí puedes agregar lógica para mostrar tiempos del participante
        mostrarNotificacion('🚧 Funcionalidad de tiempos en desarrollo', 'warning');
    };

    // Agregar animaciones CSS dinámicamente si no existen
    if (!document.querySelector('#salida-animations')) {
        const style = document.createElement('style');
        style.id = 'salida-animations';
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
            
            /* Estilos para botón de cancelar */
            #contador-overlay button:hover {
                background-color: #cc3333 !important;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(255, 68, 68, 0.3);
            }
        `;
        document.head.appendChild(style);
    }

    // Mensaje de bienvenida inicial
    updateStatus('ℹ️ Presiona "Registrar Salida"', 'ready');
    
    console.log('Registro de salidas inicializado correctamente');
});