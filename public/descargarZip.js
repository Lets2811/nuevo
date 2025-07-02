const express = require('express');
const fetch = require('node-fetch');
const archiver = require('archiver');

const router = express.Router();

router.post('/', async (req, res) => {
    const qrList = req.body.qrs;

    if (!Array.isArray(qrList) || qrList.length === 0) {
        return res.status(400).json({ error: 'Lista de QR inválida o vacía' });
    }

    res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="qrs.zip"',
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const { nombre, qrUrl } of qrList) {
        try {
            const response = await fetch(qrUrl);
            if (!response.ok) continue;
            const buffer = await response.buffer();
            const safeName = `QR_${nombre.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
            archive.append(buffer, { name: safeName });
        } catch (err) {
            console.error(`Error con ${nombre}:`, err.message);
        }
    }

    archive.finalize();
});

module.exports = router;
