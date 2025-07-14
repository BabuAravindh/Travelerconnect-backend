import mongoose from 'mongoose';

const AiChat = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    query: {
        type: String,
        required: true,
        trim: true
    },
    response: {
        type: String,
        required: true
    },
    responseStatus: {
        type: String,
        enum: ['success', 'error', 'timeout'],
        default: 'success'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

export default mongoose.model('Aichat', AiChat);