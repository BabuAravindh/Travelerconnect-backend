
import Feedback from "../models/feedbackModel.js";


export const getFeedbackForGuide = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 5 } = req.query;

        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const feedback = await Feedback.find({ guideId: id })
            .populate("userId", "name")
            .sort({ submittedAt: -1 })
            .skip(skip)
            .limit(limitNumber);

        const totalFeedback = await Feedback.countDocuments({ guideId: id });
        const totalPages = Math.ceil(totalFeedback / limitNumber);

        res.status(200).json({
            totalFeedback,
            totalPages,
            currentPage: pageNumber,
            pageSize: feedback.length,
            feedback,
        });

    } catch (error) {
        res.status(500).json({ message: "Error fetching feedback", error: error.message });
    }
};




export const createFeedback = async (req, res) => {
  try {
    const {userId, guideId, rating, comments } = req.body;

    const feedback = new Feedback({
      userId,
      guideId,
      rating,
      comments,
      status: "submitted",
    });

    await feedback.save();
    res.status(201).json({ message: "Feedback submitted successfully", feedback });
  } catch (error) {
    res.status(500).json({ message: "Error submitting feedback", error });
  }
};


export const deleteFeedback = async (req,res) => {
    try {
        const {id} =req.params
        const deleteFeedback = await Feedback.findByIdAndDelete(id)
        if(!deleteFeedback){
            return res.status(404).json({message:"feedback not found"})
        }
        res.status(200).json({message:"feedback deleted successfully",error:error.message})
    } catch (error) {
        res.status(404).json({error:error.message})
    }
}



//admin controllers
export const getAllFeedback = async (req, res) => {
    try {
        const { status, guideId, userId, sort, page = 1, limit = 10 } = req.query;
        
        const query = {};
        if (status) query.status = status;
        if (guideId) query.guideId = guideId;
        if (userId) query.userId = userId;

        const sortOptions = {};
        if (sort === 'newest') sortOptions.submittedAt = -1;
        if (sort === 'oldest') sortOptions.submittedAt = 1;
        if (sort === 'highest') sortOptions.rating = -1;
        if (sort === 'lowest') sortOptions.rating = 1;

        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const feedback = await Feedback.find(query)
            .populate({
                path: 'userId',
                select: 'name email', // Regular user details
                model: 'User'
            })
            .populate({
                path: 'guideId',
                select: 'name email', // Since guide is also a User, we get their name
                model: 'User' // Important: Now pointing to User model
            })
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNumber);

        const totalFeedback = await Feedback.countDocuments(query);
        const totalPages = Math.ceil(totalFeedback / limitNumber);

        res.status(200).json({
            totalFeedback,
            totalPages,
            currentPage: pageNumber,
            feedback,
        });

    } catch (error) {
        res.status(500).json({ 
            message: "Error fetching feedback", 
            error: error.message 
        });
    }
};
export const adminDeleteFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedFeedback = await Feedback.findByIdAndDelete(id);

        if (!deletedFeedback) {
            return res.status(404).json({ 
                message: "Feedback not found" 
            });
        }

        res.status(200).json({ 
            message: "Feedback deleted by admin successfully" 
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Error deleting feedback", 
            error: error.message 
        });
    }
}
// Admin: Get feedback statistics
export const getFeedbackStats = async (req, res) => {
    try {
        const totalFeedback = await Feedback.countDocuments();
        const approvedFeedback = await Feedback.countDocuments({ status: 'approved' });
        const rejectedFeedback = await Feedback.countDocuments({ status: 'rejected' });
        const pendingFeedback = await Feedback.countDocuments({ status: 'submitted' });

        // Average rating calculation
        const ratingStats = await Feedback.aggregate([
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: "$rating" },
                    maxRating: { $max: "$rating" },
                    minRating: { $min: "$rating" },
                    count: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            totalFeedback,
            approvedFeedback,
            rejectedFeedback,
            pendingFeedback,
            ratingStats: ratingStats[0] || {}
        });

    } catch (error) {
        res.status(500).json({ message: "Error fetching feedback stats", error: error.message });
    }
};