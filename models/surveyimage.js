/* Database schema for images used for the survey*/

var mongoose = require('mongoose');

var surveyImageSchema = mongoose.Schema({
	name: { type: String },
	path: String,
	coords: [ Number ],
	direction: Number,
	buildings: [],
	temp: String
});

module.exports = mongoose.model('SurveyImage', surveyImageSchema);