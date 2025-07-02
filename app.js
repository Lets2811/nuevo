const express = require('express');
const qr = require('qr-image');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const connectDB = require('./utils/db');
const Participante = require('./utils/pariticpantModel');
const Salida = require('./utils/salidaModel');
const Llegada = require('./utils/llegadaModelo');
const cloudinary = require('./utils/cloudinary');

const app = express();
const PORT = 3000;

// ===== MIDDLEWARE CONFIGURADO CORRECTAMENTE =====
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // ✅ PARA PARSEAR JSON
app.use(express.static('public'));
app.use('/qr-codes', express.static('qr-codes'));

// Conectar a la base de datos
connectDB();

// ===== RUTAS PRINCIPALES =====

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/registrar', async (req, res) => {
    console.log('='.repeat(50));
    console.log('🚀 RUTA /registrar EJECUTÁNDOSE');
    console.log('📅 Timestamp:', new Date().toISOString());
    console.log('📦 Body recibido:', req.body);
    console.log('='.repeat(50));
  
    const { nombre, categoria, numero } = req.body;
  
    if (!nombre || !categoria || !numero) {
      console.log('❌ Faltan campos requeridos');
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
  
    try {
      const datosQR = JSON.stringify({ nombre, categoria, numero });
  
      const safeFilename = `${Date.now()}_${nombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '_')}`;
      const tempPath = path.join('/tmp', `${safeFilename}.png`);
  
      const qr_png = qr.image(datosQR, { type: 'png' });
      const writeStream = fs.createWriteStream(tempPath);
      qr_png.pipe(writeStream);
  
      writeStream.on('finish', async () => {
        try {
          const result = await cloudinary.uploader.upload(tempPath, {
            folder: 'qr_codes',
            public_id: safeFilename,
            use_filename: true,
            overwrite: true,
          });
  
          fs.unlinkSync(tempPath); // eliminar el archivo temporal
  
          const nuevo = new Participante({
            nombre,
            categoria,
            numero,
            qrUrl: result.secure_url,
          });
  
          await nuevo.save();
  
          const response = {
            success: true,
            mensaje: 'Participante registrado',
            id: nuevo._id,
            nombre: nuevo.nombre,
            categoria: nuevo.categoria,
            qrUrl: nuevo.qrUrl,
          };
  
          console.log('✅ Participante guardado y QR subido a Cloudinary');
          res.json(response);
        } catch (uploadErr) {
          console.error('💥 Error al subir QR a Cloudinary:', uploadErr);
          res.status(500).json({ error: 'Error al subir QR' });
        }
      });
    } catch (error) {
      console.error('💥 Error general en /registrar:', error);
      res.status(500).json({ error: 'Error al registrar participante' });
    }
  });
// ===== RUTAS DE PÁGINAS =====

app.get('/escaneo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'escaneo.html'));
});

app.get('/salida', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'escaneoSalida.html'));
});

app.get('/llegada', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'escaneoLlegada.html'));
});

app.get('/galeria', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'galeria.html'));
});

app.get('/tiempos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tiempos.html'));
});

// ===== RUTAS DE PARTICIPANTES =====

