import * as functions from 'firebase-functions';
import * as http from 'request-promise';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const  getAllProducts = functions.https.onRequest(async (request, response) => {
	const apiKey = functions.config().bolaget.key;
	const url = "https://api-extern.systembolaget.se/product/v1/product"
	
	const json = await http({
		url: url,
		headers: {
			"Ocp-Apim-Subscription-Key": apiKey
		}
	}, (err, meta) => {
		// console.log(error)
		// console.log(meta.toJSON())
		// return meta.toJSON()
		// console.log(body)
		console.log("DONE", err)
		response.send(meta.body)
	}).then(res => {
		console.log("IN THEN", res)
	})
	console.log("FROM REQ; ", json)
	// response.json = json
	// response.end();
});
