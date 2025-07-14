import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Language, Country, State, GuideLanguage } from '../models/predefineSchemas.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('Error connecting to MongoDB:', error));

const createDocument = async (Model, data) => {
  try {
    await Model.create(data);
    console.log(`${Model.modelName} data seeded successfully!`);
  } catch (error) {
    console.error(`Error seeding ${Model.modelName}:`, error);
  }
};

const seedData = async () => {
  try {
    

    const languages = [
      { languageName: 'Hindi', languageStatus: 'active', order: 1 },
      { languageName: 'Tamil', languageStatus: 'active', order: 2 },
      { languageName: 'Telugu', languageStatus: 'inactive', order: 3 },
      { languageName: 'Marathi', languageStatus: 'active', order: 4 },
      { languageName: 'Bengali', languageStatus: 'active', order: 5 }
    ];

    const countries = [
      { countryName: 'India', order: 1 }
    ];

    const states = [
      { stateName: 'Maharashtra', order: 1 },
      { stateName: 'Tamil Nadu', order: 2 },
      { stateName: 'West Bengal', order: 3 },
      { stateName: 'Andhra Pradesh', order: 4 },
      { stateName: 'Karnataka', order: 5 }
    ];

    const guideLanguages = [
      { userId: new mongoose.Types.ObjectId(), spokenLanguage: 'Hindi' },
      { userId: new mongoose.Types.ObjectId(), spokenLanguage: 'Tamil' },
      { userId: new mongoose.Types.ObjectId(), spokenLanguage: 'Marathi' }
    ];

    await Promise.all([
      ...languages.map(lang => createDocument(Language, lang)),
      ...countries.map(country => createDocument(Country, country)),
      ...states.map(state => createDocument(State, state)),
      ...guideLanguages.map(gl => createDocument(GuideLanguage, gl)),
    ]);

    console.log('Seeding completed successfully!');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error during seeding:', error);
    mongoose.connection.close();
  }
};

seedData();
