# Lambda functions for Storslaget Bolaget app

## HTTP Protocol

### getAllProducts, GET
#### Request
Headers: 
- User: USER_ID

#### Response 
```json
[
	{
		PRODUCT,
		myRating: RATING (Integer),
		avgRating: RATING (Float)
	},
	...
]
```

### search, GET
#### Request
Headers: 
- User: USER_ID

Query:
- query: SEARCH QUERY

#### Response
```json
[
	{
		PRODUCT,
		myRating: RATING (Integer),
		avgRating: RATING (Float)
	},
	...
]
```

### rate, PUT
#### Request
Headers: 
- User: USER_ID

Query:
- id: PRODUCT ID

#### Response
Ok/Error

## HTTP Status codes
- 200: Ok
- 201: No product with ID
- 500: Server error

## Database schema
### User_ratings
product_id (String)\
user_id (String)\
rating (Integer)

### Product_ratings
**product_id (String)**\
avgRating (Float)\
numRatings (Integer)
