const mongoose = require('mongoose');

const ParticipanteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  categoria: { type: String, required: true },
  qrUrl: { type: String },
  horaRegistro: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Participante', ParticipanteSchema);
