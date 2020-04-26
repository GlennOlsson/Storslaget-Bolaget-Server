import * as functions from "firebase-functions";
import * as http from "request-promise";
import * as admin from "firebase-admin";
import * as _ from "@google-cloud/firestore";

var serviceAccount = require("../storslaget-bolaget-firebase-adminsdk-726n0-56fb6bd327.json");
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	storageBucket: "storslaget-bolaget.appspot.com",
	databaseURL: "https://storslaget-bolaget.firebaseio.com/"
});

// admin.initializeApp();

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const getAllProducts = functions.https.onRequest(
	async (request, response) => {
		var bucket = admin.storage().bucket();
		var file = bucket.file("NewProducts.json");
		await file.getSignedUrl({
			action: "read",
			expires: new Date().getTime() + 1000 * 60 * 5, //5 minutes
		});

		// response.json = json
		// response.end();
	}
);

export const populateDB = functions.https.onRequest(
	async (request, response) => {
		let userID = request.query.user as string;

		if (!userID) {
			response.send(`Bad userid, was ${userID}`);
			return;
		}

		let db = admin.database();
		await http(
			"https://firebasestorage.googleapis.com/v0/b/storslaget-bolaget.appspot.com/o/NewProducts.json?alt=media&token=413567b1-890a-4273-a265-b306ae0ecd86",
			{
				headers: {
					"Ocp-Apim-Subscription-Key": functions.config().bolaget.key,
				},
				json: true,
			},
			(err, resp, json) => {
				if (err != null) {
					response.status(500);
					response.send("ERROR" + err);
				} else {
					Promise.all(json.map(async (product: any) => {
						let productID = product.ProductId;
						// console.log("Doing ", productID)
						var p1 = db.ref(getUserRatingPart(userID, productID))
							.once("value")
							.then((snap) => {
								var rating = snap.val();
								product.myRating = rating ? rating.rating : 0; //if exists, else 0
							});
						var p2 = db.ref(getProductRatingPart(productID))
							.once("value")
							.then((snap) => {
								var rating = snap.val();
								product.avgRating = rating
									? rating.avgRating
									: 0; //if exists, else 0
							})
							.catch((err) => {
								console.log("err? ", err);
							});
							// console.log("Done ", productID)
						
						await Promise.all([p1, p2]);
					})).then(() => {
						response.send(JSON.stringify(json))
					})
				}
			}
		);
	}
);

export const test = functions.https.onRequest(async (request, response) => {
	let userID = request.query.id as string;
	console.log(`USERID: ${userID}`);
	let db = admin.database();

	let product: any = {
		AlcoholPercentage: 37.5,
		ProducerName: "Pernod Ricard",
		SubCategory: "Vodka och Brännvin",
		Country: "Sverige",
		Type: "Vodka",
		BeverageDescriptionShort: "Vodka",
		SupplierName: "Pernod Ricard Sweden AB",
		Volume: 700,
		ProductNameThin: null,
		Style: null,
		ProductId: "1",
		ProductNameBold: "Renat",
		Price: 205,
		AssortmentText: "Fast sortiment",
		ProductNumberShort: "1",
		Category: "Sprit",
	};

	let productID = product.ProductId;

	var p1 = db
		.ref(getUserRatingPart(userID, productID))
		.once("value")
		.then((snap) => {
			var rating = snap.val();
			product.myRating = rating ? rating.rating : 0; //if exists, else 0
		});
	var p2 = db
		.ref(getProductRatingPart(productID))
		.once("value")
		.then((snap) => {
			var rating = snap.val();
			product.avgRating = rating ? rating.avgRating : 0; //if exists, else 0
		})
		.catch((err) => {
			console.log("err? ", err);
		});

	Promise.all([p1, p2]).then(() => {
		response.send(JSON.stringify(product));
	});
});

export const rate = functions.https.onRequest(async (request, response) => {
	let userIDQ = request.query.userID;
	let productIDQ = request.query.productID;
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
		userID = productIDQ as string;
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

				console.log(
					oldRating,
					numRatings,
					newNumRatings,
					Math.round(oldRating * numRatings),
					rating
				);
				console.log("oldRating", oldRating);
				console.log("numRatings", numRatings);
				console.log("newNumRatings", newNumRatings);
				console.log(
					"Math.round(oldRating * numRatings)",
					Math.round(oldRating * numRatings)
				);
				console.log("rating", rating);
				console.log("oldUserRating", oldUserRating);
				console.log("oldRating", oldRating);

				console.log(
					"Calc new rating ",
					newTotal,
					newNumRatings,
					newTotal / newNumRatings
				);
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
			console.log("Setting ", update);
			productRating
				.set(update)
				.then(() => {
					response.send("Update successful");
					console.log(`${userID} rated ${productID} with ${rating}`);
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
