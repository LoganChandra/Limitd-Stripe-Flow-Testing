if (process.env.NODE_ENV !== 'production') {
	require('dotenv').load()
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripePublicKey = process.env.STRIPE_PUBLIC_KEY

const {
	raw
} = require('express')
const express = require('express')
const app = express()
const fs = require('fs')
const stripe = require('stripe')(stripeSecretKey)

app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.static('public'))

app.get("/stripe-key", (req, res) => {
	res.send({
		publicKey: process.env.STRIPE_PUBLIC_KEY
	});
});

//rendering pages
app.get('/store', function(req, res) {
	fs.readFile('items.json', function(error, data) {
		if (error) {
			res.status(500).end()
		} else {
			res.render('store.ejs', {
				stripePublicKey: stripePublicKey,
				items: JSON.parse(data)
			})
		}
	})
})
app.get('/login', function(req, res) {
	res.render('login.ejs', {
		// stripePublicKey: stripePublicKey,
		// items: JSON.parse(data)
	})
	console.log(req)
})

app.get('/sell', function(req, res) {
	res.render('sell.ejs', {
		// stripePublicKey: stripePublicKey,
		// items: JSON.parse(data)
	})
	console.log(req)
})

//signing up customer
app.post('/signUp', function(req, res) {
	let userData = req.body.user
	let token = req.body.token
	console.log(userData, token)


  /* -------------------------- Testing for connected account -------------------------- */
	//Creating Account
	// const account = stripe.accounts.create({
	//   type: 'standard',
	//   country: 'MY',
	//   email: userData.email,
	//   business_type: 'individual',
	//   individual: {
	//     first_name: userData.firstName,
	//     last_name: userData.lastName,
	//   }
	// }).then(function(response) {
	//     console.log('Account:',response)

  console.log('Token: ', token)
  //creating customer
	const customer = stripe.customers.create({
		description: userData.firstName + ' - Customer',
		name: userData.firstName + ' ' + userData.lastName,
		email: userData.email,
		source: token,
		// }, {
		//   stripe_account: response.id,
	}).then(function(custRes) {

		console.log('Customer: ')
		console.log(custRes)

		userData['id'] = custRes.id //saving customer id
		console.log(userData)

		let writedata = JSON.stringify(userData);
		fs.writeFileSync('users.json', writedata);//saving to "database"

	}).catch(function(error) {
		console.log('Customer not created')

	})
	console.log('Sign in Successful')

	// }).catch(function() {
	//     console.log('Sign In Fail')
	//     res.status(500).end()
	// })


})

app.post('/forSale', function(req, res) {

	console.log('Selling shoe')
	let userData = req.body
	var loggedIn = JSON.parse(fs.readFileSync('users.json', 'utf8')); //reading logged in customer
  var itemData = JSON.parse(fs.readFileSync('items.json', 'utf8'));

  /*-------------------------------- creating payment intent when customer sells --------------------------------*/

    var itemSold = {
      id: uuidv4(),
      name: userData.name,
      price: parseInt(userData.price, 10),
      size: parseInt(userData.size, 10),
      bidPrice: parseInt(userData.bidPrice, 10),
      imgName: userData.imgName,
      seller: loggedIn.id
    }

    itemData['merch'].push(itemSold)
    let writedata = JSON.stringify(itemData);
    console.log('write data: ', itemSold)
    fs.writeFileSync('items.json', writedata);
    
    res.end('Item for sale');
    
    /*-------------------------------- creating payment intent when customer sells --------------------------------*/
		// let intent
		// try {
		// 	intent = stripe.paymentIntents.create({
		// 		amount: 1500,
		// 		currency: 'myr',
		// 		confirmation_method: "manual",
		// 		capture_method: "manual",
		// 		confirm: true,
		// 		customer: loggedIn.id,
		// 	}).then(function(paymentIntent) {
		// 		// intent = stripe.paymentIntents.confirm(paymentIntent.id);
    //     console.log('Payment Intent created')

    //     //Saving to database
    //     var itemData = JSON.parse(fs.readFileSync('items.json', 'utf8'));
    //     var itemSold = {
    //       id: uuidv4(),
    //       name: userData.name,
    //       price: parseInt(userData.price, 10),
    //       size: parseInt(userData.size, 10),
    //       bidPrice: parseInt(userData.bidPrice, 10),
    //       imgName: userData.imgName,
    //       seller: loggedIn.id
    //     }

    //     itemData['merch'].push(itemSold)
    //     let writedata = JSON.stringify(itemData);
    //     console.log('write data: ', itemSold)
    //     fs.writeFileSync('items.json', writedata);
    //     //end of saving to database
		// 	})

		// } catch (e) {
		// 	console.log('failed to sell')
		// 	console.log(e)
    // }
    // res.end('item for sale and payment intent created');
    
})

