const mongoose = require('mongoose');

const LlegadaSchema = new mongoose.Schema({
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
  horaLlegada: { 
    type: Date, 
    required: true,
    default: Date.now 
  },
  horaRegistro: { 
    type: Date, 
    default: Date.now 
  },
  numeroLlegada: {
    type: Number,
    default: 0
  },
  timestampPrecision: {
    type: Number, // performance.now() para mayor precisión
    default: 0
  },
  activo: {
    type: Boolean,
    default: true
  }
});

// Índice compuesto para evitar duplicados
LlegadaSchema.index({ participanteId: 1, activo: 1 }, { unique: true });

module.exports = mongoose.model('Llegada', LlegadaSchema);