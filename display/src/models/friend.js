const mongoose = require('mongoose');
const request = require('request') ;
const path = require('path') ;
const fs = require('fs') ;
const PersonalityInsightsV3 = require('ibm-watson/personality-insights/v3');
const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1.js');
const ToneAnalyzerV3 = require('ibm-watson/tone-analyzer/v3');
const { personalityInsights_iam_apikey, naturalLanguageUnderstanding_iam_apikey,
	toneAnalyzer_iam_apikey} = require('../../credentials') ;

// New api keys are commented out and shall be replaced a few hours before submission
const personalityInsights = new PersonalityInsightsV3({
	version: '2017-10-13',
	iam_apikey: personalityInsights_iam_apikey ,
	url: "https://gateway-lon.watsonplatform.net/personality-insights/api",
	disable_ssl_verification: true,
});

const naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
	version: '2018-11-16',
	iam_apikey: naturalLanguageUnderstanding_iam_apikey ,
	url: "https://gateway-lon.watsonplatform.net/natural-language-understanding/api",
	disable_ssl_verification: true,
});

const toneAnalyzer = new ToneAnalyzerV3({
	version: '2017-09-21',
	iam_apikey: toneAnalyzer_iam_apikey ,
	url: "https://gateway-lon.watsonplatform.net/tone-analyzer/api",
	disable_ssl_verification: true,
});

const friendSchema = new mongoose.Schema({
    name : {
        type : String ,
        required : true
    },
	owner: {
		type: mongoose.Schema.Types.ObjectId,
		required: true,
		ref: 'user',
	},
    usernames : {
        type : Map,
        of : String
    },
	affinity : {
    	type : Number
	},
	category : {
    	type : String
	},
	common_interests : [{
			type : String
	}]
});

friendSchema.pre('save', function (next) {
	const friend = this ;
	if (!fs.existsSync(path.join(__dirname, '../../cache', ''.concat(friend._id, '-personality.json')))) {
		const post = {
			json: {
				'usernames': JSON.parse(JSON.stringify(friend.usernames)),
				'id': friend.id
			},
		};

		function doRequest() {
			return new Promise(function (resolve, reject) {
				request.post(process.env.FLASK_URL, post, function (error, res, body) {
					if (!error && (body.split(' ').length > 100)) {
						resolve(body);
					} else if (error) {
						reject(error);
					} else {
						reject("Not sufficient data to analyze")
					}
				});
			});
		}
		doRequest().then(async body=>{
			var data = body ;
			fs.writeFile(path.join(__dirname, '../../cache', ''.concat(friend._id, '.txt')), body, (err) => {
					if (err) throw Error(err.message)
				});

			await personalityInsights.profile({
				content: data.toString(),
				content_type: 'text/plain',
				consumption_preferences: true,
				raw_scores: true,
			}).then(profile => {
				fs.writeFile(path.join(__dirname, '../../cache', ''.concat(friend._id, '-personality.json')), JSON.stringify(profile), (err) => {
					if (err) throw Error(err.message)
				});
			}).catch(err => {
				console.log(err)
				throw Error(err.message)
			});
		console.log("after personality")

			await naturalLanguageUnderstanding.analyze({
				'text': data.toString(),
				'features': {
					'categories': {
						'limit': 10
					},
				}
			}).then(analysisResults => {
				fs.writeFile(path.join(__dirname, '../../cache', ''.concat(friend._id, '-nlu.json')), JSON.stringify(analysisResults), (err) => {
					if (err) throw Error(err.message)
				});
			})
			.catch(err => {
				console.log(err)
				throw Error(err.message)
			});

		console.log("after nlu")

			await toneAnalyzer.tone({
				tone_input: {
					'text': data.toString(),
				},
				content_type: 'text/plain',
				sentences: false,
			}).then(toneAnalysis => {
				fs.writeFile(path.join(__dirname, '../../cache', ''.concat(friend._id, '-tone.json')), JSON.stringify(toneAnalysis), (err) => {
					if (err) throw Error(err.message)
				});
			}).catch(err => {
				console.log(err)
				throw Error(err.message)
			});


			next()
		}).catch(err=>{
			console.log(err)
			throw Error(err.message)
		});

		console.log("after tone")
	} else
		next();
});

const Friend = mongoose.model('Friend', friendSchema);

module.exports = Friend ;