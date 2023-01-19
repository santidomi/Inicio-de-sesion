import { model, Schema } from 'mongoose';

const MessageSchema = new Schema({
  author: {
    id: { type: String, required: true },
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    edad: { type: Number, required: true },
    alias: { type: String, required: true },
    avatar: { type: String, required: false, default: 'https://img.icons8.com/color/512/secretary-woman-skin-type-1.png' },
  },
  timestamp: { type: String, required: true },
  text: { type: String, required: true },
});

export const Mensajes = model('mensajes', MessageSchema);
