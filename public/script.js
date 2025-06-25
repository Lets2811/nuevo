document.getElementById('registroForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Obtener valores de los campos
    const nombre = document.getElementById('nombre').value.trim();
    const categoria = document.getElementById('categoria').value;
    
    console.log('Datos del formulario:', { nombre, categoria }); // Depuración
    
    if (!nombre || !categoria) {
        alert('Por favor complete todos los campos');
        return;
    }
    
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Registrando...';
    
    // Mostrar datos que se enviarán
    console.log('Enviando datos: *****************', { nombre, categoria });
    
    fetch('/registrar', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `nombre=${encodeURIComponent(nombre)}&categoria=${encodeURIComponent(categoria)}`
    })
    .then(response => {
        console.log('Respuesta recibida, status: *****', response);
        return response.json();
    })
    .then(data => {
        console.log('Datos recibidos del servidor:', data);
        
        if (data.error) throw new Error(data.error);
        
        document.getElementById('nombreParticipante').textContent = data.nombre || 'No disponible';
        document.getElementById('categoriaParticipante').textContent = data.categoria || 'No especificada';
        
        console.log('Mostrando en UI:', {
            nombre: data.nombre,
            categoria: data.categoria
        });
        
        const qrContainer = document.getElementById('qrContainer');
        qrContainer.innerHTML = `<img src="${data.qrUrl}" alt="QR Code">`;
        
        const descargarQR = document.getElementById('descargarQR');
        descargarQR.href = data.qrUrl;
        
        document.getElementById('resultado').classList.remove('hidden');
    })
    .catch(error => {
        console.error('Error en el proceso:', error);
        alert('Error: ' + error.message);
    })
    .finally(() => {
        btn.disabled = false;
        btn.textContent = 'Registrar Participante';
    });
});
