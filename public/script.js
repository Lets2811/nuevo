/* ===========================
   Notificaciones (paleta)
   =========================== */
function getNotificationColor(tipo) {
  return '#1C1C1C';
}
function getNotificationBorderColor(tipo) {
  switch (tipo) {
    case 'success': return '#00FF3C';
    case 'error':   return '#ff4444';
    case 'warning': return '#FFD700';
    default:        return '#2196F3';
  }
}
function getNotificationTextColor() { return '#FFFFFF'; }

function mostrarNotificacion(mensaje, tipo = 'info') {
  document.querySelectorAll('.notification').forEach(n => n.remove());
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.style.cssText = `
    position: fixed; top: 20px; right: 20px; padding: 15px 20px;
    background-color: ${getNotificationColor(tipo)};
    color: ${getNotificationTextColor(tipo)};
    border-radius: 10px; z-index: 10000; max-width: 350px; word-wrap: break-word;
    box-shadow: 0 6px 20px rgba(0,0,0,0.5); font-weight: bold;
    animation: slideInRight 0.3s ease; border: 2px solid ${getNotificationBorderColor(tipo)};
    font-family: Arial, sans-serif;
  `;
  notif.textContent = mensaje;
  document.body.appendChild(notif);
  setTimeout(() => {
    notif.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notif.remove(), 300);
  }, 4000);
}

/* ===========================
   Estado global
   =========================== */
let datosExcel = [];
let datosValidados = [];

/* ===========================
   Modo (individual vs masivo)
   =========================== */
function cambiarModo(modo) {
  const modoIndividual = document.getElementById('modoIndividual');
  const modoMasivo     = document.getElementById('modoMasivo');
  const seccionInd     = document.getElementById('registroIndividual');
  const seccionMas     = document.getElementById('cargaMasiva');

  if (modo === 'individual') {
    modoIndividual.classList.add('active');
    modoMasivo.classList.remove('active');
    seccionInd.classList.remove('hidden');
    seccionMas.classList.add('hidden');
    resetForm();
  } else {
    modoIndividual.classList.remove('active');
    modoMasivo.classList.add('active');
    seccionInd.classList.add('hidden');
    seccionMas.classList.remove('hidden');
    resetMasivaCarga();
  }
}

/* ===========================
   Registro individual
   =========================== */
function mostrarResultado(data) {
  const resultadoDiv = document.getElementById('resultado');

  // Nombre robusto (usa 'nombre' si lo da el backend, si no concatena P1 & P2)
  const nombreUI = data.nombre || [data.nombrep1, data.nombrep2, data.nombreP1, data.nombreP2]
    .filter(Boolean).join(' & ');

  document.getElementById('numeroParticipante').textContent   = data.numero ?? 'No asignado';
  document.getElementById('nombreParticipante').textContent   = nombreUI || 'No disponible';
  document.getElementById('categoriaParticipante').textContent= data.categoria || 'No especificada';

  // QR
  const qrContainer = document.getElementById('qrContainer');
  const qrUrl = data.qrUrl || data.qr || '';
  qrContainer.innerHTML = `
    <div style="opacity:0; transition:opacity .5s ease;">
      <h3 style="color:#00FF3C; margin-bottom:15px;">📱 Tu Código QR</h3>
      <img src="${qrUrl}" alt="QR Code" style="animation: slideInUp .6s ease; max-width:200px;">
      <p style="color:#888; font-size:14px; margin-top:10px;">💡 Guarda este código para el día del evento</p>
    </div>
  `;
  setTimeout(() => { qrContainer.firstElementChild.style.opacity = '1'; }, 100);

  // Descargar
  const btnDescargar = document.getElementById('descargarQR');
  btnDescargar.onclick = () => descargarQR(qrUrl, nombreUI);

  // Animación tarjeta
  resultadoDiv.classList.remove('hidden');
  resultadoDiv.style.opacity = '0';
  resultadoDiv.style.transform = 'translateY(20px)';
  setTimeout(() => {
    resultadoDiv.style.transition = 'all .5s ease';
    resultadoDiv.style.opacity = '1';
    resultadoDiv.style.transform = 'translateY(0)';
  }, 50);
}

