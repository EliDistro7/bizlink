const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true }, // the raw refresh token (or its hash)
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now, expires: 0 }, // TTL driven by expiresAt below
});

// MongoDB TTL index — auto-deletes expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);