document.addEventListener('DOMContentLoaded', async () => {
    const codeReader = new ZXing.BrowserQRCodeReader();
    const videoElement = document.getElementById('qr-video');
    const startBtn = document.getElementById('start-scanner');
    const statusDisplay = document.getElementById('scanner-status');
    const resultadoDiv = document.getElementById('resultado');
    const teamCounter = document.getElementById('team-counter');

    // Estado de la ronda (ahora con número dinámico de competidores)
    let rondaActual = {
        competidores: [],
        categoria: null,
        completa: false,
        maxCompetidores: 3 // Por defecto 3, pero será dinámico
    };

    // Limpiar resultados previos
    resultadoDiv.classList.add('hidden');
    
    // Obtener número de participantes seleccionado
    function obtenerNumeroParticipantes() {
        const seleccionado = document.querySelector('input[name="numParticipantes"]:checked');
        return seleccionado ? parseInt(seleccionado.value) : 3;
    }

    // Actualizar número máximo de competidores cuando cambie la selección
    document.querySelectorAll('input[name="numParticipantes"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const nuevoMax = parseInt(this.value);
            
            // Si hay competidores ya registrados, confirmar el cambio
            if (rondaActual.competidores.length > 0) {
                const confirmar = confirm(`¿Estás seguro de cambiar a ${nuevoMax} competidor(es)? Esto limpiará la ronda actual.`);
                if (confirmar) {
                    limpiarRonda();
                    rondaActual.maxCompetidores = nuevoMax;
                } else {
                    // Revertir selección
                    document.querySelector(`input[name="numParticipantes"][value="${rondaActual.maxCompetidores}"]`).checked = true;
                    return;
                }
            } else {
                rondaActual.maxCompetidores = nuevoMax;
            }
            
            actualizarVisualizacionRonda();
            updateStatus(`ℹ️ Configurado para ${nuevoMax} competidor(es). Presiona "Escanear Competidor"`, 'ready');
        });
    });

    // Inicializar con el valor seleccionado
    rondaActual.maxCompetidores = obtenerNumeroParticipantes();

    // Verificar que todos los elementos existen
    console.log('🔍 Verificando elementos del DOM...');
    console.log('📹 Video element:', videoElement ? '✅' : '❌');
    console.log('🔘 Start button:', startBtn ? '✅' : '❌');
    console.log('📊 Status display:', statusDisplay ? '✅' : '❌');
    console.log('📋 Result div:', resultadoDiv ? '✅' : '❌');
    console.log('🔢 Team counter:', teamCounter ? '✅' : '❌');
    
    const teamMembers = document.getElementById('team-members');
    const memberSlots = document.querySelectorAll('.member-slot');
    console.log('👥 Team members container:', teamMembers ? '✅' : '❌');
    console.log('🎯 Member slots found:', memberSlots.length);

    startBtn.addEventListener('click', async () => {
        // Verificar si la ronda ya está completa
        if (rondaActual.completa) {
            mostrarNotificacion('🏁 La ronda ya está completa. Usa "Limpiar Ronda" para empezar una nueva.', 'warning');
            return;
        }

        try {
            updateStatus('📷 Iniciando cámara...', 'info');
            
            // Agregar clase activa al contenedor
            document.getElementById('scanner-container').classList.add('scanner-active');
            
            await codeReader.decodeFromVideoDevice(null, videoElement, async (result, error) => {
                if (result) {
                    const qrData = result.text;
                    updateStatus('🎯 QR detectado! Procesando competidor...', 'success');
                    
                    try {
                        // Detener el escáner inmediatamente
                        codeReader.reset();
                        
                        // Agregar competidor a la ronda
                        await agregarCompetidorALaRonda(qrData);
                        
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
            
            updateStatus('📱 Enfoca el código QR del competidor', 'scanning');
            
        } catch (error) {
            updateStatus('❌ Error: ' + error.message, 'error');
            mostrarNotificacion('❌ Error al acceder a la cámara: ' + error.message, 'error');
            resetScanner();
        }
    });

    // Función para agregar un competidor a la ronda
    async function agregarCompetidorALaRonda(qrData) {
        try {
            console.log('🔍 Procesando QR:', qrData);
            
            // Obtener datos del participante
            let participanteData;
            try {
                console.log('📄 Intentando parsear QR como JSON...');
                participanteData = JSON.parse(qrData);
                console.log('✅ QR parseado como JSON:', participanteData);
            } catch (parseError) {
                console.log('❌ QR no es JSON, buscando en servidor:', qrData);
                try {
                    const response = await fetch(`/participante/${qrData}`);
                    const data = await response.json();
                    console.log('📡 Respuesta del servidor:', data);
                    
                    if (!response.ok) {
                        throw new Error(data.error || 'Participante no encontrado');
                    }
                    participanteData = data;
                    console.log('✅ Datos obtenidos del servidor:', participanteData);
                } catch (fetchError) {
                    console.error('💥 Error al buscar en servidor:', fetchError);
                    throw new Error('No se pudo obtener información del participante');
                }
            }

            // Validar datos
            console.log('🔍 Validando datos del participante:', participanteData);
            
            if (!participanteData) {
                throw new Error('No se obtuvieron datos del participante');
            }
            
            if (!participanteData.nombre) {
                console.log('❌ Nombre faltante. Datos completos:', participanteData);
                throw new Error('Datos del participante incompletos: falta nombre');
            }
            
            // Asegurar que tenga ID
            if (!participanteData.id) {
                participanteData.id = participanteData.participanteId || Date.now().toString();
                console.log('ℹ️ ID generado/asignado:', participanteData.id);
            }
            
            // Asegurar que tenga categoría
            if (!participanteData.categoria) {
                participanteData.categoria = 'Sin categoría';
                console.log('ℹ️ Categoría asignada por defecto:', participanteData.categoria);
            }

            console.log('✅ Datos validados:', participanteData);

            // Verificar si ya está en la ronda
            console.log('🔍 Verificando duplicados. Competidores actuales:', rondaActual.competidores);
            const yaEnRonda = rondaActual.competidores.find(c => 
                c.id === participanteData.id || c.nombre === participanteData.nombre
            );
            
            if (yaEnRonda) {
                console.log('❌ Participante duplicado encontrado:', yaEnRonda);
                throw new Error(`${participanteData.nombre} ya está en la ronda`);
            }

            // Verificar si la ronda ya está completa (usando maxCompetidores dinámico)
            console.log('🔍 Verificando capacidad. Competidores actuales:', rondaActual.competidores.length, 'Máximo:', rondaActual.maxCompetidores);
            if (rondaActual.competidores.length >= rondaActual.maxCompetidores) {
                throw new Error(`La ronda ya está completa (${rondaActual.maxCompetidores}/${rondaActual.maxCompetidores} competidores)`);
            }

            // Establecer categoría de la ronda (todos deben ser de la misma)
            console.log('🔍 Verificando categoría. Ronda actual:', rondaActual.categoria, 'Participante:', participanteData.categoria);
            if (rondaActual.competidores.length === 0) {
                rondaActual.categoria = participanteData.categoria;
                console.log('✅ Categoría de ronda establecida:', rondaActual.categoria);
            } else if (participanteData.categoria !== rondaActual.categoria) {
                console.log('❌ Categoría no coincide');
                throw new Error(`Categoría ${participanteData.categoria} no coincide con la de la ronda (${rondaActual.categoria})`);
            }

            // Agregar a la ronda
            const nuevoCompetidor = {
                id: participanteData.id,
                nombre: participanteData.nombre,
                categoria: participanteData.categoria,
                qrData: qrData
            };
            
            console.log('➕ Agregando competidor:', nuevoCompetidor);
            rondaActual.competidores.push(nuevoCompetidor);
            console.log('✅ Competidor agregado. Ronda actual:', rondaActual);

            // Actualizar interfaz
            console.log('🔄 Actualizando visualización...');
            actualizarVisualizacionRonda();
            console.log('✅ Visualización actualizada');
            
            // Vibración si está disponible
            if (navigator.vibrate) {
                navigator.vibrate(200);
            }

            mostrarNotificacion(`✅ ${participanteData.nombre} agregado a la ronda (${rondaActual.competidores.length}/${rondaActual.maxCompetidores})`, 'success');

            // Si la ronda está completa, iniciar contador
            if (rondaActual.competidores.length === rondaActual.maxCompetidores) {
                rondaActual.completa = true;
                updateStatus('🏁 ¡Ronda completa! Preparando salida...', 'success');
                
                // Esperar un momento antes de iniciar el contador
                setTimeout(async () => {
                    await iniciarContadorSalida();
                }, 1500);
            } else {
                // Permitir escanear el siguiente competidor
                resetScannerOnly();
                updateStatus(`🏁 Competidor ${rondaActual.competidores.length}/${rondaActual.maxCompetidores} agregado. Escanea el siguiente.`, 'ready');
            }

        } catch (error) {
            console.error('Error al agregar competidor:', error);
            resetScannerOnly();
            throw error;
        }
    }

    // Función para resetear solo el escáner (no la ronda)
    function resetScannerOnly() {
        console.log('🔄 Reseteando solo el escáner...');
        codeReader.reset();
        startBtn.disabled = false;
        startBtn.querySelector('.btn-text').textContent = 'Escanear Competidor';
        startBtn.querySelector('.btn-icon').textContent = '📱';
        
        // Remover clase activa
        document.getElementById('scanner-container').classList.remove('scanner-active');
        console.log('✅ Escáner reseteado');
    }

    // Función para actualizar la visualización de la ronda
    function actualizarVisualizacionRonda() {
        console.log('🎨 Iniciando actualización de visualización...');
        
        const memberSlots = document.querySelectorAll('.member-slot');
        const totalCompetidores = rondaActual.competidores.length;
        const maxCompetidores = rondaActual.maxCompetidores;

        console.log('📊 Slots encontrados:', memberSlots.length);
        console.log('📊 Total competidores:', totalCompetidores);
        console.log('📊 Máximo competidores:', maxCompetidores);
        console.log('📊 Competidores:', rondaActual.competidores);

        // Actualizar contador
        if (teamCounter) {
            teamCounter.textContent = `${totalCompetidores}/${maxCompetidores}`;
            console.log('✅ Contador actualizado:', teamCounter.textContent);
        } else {
            console.log('❌ No se encontró elemento team-counter');
        }

        // Actualizar slots
        memberSlots.forEach((slot, index) => {
            const competidorNumber = index + 1;
            const competidor = rondaActual.competidores[index];
            
            console.log(`🎯 Actualizando slot ${competidorNumber}:`, competidor);
            
            // Mostrar/ocultar slot según el número máximo de competidores
            if (competidorNumber <= maxCompetidores) {
                slot.classList.remove('hidden');
                
                if (competidor) {
                    // Slot ocupado
                    console.log(`✅ Llenando slot ${competidorNumber} con:`, competidor.nombre);
                    slot.classList.remove('empty');
                    slot.classList.add('filled');
                    
                    const icon = slot.querySelector('.member-icon');
                    const label = slot.querySelector('.member-label');
                    const status = slot.querySelector('.member-status');
                    
                    if (icon && label && status) {
                        icon.textContent = '✅';
                        label.textContent = competidor.nombre;
                        status.textContent = competidor.categoria;
                        console.log(`✅ Slot ${competidorNumber} actualizado correctamente`);
                    } else {
                        console.log(`❌ No se encontraron elementos en slot ${competidorNumber}:`, {icon, label, status});
                    }
                } else {
                    // Slot vacío
                    console.log(`⭕ Dejando slot ${competidorNumber} vacío`);
                    slot.classList.remove('filled');
                    slot.classList.add('empty');
                    
                    const icon = slot.querySelector('.member-icon');
                    const label = slot.querySelector('.member-label');
                    const status = slot.querySelector('.member-status');
                    
                    if (icon && label && status) {
                        icon.textContent = '👤';
                        label.textContent = `Competidor ${competidorNumber}`;
                        status.textContent = 'Pendiente';
                    } else {
                        console.log(`❌ No se encontraron elementos en slot vacío ${competidorNumber}`);
                    }
                }
            } else {
                // Ocultar slot si excede el número máximo
                slot.classList.add('hidden');
                console.log(`🚫 Ocultando slot ${competidorNumber} (excede máximo: ${maxCompetidores})`);
            }
        });

        // Mostrar/ocultar botón de limpiar
        const clearButton = document.getElementById('clear-team');
        if (clearButton) {
            if (totalCompetidores > 0) {
                clearButton.style.display = 'block';
                console.log('✅ Botón limpiar mostrado');
            } else {
                clearButton.style.display = 'none';
                console.log('ℹ️ Botón limpiar ocultado');
            }
        } else {
            console.log('❌ No se encontró botón clear-team');
        }
        
        console.log('🎨 Actualización de visualización completada');
    }

    // Función para iniciar el contador de salida
    async function iniciarContadorSalida() {
        try {
            // Mostrar información de la ronda y preparar contador
            mostrarContadorSalida();
            
            // Vibración inicial si está disponible
            if (navigator.vibrate) {
                navigator.vibrate(200);
            }

            // Contador de 5, 4, 3, 2, 1
            for (let i = 10; i >= 1; i--) {
                actualizarContador(i);
                
                // Sonido/vibración en cada número
                if (navigator.vibrate) {
                    navigator.vibrate(100);
                }
                
                // Esperar 1 segundo
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // ¡YA! - Momento exacto de la salida
            actualizarContador('¡YA!');
            
            // Vibración larga para la salida
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }

            // Registrar las salidas de todos los competidores en este momento exacto
            const rondaRegistrada = await registrarSalidasDeLaRonda();
            
            // Esperar un momento antes de mostrar el resultado
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Ocultar contador y mostrar resultado
            ocultarContador();
            mostrarResultadoSalida(rondaRegistrada);
            stopScanner();
            
            mostrarNotificacion('🏃‍♂️ ¡Salidas de la ronda registradas exitosamente!', 'success');

        } catch (error) {
            console.error('Error en contador de salida:', error);
            ocultarContador();
            throw error;
        }
    }

    // Función para mostrar el contador visual
    function mostrarContadorSalida() {
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

        // Mostrar información de todos los competidores
        const competidoresHTML = rondaActual.competidores.map(c => 
            `<p style="margin: 5px 0; color: #00FF3C;">🏃‍♂️ ${c.nombre}</p>`
        ).join('');

        const tipoCompetencia = rondaActual.maxCompetidores === 1 ? 'Individual' : 
                               rondaActual.maxCompetidores === 2 ? 'Parejas' : 'Equipos';

        contadorOverlay.innerHTML = `
            <div style="text-align: center; max-width: 90%; margin-bottom: 40px;">
                <h2 style="color: #00FF3C; margin: 0 0 20px 0; font-size: 1.5em;">
                    🏁 Preparando Salida ${tipoCompetencia}
                </h2>
                <div style="background-color: #1C1C1C; padding: 20px; border-radius: 15px; border: 2px solid #00FF3C;">
                    <p style="margin: 10px 0; font-size: 1.1em; color: #FFD700;">
                        <strong>🏆 ${rondaActual.categoria || 'No especificada'}</strong>
                    </p>
                    <p style="margin: 10px 0; color: #2196F3;">
                        <strong>${rondaActual.maxCompetidores} Competidor(es)</strong>
                    </p>
                    <div style="margin: 15px 0;">
                        ${competidoresHTML}
                    </div>
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
                5
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
    function actualizarContador(numero) {
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

    // Función para registrar las salidas de toda la ronda
    async function registrarSalidasDeLaRonda() {
        console.log('Registrando salidas de la ronda:', rondaActual);
        try {
            // Crear timestamp único para toda la ronda
            const timestampSalida = new Date().toISOString();
            
            console.log('Timestamp de salida para toda la ronda:', timestampSalida);
            
            const salidasRegistradas = [];
            
            // Registrar cada competidor usando el endpoint existente
            for (let i = 0; i < rondaActual.competidores.length; i++) {
                const competidor = rondaActual.competidores[i];
                
                console.log(`Registrando competidor ${i + 1}:`, competidor);
                
                const body = {
                    participanteId: competidor.id,
                    nombre: competidor.nombre,
                    categoria: competidor.categoria,
                    horaSalida: timestampSalida // MISMO TIMESTAMP para todos
                };
                
                const response = await fetch('/registrar-salida', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body)
                });

                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || `Error al registrar salida de ${competidor.nombre}`);
                }
                
                salidasRegistradas.push({
                    ...competidor,
                    numeroSalida: data.numeroSalida,
                    horaSalida: data.horaSalida,
                    salidaId: data.id
                });
                
                console.log(`✅ Salida registrada para ${competidor.nombre}:`, data);
            }

            console.log('✅ Todas las salidas de la ronda registradas exitosamente');

            return {
                competidores: salidasRegistradas,
                categoria: rondaActual.categoria,
                horaSalida: salidasRegistradas[0].horaSalida, // Todos tienen la misma hora
                numeroRonda: salidasRegistradas[0].numeroSalida, // Todos tienen números consecutivos
                tipoCompetencia: rondaActual.maxCompetidores === 1 ? 'Individual' : 
                                rondaActual.maxCompetidores === 2 ? 'Parejas' : 'Equipos'
            };

        } catch (error) {
            console.error('Error en registrarSalidasDeLaRonda:', error);
            throw error;
        }
    }

    // Función para mostrar resultado de la ronda
    function mostrarResultadoSalida(rondaRegistrada) {
        try {
            console.log('Mostrando resultado para ronda:', rondaRegistrada);

            // Crear lista de competidores
            const competidoresHTML = rondaRegistrada.competidores.map(c => 
                `<div class="member-item">🏃‍♂️ ${c.nombre} (#${c.numeroSalida})</div>`
            ).join('');

            // Actualizar datos de la ronda
            document.getElementById('equipoNombre').textContent = 
                `${rondaRegistrada.tipoCompetencia} #${rondaRegistrada.numeroRonda || 'N/A'}`;
            document.getElementById('categoriaParticipante').textContent = 
                rondaRegistrada.categoria || 'No registrada';
            document.getElementById('horaSalida').textContent = 
                rondaRegistrada.horaSalida || new Date().toLocaleString('es-ES');
            document.getElementById('miembrosLista').innerHTML = competidoresHTML;
            
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
            console.error('Error al mostrar resultado de la ronda:', error);
            updateStatus('❌ Error al mostrar datos', 'error');
        }
    }

    // Función para detener el escáner
    function stopScanner() {
        codeReader.reset();
        
        // Restaurar botón original
        startBtn.querySelector('.btn-text').textContent = 'Escanear Competidor';
        startBtn.querySelector('.btn-icon').textContent = '📱';
        startBtn.disabled = false;
        
        updateStatus('🟢 Listo para registrar otra ronda', 'ready');
        
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
            case 'success': return '#00FF3C';  
            case 'error': return '#ff4444';    
            case 'warning': return '#FFD700';  
            default: return '#2196F3';         
        }
    }

    // Función global para limpiar ronda
    window.limpiarRonda = function() {
        console.log('Limpiando ronda actual');
        
        // Resetear estado de la ronda
        rondaActual = {
            competidores: [],
            categoria: null,
            completa: false,
            maxCompetidores: obtenerNumeroParticipantes()
        };
        
        // Actualizar visualización
        actualizarVisualizacionRonda();
        
        // Resetear escáner si no está activo
        if (!startBtn.disabled) {
            resetScanner();
        }
        
        // Notificación
        mostrarNotificacion('🗑️ Ronda limpiada, lista para nuevos competidores', 'info');
        
        updateStatus(`ℹ️ Configurado para ${rondaActual.maxCompetidores} competidor(es). Presiona "Escanear Competidor"`, 'ready');
    };

    // Función global para resetear escáner
    window.resetScanner = function() {
        console.log('Reseteando escáner de rondas');
        
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
        
        // Resetear estado de la ronda
        rondaActual = {
            competidores: [],
            categoria: null,
            completa: false,
            maxCompetidores: obtenerNumeroParticipantes()
        };
        
        // Actualizar visualización de la ronda
        actualizarVisualizacionRonda();
        
        // Resetear estado del escáner
        updateStatus(`ℹ️ Configurado para ${rondaActual.maxCompetidores} competidor(es). Presiona "Escanear Competidor"`, 'ready');
        
        // Asegurar que el escáner esté detenido
        codeReader.reset();
        startBtn.disabled = false;
        startBtn.querySelector('.btn-text').textContent = 'Escanear Competidor';
        startBtn.querySelector('.btn-icon').textContent = '📱';
        
        // Remover clase activa
        document.getElementById('scanner-container').classList.remove('scanner-active');
        
        mostrarNotificacion('🔄 Listo para registrar nueva ronda', 'info');
    };

    // Función global para cancelar el contador
    window.cancelarContador = function() {
        console.log('Cancelando contador de salida de la ronda');
        
        // Ocultar contador
        ocultarContador();
        
        // Marcar ronda como no completa para permitir modificaciones
        rondaActual.completa = false;
        
        // Solo resetear el escáner, no la ronda
        codeReader.reset();
        startBtn.disabled = false;
        startBtn.querySelector('.btn-text').textContent = 'Escanear Competidor';
        startBtn.querySelector('.btn-icon').textContent = '📱';
        
        // Remover clase activa
        document.getElementById('scanner-container').classList.remove('scanner-active');
        
        // Notificación de cancelación
        mostrarNotificacion('🚫 Salida de la ronda cancelada', 'warning');
        
        updateStatus('🏁 Ronda lista, presiona "Escanear Competidor" si necesitas agregar/cambiar competidores', 'ready');
    };

    // Función global para ver tiempos
    window.verTiempos = function() {
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
            
            #contador-overlay button:hover {
                background-color: #cc3333 !important;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(255, 68, 68, 0.3);
            }
        `;
        document.head.appendChild(style);
    }

    // Inicialización
    actualizarVisualizacionRonda();
    updateStatus(`ℹ️ Configurado para ${rondaActual.maxCompetidores} competidor(es). Presiona "Escanear Competidor"`, 'ready');
    
    console.log('🚀 Registro de salidas por ronda inicializado correctamente');
    
    // Test simple para verificar que las funciones básicas funcionan
    console.log('🧪 Ejecutando test básico...');
    try {
        // Test de actualización de visualización
        const testCompetidor = {
            id: 'test123',
            nombre: 'Test Participante',
            categoria: 'Test Categoría',
            qrData: 'test-qr'
        };
        
        console.log('🧪 Test: Agregando competidor de prueba temporalmente...');
        rondaActual.competidores.push(testCompetidor);
        actualizarVisualizacionRonda();
        
        // Limpiar test
        rondaActual.competidores = [];
        rondaActual.categoria = null;
        rondaActual.completa = false;
        actualizarVisualizacionRonda();
        
        console.log('✅ Test básico completado exitosamente');
    } catch (testError) {
        console.error('❌ Error en test básico:', testError);
    }
});