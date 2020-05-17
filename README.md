# Server functions for Storslaget Bolaget app

## HTTP Protocol

### getAllProductsURL, GET
Get an url of all the products
#### Request

#### Response
Returns a temporary url of the product
```
URL
```

### populateJSON, GET
Populates file in store with the database entries
#### Request
#### Response
Done if all OK

### getMyRating, GET
Get rating of a user
#### Request
Query params: 
- user: USER ID (STRING)
- product: PRODUCT ID (STRING)

#### Response
```
THE RATING (INT)
```

### rate, GET
Rate a product, updates DB
#### Request
Query params: 
- user: USER ID (STRING)
- product: PRODUCT ID (STRING)
- rating: RATING (INT)

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

### Products
**product_id (String)**\
avgRating (Float)\
numRatings (Integer)
