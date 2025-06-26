const mongoose = require('mongoose');

const SalidaSchema = new mongoose.Schema({
  participanteId: { 
    type: String, 
    required: true,
    index: true 
  },
  nombre: { 
    type: String, 
    required: true 
  },
  categoria: { 
    type: String, 
    required: true 
  },
  horaSalida: { 
    type: Date, 
    required: true,
    default: Date.now 
  },
  horaRegistro: { 
    type: Date, 
    default: Date.now 
  },
  numeroSalida: {
    type: Number,
    default: 0
  },
  activo: {
    type: Boolean,
    default: true
  }
});

SalidaSchema.index({ participanteId: 1, activo: 1 }, { unique: true });

module.exports = mongoose.model('Salida', SalidaSchema);