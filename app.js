const express = require('express');
const qr = require('qr-image');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const connectDB = require('./utils/db');
const Participante = require('./utils/pariticpantModel');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/qr-codes', express.static('qr-codes'));

connectDB();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/registrar', async (req, res) => {
    // 🔥 LOGS DE DEBUGGING - AGREGAR ESTAS LÍNEAS
    console.log('='.repeat(50));
    console.log('🚀 RUTA /registrar EJECUTÁNDOSE');
    console.log('📅 Timestamp:', new Date().toISOString());
    console.log('📦 Body recibido:', req.body);
    console.log('🔧 Headers:', req.headers);
    console.log('='.repeat(50));

    const { nombre, categoria } = req.body;

    if (!nombre || !categoria) {
        console.log('❌ Faltan campos requeridos');
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (!fs.existsSync('qr-codes')) {
        fs.mkdirSync('qr-codes');
        console.log('📁 Directorio qr-codes creado');
    }

    const nuevo = new Participante({ nombre, categoria });
    await nuevo.save();

    const id = nuevo._id.toString();
    const filename = `qr-codes/${id}_${nombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '_')}.png`;
    
    try {
        const datosQR = JSON.stringify({ id, nombre, categoria });
        const qr_png = qr.image(datosQR, { type: 'png' });
        qr_png.pipe(fs.createWriteStream(filename));

        console.log('✅ Nuevo participante registrado:', nuevo);
        console.log('📁 QR generado en:', filename);
        
        const response = {
            success: true,
            mensaje: 'Participante registrado',
            qrUrl: filename,
            id,
            nombre,
            categoria,
        };

        console.log('📤 Respuesta enviada:', response);
        res.json(response);
    } catch (error) {
        console.error('💥 Error al generar QR:', error);
        res.status(500).json({ error: 'Error al generar QR' });
    }
});

// Agrega esta ruta antes de app.listen()
app.get('/escaneo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'escaneo.html'));
});

// Ruta para buscar participantes por ID (GET)
app.get('/participante/:id', (req, res) => {
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

    fs.readdir('qr-codes', (err, files) => {
        if (err) {
            console.error('Error al leer directorio qr-codes:', err);
            return res.status(500).json({ error: 'Error del servidor' });
        }

        // Buscar archivo que comience con el ID (numérico)
        const archivoQR = files.find(file => {
            const fileId = file.split('_')[0];
            return fileId === id;
        });

        if (!archivoQR) {
            console.log('Archivos disponibles:', files); // Para depuración
            return res.status(404).json({ 
                error: 'Participante no encontrado',
                idBuscado: id,
                archivosDisponibles: files
            });
        }

        const nombre = archivoQR.split('_').slice(1).join('_').replace('.png', '');
        
        res.json({
            success: true,
            id,
            nombre,
            qrPath: `qr-codes/${archivoQR}`
        });
    });
});
// Agregar estas rutas a tu archivo app.js, después de la ruta /escaneo

// Ruta para servir la página de galería
app.get('/galeria', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'galeria.html'));
});

// API para obtener todos los códigos QR disponibles
app.get('/api/qr-codes', async (req, res) => {
    try {
        // Leer archivos de la carpeta qr-codes
        const qrFiles = fs.existsSync('qr-codes') ? fs.readdirSync('qr-codes') : [];
        
        // Obtener participantes de la base de datos para tener info completa
        const participantes = await Participante.find({}).sort({ horaRegistro: -1 });
        
        const qrList = qrFiles.map(filename => {
            // Extraer ID del nombre del archivo
            const fileId = filename.split('_')[0];
            
            // Extraer nombre del archivo (sin extensión)
            const nombreArchivo = filename.split('_').slice(1).join('_').replace('.png', '').replace(/_/g, ' ');
            
            // Buscar datos completos en la base de datos
            const participanteDB = participantes.find(p => p._id.toString().includes(fileId) || 
                                                      p.horaRegistro.getTime().toString() === fileId);
            
            return {
                id: fileId,
                filename: filename,
                nombre: participanteDB ? participanteDB.nombre : nombreArchivo,
                categoria: participanteDB ? participanteDB.categoria : 'No especificada',
                fechaRegistro: participanteDB ? participanteDB.horaRegistro : new Date(),
                qrPath: `qr-codes/${filename}`,
                downloadUrl: `/qr-codes/${filename}`
            };
        });

        // Ordenar por fecha de registro (más recientes primero)
        qrList.sort((a, b) => new Date(b.fechaRegistro) - new Date(a.fechaRegistro));

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

// API para descargar un QR específico con un nombre personalizado
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'qr-codes', filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    // Extraer nombre del participante para el archivo descargado
    const nombreParticipante = filename.split('_').slice(1).join('_').replace('.png', '').replace(/_/g, '_');
    const downloadName = `QR_${nombreParticipante}.png`;

    res.download(filePath, downloadName, (error) => {
        if (error) {
            console.error('Error al descargar archivo:', error);
            res.status(500).json({ error: 'Error al descargar el archivo' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});