//create penalty for customer
async function createPenalty(custId, price, perc) {

	const intent = await stripe.paymentIntents.create({
		amount: price * perc,
		currency: 'myr',
		confirmation_method: "manual",//we want to choose when to confirm (on dashboard)
		capture_method: "manual",//we want to choose when to capture
		confirm: true,
		customer: custId,
	}).then(function(paymentIntent) {
		console.log('Payment Intent created for: ', custId)
	})

	return intent
}

app.post('/purchase', function(req, res) {
	console.log('item', req.body.items)

	fs.readFile('items.json', function(error, data) {//reading "database"
		if (error) {
			res.status(500).end()
		} else {
			const itemsJson = JSON.parse(data)
			const itemsArray = itemsJson.music.concat(itemsJson.merch)//getting array of abjects from "database"
			let total = 0

      for (const item of req.body.items) {
				console.log(item)
				const itemJson = itemsArray.find(function(i) {
					return i.id == item.id
				})
				console.log('itemJson', itemJson)
				createPenalty(itemJson.seller, itemJson.price, 0.15) //penalty is in decimal
				total = total + itemJson.price * item.quantity
      }
      
			stripe.charges.create({
				amount: total,
				source: req.body.stripeTokenId,
				currency: 'usd'
			}).then(function() {
				console.log('Charge Successful')
				res.json({
					message: 'Successfully purchased items'
				})
			}).catch(function() {
				console.log('Charge Fail')
				res.status(500).end()
			})
		}
	})
})

//creates unique id
function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random() * 16 | 0,
			v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

  /* --------------------------------------------- TESTING --------------------------------------------- */

app.post("/forSale1", function(req, res) {
	const {
		paymentMethodId,
		paymentIntentId,
		items,
		currency
	} = req.body.oD;
	const info = req.body
	console.log('info: ', info)
	const orderAmount = 1500;
	var loggedIn = JSON.parse(fs.readFileSync('users.json', 'utf8')); //reading logged in customer
	console.log('CREATING PENALTY ON BEHALF OF: ', paymentMethodId)
	console.log('pm: ', loggedIn)

	try {
		let intent;
		if (!paymentIntentId) {
			console.log('customer:', typeof(loggedIn.id))

			const customer = stripe.customers.retrieve(
				loggedIn.id
			);
			console.log('customer:', customer)
			// Create new PaymentIntent
			intent = stripe.paymentIntents.create({
				amount: orderAmount,
				currency: currency,
				// payment_method: paymentMethodId,
				confirmation_method: "manual",
				capture_method: "manual",
				confirm: true,
				customer: loggedIn.id,
				// }, {
				//   stripe_account: loggedIn.acctId,
			})

			var itemData = JSON.parse(fs.readFileSync('items.json', 'utf8'));
			var itemSold = {
				id: uuidv4(),
				name: req.body.name,
				price: parseInt(req.body.price, 10),
				size: parseInt(req.body.size, 10),
				bidPrice: parseInt(req.body.bidPrice, 10),
				imgName: req.body.imgName,
				seller: loggedIn.id
			}

			itemData['merch'].push(itemSold)
			let writedata = JSON.stringify(itemData);
			console.log('write data: ', itemSold)
			fs.writeFileSync('items.json', writedata);


			console.log(intent)
		} else {
			// Confirm the PaymentIntent to place a hold on the card
			intent = stripe.paymentIntents.confirm(paymentIntentId);
			// console.log(intent)

		}

		if (intent.status === "requires_capture") {
			console.log("❗ Charging the card for: " + intent.amount_capturable);

			intent = stripe.paymentIntents.capture(intent.id);
		}


		const response = generateResponse(intent);
		res.send(response);
	} catch (e) {
		// Handle "hard declines" e.g. insufficient funds, expired card, etc
		// See https://stripe.com/docs/declines/codes for more
		res.send({
			error: e.message
		});
	}
});

const generateResponse = intent => {
	// Generate a response based on the intent's status
	switch (intent.status) {
		case "requires_action":
		case "requires_source_action":
			// Card requires authentication
			return {
				requiresAction: true,
					paymentIntentId: intent.id,
					clientSecret: intent.client_secret
			};
		case "requires_payment_method":
		case "requires_source":
			// Card was not properly authenticated, suggest a new payment method
			return {
				error: "Your card was denied, please provide a new payment method"
			};
		case "succeeded":
			// Payment is complete, authentication not required
			// To cancel the payment after capture you will need to issue a Refund (https://stripe.com/docs/api/refunds)
			console.log("💰 Payment received!");
			return {
				clientSecret: intent.client_secret
			};
	}
};

app.listen(3000)