const express = require('express');
const qr = require('qr-image');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/qr-codes', express.static('qr-codes'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/registrar', (req, res) => {
    const { nombre, categoria } = req.body;

    if (!nombre || !categoria) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (!fs.existsSync('qr-codes')) {
        fs.mkdirSync('qr-codes');
    }

    const id = Date.now();
    const filename = `qr-codes/${id}_${nombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '_')}.png`;
    
    try {
        const datosQR = JSON.stringify({ id, nombre, categoria });
        const qr_png = qr.image(datosQR, { type: 'png' });
        qr_png.pipe(fs.createWriteStream(filename));

        res.json({
            success: true,
            mensaje: 'Participante registrado',
            qrUrl: filename,
            id,
            nombre,
            categoria
        });
    } catch (error) {
        console.error('Error al generar QR:', error);
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

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log('Usa ngrok para exponerlo públicamente: ngrok http 3000');
});