app.get('/participante/:id', async (req, res) => {
    try {
        let id = req.params.id;
        
        // Si el ID viene como JSON, extraemos el valor numérico
        try {
            const parsedData = JSON.parse(id);
            if (parsedData && parsedData.id) {
                id = parsedData.id.toString();
            }
        } catch (e) {
            // No es JSON, continuar con el ID original
        }

        // Primero buscar en la base de datos
        const participante = await Participante.findById(id);
        
        if (participante) {
            return res.json({
                success: true,
                id: participante._id.toString(),
                nombre: participante.nombre,
                categoria: participante.categoria,
                horaRegistro: participante.horaRegistro
            });
        }

        // Si no se encuentra en DB, buscar en archivos como fallback
        fs.readdir('qr-codes', (err, files) => {
            if (err) {
                console.error('Error al leer directorio qr-codes:', err);
                return res.status(500).json({ error: 'Error del servidor' });
            }

            const archivoQR = files.find(file => {
                const fileId = file.split('_')[0];
                return fileId === id;
            });

            if (!archivoQR) {
                console.log('Participante no encontrado. ID buscado:', id);
                return res.status(404).json({ 
                    error: 'Participante no encontrado',
                    idBuscado: id
                });
            }

            const nombre = archivoQR.split('_').slice(1).join('_').replace('.png', '').replace(/_/g, ' ');
            
            res.json({
                success: true,
                id,
                nombre,
                qrPath: `qr-codes/${archivoQR}`
            });
        });

    } catch (error) {
        console.error('Error al buscar participante:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// ===== API DE GALERÍA =====

app.get('/api/qr-codes', async (req, res) => {
    try {
      const participantes = await Participante.find({}).sort({ horaRegistro: -1 });
        
      console.log(`📸 Obteniendo ${participantes.length} códigos QR de participantes`);
      const qrList = participantes.map(p => ({
        id: p._id.toString(),
        nombre: p.nombre,
        categoria: p.categoria,
        fechaRegistro: p.horaRegistro,
        qrUrl: p.qrUrl,
        filename: p.qrUrl?.split('/').pop() || 'NA', // nombre del archivo desde Cloudinary
        downloadUrl: p.qrUrl // puede usarse directamente para descargar
      }));
  
      res.json({
        success: true,
        total: qrList.length,
        qrCodes: qrList
      });
  
    } catch (error) {
      console.error('Error al obtener códigos QR:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al cargar la galería de códigos QR' 
      });
    }
  });
  

app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'qr-codes', filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const nombreParticipante = filename.split('_').slice(1).join('_').replace('.png', '').replace(/_/g, '_');
    const downloadName = `QR_${nombreParticipante}.png`;

    res.download(filePath, downloadName, (error) => {
        if (error) {
            console.error('Error al descargar archivo:', error);
            res.status(500).json({ error: 'Error al descargar el archivo' });
        }
    });
});

// ===== APIs DE SALIDAS =====

app.post('/registrar-salida', async (req, res) => {
    console.log('🏃‍♂️ REGISTRAR SALIDA - Datos recibidos:', req.body);
    console.log('📦 Content-Type:', req.get('Content-Type'));
    
    const { participanteId, nombre, categoria, horaSalida } = req.body;

    if (!participanteId || !nombre || !categoria) {
        console.log('❌ Error: Datos incompletos');
        console.log('  - participanteId:', participanteId);
        console.log('  - nombre:', nombre);
        console.log('  - categoria:', categoria);
        return res.status(400).json({ 
            error: 'Todos los campos son requeridos (participanteId, nombre, categoria)' 
        });
    }

    try {
        const salidaExistente = await Salida.findOne({ 
            participanteId, 
            activo: true 
        });
        
        if (salidaExistente) {
            console.log('⚠️ Participante ya tiene salida registrada:', salidaExistente);
            return res.status(400).json({ 
                error: `El participante "${nombre}" ya tiene registrada una salida`,
                horaSalidaAnterior: salidaExistente.horaSalida.toLocaleString('es-ES', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }),
                salidaExistente: true
            });
        }

        // OPTIMIZADO: Obtener el próximo número de salida de manera más eficiente
        const ultimaSalida = await Salida.findOne({}, {}, { sort: { numeroSalida: -1 } });
        const numeroSalida = ultimaSalida ? ultimaSalida.numeroSalida + 1 : 1;

        const timestampSalida = horaSalida ? new Date(horaSalida) : new Date();
        
        const nuevaSalida = new Salida({
            participanteId,
            nombre,
            categoria,
            horaSalida: timestampSalida,
            numeroSalida,
            horaRegistro: new Date()
        });

        await nuevaSalida.save();

        console.log('✅ Nueva salida registrada exitosamente:', {
            id: nuevaSalida._id,
            participante: nombre,
            numero: numeroSalida,
            hora: timestampSalida
        });
        
        res.json({
            success: true,
            mensaje: 'Salida registrada exitosamente',
            participanteId,
            nombre,
            categoria,
            numeroSalida,
            horaSalida: timestampSalida.toLocaleString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            horaSalidaISO: timestampSalida.toISOString(),
            id: nuevaSalida._id,
            horaRegistro: nuevaSalida.horaRegistro.toISOString()
        });

    } catch (error) {
        console.error('💥 Error al registrar salida:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({ 
                error: 'Este participante ya tiene una salida registrada' 
            });
        }
        
        res.status(500).json({ 
            error: 'Error interno del servidor al registrar salida',
            detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.get('/participantes', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'participantes.html'));
});

