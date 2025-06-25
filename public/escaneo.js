document.addEventListener('DOMContentLoaded', async () => {
    const codeReader = new ZXing.BrowserQRCodeReader();
    const videoElement = document.getElementById('qr-video');
    const startBtn = document.getElementById('start-scanner');
    const stopBtn = document.getElementById('stop-scanner');
    const statusDisplay = document.getElementById('scanner-status');
    const resultadoDiv = document.getElementById('resultado');
    const salidaVideoElement = document.getElementById('salida-video');
const startSalidaBtn = document.getElementById('start-salida-scanner');
const stopSalidaBtn = document.getElementById('stop-salida-scanner');
const salidaStatusDisplay = document.getElementById('salida-status');
const salidaSection = document.getElementById('salida-section');
const salidaResult = document.getElementById('salida-result');
const salidaNombreElement = document.getElementById('salida-nombre');
const salidaHoraElement = document.getElementById('salida-hora');

    // Limpiar resultados previos
    resultadoDiv.classList.add('hidden');

    startBtn.addEventListener('click', async () => {
        try {
            statusDisplay.textContent = 'Iniciando cámara...';
            statusDisplay.style.color = 'blue';
            
            await codeReader.decodeFromVideoDevice(null, videoElement, async (result, error) => {
                if (result) {
                    const id = result.text;
                    statusDisplay.textContent = 'QR detectado! Buscando participante...';
                    statusDisplay.style.color = 'green';
                    
                    try {
                        const participante = await buscarParticipante(id);
                        mostrarResultado(participante);
                        codeReader.reset();
                        stopScanner();
                    } catch (err) {
                        statusDisplay.textContent = 'Error: ' + err.message;
                        statusDisplay.style.color = 'red';
                    }
                }
                if (error && !error.message.includes('No QR code found')) {
                    statusDisplay.textContent = 'Error: ' + error.message;
                    statusDisplay.style.color = 'red';
                }
            });

            startBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            statusDisplay.textContent = 'Enfoca el código QR del participante';
            statusDisplay.style.color = 'black';
            
        } catch (error) {
            statusDisplay.textContent = 'Error: ' + error.message;
            statusDisplay.style.color = 'red';
            alert('Error al acceder a la cámara: ' + error.message);
        }
    });

    stopBtn.addEventListener('click', () => {
        stopScanner();
    });

    function stopScanner() {
        codeReader.reset();
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        statusDisplay.textContent = 'Escáner listo';
        statusDisplay.style.color = 'gray';
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
                data.talla = qrInfo.talla;
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

    // Modifica la función mostrarResultado
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

        document.getElementById('nombreParticipante').textContent = participante.nombre || 'No disponible';
        document.getElementById('tallaParticipante').textContent = participante.talla || 'No registrada';
        document.getElementById('categoriaParticipante').textContent = participante.categoria || 'No registrada';
        
        const qrContainer = document.getElementById('qrContainer');
        qrContainer.innerHTML = '';
        
        if (participante.qrPath) {
            const img = document.createElement('img');
            img.src = participante.qrPath;
            img.alt = 'QR Code';
            qrContainer.appendChild(img);
        }
        
        resultadoDiv.classList.remove('hidden');
    } catch (error) {
        console.error('Error al mostrar resultado:', error);
        statusDisplay.textContent = 'Error al mostrar datos';
        statusDisplay.style.color = 'red';
    }
}

    document.getElementById('nombreParticipante').textContent = datosParticipante.nombre || 'No disponible';
    document.getElementById('tallaParticipante').textContent = datosParticipante.talla || 'No registrada';
    document.getElementById('categoriaParticipante').textContent = datosParticipante.categoria || 'No registrada';
    
    const qrContainer = document.getElementById('qrContainer');
    qrContainer.innerHTML = '';
    
    if (datosParticipante.qrPath) {
        const img = document.createElement('img');
        img.src = datosParticipante.qrPath;
        img.alt = 'QR Code';
        qrContainer.appendChild(img);
    }
    
    resultadoDiv.classList.remove('hidden');

    
});