/* ===========================
   Excel: drag & drop + lectura
   =========================== */
function configurarZonaArrastre() {
  const uploadZone = document.getElementById('uploadZone');
  const fileInput  = document.getElementById('fileInput');
  if (!uploadZone || !fileInput) return;

  const preventDefaults = e => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => {
    uploadZone.addEventListener(ev, preventDefaults, false);
    document.body.addEventListener(ev, preventDefaults, false);
  });

  ['dragenter','dragover'].forEach(ev => {
    uploadZone.addEventListener(ev, () => uploadZone.classList.add('dragover'), false);
  });
  ['dragleave','drop'].forEach(ev => {
    uploadZone.addEventListener(ev, () => uploadZone.classList.remove('dragover'), false);
  });

  uploadZone.addEventListener('drop',   manejarArchivos, false);
  fileInput.addEventListener('change',  manejarArchivos, false);
  uploadZone.addEventListener('click',  () => fileInput.click());
}

function manejarArchivos(e) {
  const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
  if (!files || files.length === 0) return;
  const file = files[0];

  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    mostrarNotificacion('❌ Por favor selecciona un archivo Excel (.xlsx o .xls)', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    mostrarNotificacion('❌ El archivo es demasiado grande. Máximo 5MB', 'error');
    return;
  }

  mostrarNotificacion('📂 Procesando archivo Excel...', 'info');
  leerArchivoExcel(file);
}

function leerArchivoExcel(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      procesarDatosExcel(jsonData);
    } catch (error) {
      console.error('Error al procesar Excel:', error);
      mostrarNotificacion('❌ Error al procesar el archivo Excel', 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function procesarDatosExcel(rawData) {
  if (!rawData || rawData.length < 2) {
    mostrarNotificacion('❌ El archivo debe tener al menos una fila de datos', 'error');
    return;
  }

  const headers  = rawData[0].map(h => (h ?? '').toString().toLowerCase().trim());
  const dataRows = rawData.slice(1);

  // Sinónimos en minúsculas (porque headers ya están en minúsculas)
  const numeroCol    = encontrarColumna(headers, ['numero','número','num','#','pareja','dorsal','no']);
  const nombreP1Col  = encontrarColumna(headers, ['nombrep1','nombre p1','participante 1','p1','integrante1']);
  const nombreP2Col  = encontrarColumna(headers, ['nombrep2','nombre p2','participante 2','p2','integrante2']);
  const categoriaCol = encontrarColumna(headers, ['categoria','categoría','category','cat','categ']);

  console.log('Columnas encontradas:', { numeroCol, nombreP1Col, nombreP2Col, categoriaCol });

  if ([numeroCol, nombreP1Col, nombreP2Col, categoriaCol].some(idx => idx === -1)) {
    mostrarNotificacion('❌ El archivo debe tener columnas: Número, NombreP1, NombreP2, Categoría', 'error');
    return;
  }

  datosExcel = [];
  dataRows.forEach((row, index) => {
    if (!Array.isArray(row) || row.length === 0 || !row.some(cell => cell !== null && cell !== undefined && cell !== '')) return;

    const numero    = (row[numeroCol]    ?? '').toString().trim();
    const nombreP1  = (row[nombreP1Col]  ?? '').toString().trim();
    const nombreP2  = (row[nombreP2Col]  ?? '').toString().trim();
    const categoria = (row[categoriaCol] ?? '').toString().trim();

    console.log(`Fila ${index + 2}:`, { numero, nombreP1, nombreP2, categoria });
    datosExcel.push({
      fila: index + 2, // 1 es header
      numero, nombreP1, nombreP2, categoria,
      valido: false, errores: []
    });
  });

  validarDatos();
  mostrarVistaPrevia();
}

function encontrarColumna(headers, posibles) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i] || '';
    if (posibles.some(name => h.includes(name))) return i;
  }
  return -1;
}

