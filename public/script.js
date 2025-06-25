// Colores para notificaciones usando tu paleta específica
function getNotificationColor(tipo) {
    switch (tipo) {
        case 'success': return '#1C1C1C'; // Fondo tarjetas con borde verde
        case 'error': return '#1C1C1C';   // Fondo tarjetas con borde rojo
        case 'warning': return '#1C1C1C'; // Fondo tarjetas con borde dorado
        default: return '#1C1C1C';        // Fondo tarjetas con borde azul
    }
}

function getNotificationBorderColor(tipo) {
    switch (tipo) {
        case 'success': return '#00FF3C';  // Verde neón
        case 'error': return '#ff4444';    // Rojo para errores
        case 'warning': return '#FFD700';  // Dorado especial
        default: return '#2196F3';         // Azul secundario
    }
}

function getNotificationTextColor(tipo) {
    return '#FFFFFF'; // Texto principal siempre blanco
}

// Función para mostrar notificaciones con tu paleta
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
    
    // Auto remover después de 4 segundos
    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 4000);
}

// Actualizar la función mostrarResultado para usar tu paleta
function mostrarResultado(data) {
    const resultadoDiv = document.getElementById('resultado');
    
    // Actualizar datos del participante
    document.getElementById('nombreParticipante').textContent = data.nombre || 'No disponible';
    document.getElementById('categoriaParticipante').textContent = data.categoria || 'No especificada';
    
    console.log('Mostrando en UI:', {
        nombre: data.nombre,
        categoria: data.categoria
    });
    
    // Actualizar QR con animación y colores correctos
    const qrContainer = document.getElementById('qrContainer');
    qrContainer.innerHTML = `
        <div style="opacity: 0; transition: opacity 0.5s ease;">
            <h3 style="color: #00FF3C; margin-bottom: 15px;">📱 Tu Código QR</h3>
            <img src="${data.qrUrl}" alt="QR Code" style="animation: slideInUp 0.6s ease;">
            <p style="color: #888888; font-size: 14px; margin-top: 10px;">
                💡 Guarda este código para el día del evento
            </p>
        </div>
    `;
    
    // Animar aparición del QR
    setTimeout(() => {
        qrContainer.firstElementChild.style.opacity = '1';
    }, 100);
    
    // Actualizar enlace de descarga
    const descargarQR = document.getElementById('descargarQR');
    descargarQR.href = data.qrUrl;
    descargarQR.download = `QR_${data.nombre.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    
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

// El resto del código se mantiene igual, solo las funciones de colores cambiaron
document.getElementById('registroForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Obtener valores de los campos
    const nombre = document.getElementById('nombre').value.trim();
    const categoria = document.getElementById('categoria').value;
    
    console.log('Datos del formulario:', { nombre, categoria });
    
    if (!nombre || !categoria) {
        mostrarNotificacion('❌ Por favor complete todos los campos', 'error');
        return;
    }
    
    // Elementos del botón para estados
    const btn = e.target.querySelector('button[type="submit"]');
    const btnText = btn.querySelector('.btn-text');
    const btnIcon = btn.querySelector('.btn-icon');
    const btnLoader = btn.querySelector('.btn-loader');
    
    // Estado de carga
    setButtonState(btn, btnText, btnIcon, btnLoader, true);
    
    console.log('Enviando datos:', { nombre, categoria });
    
    fetch('/registrar', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `nombre=${encodeURIComponent(nombre)}&categoria=${encodeURIComponent(categoria)}`
    })
    .then(response => {
        console.log('Respuesta recibida, status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Datos recibidos del servidor:', data);
        
        if (data.error) throw new Error(data.error);
        
        // Mostrar resultados con animación
        mostrarResultado(data);
        
        // Mostrar notificación de éxito
        mostrarNotificacion('🎉 ¡Participante registrado exitosamente!', 'success');
        
        // Scroll suave hacia el resultado
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
        // Restaurar estado del botón
        setButtonState(btn, btnText, btnIcon, btnLoader, false);
    });
});

// Función para manejar estados del botón
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

// Función para resetear formulario
function resetForm() {
    const form = document.getElementById('registroForm');
    const resultado = document.getElementById('resultado');
    
    // Animar salida del resultado
    resultado.style.transition = 'all 0.3s ease';
    resultado.style.opacity = '0';
    resultado.style.transform = 'translateY(-20px)';
    
    setTimeout(() => {
        resultado.classList.add('hidden');
        resultado.style.transition = '';
        resultado.style.opacity = '';
        resultado.style.transform = '';
    }, 300);
    
    // Resetear formulario
    form.reset();
    
    // Focus en nombre
    setTimeout(() => {
        document.getElementById('nombre').focus();
    }, 400);
    
    mostrarNotificacion('🔄 Formulario limpiado', 'info');
}

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

// Auto-focus en el campo nombre al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('nombre').focus();
    
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

// Función global para resetear (para uso en HTML)
window.resetForm = resetForm;