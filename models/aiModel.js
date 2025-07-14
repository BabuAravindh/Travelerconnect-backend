import mongoose from 'mongoose';

const AiIntegrationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    query: { type: String, required: true },
    response: { type: String, required: true },
    responseStatus: { type: String, enum: ['success', 'error', 'timeout'], default: 'success' },
}, { timestamps: true });

const CreditHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    creditBefore: { type: Number, required: true },
    creditsUsed: { type: Number, required: true },
    creditsAfter: { type: Number, required: true },
    interactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AiIntegration', default: null },
}, { timestamps: true });

const CreditRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true });

export const CreditRequest = mongoose.model('CreditRequest', CreditRequestSchema);
export const AiIntegration = mongoose.model('AiIntegration', AiIntegrationSchema);
export const CreditHistory = mongoose.model('CreditHistory', CreditHistorySchema);
