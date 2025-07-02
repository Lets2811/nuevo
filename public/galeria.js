document.addEventListener('DOMContentLoaded', function() {
    let todosLosQR = [];
    let qrFiltrados = [];
    let seleccionados = new Set();

    const galeriaGrid = document.getElementById('galeria-grid');
    const loadingDiv = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    const noResults = document.getElementById('no-results');
    const totalCount = document.getElementById('total-count');
    const selectedCount = document.getElementById('selected-count');
    const searchInput = document.getElementById('search-input');
    const categoriaFilter = document.getElementById('categoria-filter');
    const selectAllBtn = document.getElementById('select-all-btn');
    const downloadSelectedBtn = document.getElementById('download-selected-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const previewModal = document.getElementById('preview-modal');

    cargarGaleria();

    refreshBtn.addEventListener('click', cargarGaleria);
    searchInput.addEventListener('input', filtrarQR);
    categoriaFilter.addEventListener('change', filtrarQR);
    selectAllBtn.addEventListener('click', toggleSelectAll);
    downloadSelectedBtn.addEventListener('click', descargarSeleccionados);

    document.querySelector('.close-modal').addEventListener('click', cerrarModal);
    previewModal.addEventListener('click', function(e) {
        if (e.target === previewModal) cerrarModal();
    });

    async function cargarGaleria() {
        mostrarLoading(true);
        esconderError();
        esconderNoResults();

        try {
            const response = await fetch('/api/qr-codes');
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Error al cargar códigos QR');

            todosLosQR = data.qrCodes || [];
            qrFiltrados = [...todosLosQR];
            seleccionados.clear();

            mostrarLoading(false);
            actualizarContadores();
            renderizarGaleria();

            if (todosLosQR.length === 0) mostrarNoResults();

        } catch (error) {
            console.error('Error al cargar galería:', error);
            mostrarLoading(false);
            mostrarError(error.message);
        }
    }

    function renderizarGaleria() {
        if (qrFiltrados.length === 0) {
            galeriaGrid.innerHTML = '';
            mostrarNoResults();
            return;
        }

        esconderNoResults();
        galeriaGrid.innerHTML = qrFiltrados.map(qr => crearTarjetaQR(qr)).join('');
        agregarEventListeners();
    }

    function crearTarjetaQR(qr) {
        const fechaFormateada = formatearFecha(qr.fechaRegistro);
        const isSelected = seleccionados.has(qr.id);

        return `
            <div class="qr-card ${isSelected ? 'selected' : ''}" data-id="${qr.id}">
                <div class="card-header">
                    <input type="checkbox" class="select-checkbox" ${isSelected ? 'checked' : ''}>
                    <button class="card-menu">⋮</button>
                </div>
                <div class="qr-image-container">
                    <img src="${qr.qrUrl}" alt="QR de ${qr.nombre}" class="qr-image" onclick="abrirPreview('${qr.id}')">
                </div>
                <div class="participant-info">
                    <h3>${escapeHtml(qr.nombre)}</h3>
                    <p><span class="categoria">${escapeHtml(qr.categoria)}</span></p>
                    <p class="fecha">📅 ${fechaFormateada}</p>
                </div>
                <div class="card-actions">
                    <button class="download-btn" onclick="descargarQRPorId('${qr.id}')">
                        ⬇ Descargar
                    </button>
                    <button class="preview-btn" onclick="abrirPreview('${qr.id}')">
                        👁 Vista Previa
                    </button>
                </div>
            </div>
        `;
    }

    function agregarEventListeners() {
        document.querySelectorAll('.select-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const tarjeta = this.closest('.qr-card');
                const id = tarjeta.dataset.id;
                if (this.checked) {
                    seleccionados.add(id);
                    tarjeta.classList.add('selected');
                } else {
                    seleccionados.delete(id);
                    tarjeta.classList.remove('selected');
                }
                actualizarContadores();
            });
        });
    }

    function filtrarQR() {
        const textoBusqueda = searchInput.value.toLowerCase().trim();
        const categoriaSeleccionada = categoriaFilter.value;

        qrFiltrados = todosLosQR.filter(qr => {
            const coincideTexto = !textoBusqueda || 
                qr.nombre.toLowerCase().includes(textoBusqueda) ||
                qr.categoria.toLowerCase().includes(textoBusqueda);

            const coincideCategoria = !categoriaSeleccionada || qr.categoria === categoriaSeleccionada;

            return coincideTexto && coincideCategoria;
        });

        renderizarGaleria();
        actualizarContadores();
    }

    function toggleSelectAll() {
        const todosSeleccionados = qrFiltrados.every(qr => seleccionados.has(qr.id));

        if (todosSeleccionados) {
            qrFiltrados.forEach(qr => seleccionados.delete(qr.id));
            selectAllBtn.textContent = 'Seleccionar Todo';
        } else {
            qrFiltrados.forEach(qr => seleccionados.add(qr.id));
            selectAllBtn.textContent = 'Deseleccionar Todo';
        }

        renderizarGaleria();
        actualizarContadores();
    }

    async function descargarSeleccionadosOld() {
        if (seleccionados.size === 0) return;

        downloadSelectedBtn.disabled = true;
        downloadSelectedBtn.textContent = 'Descargando...';

        try {
            for (const id of seleccionados) {
                await descargarQRPorId(id);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            seleccionados.clear();
            renderizarGaleria();
            actualizarContadores();
        } catch (error) {
            console.error('Error al descargar archivos:', error);
            alert('Error al descargar algunos archivos');
        } finally {
            downloadSelectedBtn.disabled = false;
            downloadSelectedBtn.textContent = 'Descargar Seleccionados';
        }
    }

    async function descargarSeleccionados() {
        if (seleccionados.size === 0) return;
    
        const overlay = document.getElementById('download-overlay');
        overlay.classList.remove('hidden');
    
        try {
            const qrAEnviar = todosLosQR
                .filter(qr => seleccionados.has(qr.id))
                .map(qr => ({ nombre: qr.nombre, qrUrl: qr.qrUrl }));
    
            const response = await fetch('/api/descargar-zip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qrs: qrAEnviar }),
            });
    
            if (!response.ok) throw new Error('Error al generar ZIP');
    
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'qrs.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
    
            mostrarNotificacion(`✅ ZIP descargado con éxito, ${qrAEnviar.length} registros descargados`, 'success');
            seleccionados.clear();
            renderizarGaleria();
            actualizarContadores();
        } catch (error) {
            console.error('Error al descargar ZIP:', error);
            mostrarNotificacion('❌ Error al generar ZIP', 'error');
        } finally {
            overlay.classList.add('hidden');
        }
    }
    
    

    async function descargarQR(qrUrl, nombre, mostrarMensaje = true) {
        try {
            const response = await fetch(qrUrl);
            if (!response.ok) throw new Error('Error al descargar el archivo');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `QR_${nombre.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            if (mostrarMensaje) mostrarNotificacion(`✅ QR de ${nombre} descargado`, 'success');

        } catch (error) {
            console.error('Error al descargar:', error);
            if (mostrarMensaje) mostrarNotificacion(`❌ Error al descargar QR de ${nombre}`, 'error');
        }
    }

    async function descargarQRPorId(id) {
        const qr = todosLosQR.find(q => q.id === id);
        if (!qr) return mostrarNotificacion('❌ QR no encontrado', 'error');
        await descargarQR(qr.qrUrl, qr.nombre);
    }

    function abrirPreview(id) {
        const qr = todosLosQR.find(q => q.id === id);
        if (!qr) return;

        document.getElementById('preview-image').src = qr.qrUrl;
        document.getElementById('preview-name').textContent = qr.nombre;
        document.getElementById('preview-category').textContent = qr.categoria;
        document.getElementById('preview-date').textContent = formatearFecha(qr.fechaRegistro);

        document.getElementById('preview-download').onclick = () => {
            descargarQR(qr.qrUrl, qr.nombre);
            cerrarModal();
        };

        previewModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function cerrarModal() {
        previewModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    function actualizarContadores() {
        totalCount.textContent = `Total: ${qrFiltrados.length} códigos QR`;
        selectedCount.textContent = `${seleccionados.size} seleccionados`;
        downloadSelectedBtn.disabled = seleccionados.size === 0;
        const todosSeleccionados = qrFiltrados.length > 0 && qrFiltrados.every(qr => seleccionados.has(qr.id));
        selectAllBtn.textContent = todosSeleccionados ? 'Deseleccionar Todo' : 'Seleccionar Todo';
    }

    function mostrarLoading(mostrar) {
        loadingDiv.classList.toggle('hidden', !mostrar);
        galeriaGrid.classList.toggle('hidden', mostrar);
    }

    function mostrarError(mensaje = 'Error al cargar la galería') {
        errorMessage.classList.remove('hidden');
        errorMessage.querySelector('p').textContent = `❌ ${mensaje}`;
        galeriaGrid.classList.add('hidden');
    }

    function esconderError() {
        errorMessage.classList.add('hidden');
        galeriaGrid.classList.remove('hidden');
    }

    function mostrarNoResults() {
        noResults.classList.remove('hidden');
    }

    function esconderNoResults() {
        noResults.classList.add('hidden');
    }

    function formatearFecha(fecha) {
        const date = new Date(fecha);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    function escapeHtml(texto) {
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    function mostrarNotificacion(mensaje, tipo = 'info') {
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${tipo === 'success' ? '#0f5132' : '#721c24'};
            color: white;
            border-radius: 6px;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notif.textContent = mensaje;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }

    window.descargarQR = descargarQR;
    window.abrirPreview = abrirPreview;
    window.descargarQRPorId = descargarQRPorId;
});
