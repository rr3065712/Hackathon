const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, default: 'Other' },
    priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Low' },
    status: { type: String, enum: ['Pending', 'In Progress', 'Resolved'], default: 'Pending' },
    location: {
        lat: { type: Number },
        lng: { type: Number }
    },
    imageUrl: { type: String },
    adminComment: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Complaint', ComplaintSchema);
