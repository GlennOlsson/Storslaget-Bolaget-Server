import * as functions from "firebase-functions";
import * as http from "request-promise";
import * as admin from "firebase-admin";
import * as _ from "@google-cloud/firestore";

var serviceAccount = require("../storslaget-bolaget-firebase-adminsdk-726n0-56fb6bd327.json");
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	storageBucket: "storslaget-bolaget.appspot.com",
	databaseURL: "https://storslaget-bolaget.firebaseio.com/",
});

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const getAllProductsURL = functions.https.onRequest(
	async (request, response) => {
		var bucket = admin.storage().bucket();
		var file = bucket.file("NewProducts.json");
		var url = await file.getSignedUrl({
			action: "read",
			expires: new Date().getTime() + 1000 * 60 * 5, //5 minutes
		});

		response.send(url[0]);
	}
);

export const populateJSON = functions.https.onRequest(
	async (request, response) => {
		let db = admin.database();

		var bucket = admin.storage().bucket();
		var file = bucket.file("NewProducts.json");
		var url = await file.getSignedUrl({
			action: "read",
			expires: new Date().getTime() + 1000 * 60 * 5, //5 minutes
		});
		
		http(url[0], {
			json: true
		}, (err, resp, json) => {
			Promise.all(json.map(async (product: any) => {
				const productID = product.ProductId;
				await db
				.ref(getProductRatingPart(productID))
				.once("value")
				.then((snap) => {
					var rating = snap.val();
					product.avgRating = rating ? rating.avgRating : 0; //if exists, else 0
					product.numRatings = rating ? rating.numRatings : 0
				})
				.catch((err) => {
					console.log("err with product map; ", err);
				});
				return product
			})).then(() => {
				file.save(JSON.stringify(json)).then(() => {
					response.send("Done");
				}).catch(err => {
					console.log("ERROR with saving file ", err)
					response.status(500);
					response.send("Error " + err)
				});
			})
		});
	}
);

export const getMyRating = functions.https.onRequest(
	async (request, response) => {
		const params = request.query;
		const userIDQ = params.user;
		const productIDQ = params.product;

		if (!userIDQ || !(userIDQ as string)) {
			response.status(400);
			response.send("user query must be specified, was " + userIDQ);
			return;
		}
		if (!productIDQ || !(productIDQ as string)) {
			response.status(400);
			response.send("product query must be specified, was " + productIDQ);
			return;
		}

		const userID = userIDQ as string;
		const productID = productIDQ as string;

		let db = admin.database();
		await db
			.ref(getUserRatingPart(userID, productID))
			.once("value")
			.then((snap) => {
				const val = snap.val();
				response.status(200);
				if (val && val.rating) {
					response.send("" + val.rating);
				} else {
					response.send("0");
				}
				return;
			})
			.catch((err) => {
				console.log("Error with db ", err);
				response.status(500);
				response.send("ERROR; " + err);
			});
	}
);

export const rate = functions.https.onRequest(async (request, response) => {
	let userIDQ = request.query.user;
	let productIDQ = request.query.product;
	let ratingQ = request.query.rating;

	if (!(userIDQ && productIDQ && ratingQ)) {
		response.send(
			`MUST SEND USERID, PRODUCTID & RATING. Sent ${userIDQ}, ${productIDQ} & ${ratingQ}`
		);
		response.end();
		return;
	}
	let rating: number;
	let productID: string;
	let userID: string;
	try {
		rating = parseInt(ratingQ as string);
		productID = productIDQ as string;
		userID = userIDQ as string;
	} catch {
		response.send(
			`Bad data types. UserID and ProductID must be string and rating must be an integer. Where "${userIDQ}" "${productIDQ}" "${ratingQ}"`
		);
		return;
	}

	let db = admin.database();

	let userRating = db.ref(getUserRatingPart(userID, productID));

	let oldUserRating = await userRating.once("value").then((snap) => {
		return snap.val();
	});

	userRating.set({
		rating: rating,
	});

	let productRating = db.ref(getProductRatingPart(productID));
	productRating
		.once("value")
		.then((snap) => {
			let value = snap.val();

			let update;
			if (value) {
				//Exists, update rating
				let oldRating = value.avgRating as number;
				let numRatings = value.numRatings as number;

				let newNumRatings = numRatings + (oldUserRating ? 0 : 1);
				let newTotal = Math.round(oldRating * numRatings) + rating;

				if (oldUserRating) {
					//If has rated before, remove that value
					newTotal -= oldUserRating.rating;
				}

				let newRating = newTotal / newNumRatings;
				update = {
					avgRating: newRating,
					numRatings: newNumRatings,
				};
			} else {
				//New product, set rating
				update = {
					avgRating: rating,
					numRatings: 1,
				};
			}

			productRating
				.set(update)
				.then(() => {
					// http("https://us-central1-storslaget-bolaget.cloudfunctions.net/storslaget-bolaget/us-central1/populateJSON");
					// http("http://localhost:5001/storslaget-bolaget/us-central1/populateJSON");

					console.log(`${userID} rated ${productID} with ${rating}`);
					response.send("Update successful");
				})
				.catch((err) => {
					console.log("Could not update dbase", err);
					response.send(500);
				});
		})
		.catch((err) => {
			console.log("Could not read dbase", err);
			userRating.set({
				//Reset if can't update product db
				rating: oldUserRating.rating,
			});
			response.send(501);
		});
});

function getProductRatingPart(productID: string): string {
	return "Products_ratings/" + productID;
}

function getUserRatingPart(userID: string, productID: string): string {
	return "User_ratings/" + userID + "/" + productID;
}
