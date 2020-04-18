import * as functions from 'firebase-functions';
// import * as http from 'request-promise';
import * as admin from 'firebase-admin';
import * as _ from '@google-cloud/firestore';

var serviceAccount = require("../storslaget-bolaget-firebase-adminsdk-726n0-56fb6bd327.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "storslaget-bolaget.appspot.com"
});

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const getAllProducts = functions.https.onRequest(async (request, response) => {
	var bucket = admin.storage().bucket();
	var file = bucket.file("NewProducts.json")
	file.getSignedUrl({
		action: 'read',
		expires: new Date().getTime() + (1000 * 60 * 5) //5 minutes
	}).then(link => {
		console.log("LINK ", link)
		response.send(link)
	}).catch(err => {
		console.error("ERROR! ", err)

	})
	// response.json = json
	// response.end();
});

// export const populateDB = functions.https.onRequest(async (request, response) => {
// 	let db = admin.firestore();
// 	let userRatingsCollection = db.collection("User_ratings")
// 	let productRatingsCollection = db.collection("Products_ratings")
// 	await http("https://api-extern.systembolaget.se/product/v1/product", {
// 		headers: {
// 			"Ocp-Apim-Subscription-Key": functions.config().bolaget.key
// 		},
// 		json: true
// 	}, async (err, resp, json) => {
// 		console.log("Req done")
// 		if (err != null) {
// 			console.log("ERROR", err)
// 			response.status(500)
// 			response.send("ERROR" + err)
// 		} else {
// 			console.log("Got json")
// 			await json.forEach(async product => {
// 				let id = product.ProductId
// 				let userProduct = await userRatingsCollection.where("product_id", "==", id).get()
// 				if (userProduct.empty) {
// 					product.myRating = 0
// 				} else {
// 					product.myRating = userProduct.docs[0].data().rating
// 				}
// 			});
// 		}
// 	})
// })

export const test = functions.https.onRequest(async (request, response) => {
	let userID = request.query.id
	console.log(`USERID: ${userID}`)
	let db = admin.database();

	let product: any =  {
		"AlcoholPercentage": 37.5,
		"ProducerName": "Pernod Ricard",
		"SubCategory": "Vodka och Brännvin",
		"Country": "Sverige",
		"Type": "Vodka",
		"BeverageDescriptionShort": "Vodka",
		"SupplierName": "Pernod Ricard Sweden AB",
		"Volume": 700,
		"ProductNameThin": null,
		"Style": null,
		"ProductId": "1",
		"ProductNameBold": "Renat",
		"Price": 205,
		"AssortmentText": "Fast sortiment",
		"ProductNumberShort": "1",
		"Category": "Sprit"
	}

	let userRatingsCollection = db.ref("User_ratings/" + userID)
	let productRatingsCollection = db.ref("Products_ratings/" + product.ProductId)

	userRatingsCollection.once('value').then(snap => {
		
	})

	productRatingsCollection.once('value').then(snap => {

	})

	// let id = product.ProductId
	// let userProduct = await userRatingsCollection. ("product_id", "==", id).get()
	// if (userProduct.empty) {
	// 	product.myRating = 0
	// } else {
	// 	product.myRating = userProduct.docs[0].data().rating
	// }
});

export const rate = functions.https.onRequest(async (request, response) => {
	let userID = request.query.userID
	let productID = request.query.productID
	let ratingQ = request.query.rating

	if (!(userID && productID && ratingQ)){
		response.send(`MUST SEND USERID, PRODUCTID & RATING. Sent ${userID}, ${productID} & ${ratingQ}`)
		response.end()
		return
	}
	let rating: number;
	try {
		rating = parseInt(ratingQ as string)
	} catch {
		response.send(`Rating must be an integer, was "${ratingQ}"`)
		return
	}

	let db = admin.database();

	let userRating = db.ref("User_ratings/" + userID + "/" + productID)
	
	let oldUserRating = await userRating.once('value').then(snap => {
		return snap.val()
	})
	
	userRating.set({
		rating: rating
	})

	let productRating = db.ref("Products_ratings/" + productID)
	productRating.once('value').then(snap => {
		let value = snap.val()

		let update;
		if(value) { //Exists, update rating
			let oldRating = value.avgRating as number
			let numRatings = value.numRatings as number
			
			let newNumRatings = numRatings + (oldUserRating ? 0 : 1)
			let newTotal = Math.round(oldRating * numRatings) + rating
			
			if(oldUserRating) { //If has rated before, remove that value
				newTotal -= oldUserRating.rating
			}

			console.log(oldRating, numRatings, newNumRatings, Math.round(oldRating * numRatings), rating)
			console.log("oldRating", oldRating)
			console.log("numRatings", numRatings)
			console.log("newNumRatings", newNumRatings)
			console.log("Math.round(oldRating * numRatings)", Math.round(oldRating * numRatings))
			console.log("rating", rating)
			console.log("oldUserRating", oldUserRating)
			console.log("oldRating", oldRating)

			console.log("Calc new rating ", newTotal, newNumRatings, (newTotal/newNumRatings))
			let newRating = newTotal / newNumRatings
			update = {
				avgRating: newRating,
				numRatings: newNumRatings
			}
		} else { //New product, set rating
			update = {
				avgRating: rating,
				numRatings: 1
			}
		}
		console.log("Setting ", update)
		productRating.set(update).then(() => {
			response.send("Update successful")
			console.log(`${userID} rated ${productID} with ${rating}`)
		}).catch(err => {
			console.log("Could not update dbase", err)
			response.send(500)
		})
	}).catch(err => {
		console.log("Could not read dbase", err)
		userRating.set({ //Reset if can't update product db
			rating: oldUserRating.rating
		})
		response.send(501)
	})

})