/* ===========================
   Normalización de categoría
   =========================== */
function quitarAcentos(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function normalizarCategoria(valor) {
  if (!valor) return null;
  const txt = quitarAcentos(String(valor))
    .toLowerCase().trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

  let nivel = null;
  if (/\bpri(ncipiante)?\b/.test(txt)) nivel = 'Principiante';
  else if (/\binter(medio)?\b/.test(txt)) nivel = 'Intermedio';
  else if (/\bavan(zado)?\b/.test(txt)) nivel = 'Avanzado';

  let genero = null;
  if (/\bfem(enino|enina)?\b|\bmujer(es)?\b|\bf\b/.test(txt)) genero = 'Femenino';
  else if (/\bmasc(ulino|ulina)?\b|\bhombre(s)?\b|\bm\b/.test(txt)) genero = 'Masculino';

  return (nivel && genero) ? `${nivel} ${genero}` : null;
}

/* ===========================
   Validación dataset
   =========================== */
function validarDatos() {
  const categoriesValidas = [
    'Principiante Femenino','Intermedio Femenino','Avanzado Femenino',
    'Principiante Masculino','Intermedio Masculino','Avanzado Masculino'
  ];

  const numerosUsados = new Set();

  datosExcel.forEach(item => {
    item.errores = [];
    item.valido  = true;

    // Número
    const numeroParseado = parseInt(String(item.numero).trim(), 10);
    if (!item.numero || String(item.numero).trim() === '') {
      item.errores.push('Número requerido'); item.valido = false;
    } else if (isNaN(numeroParseado) || numeroParseado <= 0) {
      item.errores.push('Número inválido');  item.valido = false;
    } else if (numerosUsados.has(numeroParseado)) {
      item.errores.push('Número duplicado'); item.valido = false;
    } else {
      item.numero = numeroParseado; // normaliza "01" -> 1
      numerosUsados.add(numeroParseado);
    }

    // Nombres
    item.nombreP1 = (item.nombreP1 || '').trim();
    if (!item.nombreP1) { item.errores.push('Nombre participante 1 requerido'); item.valido = false; }
    else if (item.nombreP1.length < 2) { item.errores.push('Nombre muy corto'); item.valido = false; }

    item.nombreP2 = (item.nombreP2 || '').trim();
    if (!item.nombreP2) { item.errores.push('Nombre participante 2 requerido'); item.valido = false; }
    else if (item.nombreP2.length < 2) { item.errores.push('Nombre muy corto'); item.valido = false; }

    // Categoría
    const canon = normalizarCategoria(item.categoria);
    if (!canon) {
      item.errores.push('Categoría requerida o inválida'); item.valido = false;
    } else if (!categoriesValidas.includes(canon)) {
      item.errores.push('Categoría inválida'); item.valido = false;
    } else {
      item.categoria = canon;
    }
  });

  datosValidados = datosExcel.filter(it => it.valido);
}

/* ===========================
   Sugerencias para el modal
   =========================== */
function obtenerSugerencias(item) {
  const sugs = [];

  // Número
  const numeroBruto = (item.numero ?? '').toString().trim();
  const nParse = parseInt(numeroBruto, 10);
  const hayReq = item.errores.some(e => e.includes('Número requerido'));
  const hayInv = item.errores.some(e => e.includes('Número inválido'));
  const hayDup = item.errores.some(e => e.includes('Número duplicado'));

  if (hayReq) sugs.push('Ingresa un número entero positivo (1, 2, 3, ...).');
  if (hayInv) sugs.push('Usa un número > 0 sin letras. Se guardará como entero (ej. "01" → 1).');
  if (hayDup) {
    const usados = new Set();
    datosExcel.forEach(it => {
      const n = parseInt(String(it.numero ?? '').trim(), 10);
      if (!isNaN(n) && n > 0) usados.add(n);
    });
    const start = !isNaN(nParse) && nParse > 0 ? nParse + 1 : 1;
    const libres = [];
    for (let cand = start; libres.length < 3 && cand < start + 200; cand++) {
      if (!usados.has(cand)) libres.push(cand);
    }
    sugs.push(libres.length
      ? `Prueba con un número libre: ${libres.join(', ')}.`
      : 'Cambia a un número que no esté usado (no se encontraron libres cercanos).'
    );
  }

  // Nombres
  if (!item.nombreP1 || item.nombreP1.trim().length < 2) {
    sugs.push('Participante 1: escribe al menos 2 caracteres (ej. "Ana Gómez").');
  }
  if (!item.nombreP2 || item.nombreP2.trim().length < 2) {
    sugs.push('Participante 2: escribe al menos 2 caracteres (ej. "Luis Pérez").');
  }

  // Categoría
  if (item.errores.some(e => e.toLowerCase().includes('categoría'))) {
    sugs.push('Usa una categoría válida: "Principiante/Intermedio/Avanzado" + "Femenino/Masculino".');
    sugs.push('Ejemplos: "Principiante Masculino", "Intermedio Femenino".');
    const tentativa = normalizarCategoria(item.categoria);
    if (tentativa) sugs.push(`Detecté que podría ser: "${tentativa}".`);
  }

  if (sugs.length === 0) sugs.push('Revisa los campos marcados y vuelve a validar.');
  return sugs;
}

/* ===========================
   Modal de errores (UI)
   =========================== */
function ensureErrorModal() {
  if (document.getElementById('errorModalOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'errorModalOverlay';
  overlay.className = 'em-overlay hidden';
  overlay.innerHTML = `
    <div class="em-modal" role="dialog" aria-modal="true" aria-labelledby="emTitle">
      <div class="em-header">
        <h3 id="emTitle">Detalles de validación</h3>
        <button class="em-close" aria-label="Cerrar">✖</button>
      </div>
      <div class="em-meta" id="emMeta"></div>
      <div class="em-body">
        <div class="em-section">
          <h5>Errores detectados</h5>
          <ul class="em-errors" id="emErrors"></ul>
        </div>
        <div class="em-section">
          <h5>Sugerencias</h5>
          <ul class="em-suggestions" id="emSuggestions"></ul>
        </div>
      </div>
      <div class="em-footer">
        <button class="em-btn" id="emCloseBtn">Entendido</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => { overlay.classList.add('hidden'); document.body.style.overflow = ''; };
  overlay.querySelector('.em-close').addEventListener('click', close);
  overlay.querySelector('#emCloseBtn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target.id === 'errorModalOverlay') close(); });
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('hidden') && e.key === 'Escape') close();
  });
}

function abrirModalErrores(item) {
  ensureErrorModal();
  const overlay = document.getElementById('errorModalOverlay');
  const ulErr   = overlay.querySelector('#emErrors');
  const ulSug   = overlay.querySelector('#emSuggestions');
  const meta    = overlay.querySelector('#emMeta');

  ulErr.innerHTML = '';
  ulSug.innerHTML = '';

  const etiqueta = [item.nombreP1, item.nombreP2].filter(Boolean).join(' & ') || 'Sin nombre';
  meta.innerHTML = `
    <div class="em-meta-grid">
      <div><strong>Fila:</strong> ${item.fila ?? '—'}</div>
      <div><strong>Número:</strong> ${item.numero ?? '—'}</div>
      <div><strong>Categoría:</strong> ${item.categoria ?? '—'}</div>
      <div><strong>Participantes:</strong> ${etiqueta}</div>
    </div>
  `;

  if (item.errores && item.errores.length) {
    item.errores.forEach(err => { const li = document.createElement('li'); li.textContent = err; ulErr.appendChild(li); });
  } else {
    const li = document.createElement('li'); li.textContent = 'Sin errores en esta fila.'; ulErr.appendChild(li);
  }

  obtenerSugerencias(item).forEach(s => { const li = document.createElement('li'); li.textContent = s; ulSug.appendChild(li); });

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

/* ===========================
   Vista previa + clicks (delegación)
   =========================== */
let previewClickBound = false;

function mostrarVistaPrevia() {
  const previewSection = document.getElementById('previewSection');
  const totalRegistros = document.getElementById('totalRegistros');
  const errorCount     = document.getElementById('errorCount');
  const tableBody      = document.getElementById('previewTableBody');

  previewSection.classList.remove('hidden');

  const totalValidos = datosValidados.length;
  const totalErrores = datosExcel.length - totalValidos;

  totalRegistros.textContent = `${totalValidos} registros válidos`;
  if (totalErrores > 0) {
    errorCount.textContent = `${totalErrores} errores`;
    errorCount.classList.remove('hidden');
  } else {
    errorCount.classList.add('hidden');
  }

  tableBody.innerHTML = '';
  const registrosAMostrar = datosExcel.slice(0, 10);

  registrosAMostrar.forEach(item => {
    const row = document.createElement('tr');
    const nombresParejas = item.nombreP2 ? `${item.nombreP1} & ${item.nombreP2}` : item.nombreP1;
    row.className = item.valido ? 'success' : 'error';
    row.dataset.idx = String(datosExcel.indexOf(item));
    row.innerHTML = `
      <td><span class="status-icon">${item.valido ? '✅' : '❌'}</span></td>
      <td>${item.numero || 'N/A'}</td>
      <td>${nombresParejas || 'N/A'}</td>
      <td>${item.categoria || 'N/A'}</td>
    `;
    if (!item.valido) row.title = 'Errores: ' + item.errores.join(', ');
    tableBody.appendChild(row);
  });

  const procesarBtn = document.getElementById('procesarLote');
  procesarBtn.style.display = totalValidos > 0 ? 'inline-flex' : 'none';

  if (datosExcel.length > 10) {
    const moreRow = document.createElement('tr');
    moreRow.innerHTML = `<td colspan="4" style="text-align:center; font-style:italic; color:#666;">... y ${datosExcel.length - 10} registros más</td>`;
    tableBody.appendChild(moreRow);
  }

  // Delegación: un único listener para todos los clicks en la 1ra celda
  if (!previewClickBound) {
    tableBody.addEventListener('click', (ev) => {
      const td = ev.target.closest('td');
      if (!td) return;
      const row = td.parentElement;
      if (!row || row.rowIndex === 0) return;
      const isFirstCell = td.cellIndex === 0;
      if (!isFirstCell) return;

      const idx = parseInt(row.dataset.idx, 10);
      if (Number.isNaN(idx) || !datosExcel[idx]) return;

      const item = datosExcel[idx];
      if (item.valido) {
        mostrarNotificacion('✅ Esta fila no tiene errores', 'success');
      } else {
        abrirModalErrores(item);
      }
    });
    previewClickBound = true;
  }

  mostrarNotificacion(`📊 ${totalValidos} registros listos para procesar`, 'success');
}

/* ===========================
   Descargar QR (utilidad)
   =========================== */
async function descargarQR(qrUrl, nombre, mostrarMensaje = true) {
  try {
    const response = await fetch(qrUrl);
    if (!response.ok) throw new Error('Error al descargar el archivo');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_${(nombre || 'participante').replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    if (mostrarMensaje) mostrarNotificacion(`✅ QR de ${nombre || 'participante'} descargado`, 'success');
  } catch (error) {
    console.error('Error al descargar:', error);
    if (mostrarMensaje) mostrarNotificacion(`❌ Error al descargar QR de ${nombre || 'participante'}`, 'error');
  }
}

/* ===========================
   Procesamiento masivo
   =========================== */
async function procesarLoteHandler() {
  if (datosValidados.length === 0) {
    mostrarNotificacion('❌ No hay datos válidos para procesar', 'error');
    return;
  }

  const progressSection = document.getElementById('progressSection');
  const progressFill    = document.getElementById('progressFill');
  const progressText    = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');

  progressSection.classList.remove('hidden');
  document.getElementById('previewSection').classList.add('hidden');

  let procesados = 0, exitosos = 0, fallidos = 0;
  const errores = [];
  const total = datosValidados.length;

  for (const participante of datosValidados) {
    try {
      const response = await fetch('/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `numero=${encodeURIComponent(participante.numero)}&nombrep1=${encodeURIComponent(participante.nombreP1)}&nombrep2=${encodeURIComponent(participante.nombreP2)}&categoria=${encodeURIComponent(participante.categoria)}`
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      exitosos++;
    } catch (error) {
      const etiqueta = [participante.nombreP1, participante.nombreP2].filter(Boolean).join(' & ');
      console.error(`Error procesando ${etiqueta || 'sin nombre'}:`, error);
      fallidos++;
      errores.push(`Fila ${participante.fila} (${etiqueta || 'sin nombre'}): ${error.message}`);
    }

    procesados++;
    const porcentaje = Math.round((procesados / total) * 100);
    progressFill.style.width = `${porcentaje}%`;
    progressText.textContent = `${procesados} / ${total} procesados`;
    progressPercent.textContent = `${porcentaje}%`;

    await new Promise(r => setTimeout(r, 100)); // efecto visual
  }

  mostrarResultadosMasivos(exitosos, fallidos, errores);
}

function mostrarResultadosMasivos(exitosos, fallidos, errores) {
  const progressSection = document.getElementById('progressSection');
  const resultsSection  = document.getElementById('resultsSection');
  const successCount    = document.getElementById('successCount');
  const failCount       = document.getElementById('failCount');
  const errorDetails    = document.getElementById('errorDetails');
  const errorList       = document.getElementById('errorList');

  progressSection.classList.add('hidden');
  resultsSection.classList.remove('hidden');

  successCount.textContent = exitosos;
  failCount.textContent    = fallidos;

  if (errores.length > 0) {
    errorDetails.classList.remove('hidden');
    errorList.innerHTML = '';
    errores.forEach(msg => {
      const li = document.createElement('li');
      li.textContent = msg;
      li.style.color = '#ff4444';
      li.style.marginBottom = '5px';
      errorList.appendChild(li);
    });
  } else {
    errorDetails.classList.add('hidden');
  }

  const mensaje = fallidos > 0
    ? `✅ ${exitosos} exitosos, ❌ ${fallidos} fallidos`
    : `🎉 ¡${exitosos} participantes registrados exitosamente!`;
  mostrarNotificacion(mensaje, fallidos > 0 ? 'warning' : 'success');
}

/* ===========================
   Utilidades
   =========================== */
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
function resetForm() {
  const form = document.getElementById('registroForm');
  const resultado = document.getElementById('resultado');

  resultado.style.transition = 'all .3s ease';
  resultado.style.opacity = '0';
  resultado.style.transform = 'translateY(-20px)';
  setTimeout(() => {
    resultado.classList.add('hidden');
    resultado.style.transition = '';
    resultado.style.opacity = '';
    resultado.style.transform = '';
  }, 300);

  form.reset();
  setTimeout(() => { document.getElementById('numero').focus(); }, 400);
  mostrarNotificacion('🔄 Formulario limpiado', 'info');
}

// Poner "clic para detalles" en el header de Estado (una sola vez)
const thEstado = document.querySelector('#previewTable thead th:first-child');
if (thEstado && !thEstado.dataset.hinted) {
  thEstado.innerHTML = 'Estado <span class="click-hint">clic para detalles</span>';
  thEstado.dataset.hinted = '1';
}

function resetMasivaCarga() {
  datosExcel = [];
  datosValidados = [];
  document.getElementById('previewSection').classList.add('hidden');
  document.getElementById('progressSection').classList.add('hidden');
  document.getElementById('resultsSection').classList.add('hidden');
  document.getElementById('fileInput').value = '';
  document.getElementById('uploadZone').classList.remove('dragover');
}
function cancelarCarga() {
  resetMasivaCarga();
  mostrarNotificacion('❌ Carga cancelada', 'info');
}
function descargarPlantilla() {
  const datosEjemplo = [
    ['Número','NombreP1','NombreP2','Categoría'],
    [1,'Juan Pérez','Felipe Jimenez','Principiante Masculino'],
    [2,'Juanita Pérez','Rosita Jimenez','Principiante Masculino'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(datosEjemplo);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Participantes');
  XLSX.writeFile(wb, 'plantilla_participantes.xlsx');
  mostrarNotificacion('📥 Plantilla descargada exitosamente', 'success');
}

/* ===========================
   Inicialización
   =========================== */
document.addEventListener('DOMContentLoaded', () => {
  // Listeners de modo
  document.getElementById('modoIndividual')?.addEventListener('click', () => cambiarModo('individual'));
  document.getElementById('modoMasivo')?.addEventListener('click', () => cambiarModo('masivo'));

  // Form submit (individual)
  const form = document.getElementById('registroForm');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const numero   = document.getElementById('numero').value.trim();
      const nombreP1 = document.getElementById('nombre_p1').value.trim();
      const nombreP2 = document.getElementById('nombre_p2').value.trim();
      const categoria= document.getElementById('categoria').value;

      if (!numero || !nombreP1 || !nombreP2 || !categoria) {
        mostrarNotificacion('❌ Por favor complete todos los campos', 'error'); return;
      }
      if (parseInt(numero, 10) <= 0) {
        mostrarNotificacion('❌ El número debe ser mayor a 0', 'error'); return;
      }

      const btn       = e.target.querySelector('button[type="submit"]');
      const btnText   = btn.querySelector('.btn-text');
      const btnIcon   = btn.querySelector('.btn-icon');
      const btnLoader = btn.querySelector('.btn-loader');
      setButtonState(btn, btnText, btnIcon, btnLoader, true);

      fetch('/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `numero=${encodeURIComponent(numero)}&nombrep1=${encodeURIComponent(nombreP1)}&nombrep2=${encodeURIComponent(nombreP2)}&categoria=${encodeURIComponent(categoria)}`
      })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        mostrarResultado(data);
        mostrarNotificacion('🎉 ¡Participante registrado exitosamente!', 'success');
        setTimeout(() => { document.getElementById('resultado').scrollIntoView({ behavior:'smooth', block:'start' }); }, 300);
      })
      .catch(err => {
        console.error('Error en el proceso:', err);
        mostrarNotificacion(`❌ Error: ${err.message}`, 'error');
      })
      .finally(() => setButtonState(btn, btnText, btnIcon, btnLoader, false));
    });
  }

  // Enfoque inicial
  document.getElementById('numero')?.focus();

  // Dropzone
  configurarZonaArrastre();

  // Animación formulario
  const formCard = document.querySelector('.registration-form');
  if (formCard) {
    formCard.style.opacity = '0';
    formCard.style.transform = 'translateY(20px)';
    setTimeout(() => {
      formCard.style.transition = 'all .6s ease';
      formCard.style.opacity = '1';
      formCard.style.transform = 'translateY(0)';
    }, 100);
  }

  // Botón procesar lote (delegado aquí para evitar múltiples binds)
  document.getElementById('procesarLote')?.addEventListener('click', procesarLoteHandler);
});

/* ===========================
   Animaciones (CSS-in-JS)
   =========================== */
const style = document.createElement('style');
style.textContent = `
@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes slideOutRight{ from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
@keyframes slideInUp    { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;
document.head.appendChild(style);