app.get('/api/salidas', async (req, res) => {
    try {
        const { activo = true, limite = 100, pagina = 1 } = req.query;
        
        const filtro = activo === 'all' ? {} : { activo: activo === 'true' };
        const skip = (parseInt(pagina) - 1) * parseInt(limite);
        
        const salidas = await Salida.find(filtro)
            .sort({ horaSalida: -1 })
            .limit(parseInt(limite))
            .skip(skip);
            
        const total = await Salida.countDocuments(filtro);
        
        console.log(`📊 Obteniendo salidas - Total: ${total}, Página: ${pagina}`);
        
        res.json({
            success: true,
            total,
            pagina: parseInt(pagina),
            limite: parseInt(limite),
            totalPaginas: Math.ceil(total / parseInt(limite)),
            salidas: salidas.map(salida => ({
                id: salida._id,
                participanteId: salida.participanteId,
                nombre: salida.nombre,
                categoria: salida.categoria,
                numeroSalida: salida.numeroSalida,
                horaSalida: salida.horaSalida.toLocaleString('es-ES'),
                horaSalidaISO: salida.horaSalida.toISOString(),
                horaRegistro: salida.horaRegistro.toISOString(),
                activo: salida.activo
            }))
        });
        
    } catch (error) {
        console.error('💥 Error al obtener salidas:', error);
        res.status(500).json({ 
            error: 'Error al obtener salidas',
            detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.get('/api/salida/:participanteId', async (req, res) => {
    try {
        const { participanteId } = req.params;
        
        const salida = await Salida.findOne({ 
            participanteId, 
            activo: true 
        });
        
        if (!salida) {
            return res.status(404).json({ 
                error: 'No se encontró salida activa para este participante',
                participanteId 
            });
        }
        
        console.log(`🔍 Salida encontrada para participante ${participanteId}`);
        
        res.json({
            success: true,
            salida: {
                id: salida._id,
                participanteId: salida.participanteId,
                nombre: salida.nombre,
                categoria: salida.categoria,
                numeroSalida: salida.numeroSalida,
                horaSalida: salida.horaSalida.toLocaleString('es-ES'),
                horaSalidaISO: salida.horaSalida.toISOString(),
                horaRegistro: salida.horaRegistro.toISOString(),
                activo: salida.activo
            }
        });
        
    } catch (error) {
        console.error('💥 Error al buscar salida:', error);
        res.status(500).json({ 
            error: 'Error al buscar salida',
            detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.put('/api/salida/:participanteId/anular', async (req, res) => {
    try {
        const { participanteId } = req.params;
        const { motivo = 'Anulación manual' } = req.body;
        
        const salida = await Salida.findOneAndUpdate(
            { participanteId, activo: true },
            { 
                activo: false, 
                motivoAnulacion: motivo,
                fechaAnulacion: new Date()
            },
            { new: true }
        );
        
        if (!salida) {
            return res.status(404).json({ 
                error: 'No se encontró salida activa para anular' 
            });
        }
        
        console.log(`🚫 Salida anulada para participante ${participanteId}: ${motivo}`);
        
        res.json({
            success: true,
            mensaje: 'Salida anulada exitosamente',
            salida: {
                id: salida._id,
                participanteId: salida.participanteId,
                nombre: salida.nombre,
                motivo,
                fechaAnulacion: salida.fechaAnulacion
            }
        });
        
    } catch (error) {
        console.error('💥 Error al anular salida:', error);
        res.status(500).json({ 
            error: 'Error al anular salida',
            detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.get('/api/salidas/estadisticas', async (req, res) => {
    try {
        const ahora = new Date();
        const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        
        const totalSalidas = await Salida.countDocuments({ activo: true });
        const salidasHoy = await Salida.countDocuments({ 
            activo: true,
            horaSalida: { $gte: hoy }
        });
        
        const salidasPorCategoria = await Salida.aggregate([
            { $match: { activo: true } },
            { $group: { _id: '$categoria', total: { $sum: 1 } } },
            { $sort: { total: -1 } }
        ]);
        
        const ultimaSalida = await Salida.findOne({ activo: true }, {}, { sort: { horaSalida: -1 } });
        
        console.log('📈 Generando estadísticas de salidas');
        
        res.json({
            success: true,
            estadisticas: {
                totalSalidas,
                salidasHoy,
                salidasPorCategoria,
                ultimaSalida: ultimaSalida ? {
                    nombre: ultimaSalida.nombre,
                    categoria: ultimaSalida.categoria,
                    horaSalida: ultimaSalida.horaSalida.toLocaleString('es-ES'),
                    numeroSalida: ultimaSalida.numeroSalida
                } : null,
                fechaConsulta: ahora.toISOString()
            }
        });
        
    } catch (error) {
        console.error('💥 Error al obtener estadísticas:', error);
        res.status(500).json({ 
            error: 'Error al obtener estadísticas',
            detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ===== APIs DE LLEGADAS =====

app.post('/registrar-llegada', async (req, res) => {
    console.log('🏁 REGISTRAR LLEGADA - Datos recibidos:', req.body);
    console.log('⚡ Timestamp del frontend:', req.body.horaLlegada);
    
    const { participanteId, nombre, categoria, horaLlegada, timestampPrecision } = req.body;

    // Validación rápida
    if (!participanteId || !nombre || !categoria) {
        console.log('❌ Error: Datos incompletos');
        return res.status(400).json({ 
            error: 'Todos los campos son requeridos (participanteId, nombre, categoria)' 
        });
    }

    try {
        // ⚡ VERIFICACIÓN RÁPIDA DE DUPLICADOS
        const llegadaExistente = await Llegada.findOne({ 
            participanteId, 
            activo: true 
        });
        
        if (llegadaExistente) {
            console.log('⚠️ Participante ya tiene llegada registrada:', llegadaExistente);
            return res.status(400).json({ 
                error: `El participante "${nombre}" ya tiene registrada una llegada`,
                horaLlegadaAnterior: llegadaExistente.horaLlegada.toLocaleString('es-ES', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    fractionalSecondDigits: 3
                }),
                llegadaExistente: true
            });
        }

        // ⚡ OBTENER NÚMERO DE LLEGADA RÁPIDAMENTE
        const ultimaLlegada = await Llegada.findOne({}, { numeroLlegada: 1 }, { sort: { numeroLlegada: -1 } });
        const numeroLlegada = ultimaLlegada ? ultimaLlegada.numeroLlegada + 1 : 1;

        // ⚡ USAR TIMESTAMP DEL FRONTEND (más preciso)
        const timestampLlegada = horaLlegada ? new Date(horaLlegada) : new Date();
        
        const nuevaLlegada = new Llegada({
            participanteId,
            nombre,
            categoria,
            horaLlegada: timestampLlegada,
            numeroLlegada,
            timestampPrecision: timestampPrecision || 0,
            horaRegistro: new Date()
        });

        // ⚡ GUARDADO RÁPIDO
        await nuevaLlegada.save();

        console.log('✅ Nueva llegada registrada exitosamente:', {
            id: nuevaLlegada._id,
            participante: nombre,
            numero: numeroLlegada,
            hora: timestampLlegada,
            precision: timestampPrecision
        });
        
        // ⚡ RESPUESTA OPTIMIZADA
        res.json({
            success: true,
            mensaje: 'Llegada registrada exitosamente',
            participanteId,
            nombre,
            categoria,
            numeroLlegada,
            horaLlegada: timestampLlegada.toLocaleString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3
            }),
            horaLlegadaISO: timestampLlegada.toISOString(),
            timestampPrecision,
            id: nuevaLlegada._id,
            horaRegistro: nuevaLlegada.horaRegistro.toISOString()
        });

    } catch (error) {
        console.error('💥 Error al registrar llegada:', error);
        
        // Error específico de duplicado
        if (error.code === 11000) {
            return res.status(400).json({ 
                error: 'Este participante ya tiene una llegada registrada' 
            });
        }
        
        res.status(500).json({ 
            error: 'Error interno del servidor al registrar llegada',
            detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.get('/api/llegadas', async (req, res) => {
    try {
        const { activo = true, limite = 100, pagina = 1, ordenar = 'tiempo' } = req.query;
        
        // Obtener todas las llegadas y salidas activas
        const llegadas = await Llegada.find();
        const salidas = await Salida.find();
        
        // Crear un mapa de salidas por participanteId para búsqueda rápida
        const salidasMap = {};
        salidas.forEach(salida => {
            salidasMap[salida.participanteId] = salida;
        });
        
        // Combinar datos y calcular tiempos
        const resultados = [];
        
        llegadas.forEach(llegada => {
            const salida = salidasMap[llegada.participanteId];
            
            if (salida) {
                // Extraer timestamps
                const timestampSalida = new Date(salida.horaSalida).getTime();
                const timestampLlegada = new Date(llegada.horaLlegada).getTime();
                
                // Calcular tiempo transcurrido en milisegundos
                const tiempoMs = timestampLlegada - timestampSalida;
                
                // Convertir a formato legible (opcional)
                const tiempoSegundos = Math.floor(tiempoMs / 1000);
                const horas = Math.floor(tiempoSegundos / 3600);
                const minutos = Math.floor((tiempoSegundos % 3600) / 60);
                const segundos = tiempoSegundos % 60;
                
                const tiempoFormateado = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
                
                // Formatear horas de salida y llegada
                const fechaSalida = new Date(timestampSalida);
                const fechaLlegada = new Date(timestampLlegada);
                
                const salidaFormateada = fechaSalida.toLocaleString('es-CO', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                
                const llegadaFormateada = fechaLlegada.toLocaleString('es-CO', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                
                resultados.push({
                    participanteId: llegada.participanteId,
                    nombre: llegada.nombre,
                    categoria: llegada.categoria,
                    salida: timestampSalida,
                    llegada: timestampLlegada,
                    salidaFormateada: salidaFormateada,
                    llegadaFormateada: llegadaFormateada,
                    tiempo: tiempoMs, // tiempo en milisegundos
                    tiempoFormateado: tiempoFormateado, // tiempo en formato HH:MM:SS
                    numeroSalida: salida.numeroSalida,
                    numeroLlegada: llegada.numeroLlegada
                });
            }
        });
        
        // Ordenar resultados
        let resultadosOrdenados = [...resultados];
        switch (ordenar) {
            case 'tiempo':
                resultadosOrdenados.sort((a, b) => a.tiempo - b.tiempo);
                break;
            case 'nombre':
                resultadosOrdenados.sort((a, b) => a.nombre.localeCompare(b.nombre));
                break;
            case 'numeroLlegada':
                resultadosOrdenados.sort((a, b) => a.numeroLlegada - b.numeroLlegada);
                break;
            case 'categoria':
                resultadosOrdenados.sort((a, b) => a.categoria.localeCompare(b.categoria));
                break;
            default:
                resultadosOrdenados.sort((a, b) => a.tiempo - b.tiempo);
        }
        
        // Aplicar paginación
        const inicio = (parseInt(pagina) - 1) * parseInt(limite);
        const fin = inicio + parseInt(limite);
        const resultadosPaginados = resultadosOrdenados.slice(inicio, fin);
        
        // Respuesta
        res.json({
            success: true,
            data: resultadosPaginados,
            meta: {
                total: resultados.length,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                totalPaginas: Math.ceil(resultados.length / parseInt(limite)),
                ordenar: ordenar
            }
        });
        
    } catch (error) {
        console.error('💥 Error al obtener llegadas:', error);
        res.status(500).json({ 
            error: 'Error al obtener llegadas',
            detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});
// ===== API DE TIEMPOS =====
// ===== RUTAS SIMPLIFICADAS PARA TIEMPOS COMPLETADOS =====

// Ruta para servir la página de tiempos
app.get('/tiempos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tiempos.html'));
});


// API SIMPLIFICADA: Obtener solo tiempos completados
app.get('/api/tiempos-completados', async (req, res) => {
    try {
        const { categoria } = req.query;
        
        console.log('⏱️ Obteniendo tiempos completados:', { categoria });
        
        // Obtener datos en paralelo
        const [llegadas, salidas, participantes] = await Promise.all([
            Llegada.find({ activo: true }).lean(),
            Salida.find({ activo: true }).lean(),
            Participante.find({}).lean()
        ]);
        
        // Crear mapas para acceso rápido
        const llegadasMap = new Map();
        const salidasMap = new Map();
        
        llegadas.forEach(llegada => {
            llegadasMap.set(llegada.participanteId, llegada);
        });
        
        salidas.forEach(salida => {
            salidasMap.set(salida.participanteId, salida);
        });
        
        // Procesar solo participantes con AMBOS registros
        let tiemposCompletados = [];
        
        participantes.forEach(participante => {
            const llegada = llegadasMap.get(participante._id.toString());
            const salida = salidasMap.get(participante._id.toString());
            
            // Solo incluir si tiene AMBOS registros
            if (llegada && salida) {
                const inicioTime = new Date(salida.horaSalida);
                const finTime = new Date(llegada.horaLlegada);
                const tiempoTotal = finTime - inicioTime; // milisegundos
                
                tiemposCompletados.push({
                    id: participante._id.toString(),
                    nombre: participante.nombre,
                    categoria: participante.categoria,
                    
                    // Datos de salida
                    horaSalida: inicioTime.toLocaleTimeString('es-ES'),
                    horaSalidaCompleta: inicioTime.toLocaleString('es-ES'),
                    numeroSalida: salida.numeroSalida,
                    
                    // Datos de llegada
                    horaLlegada: finTime.toLocaleTimeString('es-ES'),
                    horaLlegadaCompleta: finTime.toLocaleString('es-ES'),
                    numeroLlegada: llegada.numeroLlegada,
                    posicion: llegada.numeroLlegada,
                    
                    // Tiempo total
                    tiempoTotal: tiempoTotal,
                    tiempoTotalFormateado: formatearDuracionServer(tiempoTotal),
                    tiempoTotalSegundos: Math.floor(tiempoTotal / 1000)
                });
            }
        });
        
        // Filtrar por categoría si se especifica
        if (categoria && categoria !== 'all') {
            tiemposCompletados = tiemposCompletados.filter(t => t.categoria === categoria);
        }
        
        // Ordenar por tiempo total (mejor tiempo primero)
        tiemposCompletados.sort((a, b) => a.tiempoTotal - b.tiempoTotal);
        
        // Calcular estadísticas
        const stats = calcularEstadisticasCompletados(tiemposCompletados);
        
        // Podium (top 3)
        const podium = tiemposCompletados.slice(0, 3).map((t, index) => ({
            posicion: index + 1,
            medalla: ['🥇', '🥈', '🥉'][index],
            ...t
        }));
        
        console.log(`✅ Tiempos completados obtenidos: ${tiemposCompletados.length} resultados`);
        
        res.json({
            success: true,
            total: tiemposCompletados.length,
            filtros: { categoria },
            estadisticas: stats,
            podium: podium,
            tiempos: tiemposCompletados,
            fechaConsulta: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('💥 Error al obtener tiempos completados:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener tiempos completados',
            detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// API: Estadísticas rápidas solo de completados
app.get('/api/estadisticas-completados', async (req, res) => {
    try {
        console.log('📊 Generando estadísticas de completados...');
        
        // Obtener conteos básicos
        const [totalParticipantes, totalSalidas, totalLlegadas] = await Promise.all([
            Participante.countDocuments({}),
            Salida.countDocuments({ activo: true }),
            Llegada.countDocuments({ activo: true })
        ]);
        
        // Obtener participantes que tienen AMBOS registros
        const [llegadas, salidas] = await Promise.all([
            Llegada.find({ activo: true }).lean(),
            Salida.find({ activo: true }).lean()
        ]);
        
        const llegadasSet = new Set(llegadas.map(l => l.participanteId));
        const salidasSet = new Set(salidas.map(s => s.participanteId));
        
        // Intersección: participantes que tienen ambos
        const completados = [...llegadasSet].filter(id => salidasSet.has(id));
        
        // Calcular tiempos solo de completados
        let tiempoPromedio = null;
        let mejorTiempo = null;
        
        if (completados.length > 0) {
            const llegadasMap = new Map(llegadas.map(l => [l.participanteId, l]));
            const salidasMap = new Map(salidas.map(s => [s.participanteId, s]));
            
            const tiempos = completados.map(participanteId => {
                const llegada = llegadasMap.get(participanteId);
                const salida = salidasMap.get(participanteId);
                return new Date(llegada.horaLlegada) - new Date(salida.horaSalida);
            });
            
            if (tiempos.length > 0) {
                const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
                const mejor = Math.min(...tiempos);
                
                tiempoPromedio = formatearDuracionServer(promedio);
                mejorTiempo = formatearDuracionServer(mejor);
            }
        }
        
        res.json({
            success: true,
            estadisticas: {
                totalParticipantes,
                totalSalidas,
                totalLlegadas,
                completados: completados.length,
                enCurso: totalSalidas - completados.length,
                noIniciados: totalParticipantes - totalSalidas,
                tiempoPromedio,
                mejorTiempo,
                porcentajeCompletado: totalParticipantes > 0 ? 
                    Math.round((completados.length / totalParticipantes) * 100) : 0
            },
            fechaConsulta: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('💥 Error al generar estadísticas de completados:', error);
        res.status(500).json({
            success: false,
            error: 'Error al generar estadísticas',
            detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.post('/registrar', async (req, res) => {
    console.log('='.repeat(50));
    console.log('🚀 RUTA /registrar EJECUTÁNDOSE');
    console.log('📅 Timestamp:', new Date().toISOString());
    console.log('📦 Body recibido:', req.body);
    console.log('='.repeat(50));

    const { numero, nombre, categoria } = req.body;

    // Validaciones mejoradas
    if (!numero || !nombre || !categoria) {
        console.log('❌ Faltan campos requeridos');
        return res.status(400).json({ 
            error: 'Todos los campos son requeridos',
            faltantes: {
                numero: !numero,
                nombre: !nombre,
                categoria: !categoria
            }
        });
    }

    // Validar número
    const numeroInt = parseInt(numero);
    if (isNaN(numeroInt) || numeroInt <= 0) {
        console.log('❌ Número inválido:', numero);
        return res.status(400).json({ 
            error: 'El número debe ser un entero positivo' 
        });
    }

    // Validar categoría
    const categoriesValidas = [
        'Principiante Femenino', 'Intermedio Femenino', 'Avanzado Femenino',
        'Principiante Masculino', 'Intermedio Masculino', 'Avanzado Masculino'
    ];
    
    if (!categoriesValidas.includes(categoria)) {
        console.log('❌ Categoría inválida:', categoria);
        return res.status(400).json({ 
            error: 'Categoría no válida',
            categoriasValidas: categoriesValidas
        });
    }

    // Crear directorio si no existe
    if (!fs.existsSync('qr-codes')) {
        fs.mkdirSync('qr-codes', { recursive: true });
        console.log('📁 Directorio qr-codes creado');
    }

    try {
        // Verificar si el número ya existe
        const participanteExistente = await Participante.findOne({ numero: numeroInt });
        if (participanteExistente) {
            console.log('❌ Número ya registrado:', numeroInt);
            return res.status(409).json({ 
                error: `El número ${numeroInt} ya está registrado para ${participanteExistente.nombre}`
            });
        }

        // Crear nuevo participante
        const nuevo = new Participante({ 
            numero: numeroInt, 
            nombre: nombre.trim(), 
            categoria 
        });
        
        await nuevo.save();

        // Generar archivo QR
        const id = nuevo._id.toString();
        const nombreArchivo = `${numeroInt}_${nombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '_')}.png`;
        const rutaCompleta = path.join('qr-codes', nombreArchivo);
        
        // Datos para el QR (incluir número)
        const datosQR = JSON.stringify({ 
            id, 
            numero: numeroInt,
            nombre, 
            categoria,
            timestamp: new Date().toISOString()
        });
        
        // Generar QR
        const qr_png = qr.image(datosQR, { 
            type: 'png',
            size: 10,
            margin: 2
        });
        
        qr_png.pipe(fs.createWriteStream(rutaCompleta));

        // Actualizar registro con info del QR
        nuevo.qrGenerado = true;
        nuevo.archivoQR = rutaCompleta;
        await nuevo.save();

        console.log('✅ Nuevo participante registrado:', {
            id: nuevo._id,
            numero: nuevo.numero,
            nombre: nuevo.nombre,
            categoria: nuevo.categoria
        });
        console.log('📁 QR generado en:', rutaCompleta);
        
        const response = {
            success: true,
            mensaje: 'Participante registrado exitosamente',
            qrUrl: `/${rutaCompleta}`, // URL relativa para el frontend
            id,
            numero: numeroInt,
            nombre,
            categoria,
            fechaRegistro: nuevo.fechaRegistro
        };

        console.log('📤 Respuesta enviada:', response);
        res.json(response);
        
    } catch (error) {
        console.error('💥 Error al registrar participante:', error);
        
        // Manejar diferentes tipos de errores
        if (error.code === 11000) {
            // Error de duplicado en MongoDB
            const campo = Object.keys(error.keyPattern)[0];
            return res.status(409).json({ 
                error: `Ya existe un participante con ${campo}: ${error.keyValue[campo]}`
            });
        }
        
        if (error.name === 'ValidationError') {
            const errores = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ 
                error: 'Datos inválidos',
                detalles: errores
            });
        }
        
        res.status(500).json({ 
            error: 'Error interno del servidor',
            mensaje: 'Por favor intente nuevamente'
        });
    }
});

// ===========================================
// NUEVA RUTA PARA CARGA MASIVA
// ===========================================

app.post('/registrar-lote', async (req, res) => {
    console.log('='.repeat(50));
    console.log('🚀 RUTA /registrar-lote EJECUTÁNDOSE');
    console.log('📅 Timestamp:', new Date().toISOString());
    console.log('='.repeat(50));

    const { participantes } = req.body;

    if (!participantes || !Array.isArray(participantes) || participantes.length === 0) {
        return res.status(400).json({
            error: 'Se requiere un array de participantes'
        });
    }

    console.log(`📦 Recibidos ${participantes.length} participantes para procesar`);

    // Crear directorio si no existe
    if (!fs.existsSync('qr-codes')) {
        fs.mkdirSync('qr-codes', { recursive: true });
    }

    const resultados = {
        exitosos: [],
        fallidos: [],
        total: participantes.length,
        procesados: 0
    };

    // Procesar cada participante
    for (let i = 0; i < participantes.length; i++) {
        const participante = participantes[i];
        const { numero, nombre, categoria } = participante;

        try {
            // Validaciones
            if (!numero || !nombre || !categoria) {
                throw new Error('Campos requeridos faltantes');
            }

            const numeroInt = parseInt(numero);
            if (isNaN(numeroInt) || numeroInt <= 0) {
                throw new Error('Número inválido');
            }

            // Verificar si ya existe
            const existente = await Participante.findOne({ numero: numeroInt });
            if (existente) {
                throw new Error(`Número ${numeroInt} ya registrado`);
            }

            // Crear participante
            const nuevo = new Participante({ 
                numero: numeroInt, 
                nombre: nombre.trim(), 
                categoria 
            });
            
            await nuevo.save();

            // Generar QR
            const id = nuevo._id.toString();
            const nombreArchivo = `${numeroInt}_${nombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '_')}.png`;
            const rutaCompleta = path.join('qr-codes', nombreArchivo);
            
            const datosQR = JSON.stringify({ 
                id, 
                numero: numeroInt,
                nombre, 
                categoria,
                timestamp: new Date().toISOString()
            });
            
            const qr_png = qr.image(datosQR, { 
                type: 'png',
                size: 10,
                margin: 2
            });
            
            qr_png.pipe(fs.createWriteStream(rutaCompleta));

            // Actualizar con info del QR
            nuevo.qrGenerado = true;
            nuevo.archivoQR = rutaCompleta;
            await nuevo.save();

            resultados.exitosos.push({
                numero: numeroInt,
                nombre,
                categoria,
                id,
                qrUrl: `/${rutaCompleta}`
            });

            console.log(`✅ Participante ${i + 1}/${participantes.length} registrado: ${nombre}`);

        } catch (error) {
            console.error(`❌ Error con participante ${i + 1}:`, error.message);
            
            resultados.fallidos.push({
                numero: participante.numero,
                nombre: participante.nombre,
                categoria: participante.categoria,
                error: error.message,
                posicion: i + 1
            });
        }

        resultados.procesados++;
    }

    console.log('📊 Resumen del procesamiento:', {
        total: resultados.total,
        exitosos: resultados.exitosos.length,
        fallidos: resultados.fallidos.length
    });

    res.json({
        success: true,
        mensaje: `Procesamiento completado: ${resultados.exitosos.length} exitosos, ${resultados.fallidos.length} fallidos`,
        resultados
    });
});

// Función auxiliar: Calcular estadísticas de completados
function calcularEstadisticasCompletados(tiemposCompletados) {
    if (tiemposCompletados.length === 0) {
        return {
            totalCompletados: 0,
            tiempoPromedio: null,
            mejorTiempo: null,
            peorTiempo: null,
            categorias: {}
        };
    }
    
    const tiempos = tiemposCompletados.map(t => t.tiempoTotal);
    const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    const mejor = Math.min(...tiempos);
    const peor = Math.max(...tiempos);
    
    // Estadísticas por categoría
    const categorias = {};
    tiemposCompletados.forEach(t => {
        if (!categorias[t.categoria]) {
            categorias[t.categoria] = {
                total: 0,
                tiempos: []
            };
        }
        categorias[t.categoria].total++;
        categorias[t.categoria].tiempos.push(t.tiempoTotal);
    });
    
    // Calcular promedio por categoría
    Object.keys(categorias).forEach(cat => {
        const tiemposCat = categorias[cat].tiempos;
        const promedioCat = tiemposCat.reduce((a, b) => a + b, 0) / tiemposCat.length;
        categorias[cat].tiempoPromedio = formatearDuracionServer(promedioCat);
    });
    
    return {
        totalCompletados: tiemposCompletados.length,
        tiempoPromedio: formatearDuracionServer(promedio),
        mejorTiempo: formatearDuracionServer(mejor),
        peorTiempo: formatearDuracionServer(peor),
        categorias
    };
}

// Función auxiliar para formatear duración en el servidor
function formatearDuracionServer(milisegundos) {
    if (!milisegundos || milisegundos < 0) return null;
    
    const segundos = Math.floor(milisegundos / 1000);
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;
    
    if (horas > 0) {
        return `${horas}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    } else {
        return `${minutos}:${segs.toString().padStart(2, '0')}`;
    }
}

console.log('⏱️ APIs simplificadas de tiempos completados inicializadas');
// ===== RUTAS PARA VISTA DE TIEMPOS =====

// Ruta para servir la página de tiempos
app.get('/tiempos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tiempos.html'));
});

// Alias para reportes
app.get('/reportes', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tiempos.html'));
});

// API: Obtener tiempos calculados (optimizada para consultas)
app.get('/api/tiempos-calculados', async (req, res) => {
    try {
        const { categoria, estado = 'todos', orden = 'tiempo-total', limite = 1000 } = req.query;
        
        console.log('⏱️ Calculando tiempos para consulta:', { categoria, estado, orden });
        
        // Obtener datos en paralelo
        const [llegadas, salidas, participantes] = await Promise.all([
            Llegada.find({ activo: true }).sort({ numeroLlegada: 1 }),
            Salida.find({ activo: true }).sort({ numeroSalida: 1 }),
            Participante.find({}).sort({ horaRegistro: 1 })
        ]);
        
        // Crear mapas para acceso rápido
        const llegadasMap = new Map();
        const salidasMap = new Map();
        
        llegadas.forEach(llegada => {
            llegadasMap.set(llegada.participanteId, llegada);
        });
        
        salidas.forEach(salida => {
            salidasMap.set(salida.participanteId, salida);
        });
        
        // Procesar cada participante
        let tiemposCalculados = participantes.map(participante => {
            const llegada = llegadasMap.get(participante._id.toString());
            const salida = salidasMap.get(participante._id.toString());
            
            // Determinar estado
            let estadoParticipante = 'no-iniciado';
            if (llegada && salida) estadoParticipante = 'completado';
            else if (salida && !llegada) estadoParticipante = 'en-curso';
            else if (llegada && !salida) estadoParticipante = 'llegada-sin-salida';
            
            // Calcular tiempo total
            let tiempoTotal = null;
            let tiempoTotalMs = null;
            if (llegada && salida) {
                tiempoTotalMs = new Date(llegada.horaLlegada) - new Date(salida.horaSalida);
                tiempoTotal = formatearDuracionServer(tiempoTotalMs);
            }
            
            return {
                id: participante._id.toString(),
                nombre: participante.nombre,
                categoria: participante.categoria,
                fechaRegistro: participante.horaRegistro.toISOString(),
                
                // Salida
                tieneSalida: !!salida,
                horaSalida: salida ? salida.horaSalida.toISOString() : null,
                horaSalidaFormateada: salida ? salida.horaSalida.toLocaleString('es-ES') : null,
                numeroSalida: salida ? salida.numeroSalida : null,
                
                // Llegada
                tieneLlegada: !!llegada,
                horaLlegada: llegada ? llegada.horaLlegada.toISOString() : null,
                horaLlegadaFormateada: llegada ? llegada.horaLlegada.toLocaleString('es-ES') : null,
                numeroLlegada: llegada ? llegada.numeroLlegada : null,
                posicion: llegada ? llegada.numeroLlegada : null,
                
                // Tiempo y estado
                estado: estadoParticipante,
                tiempoTotal: tiempoTotal,
                tiempoTotalMs: tiempoTotalMs
            };
        });
        
        // Aplicar filtros
        if (categoria && categoria !== 'all') {
            tiemposCalculados = tiemposCalculados.filter(t => t.categoria === categoria);
        }
        
        if (estado !== 'todos') {
            tiemposCalculados = tiemposCalculados.filter(t => {
                switch (estado) {
                    case 'completados': return t.estado === 'completado';
                    case 'en-curso': return t.estado === 'en-curso';
                    case 'no-iniciados': return t.estado === 'no-iniciado';
                    default: return true;
                }
            });
        }
        
        // Ordenar resultados
        switch (orden) {
            case 'tiempo-total':
                tiemposCalculados = tiemposCalculados
                    .filter(t => t.tiempoTotalMs !== null)
                    .sort((a, b) => a.tiempoTotalMs - b.tiempoTotalMs)
                    .concat(tiemposCalculados.filter(t => t.tiempoTotalMs === null));
                break;
                
            case 'llegada':
                tiemposCalculados.sort((a, b) => {
                    if (!a.numeroLlegada && !b.numeroLlegada) return 0;
                    if (!a.numeroLlegada) return 1;
                    if (!b.numeroLlegada) return -1;
                    return a.numeroLlegada - b.numeroLlegada;
                });
                break;
                
            case 'salida':
                tiemposCalculados.sort((a, b) => {
                    if (!a.numeroSalida && !b.numeroSalida) return 0;
                    if (!a.numeroSalida) return 1;
                    if (!b.numeroSalida) return -1;
                    return a.numeroSalida - b.numeroSalida;
                });
                break;
                
            case 'nombre':
                tiemposCalculados.sort((a, b) => a.nombre.localeCompare(b.nombre));
                break;
        }
        
        // Limitar resultados
        if (limite && limite < tiemposCalculados.length) {
            tiemposCalculados = tiemposCalculados.slice(0, parseInt(limite));
        }
        
        // Calcular estadísticas
        const stats = {
            totalParticipantes: participantes.length,
            completados: tiemposCalculados.filter(t => t.estado === 'completado').length,
            enCurso: tiemposCalculados.filter(t => t.estado === 'en-curso').length,
            noIniciados: tiemposCalculados.filter(t => t.estado === 'no-iniciado').length,
            tiempoPromedio: null
        };
        
        // Calcular tiempo promedio
        const tiemposCompletos = tiemposCalculados.filter(t => t.tiempoTotalMs !== null);
        if (tiemposCompletos.length > 0) {
            const promedio = tiemposCompletos.reduce((sum, t) => sum + t.tiempoTotalMs, 0) / tiemposCompletos.length;
            stats.tiempoPromedio = formatearDuracionServer(promedio);
        }
        
        // Podium (top 3)
        const podium = tiemposCalculados
            .filter(t => t.estado === 'completado')
            .slice(0, 3)
            .map((t, index) => ({
                posicion: index + 1,
                ...t
            }));
        
        console.log(`✅ Tiempos calculados: ${tiemposCalculados.length} resultados`);
        
        res.json({
            success: true,
            total: tiemposCalculados.length,
            filtros: { categoria, estado, orden },
            estadisticas: stats,
            podium: podium,
            tiempos: tiemposCalculados,
            fechaConsulta: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('💥 Error al calcular tiempos:', error);
        res.status(500).json({
            error: 'Error al calcular tiempos',
            detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// API: Estadísticas rápidas de la carrera
app.get('/api/estadisticas-carrera', async (req, res) => {
    try {
        console.log('📊 Generando estadísticas rápidas de carrera...');
        
        const [
            totalParticipantes,
            totalSalidas,
            totalLlegadas,
            ultimaLlegada,
            ultimaSalida
        ] = await Promise.all([
            Participante.countDocuments({}),
            Salida.countDocuments({ activo: true }),
            Llegada.countDocuments({ activo: true }),
            Llegada.findOne({ activo: true }, {}, { sort: { horaLlegada: -1 } }),
            Salida.findOne({ activo: true }, {}, { sort: { horaSalida: -1 } })
        ]);
        
        // Calcular tiempo promedio si hay suficientes datos
        let tiempoPromedio = null;
        if (totalLlegadas > 0) {
            const tiemposCompletos = await Promise.all([
                Llegada.find({ activo: true }),
                Salida.find({ activo: true })
            ]);
            
            const [llegadas, salidas] = tiemposCompletos;
            const llegadasMap = new Map(llegadas.map(l => [l.participanteId, l]));
            const salidasMap = new Map(salidas.map(s => [s.participanteId, s]));
            
            const tiempos = [];
            llegadas.forEach(llegada => {
                const salida = salidasMap.get(llegada.participanteId);
                if (salida) {
                    const tiempo = new Date(llegada.horaLlegada) - new Date(salida.horaSalida);
                    tiempos.push(tiempo);
                }
            });
            
            if (tiempos.length > 0) {
                const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
                tiempoPromedio = formatearDuracionServer(promedio);
            }
        }
        
        res.json({
            success: true,
            estadisticas: {
                totalParticipantes,
                totalSalidas,
                totalLlegadas,
                enCurso: totalSalidas - totalLlegadas,
                noIniciados: totalParticipantes - totalSalidas,
                tiempoPromedio,
                ultimaActividad: {
                    ultimaLlegada: ultimaLlegada ? {
                        nombre: ultimaLlegada.nombre,
                        hora: ultimaLlegada.horaLlegada.toLocaleString('es-ES'),
                        numero: ultimaLlegada.numeroLlegada
                    } : null,
                    ultimaSalida: ultimaSalida ? {
                        nombre: ultimaSalida.nombre,
                        hora: ultimaSalida.horaSalida.toLocaleString('es-ES'),
                        numero: ultimaSalida.numeroSalida
                    } : null
                }
            },
            fechaConsulta: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('💥 Error al generar estadísticas:', error);
        res.status(500).json({
            error: 'Error al generar estadísticas',
            detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Función auxiliar para formatear duración en el servidor
function formatearDuracionServer(milisegundos) {
    if (!milisegundos || milisegundos < 0) return null;
    
    const segundos = Math.floor(milisegundos / 1000);
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;
    
    if (horas > 0) {
        return `${horas}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    } else {
        return `${minutos}:${segs.toString().padStart(2, '0')}`;
    }
}

console.log('⏱️ APIs de tiempos y reportes inicializadas');
// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log('✅ Middleware JSON configurado correctamente');
    console.log('✅ Modelo Salida importado');
    console.log('🏃‍♂️ Servicio de registro de salidas inicializado');
});