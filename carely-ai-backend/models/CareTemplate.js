import mongoose from 'mongoose';

const CareTemplateSchema = new mongoose.Schema({
  templateName: { type: String, required: true },
  conditionKeywords: [String],
  questions: [
    {
      id: String,
      category: String,
      questionText: String,
      questionDescription: String,
      options: [
        {
          text: String,
          symptom: String,
          triggersAlert: Boolean
        }
      ]
    }
  ]
});

export default mongoose.model('CareTemplate', CareTemplateSchema);
