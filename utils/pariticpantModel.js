const mongoose = require('mongoose');

const ParticipanteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  categoria: { type: String, required: true },
  qrUrl: { type: String },
  horaRegistro: { type: Date, default: Date.now },
  numero: { type: String, required: true, unique: true, min: 1 },
});

ParticipanteSchema.index({ numero: 1 });
ParticipanteSchema.index({ categoria: 1 });
ParticipanteSchema.index({ fechaRegistro: -1 });

module.exports = mongoose.model('Participante', ParticipanteSchema);
